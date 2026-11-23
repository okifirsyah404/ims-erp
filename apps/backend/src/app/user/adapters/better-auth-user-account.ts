import { randomBytes } from 'node:crypto';
import { runWithEndpointContext } from '@better-auth/core/context';
import type { AuthEndpointContext } from '@better-auth/core/context';
import { auth } from '@providers/better-auth/auth';
import { injectable } from 'tsyringe';
import type { IUserAccountGateway, TAuthUser } from '../contracts/user-account.gateway.interface';

/** Synthetic endpoint context for server-side internal-adapter calls (no caller session). */
function internalContext(): AuthEndpointContext {
	const headers = new Headers();
	return { headers, request: new Request('http://internal/portal-account', { headers }), context: {} as never } as unknown as AuthEndpointContext;
}

const pick = (user: TAuthUser | null | undefined): TAuthUser | null =>
	user
		? {
				id: user.id,
				name: user.name,
				email: user.email,
				emailVerified: Boolean(user.emailVerified),
				username: user.username ?? null,
				image: user.image ?? null,
			}
		: null;

/**
 * Better Auth implementation of {@link IUserAccountGateway} (ERP-0022).
 *
 * Users, credential accounts and verification tokens stay Better Auth-owned:
 * everything goes through `ctx.internalAdapter`. The password token uses
 * Better Auth's own reset-password identifier (`reset-password:<token>`), so
 * the portal sets the first password through the standard
 * `resetPassword` endpoint — no second password store.
 */
@injectable()
export class BetterAuthUserAccountGateway implements IUserAccountGateway {
	private run<T>(work: (ctx: Awaited<typeof auth.$context>) => Promise<T>): Promise<T> {
		return runWithEndpointContext(internalContext(), async () => work(await auth.$context)) as Promise<T>;
	}

	findUserByEmail(email: string) {
		return this.run(async (ctx) => pick((await ctx.internalAdapter.findUserByEmail(email))?.user as TAuthUser | undefined));
	}

	findUserById(id: string) {
		return this.run(async (ctx) => pick((await ctx.internalAdapter.findUserById(id)) as TAuthUser | null));
	}

	createUser(input: { name: string; email: string; emailVerified: boolean; username?: string }) {
		return this.run(async (ctx) => {
			const username = input.username
				? { username: input.username.toLowerCase(), displayUsername: input.username }
				: {};
			const user = (await ctx.internalAdapter.createUser(
				{ name: input.name, email: input.email, emailVerified: input.emailVerified, status: 'active', ...username } as never,
				{ method: input.emailVerified ? 'admin' : 'email-password' },
			)) as TAuthUser;
			return pick(user) as TAuthUser;
		});
	}

	findUsersByIds(ids: string[]) {
		if (ids.length === 0) return Promise.resolve([]);
		return this.run(async (ctx) => {
			const rows = (await ctx.adapter.findMany({
				model: 'user',
				where: [{ field: 'id', operator: 'in', value: ids }],
				limit: ids.length,
			})) as TAuthUser[];
			return rows.map((row) => pick(row) as TAuthUser);
		});
	}

	findUserIdsByEmailLike(term: string, limit: number) {
		return this.run(async (ctx) => {
			const rows = (await ctx.adapter.findMany({
				model: 'user',
				where: [{ field: 'email', operator: 'contains', value: term.trim().toLowerCase() }],
				limit,
			})) as { id: string }[];
			return rows.map((row) => row.id);
		});
	}

	isUsernameTaken(username: string) {
		return this.run(async (ctx) =>
			Boolean(
				await ctx.adapter.findOne({ model: 'user', where: [{ field: 'username', value: username.toLowerCase() }] }),
			),
		);
	}

	async updateUser(userId: string, patch: { name?: string; email?: string; image?: string | null }): Promise<void> {
		const data = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
		if (Object.keys(data).length === 0) return;
		await this.run(async (ctx) => ctx.internalAdapter.updateUser(userId, data as never));
	}

	async deleteUser(userId: string): Promise<void> {
		await this.run(async (ctx) => ctx.internalAdapter.deleteUser(userId));
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

	/** `user.role` is comma-joined (admin plugin, ADR-0018); the default `user` role is replaced. */
	async grantCustomerRole(userId: string): Promise<void> {
		await this.run(async (ctx) => {
			const user = (await ctx.internalAdapter.findUserById(userId)) as { role?: string | null } | null;
			if (!user) return;
			const roles = (user.role ?? '')
				.split(',')
				.map((role) => role.trim())
				.filter((role) => role && role !== 'user');
			if (roles.includes('customer')) return;
			await ctx.internalAdapter.updateUser(userId, { role: [...roles, 'customer'].join(',') } as never);
		});
	}

	isOrganizationMember(userId: string) {
		return this.run(async (ctx) => Boolean(await ctx.adapter.findOne({ model: 'member', where: [{ field: 'userId', value: userId }] })));
	}
}
