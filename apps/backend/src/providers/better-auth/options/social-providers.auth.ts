import type { SocialProviders } from 'better-auth';
import { appConfig } from '@config/providers/config';

/**
 * Builds the social provider block (ERP-0107 hardening).
 *
 * @remarks
 * Enabled only when credentials are configured; unset env vars leave Google
 * sign-in disabled rather than failing auth construction.
 *
 * `disableSignUp: true` — the ERP is invitation-only: Google may sign in an
 * existing account, never create one. An unknown email is refused by Better
 * Auth with `?error=signup_disabled` on the error callback and no
 * `auth.users` row is written. Existing-but-inactive accounts (pending
 * invitation, deactivated) are refused by the account-link hook and the
 * session login gate.
 */
export function buildSocialProviders(
	google: { clientId?: string | null; clientSecret?: string | null } | null | undefined,
): SocialProviders {
	return {
		...(google?.clientId && google?.clientSecret
			? {
					google: {
						clientId: google.clientId,
						clientSecret: google.clientSecret,
						disableSignUp: true,
					},
				}
			: {}),
	};
}

export const betterAuthSocialProviders: SocialProviders = buildSocialProviders(
	appConfig.auth.social?.google,
);

/**
 * Trusted origins for Better Auth's origin/CSRF checks on state-changing
 * requests. The app's own URL is always trusted; the web-admin dev server is
 * included so browser logins from the Vite dev server pass validation.
 */
export const betterAuthTrustedOrigins: string[] = [
	appConfig.app.url!,
	'http://localhost:5173',
	// The customer portal's reset-password page (ERP-0022): password links
	// redirect there, so Better Auth must accept it as a callback origin.
	...(appConfig.app.portalUrl ? [new URL(appConfig.app.portalUrl).origin] : []),
];
