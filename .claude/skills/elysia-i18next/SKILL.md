---
name: elysia-i18next
description: Server-side internationalization for this project's Elysia backend via the elysia-i18next plugin - injects request-scoped `t` and `i18n` into context, detects the request language from query/cookie/path/store/header, and serves translations from i18next initOptions or a supplied instance. Use when translating backend responses, validation or error messages, wiring elysia-i18next into an Elysia app, writing a custom language detector, or reading `t` in a controller. Does NOT cover react-i18next frontend work (use i18n), Better Auth's own `@better-auth/i18n` plugin config (use better-auth-best-practices), or Elysia plugin/lifecycle mechanics in general (use elysiajs).
license: MIT
metadata:
  author: OpenAgentic
  version: "1.0.0"
  dependsOn: elysiajs
  canonicalExample: apps/backend/src/providers/better-auth/plugins/i18n.auth.ts
  source: https://github.com/eelkevdbos/elysia-i18next
---

# elysia-i18next

Wraps [i18next](https://www.i18next.com/) as an Elysia plugin. Two things land in
context on every request: `t` (a translate function bound to that request's
language) and `i18n` (the i18next instance that produced it).

Peer requirements: `elysia >= 1.0.1`, `i18next >= 23.5.1`. This project ships
`elysia-i18next` `^4.0.3` and `i18next` `^26` in `apps/backend`.

## Minimal wiring

```ts
import { Elysia } from 'elysia'
import { i18next } from 'elysia-i18next'

new Elysia()
  .use(
    i18next({
      initOptions: {
        fallbackLng: 'en',
        resources: {
          en: { translation: { greeting: 'Hi' } },
          id: { translation: { greeting: 'Halo' } },
        },
      },
    }),
  )
  .get('/', ({ t }) => t('greeting'))
```

`t` is only typed on routes registered **after** `.use(i18next(...))`. Declare
the plugin on a base instance and `.use()` that, rather than relying on later
inheritance to give children the static type.

## Critical rules

- **Detection order is query → cookie → path param → store → `accept-language`.** Not the order the upstream README lists (it claims store first). Both `lang` cookie and `?lang=` beat a `store.language` value. See [detection](references/2-language-detection.md).
- **Translations live in `@ims-erp/locales`** (`en` + `id`, five namespaces, flat dot-keys). Mount with `keySeparator: false`, `nsSeparator: ':'`, and `resources: { en, id }`; guard detected codes with `isLanguageCode`. See [resources](references/4-instance-and-resources.md).
- **`t` is per-request.** The plugin calls `instance.cloneInstance()` on every request to isolate language. Never hoist `t` into module scope, never cache it, never expect `ctx.i18n.changeLanguage()` to leak into the next request.
- **Detection runs in `onBeforeHandle`.** Any `onRequest` / `onTransform` / `onParse` / `onBeforeHandle` hook registered *before* the plugin still sees the default language. Register the plugin early, or re-translate in the handler.
- **Default language comes from `initOptions.lng`, not the request.** With no detectable language the detector returns nothing and the clone keeps the init default.
- **Prefer `instance: createInstance()` over the module-level singleton** when several apps, tests, or modules share one process. The plugin falls back to the global `i18next` singleton, whose resources are process-wide mutable state. See [instances](references/4-instance-and-resources.md).
- **`accept-language` is passed through raw.** The plugin does no q-value negotiation; i18next resolves it. If you need exact `en-GB;q=0.9,en;q=0.8` semantics or a project-specific allowlist, write a custom detector.

## Where to look next

| Task | Reference |
| --- | --- |
| Understand what the plugin does under the hood | [plugin anatomy](references/1-plugin-anatomy.md) |
| Control language resolution, override per route | [language detection](references/2-language-detection.md) |
| Keys, interpolation, plurals, namespaces, typed `t` | [translation patterns](references/3-translation-patterns.md) |
| Resources, `instance` vs `initOptions`, isolation | [instances and resources](references/4-instance-and-resources.md) |
| Test routes that translate | [testing](references/5-testing.md) |

Project-specific mounting status and the overlap with `@better-auth/i18n` are in
[AGENTS.md](AGENTS.md) — read it before wiring this plugin into `apps/backend`.
