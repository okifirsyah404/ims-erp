import { auth } from '@providers/better-auth/auth';
import { APIError } from 'better-auth/api';
import { runWithEndpointContext } from '@better-auth/core/context';
import type { AuthEndpointContext } from '@better-auth/core/context';
import { injectable } from 'tsyringe';
import type { IUserManagementAuthGateway } from '../contracts/gateways.interface';
import {
	ClaimConflictError,
	ClaimStateError,
} from './invitation.errors';

/**
 * Synthetic endpoint context for token-authorized server-side Better Auth
 * calls (the invitation claim has no HTTP session yet). Only the pieces
 * the called endpoints touch are provided; `context.session` is absent, so
 * `requireHeaders`/admin-permission paths are never entered — the endpoints
 * used here either need no session (credential update, session creation) or
 * are replaced by internal-adapter equivalents.
 */
function claimContext(headers: Headers): AuthEndpointContext {
	return {
		headers,
		request: new Request('http://internal/claim', { headers }),
		context: {} as never,
	} as unknown as AuthEndpointContext;
}

/**
 * Better Auth implementation of {@link IUserManagementAuthGateway}. The
 * claim flow is token-authorized (no caller session), so calls run inside
 * `runWithEndpointContext` with a synthetic context; credential state is
 * written through Better Auth's internal adapter (password hashing +
 * account shape stay Better Auth-owned — same boundary rationale as the
 * user module's `deletedAt` exception).
 */
@injectable()
export class BetterAuthUserManagementGateway
	implements IUserManagementAuthGateway
{
	async claimCredentials(input: {
		userId: string;
		username: string;
		password: string;
	}): Promise<void> {
		try {
			await runWithEndpointContext(claimContext(new Headers()), async () => {
				const ctx = await auth.$context;
				// Password: hash through Better Auth's configured hasher, then
				// upsert the credential account (mirrors setUserPassword route).
				const hashed = await ctx.password.hash(input.password);
				const account = await ctx.internalAdapter.findCredentialAccount(
					input.userId,
				);
				if (account) {
					await ctx.internalAdapter.updatePassword(input.userId, hashed);
				} else {
					await ctx.internalAdapter.createAccount({
						userId: input.userId,
						providerId: 'credential',
						accountId: input.userId,
						password: hashed,
					});
				}
				// Username + display name: through the user model's update path
				// (Better Auth-owned column; uniqueness enforced by the unique
				// index and re-checked by the service before this call).
				await ctx.internalAdapter.updateUser(input.userId, {
					username: input.username,
					displayUsername: input.username,
				});
			});
		} catch (error) {
			throw translateClaimError(error);
		}
	}

	async revokeSessions(userId: string): Promise<void> {
		await auth.api.revokeUserSessions({ body: { userId } });
	}

	async createSession(
		userId: string,
		input: { password: string },
		headers: Headers,
	): Promise<{ setCookie: string | null }> {
		try {
			// Standard credential sign-in with the just-claimed password opens
			// the user's first session (option A). The claim request's own
			// headers (origin, user-agent, IP) are forwarded so CSRF/origin
			// validation passes and the session row gets real request context.
			// The email is re-read server-side; the id never comes from the
			// client.
			const user = (await runWithEndpointContext(
				claimContext(headers),
				async () => {
					const ctx = await auth.$context;
					return ctx.internalAdapter.findUserById(userId) as Promise<{
						email: string;
					} | null>;
				},
			)) as { email: string } | null;
			if (!user) throw new ClaimStateError();

			const response = await auth.api.signInEmail({
				body: { email: user.email, password: input.password },
				headers,
				asResponse: true,
			});
			const setCookie = response.headers.get('set-cookie');
			return { setCookie };
		} catch (error) {
			throw translateClaimError(error);
		}
	}

	async attachMembership(input: {
		userId: string;
		organizationId: string;
		roleName: string;
	}): Promise<string> {
		try {
			// addMember needs no session when `organizationId` is in the body
			// (orgMiddleware only; the ERP before-hook passes non-owner
			// grants). Run inside the endpoint context so the ERP hook's
			// adapter/`getSessionFromCtx` lookups resolve.
			await runWithEndpointContext(claimContext(new Headers()), () =>
				auth.api.addMember({
					body: {
						organizationId: input.organizationId,
						userId: input.userId,
						// Custom ERP roles are valid at runtime (registered via
						// `erpRoles`); cast per the organization gateway precedent.
						role: input.roleName as 'owner',
					},
				} as never) as unknown as Promise<{ id: string }>,
			);
			// Organization name via the internal adapter — getFullOrganization
			// runs orgSessionMiddleware and would 401 without a caller session.
			const name = (await runWithEndpointContext(
				claimContext(new Headers()),
				async () => {
					const ctx = await auth.$context;
					const org = (await ctx.adapter.findOne({
						model: 'organization',
						where: [{ field: 'id', value: input.organizationId }],
					})) as { name?: string } | null;
					return org?.name ?? '';
				},
			)) as string;
			return name;
		} catch (error) {
			throw translateClaimError(error);
		}
	}
}

function translateClaimError(error: unknown): Error {
	if (error instanceof APIError) {
		if (error.status === 422) {
			return ClaimConflictError.reportedByAuth(
				error.message ?? 'Username or email already in use',
			);
		}
		if (error.status === 400) {
			return ClaimStateError.reportedByAuth(
				error.message ?? 'Invalid claim data',
			);
		}
	}
	return error as Error;
}
