# Instances and resources

## Two ways to supply i18next

| Option | Behaviour |
| --- | --- |
| `initOptions` only (default) | Uses the module-level i18next singleton, `init`s it once, clones per request. |
| `instance` | Uses your instance. `init(initOptions)` is called only if `!isInitialized`. |

```ts
import { createInstance } from 'i18next'
import { i18next } from 'elysia-i18next'

const i18nInstance = createInstance()

new Elysia().use(
  i18next({
    instance: i18nInstance,
    initOptions: { fallbackLng: 'en', resources },
  }),
)
```

## Why prefer `createInstance()`

The plugin's fallback is the shared `i18next` default export. That singleton is
process-wide mutable state:

- Several Elysia apps in one process share it.
- `bun:test` files share it — one file's `init` leaks into the next.
- Anything that imports `i18next` directly (migrations, jobs, scripts) may
  `init` it first, after which the plugin's `initOptions` are **skipped** because
  the instance is already initialized.
- `changeLanguage` on the shared root (not the clone) affects everyone.

An explicit `createInstance()` gives each app its own resource store and options
and makes tests independent.

## The `isInitialized` trap

```ts
if (!_instance.isInitialized) await _instance.init(options.initOptions)
```

If translations do not appear, the first question is whether the instance was
already initialized elsewhere with different options. Symptoms: raw keys in
responses, or the wrong `fallbackLng`. Fix by giving the app its own
`createInstance()`, or by explicitly awaiting `init` yourself before mounting.

## Loading resources

### Inline (small, static)

```ts
initOptions: {
  fallbackLng: 'en',
  supportedLngs: ['en', 'id'],
  resources: {
    en: { translation: { greeting: 'Hi' } },
    id: { translation: { greeting: 'Halo' } },
  },
}
```

### From this project's `@ims-erp/locales` package (preferred)

`packages/locales` already owns the bundles. Do not create a second set of
translation files under `apps/backend`.

```ts
import { createInstance } from 'i18next'
import { DEFAULT_LANGUAGE, NAMESPACES, en, id } from '@ims-erp/locales'

const i18nInstance = createInstance()

initOptions: {
  fallbackLng: DEFAULT_LANGUAGE, // 'en'
  supportedLngs: [...LANGUAGE_CODES], // ['en', 'id']
  defaultNS: 'common',
  keySeparator: false, // bundles use flat dot-keys: 'sessions.revokeAll'
  nsSeparator: ':',
  interpolation: { escapeValue: false },
  resources: { en, id }, // each locale is a namespace map
}
```

`en` is the source of truth; `packages/locales/src/locale-parity.test.ts`
enforces that `id` mirrors its key set. Never add a key to only one locale.

`cloneInstance()` shares the parent's store, so loading once at boot is enough.
Prefer one boot-time object over `i18next-http-backend` or filesystem backends —
the server has no need for lazy loading, and a backend would make each request's
language depend on I/O timing.

### Configuration that matters for a server

```ts
initOptions: {
  fallbackLng: 'en',            // what an undetectable request gets
  supportedLngs: ['en', 'id'],  // allowlist; anything else falls back
  defaultNS: 'common',
  keySeparator: false,          // MUST match the bundles — see translation patterns
  nsSeparator: ':',
  interpolation: { escapeValue: false }, // server output is JSON, not HTML
}
```

`keySeparator: false` is not optional here: the bundles are flat dot-keys, so the
`.': ` default would make `t('sessions.revokeAll')` resolve nothing.

`supportedLngs` matters because the default detector returns whatever the client
sent. Without it, `Accept-Language: xx-YY` becomes the active language.

## Replacing resources at runtime

Because the store is shared, `i18nInstance.addResourceBundle(lng, ns, obj)` on the
configured instance updates every subsequent request's clone. Do this for
config-driven or DB-backed translations, and cache it — do not load per request.

## Multiple apps / routes with different language sets

Mount separate `i18next()` plugins with distinct `createInstance()` instances on
separate Elysia instances. Do not mount two plugins with the same options on the
same instance: Elysia dedupes by `name` + `seed`, so the second is a no-op.
