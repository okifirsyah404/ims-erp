# 2.5 Import reflect-metadata at the Entrypoint

**Impact: HIGH**

## The Rule

`import 'reflect-metadata';` is the first line of `src/index.ts`. Required
even though Bun appears to work without it.

## Canonical Example (from this repo)

`apps/backend/src/index.ts`:

```typescript
import 'reflect-metadata';
import { wrap } from '@bogeychan/elysia-logger';
// ...
```

Real boot crash without it: `error: tsyringe requires a reflect polyfill.
Please add 'import "reflect-metadata"' to the top of your entry point.`

## Why

- tsyringe's CJS entry does a hard precondition check at module load:
  `if (typeof Reflect === "undefined" || !Reflect.getMetadata) throw ...`.
  Native `design:paramtypes` emission does not define `Reflect.getMetadata`,
  so the throw fires on every runtime — Bun included.
- `@inject()` on constructor parameters additionally relies on
  `design:paramtypes` metadata, so the polyfill must be present before any
  decorated class is imported.
- First-line placement guarantees it loads before `tsyringe` itself.

## Anti-patterns

- Importing it inside a feature module instead of the entrypoint.
- Removing it because "Bun emits metadata natively, so the polyfill is
  unnecessary" — true of emission, false of tsyringe's `Reflect.getMetadata`
  guard. Verified 2026-11-02: removal makes `bun run dev` exit 255.
