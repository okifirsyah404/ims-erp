import { auth } from '@providers/better-auth/auth';
import { WEBSITE_API_KEY_CONFIG_ID } from '@providers/better-auth/plugins/api-key.auth';
import type { IWebsiteKeyIssuer, TWebsiteKeyView } from '../contracts/website.contract';

type TApiKeyRow = { id: string; name?: string | null; start?: string | null; enabled?: boolean; createdAt: string | Date; lastRequest?: string | Date | null };

// The plugin's endpoints are not part of the inferred `auth.api` type when
// it is registered through the shared plugin list.
const apiKeyApi = auth.api as unknown as {
	createApiKey(input: {
		body: { configId: string; organizationId: string; userId: string; name: string; metadata?: Record<string, unknown> };
	}): Promise<{ id: string; key: string; start: string | null }>;
	listApiKeys(input: { query: { configId: string; organizationId: string }; headers: Headers }): Promise<TApiKeyRow[] | { apiKeys: TApiKeyRow[] }>;
	updateApiKey(input: { body: { configId: string; keyId: string; userId: string; enabled: boolean } }): Promise<unknown>;
};

const iso = (value: string | Date | null | undefined) => (value ? new Date(value).toISOString() : null);

/**
 * Better Auth implementation of {@link IWebsiteKeyIssuer} (ERP-0071 stage 1).
 *
 * @remarks
 * The website server sends one of these keys on every `/public/v1/*` call
 * (`publicApiGuard`, config `website`, prefix `ewk_`). Keys are
 * organization-owned; every call runs as the member who acts, so Better Auth
 * checks that member's organization `apiKey` permission, and the issuer is
 * kept in the key metadata. The secret is hashed by Better Auth and returned
 * only once, at creation.
 */
export class BetterAuthWebsiteKeys implements IWebsiteKeyIssuer {
	issue(input: { organizationId: string; issuerUserId: string; name: string }) {
		return apiKeyApi.createApiKey({
			body: {
				configId: WEBSITE_API_KEY_CONFIG_ID,
				organizationId: input.organizationId,
				userId: input.issuerUserId,
				name: input.name,
				metadata: { purpose: 'website', issuedBy: input.issuerUserId },
			},
		});
	}

	async list(input: { organizationId: string; headers: Headers }): Promise<TWebsiteKeyView[]> {
		const result = await apiKeyApi.listApiKeys({
			query: { configId: WEBSITE_API_KEY_CONFIG_ID, organizationId: input.organizationId },
			headers: input.headers,
		});
		const rows = Array.isArray(result) ? result : (result.apiKeys ?? []);
		return rows.map((row) => ({
			id: row.id,
			name: row.name ?? null,
			start: row.start ?? null,
			enabled: row.enabled !== false,
			createdAt: iso(row.createdAt) ?? '',
			lastRequest: iso(row.lastRequest),
		}));
	}

	async disable(input: { apiKeyId: string; actorUserId: string }) {
		await apiKeyApi.updateApiKey({
			body: { configId: WEBSITE_API_KEY_CONFIG_ID, keyId: input.apiKeyId, userId: input.actorUserId, enabled: false },
		});
	}
}
