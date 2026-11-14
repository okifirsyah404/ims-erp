import { randomBytes } from 'node:crypto';
import { runWithEndpointContext } from '@better-auth/core/context';
import type { AuthEndpointContext } from '@better-auth/core/context';
import { auth } from '@providers/better-auth/auth';
import { injectable } from 'tsyringe';
import type { IPortalAuthGateway } from '../contracts/portal-account.contract';

/** Synthetic endpoint context for server-side internal-adapter calls (no caller session). */
function internalContext(): AuthEndpointContext {
	const headers = new Headers();
	return { headers, request: new Request('http://internal/portal-account', { headers }), context: {} as never } as unknown as AuthEndpointContext;
}

type TAuthUser = { id: string; name: string; email: string };

const pick = (user: TAuthUser | null | undefined): TAuthUser | null =>
	user ? { id: user.id, name: user.name, email: user.email } : null;

/**
 * Better Auth implementation of {@link IPortalAuthGateway} (ERP-0022).
 *
 * Users, credential accounts and verification tokens stay Better Auth-owned:
 * everything goes through `ctx.internalAdapter`. The password token uses
 * Better Auth's own reset-password identifier (`reset-password:<token>`), so
 * the portal sets the first password through the standard
 * `resetPassword` endpoint — no second password store.
 */
@injectable()
export class BetterAuthPortalGateway implements IPortalAuthGateway {
	private run<T>(work: (ctx: Awaited<typeof auth.$context>) => Promise<T>): Promise<T> {
		return runWithEndpointContext(internalContext(), async () => work(await auth.$context)) as Promise<T>;
	}

	findUserByEmail(email: string) {
		return this.run(async (ctx) => pick((await ctx.internalAdapter.findUserByEmail(email))?.user as TAuthUser | undefined));
	}

	findUserById(id: string) {
		return this.run(async (ctx) => pick((await ctx.internalAdapter.findUserById(id)) as TAuthUser | null));
	}

	createUser(input: { name: string; email: string }) {
		return this.run(async (ctx) => {
			const user = (await ctx.internalAdapter.createUser({
				name: input.name,
				email: input.email,
				emailVerified: true,
				status: 'active',
			} as never, { method: 'admin' })) as TAuthUser;
			return pick(user) as TAuthUser;
		});
	}

	hasPassword(userId: string) {
		return this.run(async (ctx) => Boolean((await ctx.internalAdapter.findCredentialAccount(userId))?.password));
	}

	issuePasswordToken(userId: string, ttlSeconds: number) {
		return this.run(async (ctx) => {
			const token = randomBytes(24).toString('base64url');
			await ctx.internalAdapter.createVerificationValue({
				value: userId,
				identifier: `reset-password:${token}`,
				expiresAt: new Date(Date.now() + ttlSeconds * 1000),
			});
			return token;
		});
	}

	async revokeSessions(userId: string): Promise<void> {
		await this.run(async (ctx) => ctx.internalAdapter.deleteUserSessions(userId));
	}

	isOrganizationMember(userId: string) {
		return this.run(async (ctx) => Boolean(await ctx.adapter.findOne({ model: 'member', where: [{ field: 'userId', value: userId }] })));
	}
}
