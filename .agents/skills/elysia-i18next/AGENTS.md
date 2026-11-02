# elysia-i18next in this repository

## Current status: installed, not mounted

`apps/backend/package.json` declares `elysia-i18next ^4.0.3` and `i18next ^26.6.0`,
but **no module currently calls the `i18next()` plugin**. Grep confirms the only
i18next reference under `apps/backend/src` is a comment.

Do not assume `t` is available in a controller. Check for an `.use(i18next(...))`
on the instance that owns the route first.

## There is already an i18n layer for auth errors

`apps/backend/src/providers/better-auth/plugins/i18n.auth.ts` registers
`@better-auth/i18n` with `detection: ['header']` and `defaultLocale: 'en'`, so
Better Auth's own error messages (invalid credentials, expired invitation, …)
are translated at the source from `Accept-Language`.

Consequences when wiring `elysia-i18next`:

- **Do not translate Better Auth error strings again.** They arrive already
  localised. Wrapping them in `t()` double-translates or, worse, leaves the
  English text as an untranslated key.
- **Keep the two header-driven.** The web-admin sends `Accept-Language` from its
  active i18next language. `elysia-i18next` reads the same header last in its
  precedence chain, so the two agree as long as you do not shadow the header
  with a cookie or `?lang=` on auth routes.
- **Do not mount a second `@better-auth/i18n`** with different translations to
  "unify" the two. The Better Auth plugin owns its locale bundles.

## Mounting it, when a task calls for it

Put the plugin on a base instance near the app composition root so every route
inherits the typed `t` and the global hooks run early:

```ts
// apps/backend/src/app/index.ts (or whichever instance owns the routes)
import { createInstance } from 'i18next'
import { i18next } from 'elysia-i18next'
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_CODES,
  NAMESPACES,
  en,
  id,
} from '@ims-erp/locales'

export const i18nInstance = createInstance()

export const app = new Elysia()
  .use(
    i18next({
      instance: i18nInstance,
      initOptions: {
        fallbackLng: DEFAULT_LANGUAGE,
        supportedLngs: [...LANGUAGE_CODES],
        defaultNS: 'common',
        keySeparator: false, // bundles are flat dot-keys
        nsSeparator: ':',
        interpolation: { escapeValue: false },
        resources: { en, id },
      },
    }),
  )
  // ...modules
```

Why an explicit `createInstance()` rather than the default: the plugin otherwise
falls back to the module-level i18next singleton, which `bun:test` files and
several Elysia instances in one process would share and mutate.

Add `@ims-erp/locales` to `apps/backend/package.json` as a workspace dependency
before importing it.

Use `fallbackLng` plus `supportedLngs` as an allowlist. The default detector
returns whatever the client sent, so an unsupported tag otherwise becomes an
active language with no resources.

## Related packages and skills

- `packages/locales` (`@ims-erp/locales`) — the translation bundles, key types
  (`TranslationKey`, `NavKey`, `CommonKey`), `LANGUAGE_CODES`, `isLanguageCode`,
  and the `i18next.d.ts` augmentation. Source of truth is `en`; `id` mirrors it.
- `packages/locales/src/locale-parity.test.ts` — fails when a locale drifts.
- `i18n` skill — react-i18next in `apps/web-admin`. Frontend only.
- `elysiajs` skill — plugin, lifecycle, and context mechanics this skill builds
  on.
- `better-auth-best-practices` — Better Auth plugin configuration, including
  `@better-auth/i18n`.
