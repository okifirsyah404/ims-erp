---
name: tsyringe
description: Dependency-injection convention for this project using tsyringe - tokens are module-scoped Symbols, providers register at a single composition root, repositories/services are @injectable() with constructor @inject(TOKEN), routes resolve via container.resolve(), lifetimes default transient. Use when creating or reviewing services, repositories, or anything that receives the Drizzle client, cache, or other providers in apps/backend-elysia. Does NOT cover Elysia route plugins themselves (use the elysiajs skill) or Drizzle schema conventions (use drizzle-unix-timestamp).
license: MIT
metadata:
  author: OpenAgentic
  version: "1.0.0"
  dependsOn: elysiajs
  canonicalExample: apps/backend-elysia/drizzle/container.ts
---

# TSyringe DI Convention

This project uses **tsyringe** (^4.10.0) for constructor injection in
`apps/backend-elysia`. Conventions exist to keep the container predictable:
one composition root, module-scoped Symbol tokens, transient-by-default
services, and resolution only at the HTTP boundary.

## When to Apply

Reference these guidelines when:

- Creating a new service, repository, or provider class
- Registering a new dependency (DB client, cache, external SDK)
- Deciding whether a class should be transient, singleton, or scoped
- Writing route/controller code that needs a service
- Reviewing DI wiring or debugging "Cannot inject the dependency" errors

## The 6 Rules (by impact)

### 1.1 Register at one composition root — CRITICAL

All `container.register(...)` calls live in dedicated container modules next
to the provider they register — never scattered inside feature files. Today:
`drizzle/container.ts` is the only registration point.

```typescript
// apps/backend-elysia/drizzle/container.ts — the pattern
import { container } from 'tsyringe';
import { drizzleDB } from './db';

const DRIZZLE_TOKEN = Symbol('DRIZZLE_TOKEN');

container.register(DRIZZLE_TOKEN, { useValue: drizzleDB });

export { DRIZZLE_TOKEN };
```

New provider (e.g. Keyv cache) → new `providers/keyv/container.ts` with the
same shape. Feature files (`src/app/<domain>/**`) never call
`container.register` directly.

### 1.2 Tokens: Symbol per module, never strings — CRITICAL

- Non-class dependencies (db client, config object, cache instance) get a
  module-scoped `Symbol('...')` token exported next to the registration.
- Classes resolved by their constructor (`@injectable()` classes) need no
  token — `container.resolve(UserRepository)` works directly.
- Never use string tokens (`@inject('Database')`) — Symbols cannot collide
  and get type-checked by usage sites.

### 2.1 Reflect metadata / Bun nuance — HIGH

`@inject()` on constructor parameters relies on `design:paramtypes`
metadata (`emitDecoratorMetadata: true` is already set in
`apps/backend-elysia/tsconfig.json`). On **Bun** this works without an
explicit polyfill — today's code imports no `reflect-metadata` and runs fine.

**If the app ever runs on Node** (tests via `node`, a Docker runtime switch):
`import "reflect-metadata";` must be added **once, at the entrypoint**,
before any DI use. Symptom when missing: "Attempted to construct an
undefined constructor" / injected params become `undefined`.

### 2.2 Lifetimes: transient by default — HIGH

| Decorator | Use for | Examples here |
|---|---|---|
| `@injectable()` | default — stateless repositories/services, new instance per resolve | `ProvinceRepository`, `UserRepository` |
| `@singleton()` | genuinely stateful process-wide instances | logger, config, db client (these are registered via `useValue` today instead) |
| `@scoped(Lifecycle.ContainerScoped)` / child containers | per-request state only if proven needed | better-auth session context — **not yet used; avoid until required** |

```typescript
@injectable()
export class ProvinceRepository implements IBaseRepository<...> {
  constructor(@inject(DRIZZLE_TOKEN) database: BunSQLDatabase) {}
}
```

Default to `@injectable()`. Reach for `@singleton()` only when a class holds
mutable process-wide state. Reach for scoped lifetimes only when a request
cache is actually measured to matter.

### 3.1 Resolution only at the HTTP boundary — MEDIUM-HIGH

Routes/controllers obtain services via `container.resolve(XService)`.
- Never `new Service()` inside a route — that bypasses injection of the
  service's own dependencies.
- Never call `container.resolve` inside a repository or another service —
  dependencies arrive via constructor injection.
- Note: current code does not yet resolve services from routes (slices are
  scaffolded); when the first real route lands, it adopts this pattern.

### 3.2 Circular dependencies: restructure first — MEDIUM

tsyringe cannot construct cyclic constructor graphs. Prefer extracting a
third service or a contract to cut the cycle. `delay()` exists as a last
resort:

```typescript
@injectable()
export class Foo {
  constructor(@inject(delay(() => Bar)) public bar: Bar) {}
}
```

## References

- https://github.com/microsoft/tsyringe#readme — full API (`injectAll`,
  transforms, `@registry`, interception, disposal) documented upstream;
  use those APIs only when a rule here doesn't cover the case.
- https://www.npmjs.com/package/reflect-metadata — polyfill for Node runtimes.

## Related

- `elysiajs` skill — Elysia route/plugin patterns (HTTP side of services).
- `drizzle-unix-timestamp` skill — the datetime types the injected DB client
  serves.
