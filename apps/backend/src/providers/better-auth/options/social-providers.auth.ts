import type { SocialProviders } from 'better-auth';
import { appConfig } from '@config/providers/config';

const google = appConfig.auth.social?.google;

export const betterAuthSocialProviders: SocialProviders = {
	// Enabled only when credentials are configured; unset env vars leave
	// Google sign-in disabled rather than failing auth construction.
	...(google?.clientId && google?.clientSecret
		? {
				google: {
					clientId: google.clientId,
					clientSecret: google.clientSecret,
				},
			}
		: {}),
};

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
