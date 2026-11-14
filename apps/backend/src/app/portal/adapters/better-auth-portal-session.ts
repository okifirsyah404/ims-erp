import { auth } from '@providers/better-auth/auth';
import { parseSetCookieHeader } from 'better-auth/cookies';
import { injectable } from 'tsyringe';
import type { IPortalSessionGateway, TPortalSession } from '../contracts/portal.contract';

async function sessionCookieName(): Promise<string> {
	return (await auth.$context).authCookies.sessionToken.name;
}

/** Request headers carrying the access token as Better Auth's session cookie. */
async function sessionHeaders(token: string): Promise<Headers> {
	return new Headers({ cookie: `${await sessionCookieName()}=${encodeURIComponent(token)}` });
}

/**
 * Better Auth implementation of {@link IPortalSessionGateway} (ERP-0022).
 *
 * The access token handed to the portal is Better Auth's signed session
 * cookie value; it is turned back into a cookie header here, so sessions,
 * expiry and revocation stay entirely Better Auth's. No `bearer` plugin is
 * installed: other routes never accept the token.
 */
@injectable()
export class BetterAuthPortalSessionGateway implements IPortalSessionGateway {
	async signIn(email: string, password: string, headers: Headers): Promise<TPortalSession | null> {
		const forwarded = new Headers();
		for (const name of ['user-agent', 'x-forwarded-for', 'x-real-ip']) {
			const value = headers.get(name);
			if (value) forwarded.set(name, value);
		}
		const response = await auth.api.signInEmail({ body: { email, password, rememberMe: true }, headers: forwarded, asResponse: true });
		if (!response.ok) return null;
		const cookie = parseSetCookieHeader(response.headers.get('set-cookie') ?? '').get(await sessionCookieName());
		if (!cookie?.value) return null;
		const token = decodeURIComponent(cookie.value);
		return this.getSession(token);
	}

	async getSession(token: string): Promise<TPortalSession | null> {
		const result = await auth.api
			.getSession({ headers: await sessionHeaders(token), query: { disableCookieCache: true } })
			.catch(() => null);
		if (!result) return null;
		return { token, userId: result.user.id, expiresAt: new Date(result.session.expiresAt) };
	}

	async signOut(token: string): Promise<void> {
		await auth.api.signOut({ headers: await sessionHeaders(token) }).catch(() => undefined);
	}

	async changePassword(token: string, current: string, next: string): Promise<boolean> {
		try {
			await auth.api.changePassword({
				headers: await sessionHeaders(token),
				body: { currentPassword: current, newPassword: next, revokeOtherSessions: false },
			});
			return true;
		} catch {
			return false;
		}
	}

	async resetPassword(token: string, password: string): Promise<boolean> {
		try {
			await auth.api.resetPassword({ body: { token, newPassword: password } });
			return true;
		} catch {
			return false;
		}
	}
}
