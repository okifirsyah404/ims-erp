# Testing

Use `bun:test` and exercise the real plugin; the behaviour under test is the
plugin's, not a mock of it.

## Harness

```ts
import { describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'
import { createInstance } from 'i18next'
import { i18next } from 'elysia-i18next'
import { en, id } from '@ims-erp/locales'

const build = () => {
  const instance = createInstance() // fresh per app: no leakage between tests
  return new Elysia()
    .use(
      i18next({
        instance,
        initOptions: {
          fallbackLng: 'en',
          supportedLngs: ['en', 'id'],
          defaultNS: 'common',
          keySeparator: false,
          nsSeparator: ':',
          resources: { en, id },
        },
      }),
    )
    .get('/', ({ t }) => t('common:language.switchToEnglish'))
}
```

Build the app **inside** each test (or in `beforeEach`). A module-scope app plus
the default singleton is the usual cause of an order-dependent failure.

Call `app.handle(new Request('http://localhost/'))` rather than `.listen()`; no
port, no cleanup.

## Asserting detection precedence

| Source | Request |
| --- | --- |
| query | `new Request('http://localhost/?lang=id')` |
| cookie | `new Request('http://localhost/', { headers: { cookie: 'lang=id' } })` |
| header | `new Request('http://localhost/', { headers: { 'accept-language': 'id' } })` |
| store | route/hook sets `store.language = 'id'` |
| default | no headers → English |

The two tests worth writing explicitly, because they encode the README/code
divergence:

```ts
it('a lang cookie beats store.language', async () => {
  const app = new Elysia()
    .onRequest(({ store }) => { (store as any).language = 'id' })
    .use(i18next({ ...opts }))
    .get('/', ({ t }) => t('common:language.switchToEnglish'))

  const res = await app.handle(
    new Request('http://localhost/', { headers: { cookie: 'lang=en' } }),
  )
  expect(await res.text()).toBe(en.common['language.switchToEnglish']) // cookie wins
})

it('falls back to fallbackLng with no signal', async () => {
  const res = await build().handle(new Request('http://localhost/'))
  expect(await res.text()).toBe(en.common['language.switchToEnglish'])
})
```

## Asserting per-request isolation

Concurrent requests must not bleed languages. This is the regression test for
anyone tempted to hoist `t` or reuse a root instance:

```ts
it('isolates language per request', async () => {
  const app = build()
  const [a, b] = await Promise.all([
    app.handle(new Request('http://localhost/?lang=id')),
    app.handle(new Request('http://localhost/?lang=en')),
  ])
  expect(await a.text()).toBe(id.common['language.switchToEnglish'])
  expect(await b.text()).toBe(en.common['language.switchToEnglish'])
})
```

## Asserting unsupported tags fall back

```ts
it('unknown language falls back, does not leak the tag', async () => {
  const res = await build().handle(
    new Request('http://localhost/', { headers: { 'accept-language': 'xx-YY' } }),
  )
  expect(await res.text()).toBe(en.common['language.switchToEnglish'])
})
```

## Checklist

- Fresh `createInstance()` (or fresh app) per test.
- Prefer `app.handle(new Request(...))`; assert with `await res.text()` or
  `await res.json()`.
- Cover at least: default language, one explicit signal, and the precedence
  pair you rely on.
- For routes that translate errors, assert the localised message **and** the
  stable `code` key, so tests do not depend on English wording.
