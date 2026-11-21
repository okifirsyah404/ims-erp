/**
 * The portal's language (owner decision 2026-11-21): kept by the portal itself in a cookie and
 * sent to the ERP as `Accept-Language` on every call, the way web-admin sends
 * `currentLanguage()`. The ERP stores no language for a portal login.
 */
export const PORTAL_LANGUAGES = ["en", "id"] as const;
export type PortalLanguage = (typeof PORTAL_LANGUAGES)[number];

/** The portal copy is English, so English is the default until the visitor picks another. */
export const DEFAULT_LANGUAGE: PortalLanguage = "en";

export const LANGUAGE_COOKIE = "portal_lang";
/** One year: a language choice outlives sign-out. */
export const LANGUAGE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isPortalLanguage(value: unknown): value is PortalLanguage {
  return typeof value === "string" && (PORTAL_LANGUAGES as readonly string[]).includes(value);
}

/** A cookie value → a supported language, or the default for anything else. */
export function resolveLanguage(value: string | undefined | null): PortalLanguage {
  return isPortalLanguage(value) ? value : DEFAULT_LANGUAGE;
}
