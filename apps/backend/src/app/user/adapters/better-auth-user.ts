import { auth } from '@providers/better-auth/auth';
import { APIError } from 'better-auth/api';
import { injectable } from 'tsyringe';
import type {
	IUserAuthGateway,
	TAuthGatewayCreateUser,
} from '../contracts/user-auth.gateway.interface';
import type { TSetUserRole, TUpdateUser } from '../contracts/user.contract';
import { UserEmailTakenError, UserNotFoundError } from '../errors/user.errors';

/**
 * Better Auth admin API implementation of {@link IUserAuthGateway}.
 *
 * @remarks
 * All ban state, role, password, and profile mutations stay inside Better
 * Auth; this class only forwards parsed input and translates `APIError`s
 * into module domain errors. Endpoints with `requireHeaders` run Better
 * Auth's own admin-authorization check against the caller's session, so
 * the caller's request headers are forwarded unchanged.
 */
@injectable()
export class BetterAuthUserGateway implements IUserAuthGateway {
	async createUser(
		input: TAuthGatewayCreateUser,
		_headers: Headers,
	): Promise<{ id: string }> {
		try {
			const { user } = await auth.api.createUser({
				body: {
					email: input.email,
					password: input.password,
					name: input.name,
					// ADR-0018: the role is validated by the contract (globalRoles),
					// but admin() types the body as the default "user"|"admin" union.
					role: input.role as 'admin' | undefined,
					data: { username: input.username, bio: input.bio },
				},
			});
			return { id: user.id };
		} catch (error) {
			throw translate(error, input.email);
		}
	}

	async updateUser(
		userId: string,
		input: TUpdateUser,
		headers: Headers,
	): Promise<void> {
		await this.call(() =>
			auth.api.adminUpdateUser({
				body: { userId, data: { ...input } },
				headers,
			}),
		);
	}

	/**
	 * Self-service update via Better Auth's session-authenticated
	 * `/update-user`. The id is taken from the forwarded session server-
	 * side, never from client input; `userId` is asserted only for the
	 * contract.
	 */
	async updateSelf(
		userId: string,
		input: TUpdateUser,
		headers: Headers,
	): Promise<void> {
		await this.call(async () => {
			await auth.api.updateUser({
				body: { ...input },
				headers,
			});
		});
	}

	async setRole(
		userId: string,
		input: TSetUserRole,
		headers: Headers,
	): Promise<void> {
		await this.call(() =>
			auth.api.setRole({
				// ADR-0018: `role` is already restricted to `globalRoles` by
				// `setUserRoleSchema`; admin() still types the body as the default
				// "user"|"admin" union, so the cast is a type-only widening.
				body: { userId, role: input.role as 'admin' },
				headers,
			}),
		);
	}

	async banUser(
		userId: string,
		input: { banReason?: string; banExpiresIn?: number },
		headers: Headers,
	): Promise<void> {
		await this.call(() =>
			auth.api.banUser({
				body: {
					userId,
					banReason: input.banReason,
					banExpiresIn: input.banExpiresIn,
				},
				headers,
			}),
		);
	}

	async unbanUser(userId: string, headers: Headers): Promise<void> {
		await this.call(() =>
			auth.api.unbanUser({ body: { userId }, headers }),
		);
	}

	/**
	 * Runs one Better Auth admin-API call and translates `APIError`s onto
	 * the module's domain errors via {@link translate}.
	 */
	private async call(run: () => Promise<unknown>): Promise<void> {
		try {
			await run();
		} catch (error) {
			throw translate(error);
		}
	}
}

/**
 * Maps Better Auth `APIError`s onto the user module's domain errors.
 *
 * @remarks
 * Module-internal helper used by {@link BetterAuthUserGateway.call}.
 * A 422 (email conflict) becomes {@link UserEmailTakenError} carrying the
 * attempted email; a 404 becomes {@link UserNotFoundError}. Anything else
 * passes through unchanged so unexpected failures keep their original
 * shape.
 */
function translate(error: unknown, email = 'unknown'): Error {
	if (error instanceof APIError) {
		if (error.status === 422) return new UserEmailTakenError(email);
		if (error.status === 404) return new UserNotFoundError('unknown');
	}
	return error as Error;
}
