import { lastLoginMethod } from 'better-auth/plugins';

/**
 * Which sign-in method the resolver adds on top of the library mapping
 * (ERP-0112).
 *
 * @returns `'username'` for `/sign-in/username`, otherwise `null` so Better
 * Auth's own mapping applies (email, the OAuth callback's provider id,
 * passkey, magic-link, email-otp)
 *
 * @remarks
 * Pure and exported for the unit test; the web-admin routes a non-email
 * identifier to `/sign-in/username`, which the library's default resolver
 * does not recognise.
 */
export function resolveLoginMethodOverride(path: string | undefined): string | null {
	return path === '/sign-in/username' ? 'username' : null;
}

/**
 * Remembers the last used sign-in method in a readable cookie
 * (`better-auth.last_used_login_method`) so `/login` can badge it.
 *
 * @remarks
 * Cookie only — `storeInDatabase` stays off, so there is no `auth.users`
 * column and no migration. The cookie is written on the API origin with
 * `httpOnly: false` and read by the web admin from its own origin: fine on the
 * dev ports and behind one origin/reverse proxy; separate subdomains need
 * `advanced.crossSubDomainCookies` (open decision, see `progress.md`).
 */
export const betterAuthLastLoginMethodPlugin = lastLoginMethod({
	customResolveMethod: (ctx) => resolveLoginMethodOverride(ctx.path),
});
