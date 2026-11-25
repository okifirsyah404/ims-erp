/**
 * Sign-in methods Better Auth's `lastLoginMethod` plugin can record
 * (ERP-0112). `google` comes from the OAuth callback, `email`/`username`
 * from the two credential endpoints the login form uses.
 */
export const LAST_LOGIN_METHODS = [
	'email',
	'username',
	'google',
	'passkey',
	'magic-link',
	'email-otp',
] as const;

export type TLastLoginMethod = (typeof LAST_LOGIN_METHODS)[number];

/** Cookie the backend plugin writes (`httpOnly: false`, 30 days). */
export const LAST_LOGIN_COOKIE = 'better-auth.last_used_login_method';

/**
 * Validates the raw cookie value.
 *
 * @remarks
 * The cookie is `httpOnly: false` and client-writable, so anything outside
 * {@link LAST_LOGIN_METHODS} is ignored instead of rendered.
 *
 * @returns The method, or `null` when absent/unknown
 */
export function parseLastLoginMethod(
	value: string | null | undefined,
): TLastLoginMethod | null {
	if (!value) return null;
	return (LAST_LOGIN_METHODS as readonly string[]).includes(value)
		? (value as TLastLoginMethod)
		: null;
}

/** Reads one cookie from a `document.cookie` string (decoded). */
export function cookieValue(
	cookieString: string,
	name: string,
): string | null {
	for (const part of cookieString.split(';')) {
		const [key, ...rest] = part.trim().split('=');
		if (key !== name) continue;
		try {
			return decodeURIComponent(rest.join('='));
		} catch {
			return rest.join('=');
		}
	}
	return null;
}

/**
 * Method recorded for this browser by the last successful sign-in.
 *
 * @remarks
 * Read straight from `document.cookie` rather than through Better Auth's
 * client plugin: the helper stays a pure DOM read, so a test that mocks
 * `@/lib/auth-client` cannot break it (that mock caused a CI-only failure).
 */
export function readLastLoginMethod(): TLastLoginMethod | null {
	if (typeof document === 'undefined') return null;
	return parseLastLoginMethod(cookieValue(document.cookie, LAST_LOGIN_COOKIE));
}

/**
 * Drops the remembered method when `provider` is the one remembered, e.g.
 * after Google is disconnected from `/accounts` — the badge must not point at
 * a method that no longer exists.
 */
export function clearLastLoginMethodIf(provider: TLastLoginMethod): void {
	if (typeof document === 'undefined') return;
	if (readLastLoginMethod() !== provider) return;
	document.cookie = `${LAST_LOGIN_COOKIE}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`;
}
