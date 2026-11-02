# Plugin anatomy

The whole library is ~89 lines. Knowing its shape explains every behaviour
documented in the other references.

## Exports

| Export | Kind |
| --- | --- |
| `i18next(userOptions)` | Elysia plugin factory |
| `newLanguageDetector(opts)` | builds a default-style detector |
| `I18NextPluginOptions` | `{ initOptions, detectLanguage, instance }` |
| `LanguageDetector` | `(ctx) => null \| string \| Promise<string \| null>` |
| `LanguageDetectorOptions` | `{ storeParamName, searchParamName, headerName, cookieName, pathParamName }` |
| `I18NextRequest` | `{ i18n, t }` |

## The plugin body

```ts
export const i18next = (userOptions: Partial<I18NextPluginOptions>) => (app: Elysia) => {
  const options = { ...defaultOptions, ...userOptions }
  return app.use(
    new Elysia({ name: 'elysia-i18next', seed: options })
      .derive({ as: 'global' }, async () => {
        const _instance = options.instance || lib          // module singleton
        if (!_instance.isInitialized) await _instance.init(options.initOptions)
        const _clone = _instance.cloneInstance()
        return { i18n: _clone, t: _clone.t }
      })
      .onBeforeHandle({ as: 'global' }, async (ctx) => {
        const lng = await options.detectLanguage(ctx)
        if (lng) await ctx.i18n.changeLanguage(lng)
      }),
  )
}
```

Four consequences follow directly.

### 1. Named instance with `seed` → registration dedupe

`name: 'elysia-i18next'` plus `seed: options` lets Elysia recognise a repeated
`.use(i18next(sameOptions))` and skip re-registering it. Options are compared by
value, so two calls are only deduped when their options are structurally equal.
Passing a fresh inline object with a custom `detectLanguage` closure on every call
defeats the dedupe.

### 2. `derive` is `as: 'global'`

`t` and `i18n` appear on context for **every** route in the app that inherits this
plugin — including routes of modules that never mention i18n. They are derived
before validation, so `onBeforeHandle` validators can read `t` too.

The derive runs on each request, which is why a clone is made per request.

### 3. `cloneInstance()` per request

`cloneInstance()` produces an independent language state that shares the parent's
translator, resource store, and options. `changeLanguage` on the clone therefore
does not affect the parent or concurrent requests — this is what makes the plugin
concurrency-safe for language.

It also means:

- Resources are shared. Loading a namespace on one request's clone is visible to
  others (same store), but `changeLanguage` is not.
- `t` is captured from the clone at derive time. It is safe inside the handler.
  Hoisting it, storing it on `store`, or keeping it beyond the request is not.

### 4. `onBeforeHandle` runs after earlier hooks

`onBeforeHandle({ as: 'global' })` runs just before the route handler. Hooks
registered before the plugin — `onRequest`, `onTransform`, `onParse`, and earlier
`onBeforeHandle` — run before the language is switched. See
[detection](2-language-detection.md#lifecycle-ordering).

## Initialization

`_instance.init(options.initOptions)` is called only when
`!isInitialized`. A previously-initialized instance keeps its own resources and
options; `initOptions` are then effectively ignored. That is the source of the
classic "my translations do not load" bug when reusing the module singleton after
something else initialized it.

`options.instance || lib` — passing `instance: null` (the default) means the
process-wide `i18next` default export.
