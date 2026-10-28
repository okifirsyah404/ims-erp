# 2.1 Import reflect-metadata on Node Runtimes

**Impact: HIGH**

## The Rule

Constructor-parameter injection (`@inject(TOKEN)` without an explicit type
fallback) relies on `design:paramtypes` metadata, emitted by
`emitDecoratorMetadata: true` (already set in
`apps/backend-elysia/tsconfig.json`). tsyringe's upstream docs require a
Reflect API polyfill (`reflect-metadata`) for this.

**On Bun** (this project's runtime): metadata for decorated constructor
parameters is available natively — the current codebase imports no
`reflect-metadata` and injection works. Do not add the polyfill speculatively.

**If the app ever runs under Node** (tests executed via `node`, a Docker
runtime switch, a CLI script): add `import "reflect-metadata";` **once, at
the entrypoint, before any DI use** — `src/index.ts` for the app, the test
setup file for vitest.

## Failure Symptom

Missing polyfill on Node: injected constructor parameters become
`undefined`, or the container throws
"Attempted to construct an undefined constructor" / "Cannot inject the
dependency" at resolve time — usually far from the un-polyfilled entrypoint,
which makes it look like a registration bug.

## Why This Nuance Matters

Agents moving code between runtimes (extracting a CLI script, adding a Node
test runner) are the realistic trigger. The absence of the polyfill in the
tree is easy to read as "not needed" rather than "Bun-specific".

## Decision Rule

| Runtime | Action |
|---|---|
| Bun (current) | No polyfill; do not add one speculatively |
| Node (tests/scripts) | `import "reflect-metadata"` once per entrypoint, before DI |
| Mixed | Polyfill is harmless on Bun — add it if either runtime is Node |
