# Translation patterns

## Reading `t` in a handler

`t` and `i18n` are on context for every route that inherits the plugin:

```ts
.get('/:id', ({ params, t }) => ({ title: t('invoice.title') }))
```

`t` is typed `i18n['t']`. In a layered backend the handler is the controller
layer, so translation belongs there, not in services or repositories — those
should stay language-agnostic and return message **keys** plus parameters.

## Keys and namespaces

This project's bundles live in `@ims-erp/locales` with **flat dot-keys** and five
namespaces (`common`, `nav`, `auth`, `account`, `admin`). Keys are qualified with
`:`:

```ts
import type { TranslationKey } from '@ims-erp/locales'

t('nav:item.warehouses')
t('auth:login.invalidCredentials')
t('common:language.switchToEnglish')
```

Rules:

- **`keySeparator: false` is mandatory.** The dot in `sessions.revokeAll` is part
  of the key, not nesting. With the default separator i18next walks
  `sessions` → `revokeAll`, finds nothing, and returns the raw key.
- **Use `:` to scope a namespace**, never `.`. `nsSeparator` is `':'`.
- **Type keys with `TranslationKey`**, not bare strings, so a typo fails at
  compile time. Add new keys to `packages/locales/src/en/<ns>.ts` and mirror them
  in `id` — `locale-parity.test.ts` fails otherwise.
- Prefer keys that describe the message, not the English wording:
  `error.duplicateEmail`, not `Email already in use`.

## Interpolation

```ts
// en: { "welcome": "Welcome, {{name}}" }
t('welcome', { name: user.name })
```

i18next escapes interpolation values by default. Pass `interpolation: { escapeValue: false }`
when values are already safe and you expect HTML-free output. Never interpolate
raw user input into a string you render as HTML.

## Plurals

```ts
// en: { "items": "{{count}} item", "items_plural": "{{count}} items" }
t('items', { count: n })
```

`count` is the reserved variable that selects the plural form. Always pass it for
pluralised keys; omitting it resolves the singular. Locale-specific plural rules
come from i18next; do not hand-roll `n === 1 ? … : …`.

## Returning translated errors

Return the translated string as the message, and keep the key visible for
machines in the envelope:

```ts
import type { TranslationKey } from '@ims-erp/locales'

const key: TranslationKey = 'auth:login.invalidCredentials'
throw new NotFoundError({ message: t(key), code: key })
```

Do not re-translate an already-translated message later in the stack — that
produces `t('Invalid email or password')`, which is a missing key.

The `code` must stay the untranslated key so clients and tests never depend on
English wording.

## Typed keys

`packages/locales/src/i18next.d.ts` already augments i18next, so in any package
that depends on `@ims-erp/locales` the keys are typed with no codegen. Use the
exported key types at boundaries:

```ts
import type { TranslationKey, CommonKey } from '@ims-erp/locales'

const item: { labelKey: CommonKey } = { labelKey: 'language.switchToEnglish' }
```

Note the augmentation registers per-namespace resources through
`ResourceNamespaceMap` (not `CustomTypeOptions['resources']`, which is a single
interface member and would collide with TS2717 if a second package added
namespaces). Follow that pattern if you ever need to register more namespaces
from another package.

## What not to translate

- Log lines, metrics, and internal exception messages — keep English.
- Better Auth's own errors: they are already localised by
  `@better-auth/i18n`. See [AGENTS.md](../AGENTS.md).
- Data values (names, codes, amounts). Format with `Intl`, not `t()`:
  `new Intl.NumberFormat(lng, { style: 'currency', currency: 'IDR' })`, with
  `lng` read from `i18n.language`.
