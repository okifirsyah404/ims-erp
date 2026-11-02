import { i18n, locales } from '@better-auth/i18n';

/**
 * Translates Better Auth's own error messages (invalid credentials,
 * expired invitation, ...) at the source, keyed off the request's
 * `Accept-Language` header.
 *
 * The web-admin sends that header from its active i18next language, so a
 * language switch is reflected in backend errors without the client ever
 * matching on English strings. `en` is the default/fallback locale, keeping
 * non-localised callers (tests, curl, cron) on English.
 */
export const betterAuthI18nPlugin = i18n({
	translations: {
		en: locales.en,
		id: locales.id,
	},
	detection: ['header'],
	defaultLocale: 'en',
});
