import { auth } from '@providers/better-auth/auth';
import { LICENSING_API_KEY_CONFIG_ID } from '@providers/better-auth/plugins/api-key.auth';

/**
 * Port to the machine keys of the license API (M03 stage 2). The secret is
 * created, hashed, rate-limited and verified by Better Auth's API key plugin
 * (config `licensing`, prefix `elk_`); licensing keeps only the key id.
 */
export interface IApiKeyIssuer {
	/**
	 * Creates an organization-owned key as the acting member (`issuerUserId`):
	 * Better Auth checks that member's `apiKey:create`, and the issuer is kept
	 * in the key metadata. The plaintext is returned once.
	 */
	issue(input: { organizationId: string; issuerUserId: string; name: string; applicationId: string }): Promise<{
		id: string;
		key: string;
		start: string | null;
	}>;
	/** Disables a key for good, as the acting member (`apiKey:update`). */
	disable(input: { apiKeyId: string; actorUserId: string }): Promise<void>;
	/** The key's id, `null` when invalid or disabled, or `rateLimited`. */
	verify(key: string): Promise<{ id: string } | null | 'rateLimited'>;
}

type VerifyResult = {
	valid: boolean;
	error: { code: string } | null;
	key: { id: string } | null;
};

// The plugin's endpoints are not part of the inferred `auth.api` type when
// it is registered through the shared plugin list.
const apiKeyApi = auth.api as unknown as {
	createApiKey(input: {
		body: { configId: string; organizationId: string; userId: string; name: string; metadata?: Record<string, unknown> };
	}): Promise<{ id: string; key: string; start: string | null }>;
	updateApiKey(input: { body: { configId: string; keyId: string; userId: string; enabled: boolean } }): Promise<unknown>;
	verifyApiKey(input: { body: { configId: string; key: string } }): Promise<VerifyResult>;
};

/**
 * Better Auth implementation of {@link IApiKeyIssuer}.
 *
 * @remarks
 * Every call runs as the member who acts (reviewer request on PR #100): Better
 * Auth checks that member's organization `apiKey` permission, granted together
 * with `license:manage_api`, and the issuer is stored in the key metadata
 * (`issuedBy`) as well as on the licensing row (`created_by` / `revoked_by`).
 * Organization-owned keys stay valid when the issuing member leaves.
 */
export class BetterAuthApiKeyIssuer implements IApiKeyIssuer {
	issue(input: { organizationId: string; issuerUserId: string; name: string; applicationId: string }) {
		return apiKeyApi.createApiKey({
			body: {
				configId: LICENSING_API_KEY_CONFIG_ID,
				organizationId: input.organizationId,
				userId: input.issuerUserId,
				name: input.name,
				metadata: { purpose: 'license-api', applicationId: input.applicationId, issuedBy: input.issuerUserId },
			},
		});
	}

	async disable(input: { apiKeyId: string; actorUserId: string }) {
		await apiKeyApi.updateApiKey({
			body: { configId: LICENSING_API_KEY_CONFIG_ID, keyId: input.apiKeyId, userId: input.actorUserId, enabled: false },
		});
	}

	async verify(key: string) {
		const result = await apiKeyApi.verifyApiKey({ body: { configId: LICENSING_API_KEY_CONFIG_ID, key } }).catch(() => null);
		if (result?.valid && result.key) return { id: result.key.id };
		return result?.error?.code === 'RATE_LIMITED' ? 'rateLimited' : null;
	}
}
