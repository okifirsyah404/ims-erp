/**
 * Types every `t()` call in the app against the English bundles.
 *
 * `en` is the source of truth (every other locale mirrors its key set), so
 * `typeof en.<ns>` gives `t()` completions and typo errors with no codegen.
 *
 * Augmenting `ResourceNamespaceMap` rather than `CustomTypeOptions['resources']`
 * because that slot is a single interface member: a second package adding its
 * own namespaces would collide with TS2717. `ResourceNamespaceMap` is the
 * per-package registry meant for exactly this.
 */
import 'i18next';
import type { en, Namespace } from './en';

declare module 'i18next' {
	interface ResourceNamespaceMap {
		common: typeof en.common;
		nav: typeof en.nav;
		auth: typeof en.auth;
		account: typeof en.account;
		admin: typeof en.admin;
		inventory: typeof en.inventory;
		assets: typeof en.assets;
		dashboard: typeof en.dashboard;
		api: typeof en.api;
	}

	interface CustomTypeOptions {
		/**
		 * Keys are called with an explicit namespace scope (`useTranslation('nav')`,
		 * `useTranslation(['admin', 'common'])`) throughout the app, so the bare
		 * default namespace has no meaningful value. Widening it to every namespace
		 * keeps unqualified keys resolving against the hook's scope instead of being
		 * forced into one namespace — with a single literal here, `t('sessions.x')`
		 * under `useTranslation('account')` would be checked against `common` and
		 * wrongly rejected.
		 */
		defaultNS: Namespace;
		/**
		 * The bundles use flat dot-keys (`sessions.revokeAll`) rather than nested
		 * objects, so the separator must be disabled: with `'.'`, i18next walks the
		 * key segment by segment and resolves `sessions` → `revokeAll`, finds nothing,
		 * and every `t()` return type degrades to `string` with no interpolation
		 * checking. `false` treats the whole key as one flat lookup.
		 */
		keySeparator: false;
		nsSeparator: ':';
		returnNull: false;
		returnObjects: false;
		/** A key with `{{vars}}` requires those options: they cannot be omitted. */
		strictInterpolationChecks: true;
	}
}
