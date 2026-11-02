# Language detection

## The default detector

`newLanguageDetector` with `searchParamName: 'lang'`, `cookieName: 'lang'`,
`pathParamName: 'lang'`, `storeParamName: 'language'`, `headerName: 'accept-language'`.

## Actual precedence

The implementation short-circuits in this order. This is **not** the order the
upstream README documents (it lists the store first):

| # | Source | Example |
| --- | --- | --- |
| 1 | query parameter `lang` | `/invoices?lang=id` |
| 2 | cookie `lang` | `lang=id` |
| 3 | route path parameter named `lang` | `/id/invoices` |
| 4 | `store.language` | set by an earlier hook |
| 5 | `accept-language` header | `Accept-Language: id-ID,id;q=0.9` |
| – | otherwise `null` | clone keeps `initOptions.lng` |

Two traps fall out of this:

- **A `lang` cookie silently beats `store.language`.** If you set the language
  from an authenticated user's profile in an `onBeforeHandle`, a leftover browser
  cookie overrides it. Delete the cookie, use a different cookie name, or write a
  custom detector with the store first.
- **A path parameter wins over the store but loses to the cookie.** URLs like
  `/:lang/...` are therefore sticky only for clients without the cookie.

The lookup is also strictly case-sensitive on the names: `?locale=` and a
`Accept-Language` header are the only built-ins you get beyond the five above.

## Store-based override (per route)

`store` is writable from an earlier hook, so this is the sanctioned way to make a
single route translate to a fixed language:

```ts
new Elysia()
  .use(i18next({ initOptions }))
  .get('/export', ({ store, t }) => t('export.ready'), {
    beforeHandle: ({ store }) => {
      ;(store as any).language = 'en' // still loses to ?lang / cookie
    },
  })
```

If a route must be immune to the query/cookie, that is the wrong tool — write a
custom detector instead.

## Custom detectors

`detectLanguage` receives the full Elysia context and may be async:

```ts
import type { LanguageDetector } from 'elysia-i18next'
import { DEFAULT_LANGUAGE, isLanguageCode } from '@ims-erp/locales'

const fromUserProfile: LanguageDetector = ({ user, request }) => {
  // store.language set early, checked first so a stale `lang` cookie cannot win
  const profile = (user as { locale?: string } | undefined)?.locale
  if (isLanguageCode(profile)) return profile

  const header = request.headers.get('accept-language') ?? ''
  const preferred = header.split(',')[0]?.split(';')[0]?.trim()
  if (isLanguageCode(preferred)) return preferred

  return DEFAULT_LANGUAGE
}
```

Rules that matter:

- **Use `isLanguageCode`**, not an ad-hoc set. It narrows to `'en' | 'id'` and
  keeps the detector in sync with `LANGUAGE_CODES`.
- Returning a value is safe only because the guard rejected everything else;
  returning an unconfigured tag leaves the clone on a language with no resources
  and raw keys in responses. `null` also works and leaves `initOptions.lng`.
- **Be aware the detector runs per request** inside `onBeforeHandle`. Keep it
  cheap and avoid throwing — a rejected detector fails the request.

### Header subtleties

The default detector returns the raw `accept-language` string and hands it to
i18next, which does its own parsing and fallback. It performs no explicit
q-value ordering and no allowlist filtering. When exactness matters (regional
tags, `q=0` rejection, matching only your supported set), normalize in a custom
detector as above rather than post-processing the result.

## Lifecycle ordering

Detection runs in `onBeforeHandle({ as: 'global' })`, which fires **after**
`onRequest`, `onTransform`, `onParse`, and any `onBeforeHandle` registered before
the plugin.

```ts
new Elysia()
  .onRequest(({ store }) => {
    store.language = 'id' // detected later: store is read in onBeforeHandle, OK
  })
  .use(i18next({ initOptions }))
  .onBeforeHandle(({ t }) => {
    // runs BEFORE the plugin's own onBeforeHandle -> still default language
  })
  .get('/', ({ t }) => t('greeting')) // correct language here
```

Guidance: register `i18next()` before any hook that reads `t`, and set
`store.language` from an `onRequest`/`onTransform` hook (early) rather than a
later one.

## Testing detection

See [testing](5-testing.md) for header/cookie/query/param-driven assertions and
for resetting the language between tests.
