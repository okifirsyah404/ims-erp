# 2.1 Import reflect-metadata on Node Runtimes

**Impact: HIGH**

## The Rule

Constructor-parameter injection (`@inject(TOKEN)` without an explicit type
fallback) relies on `design:paramtypes` metadata, emitted by
`emitDecoratorMetadata: true` (already set in
`apps/backend/tsconfig.json`). tsyringe requires a Reflect API polyfill
(`reflect-metadata`) for this.

**On Bun** (this project's runtime) the polyfill is **still required**.
Bun supplies `design:paramtypes` natively, but tsyringe's CJS entry does a
hard precondition check at module load:

```js
if (typeof Reflect === "undefined" || !Reflect.getMetadata) {
  throw new Error(`tsyringe requires a reflect polyfill. Please add 'import "reflect-metadata"' to the top of your entry point.`);
}
```

Native metadata emission does not define `Reflect.getMetadata`, so the
throw fires regardless of runtime. Keep `import "reflect-metadata";` as the
**first line of `src/index.ts`**, before any `tsyringe` import.

**If the app ever runs under Node** (tests executed via `node`, a Docker
runtime switch, a CLI script): the same import goes at the top of that
entrypoint — the test setup file for vitest.

## Failure Symptom

Missing polyfill — on Bun *and* Node — is a hard boot failure, not silent
misbehaviour:

```
tsyringe requires a reflect polyfill. Please add 'import "reflect-metadata"'
to the top of your entry point.
  at node_modules/tsyringe/dist/cjs/index.js:5:15
```

It fires at import time, so it surfaces immediately rather than as a
resolve-time injection bug. If you see `undefined` constructor parameters
instead, that is a different problem (a missing `@inject` token or a
non-`@injectable()` class), not the polyfill.

## Why This Nuance Matters

The tempting-but-wrong reading is "Bun emits `design:paramtypes` natively,
so the polyfill is optional here". That is true of the metadata *emission*
and false of tsyringe's *guard*, which tests `Reflect.getMetadata` — a
function only `reflect-metadata` installs. Removing the import to satisfy a
"no speculative polyfills" instinct breaks boot. Verified 2026-11-02:
deleting the import from `src/index.ts` makes `bun run dev` exit 255 with
the error above.

## Decision Rule

| Runtime | Action |
|---|---|
| Bun (current) | `import "reflect-metadata"` first line of `src/index.ts` — required |
| Node (tests/scripts) | `import "reflect-metadata"` once per entrypoint, before DI |
| Mixed | Same import per entrypoint; it is idempotent and harmless to repeat |
