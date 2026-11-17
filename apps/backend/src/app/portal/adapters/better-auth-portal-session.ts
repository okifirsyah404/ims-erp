import { createHmac } from 'node:crypto';
import { runWithEndpointContext } from '@better-auth/core/context';
import type { AuthEndpointContext } from '@better-auth/core/context';
import { auth } from '@providers/better-auth/auth';
import { PORTAL_SIGNIN_HEADER, PORTAL_SIGNIN_NONCE } from '@providers/better-auth/portal-signin';
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

/** Headers that mark a session as created by the portal (see `portal-signin.ts`). */
function portalHeaders(from?: Headers): Headers {
	const headers = new Headers();
	for (const name of ['user-agent', 'x-forwarded-for', 'x-real-ip']) {
		const value = from?.get(name);
		if (value) headers.set(name, value);
	}
	headers.set(PORTAL_SIGNIN_HEADER, PORTAL_SIGNIN_NONCE);
	return headers;
}

/**
 * Better Auth implementation of {@link IPortalSessionGateway} (ERP-0022).
 *
 * The access token handed to the portal is Better Auth's signed session
 * cookie value (`<token>.<base64 HMAC-SHA256>`); it is turned back into a
 * cookie header here, so sessions, expiry and revocation stay entirely Better
 * Auth's. No `bearer` plugin is installed: other routes never accept the
 * token. Sessions created here carry the portal sign-in marker, which the web
 * admin's sign-in never has.
 */
@injectable()
export class BetterAuthPortalSessionGateway implements IPortalSessionGateway {
	async signIn(email: string, password: string, headers: Headers): Promise<TPortalSession | null> {
		const response = await auth.api.signInEmail({ body: { email, password, rememberMe: true }, headers: portalHeaders(headers), asResponse: true });
		if (!response.ok) return null;
		const cookie = parseSetCookieHeader(response.headers.get('set-cookie') ?? '').get(await sessionCookieName());
		if (!cookie?.value) return null;
		return this.getSession(decodeURIComponent(cookie.value));
	}

	/** A session for a user who just verified their sign-up code (no password round trip). */
	async createSession(userId: string): Promise<TPortalSession | null> {
		const headers = portalHeaders();
		const context = { headers, request: new Request('http://internal/portal-signup', { headers }), context: {} as never } as unknown as AuthEndpointContext;
		const token = (await runWithEndpointContext(context, async () => {
			const ctx = await auth.$context;
			const session = await ctx.internalAdapter.createSession(userId);
			if (!session) return null;
			return `${session.token}.${createHmac('sha256', ctx.secret).update(session.token).digest('base64')}`;
		})) as string | null;
		return token ? this.getSession(token) : null;
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
