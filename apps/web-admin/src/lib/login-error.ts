/** `auth` keys a refused sign-in can show; none takes interpolation. */
export type TLoginErrorKey =
	| 'login.googleNotRegistered'
	| 'login.accountNotActive'
	| 'login.noAccess'
	| 'login.googleNotLinked'
	| 'login.banned'
	| 'login.googleFailed';

/**
 * Absolute, same-origin form of the post-login destination.
 *
 * @remarks
 * The `_authed` guard stores the router `location.href` (a path such as
 * `/sales?page=2`), and the auth server runs on another origin, so a
 * relative Google callback would land on the API host. Anything pointing
 * at another origin falls back to the app root (no open redirect).
 */
export function sameOriginUrl(target: string | undefined, origin: string): string {
	if (!target) return `${origin}/`;
	try {
		const url = new URL(target, origin);
		return url.origin === origin ? url.toString() : `${origin}/`;
	} catch {
		return `${origin}/`;
	}
}

/**
 * Google error callback: back to `/login`, keeping `redirect` for the next
 * attempt. Better Auth appends `error=<code>` to this URL.
 */
export function loginErrorCallbackUrl(origin: string, redirect: string | undefined): string {
	const url = new URL('/login', origin);
	if (redirect) url.searchParams.set('redirect', redirect);
	return url.toString();
}

/**
 * Maps the `error` Better Auth appends to the Google sign-in error callback
 * (`/login?error=…`, ERP-0109) to an `auth` namespace message key.
 *
 * @remarks
 * Codes come from three places:
 * - Better Auth's OAuth callback (`signup_disabled`, `account_not_linked`,
 *   lowercase with underscores);
 * - the backend hooks (`ACCOUNT_NOT_ACTIVE` from the login gate and the
 *   account-link guard, `WEB_ADMIN_ACCESS_DENIED` from the login gate);
 * - the admin plugin (`BANNED_USER`).
 * Anything else (provider cancelled, state mismatch, …) gets a generic line.
 *
 * @returns The message key, or `null` when there is no error
 */
export function loginErrorKey(code: string | undefined): TLoginErrorKey | null {
	if (!code) return null;
	switch (code) {
		case 'signup_disabled':
			return 'login.googleNotRegistered';
		case 'ACCOUNT_NOT_ACTIVE':
			return 'login.accountNotActive';
		case 'WEB_ADMIN_ACCESS_DENIED':
			return 'login.noAccess';
		case 'account_not_linked':
			return 'login.googleNotLinked';
		case 'BANNED_USER':
			return 'login.banned';
		default:
			return 'login.googleFailed';
	}
}
