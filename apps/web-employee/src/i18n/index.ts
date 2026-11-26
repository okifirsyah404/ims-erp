import {
	DEFAULT_LANGUAGE,
	en,
	id,
	isLanguageCode,
	LANGUAGES,
	NAMESPACES,
	type LanguageCode,
} from '@ims-erp/locales';
// Type-only: registers the `i18next` augmentation that types every `t()` key.
import type {} from '@ims-erp/locales/i18next';
import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

/** localStorage key holding the user's explicit language choice. */
export const LANGUAGE_STORAGE_KEY = 'ui-locale';

/**
 * App i18next instance.
 *
 * @remarks
 * - Only `en` and `id` are supported; anything else (e.g. `fr`) falls back to
 *   English via `fallbackLng`, and regional tags (`id-ID`, `en-GB`) collapse
 *   to their base language through `load: 'languageOnly'`.
 * - Detection order is localStorage first so an explicit choice survives
 *   reloads, then the browser's preference list.
 * - No URL/query detection on purpose: this is a TanStack Router SPA and
 *   `?lng=` would collide with route `search` validation.
 * - `escapeValue` is off because React already escapes interpolated values.
 */
export const i18nInstance = i18n.createInstance();

/**
 * Result of the single `init` call. Every other helper awaits this, so the
 * instance is never initialised twice (i18next forbids it).
 */
const ready = i18nInstance.use(LanguageDetector).use(initReactI18next).init({
	resources: { en, id },
	supportedLngs: LANGUAGES.map((language) => language.code),
	fallbackLng: DEFAULT_LANGUAGE,
	load: 'languageOnly',
	ns: [...NAMESPACES],
	defaultNS: 'common',
	interpolation: { escapeValue: false },
	detection: {
		order: ['localStorage', 'navigator'],
		caches: ['localStorage'],
		lookupLocalStorage: LANGUAGE_STORAGE_KEY,
		// Ignore browser languages we don't ship, so `fr-FR` doesn't get stored
		// as a "choice" the user never made.
		convertDetectedLanguage: (value) => {
			const base = value.split('-')[0]?.toLowerCase();
			return isLanguageCode(base) ? base : DEFAULT_LANGUAGE;
		},
	},
	react: {
		// Components re-render on `changeLanguage` without an extra provider.
		useSuspense: false,
	},
});

/** Current language narrowed to a shipped code (never `undefined`). */
export function currentLanguage(): LanguageCode {
	const base = i18nInstance.language.split('-')[0] ?? DEFAULT_LANGUAGE;
	return isLanguageCode(base) ? base : DEFAULT_LANGUAGE;
}

/**
 * Switches language and keeps `<html lang>` in sync.
 *
 * Applied immediately (not via an effect) so the DOM attribute matches what
 * assistive tech and search engines read as soon as the UI changes.
 */
export async function changeLanguage(code: LanguageCode): Promise<void> {
	await i18nInstance.changeLanguage(code);
	document.documentElement.lang = code;
}

/**
 * Boots i18n before the first render. i18next requires `init` to resolve
 * before `t()` is called, so the app must not mount until this settles —
 * otherwise the first paint shows raw keys.
 */
export async function setupI18n(): Promise<void> {
	await ready;
	document.documentElement.lang = currentLanguage();
}
