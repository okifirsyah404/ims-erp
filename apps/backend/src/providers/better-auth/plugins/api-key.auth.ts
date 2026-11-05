import { apiKey } from '@better-auth/api-key';
import { BetterAuthPlugin } from 'better-auth';

/** Config id of the server-to-server keys used by the public website. */
export const WEBSITE_API_KEY_CONFIG_ID = 'website';

/**
 * Two key configurations:
 * - `default`: user-owned keys (Better Auth defaults, unchanged).
 * - `website`: organization-owned keys for `/public/v1/*` (ADR-0011 step
 *   3b). The website server sends one on every request, so the per-key
 *   limit is per minute rather than the default 10 per day. Keys never
 *   create a session (`enableSessionForAPIKeys` stays off).
 */
export const betterAuthApiKeyPlugin: BetterAuthPlugin = apiKey([
	{ configId: 'default' },
	{
		configId: WEBSITE_API_KEY_CONFIG_ID,
		references: 'organization',
		defaultPrefix: 'ewk_',
		enableMetadata: true,
		rateLimit: { enabled: true, timeWindow: 60_000, maxRequests: 600 },
	},
]) as BetterAuthPlugin;
