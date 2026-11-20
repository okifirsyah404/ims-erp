import { createHmac } from 'node:crypto';
import { runWithEndpointContext } from '@better-auth/core/context';
import type { AuthEndpointContext } from '@better-auth/core/context';
import { auth } from '@providers/better-auth/auth';
import { PORTAL_SIGNIN_HEADER, PORTAL_SIGNIN_NONCE } from '@providers/better-auth/portal-signin';
import { parseCookies, parseSetCookieHeader } from 'better-auth/cookies';
import { injectable } from 'tsyringe';
import type { IPortalSessionGateway, TPortalDeviceSession, TPortalSession } from '../contracts/portal.contract';

async function sessionCookieName(): Promise<string> {
	return (await auth.$context).authCookies.sessionToken.name;
}

/** The roles of a Better Auth user (`user.role` is comma-joined by the admin plugin). */
function rolesOf(user: { role?: string | null }): string[] {
	return (user.role ?? '')
		.split(',')
		.map((role) => role.trim())
		.filter(Boolean);
}

/** `Set-Cookie` for Better Auth's session cookie, using its own name and attributes. */
async function serializeSessionCookie(value: string, maxAgeSeconds: number): Promise<string> {
	const { name, attributes } = (await auth.$context).authCookies.sessionToken;
	const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${attributes.path || '/'}`, `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`];
	if (attributes.domain) parts.push(`Domain=${attributes.domain}`);
	if (attributes.httpOnly) parts.push('HttpOnly');
	if (attributes.secure) parts.push('Secure');
	if (attributes.sameSite) parts.push(`SameSite=${attributes.sameSite[0]!.toUpperCase()}${attributes.sameSite.slice(1).toLowerCase()}`);
	return parts.join('; ');
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
 * Better Auth implementation of {@link IPortalSessionGateway} (ERP-0022,
 * session transport ERP-0069 / ADR-0024).
 *
 * The portal's server receives Better Auth's own session cookie
 * (`<token>.<base64 HMAC-SHA256>`, same name and attributes) as a
 * `Set-Cookie`, keeps it in its server-side session and sends it back as a
 * `Cookie` header, so sessions, expiry and revocation stay entirely Better
 * Auth's. Sessions created here carry the portal sign-in marker, which the
 * web admin's sign-in never has.
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

	/** A session for a user who just verified a code (no password round trip); `from` names the device. */
	async createSession(userId: string, from?: Headers): Promise<TPortalSession | null> {
		const headers = portalHeaders(from);
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
		return {
			token,
			userId: result.user.id,
			roles: rolesOf(result.user as { role?: string | null }),
			expiresAt: new Date(result.session.expiresAt),
		};
	}

	async tokenFromHeaders(headers: Headers): Promise<string | null> {
		const cookie = headers.get('cookie');
		if (!cookie) return null;
		const value = parseCookies(cookie).get(await sessionCookieName());
		if (!value) return null;
		const token = decodeURIComponent(value);
		return token.length > 0 && token.length <= 8192 ? token : null;
	}

	sessionCookie(session: TPortalSession): Promise<string> {
		return serializeSessionCookie(session.token, (session.expiresAt.getTime() - Date.now()) / 1000);
	}

	clearedSessionCookie(): Promise<string> {
		return serializeSessionCookie('', 0);
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

	async verifyPassword(token: string, password: string): Promise<boolean> {
		try {
			await auth.api.verifyPassword({ headers: await sessionHeaders(token), body: { password } });
			return true;
		} catch {
			return false;
		}
	}

	async listSessions(token: string): Promise<TPortalDeviceSession[]> {
		const sessions = await auth.api.listSessions({ headers: await sessionHeaders(token) }).catch(() => []);
		return sessions.map((session) => ({
			id: session.id,
			token: session.token,
			userAgent: session.userAgent ?? null,
			ipAddress: session.ipAddress ?? null,
			createdAt: new Date(session.createdAt),
			updatedAt: new Date(session.updatedAt),
		}));
	}

	async revokeSession(token: string, sessionToken: string): Promise<void> {
		await auth.api.revokeSession({ headers: await sessionHeaders(token), body: { token: sessionToken } });
	}

	async revokeOtherSessions(token: string): Promise<void> {
		await auth.api.revokeOtherSessions({ headers: await sessionHeaders(token) });
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
