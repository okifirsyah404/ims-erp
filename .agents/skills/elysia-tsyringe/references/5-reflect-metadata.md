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

- `@inject()` on constructor parameters relies on `design:paramtypes`
  metadata. Bun tolerates its absence in some paths — until the module
  graph changes and injections silently become `undefined`.
- Node runtimes (tests, Docker switches) hard-require the polyfill.
- First-line placement guarantees it loads before any decorated class.

## Anti-patterns

- Importing it inside a feature module instead of the entrypoint.
- Removing it because "Bun runs fine without it".
