import { randomBytes } from 'node:crypto';
import { runWithEndpointContext } from '@better-auth/core/context';
import type { AuthEndpointContext } from '@better-auth/core/context';
import { auth } from '@providers/better-auth/auth';
import { injectable } from 'tsyringe';
import type { IPortalAuthGateway, TAuthUser } from '../contracts/portal-account.contract';

/** Synthetic endpoint context for server-side internal-adapter calls (no caller session). */
function internalContext(): AuthEndpointContext {
	const headers = new Headers();
	return { headers, request: new Request('http://internal/portal-account', { headers }), context: {} as never } as unknown as AuthEndpointContext;
}

const pick = (user: TAuthUser | null | undefined): TAuthUser | null =>
	user ? { id: user.id, name: user.name, email: user.email, emailVerified: Boolean(user.emailVerified) } : null;

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

	createUser(input: { name: string; email: string; emailVerified: boolean }) {
		return this.run(async (ctx) => {
			const user = (await ctx.internalAdapter.createUser(
				{ name: input.name, email: input.email, emailVerified: input.emailVerified, status: 'active' } as never,
				{ method: input.emailVerified ? 'admin' : 'email-password' },
			)) as TAuthUser;
			return pick(user) as TAuthUser;
		});
	}

	/** Mirrors Better Auth's own set-password path: hash, then upsert the credential account. */
	async setPassword(userId: string, password: string): Promise<void> {
		await this.run(async (ctx) => {
			const hashed = await ctx.password.hash(password);
			const account = await ctx.internalAdapter.findCredentialAccount(userId);
			if (account) await ctx.internalAdapter.updatePassword(userId, hashed);
			else await ctx.internalAdapter.createAccount({ userId, providerId: 'credential', accountId: userId, password: hashed });
		});
	}

	async markEmailVerified(userId: string): Promise<void> {
		await this.run(async (ctx) => ctx.internalAdapter.updateUser(userId, { emailVerified: true }));
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
