import { en } from './en';
import type { Namespace as NamespaceName } from './en';
import { id } from './id';

export { en, id };
export type { Namespace } from './en';

/** Every key within a single namespace. */
export type NamespaceKey<N extends NamespaceName> = keyof (typeof en)[N] & string;

/** A key qualified with its namespace, e.g. `nav:item.warehouses`. */
export type TranslationKey = {
	[N in NamespaceName]: `${N}:${NamespaceKey<N>}`;
}[NamespaceName];

/** Keys of the `nav` namespace, for sidebar/shell item definitions. */
export type NavKey = NamespaceKey<'nav'>;
/** Keys of the `account` namespace, for the account page tabs. */
export type AccountKey = NamespaceKey<'account'>;
/** Keys of the `common` namespace, e.g. the language switcher labels. */
export type CommonKey = NamespaceKey<'common'>;

/** Locale codes the app ships translations for. */
export const LANGUAGE_CODES = ['en', 'id'] as const;

export type LanguageCode = (typeof LANGUAGE_CODES)[number];

/** Languages offered by the switcher, in display order. */
export const LANGUAGES = [
	{ code: 'en', labelKey: 'language.switchToEnglish', short: 'EN' },
	{ code: 'id', labelKey: 'language.switchToIndonesian', short: 'ID' },
] as const satisfies ReadonlyArray<{
	code: LanguageCode;
	labelKey: CommonKey;
	short: string;
}>;

export const DEFAULT_LANGUAGE: LanguageCode = 'en';

/** Every i18next namespace, in the order resources are registered. */
export const NAMESPACES = ['common', 'nav', 'auth', 'account', 'admin', 'inventory', 'dashboard', 'api', 'settings', 'crm', 'sales', 'finance', 'procurement', 'projects', 'licensing'] as const;

/** Narrows an arbitrary string (e.g. a detector result) to a shipped code. */
export function isLanguageCode(value: string | null | undefined): value is LanguageCode {
	return !!value && (LANGUAGE_CODES as readonly string[]).includes(value);
}