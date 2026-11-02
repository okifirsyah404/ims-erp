/**
 * Request-scoped translation access for the backend.
 *
 * @remarks
 * `elysia-i18next` injects `t` into every route context, but its shipped
 * declarations are generated against a different Elysia version and collapse
 * the context type to `any` when used directly (see `src/index.ts`). Rather
 * than let that destroy Elysia's inference, the plugin is cast at mount time
 * and its `t` is read through {@link translator}.
 *
 * The key space is still type-checked: {@link ApiKey} is derived from the
 * `api` namespace of `@ims-erp/locales`, and the locale parity test keeps `en`
 * and `id` in sync.
 */
import {
	DEFAULT_LANGUAGE,
	LANGUAGE_CODES,
	en,
	id,
	type LanguageCode,
} from '@ims-erp/locales';
import { createInstance } from 'i18next';
import type { en as EnBundle } from '@ims-erp/locales';

/** A key in the `api` namespace — the backend's own message catalogue. */
export type ApiKey = keyof typeof EnBundle.api;

/** Minimal context shape we read from; avoids depending on Elysia's generics. */
type I18nContext = { t?: (key: string, options?: object) => string };

/** The accepted header name, checked case-insensitively by `Headers`. */
const LANGUAGE_HEADER = 'accept-language';

/**
 * Picks the best supported language from an `Accept-Language` value.
 *
 * @remarks
 * Handles the q-weighted form browsers send (`id-ID,id;q=0.9,en;q=0.8`) by
 * walking the entries in order and returning the first whose primary subtag
 * is supported. Anything unmatched falls back to {@link DEFAULT_LANGUAGE}.
 */
export function resolveLanguage(
	header: string | null | undefined,
): LanguageCode {
	if (!header) return DEFAULT_LANGUAGE;
	for (const entry of header.split(',')) {
		const tag = entry.split(';')[0]?.trim().toLowerCase();
		if (!tag) continue;
		const primary = tag.split('-')[0] ?? '';
		const match = LANGUAGE_CODES.find((code) => code === primary);
		if (match) return match;
	}
	return DEFAULT_LANGUAGE;
}

/**
 * Extracts the request-scoped translator from an Elysia context.
 *
 * @remarks
 * Falls back to returning the key unchanged, which keeps a misconfigured
 * instance returning keys (visible in tests) instead of throwing at runtime.
 */
export function translator(
	context: unknown,
): (key: ApiKey, options?: object) => string {
	const t = (context as I18nContext | null | undefined)?.t;
	if (typeof t !== 'function') {
		return (key) => key;
	}
	return (key, options) => t(`api:${key}`, options);
}

/**
 * Translates an `api` key outside a route context.
 *
 * @remarks
 * For hooks that run inside Better Auth, where Elysia's request-scoped `t` is
 * not on the context. Resolves {@link resolveLanguage} from the request
 * headers against the same resource bundles the Elysia plugin uses, so callers
 * get the same text with the same fallback.
 */
export function translateForRequest(
	key: ApiKey,
	headers: Headers | undefined,
	options?: Record<string, unknown>,
): string {
	const instance = createInstance();
	const lng = resolveLanguage(headers?.get(LANGUAGE_HEADER));
	instance.init({
		lng,
		fallbackLng: DEFAULT_LANGUAGE,
		supportedLngs: [...LANGUAGE_CODES],
		keySeparator: false,
		nsSeparator: ':',
		interpolation: { escapeValue: false },
		resources: { en, id } as never,
	});
	return instance.t(`api:${key}`, options ?? {}) as string;
}
