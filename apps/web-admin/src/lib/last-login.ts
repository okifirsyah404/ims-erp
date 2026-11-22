import { authClient } from './auth-client';

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

/** Method recorded for this browser by the last successful sign-in. */
export function readLastLoginMethod(): TLastLoginMethod | null {
	return parseLastLoginMethod(authClient.getLastUsedLoginMethod());
}

/**
 * Drops the remembered method when `provider` is the one remembered, e.g.
 * after Google is disconnected from `/accounts` — the badge must not point at
 * a method that no longer exists.
 */
export function clearLastLoginMethodIf(provider: TLastLoginMethod): void {
	if (readLastLoginMethod() === provider) authClient.clearLastUsedLoginMethod();
}
