/**
 * Public website API authentication (`/public/v1/*`, ADR-0011 step 3b).
 *
 * @remarks
 * Server-to-server only: the website server sends an organization-owned
 * Better Auth API key (config `website`, prefix `ewk_`) as
 * `Authorization: Bearer <key>`. There is no session and no ERP role; the
 * key only proves the caller is the website. Errors are `AppError`s, so the
 * shared `domainPlugin` error arm writes the envelope.
 */
import Elysia, { type Context } from 'elysia';
import { AppError } from '@http/errors';
import { auth } from '@providers/better-auth/auth';
import { WEBSITE_API_KEY_CONFIG_ID } from '@providers/better-auth/plugins/api-key.auth';

export type PublicClient = {
	/** Organization that owns the key (the department running the website). */
	organizationId: string;
	keyId: string;
};

/** Missing, invalid, or rate-limited website key. */
export class PublicApiAuthError extends AppError {
	constructor(kind: 'missing' | 'invalid' | 'rateLimited') {
		super(
			kind === 'rateLimited' ? 429 : 401,
			kind === 'missing'
				? 'publicApi.keyRequired'
				: kind === 'invalid'
					? 'publicApi.keyInvalid'
					: 'publicApi.rateLimited',
			`Public API key ${kind}`,
		);
	}
}

type VerifyResult = {
	valid: boolean;
	error: { code: string; message?: string } | null;
	key: { id: string; referenceId: string } | null;
};

// The api-key plugin's endpoints are not part of the inferred `auth.api`
// type when the plugin is registered through the shared plugin list.
const apiKeyApi = auth.api as unknown as {
	verifyApiKey(input: { body: { configId: string; key: string } }): Promise<VerifyResult>;
};

function bearerToken(headers: Headers): string | null {
	const [scheme, token] = (headers.get('authorization') ?? '').split(' ');
	return scheme?.toLowerCase() === 'bearer' && token?.trim() ? token.trim() : null;
}

/** Verifies the website key and returns its owner. */
export async function resolvePublicClient(headers: Headers): Promise<PublicClient> {
	const key = bearerToken(headers);
	if (!key) throw new PublicApiAuthError('missing');
	const result = await apiKeyApi
		.verifyApiKey({ body: { configId: WEBSITE_API_KEY_CONFIG_ID, key } })
		.catch(() => null);
	if (!result?.valid || !result.key) {
		throw new PublicApiAuthError(result?.error?.code === 'RATE_LIMITED' ? 'rateLimited' : 'invalid');
	}
	return { organizationId: result.key.referenceId, keyId: result.key.id };
}

/** Registers the `publicApi` macro; routes opt in with `{ publicApi: true }`. */
export function publicApiGuard() {
	return new Elysia({ name: 'public-api-guard' }).macro({
		publicApi: (enabled: boolean) => ({
			resolve: async ({ request }: Context) => {
				if (!enabled) throw new PublicApiAuthError('missing');
				return { publicClient: await resolvePublicClient(request.headers) };
			},
		}),
	});
}
