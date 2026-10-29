import type { SocialProviders } from 'better-auth';
import { appConfig } from '@config/providers/config';

export const betterAuthSocialProviders: SocialProviders = {};

/**
 * Trusted origins for Better Auth's origin/CSRF checks on state-changing
 * requests. The app's own URL is always trusted; the web-admin dev server is
 * included so browser logins from the Vite dev server pass validation.
 */
export const betterAuthTrustedOrigins: string[] = [
	appConfig.app.url!,
	'http://localhost:5173',
];
