# 1.2 Tokens Are Module-Scoped Symbols

**Impact: CRITICAL**

## The Rule

Non-class dependencies (db client, config object, cache instance) are
injected under a module-scoped `Symbol('...')` token, exported from the same
container module that registers it. Classes that can be resolved by their
constructor need no token at all. Never use string tokens.

## Token Decision Table

| Dependency kind | Token | Example here |
|---|---|---|
| Class with `@injectable()` | none — resolve by constructor | `ProvinceRepository` |
| Non-class instance (db client, cache, config) | `Symbol('NAME')` exported from its container module | `DRIZZLE_TOKEN` |
| Interface (needs an impl alias) | Symbol token + `useClass`/`useToken` provider | — (none yet) |

## Canonical Example (from this repo)

```typescript
// drizzle/container.ts
const DRIZZLE_TOKEN = Symbol('DRIZZLE_TOKEN');
container.register(DRIZZLE_TOKEN, { useValue: drizzleDB });
export { DRIZZLE_TOKEN };

// src/app/location/repository/province.repository.ts
@injectable()
export class ProvinceRepository implements IBaseRepository<...> {
  constructor(@inject(DRIZZLE_TOKEN) database: BunSQLDatabase) {}
}
```

## Why

- Symbols cannot collide across modules; string tokens
  (`@inject('Database')`) silently overwrite each other across libraries
  and features.
- A token exported beside its registration is greppable: `DRIZZLE_TOKEN`
  leads a reader straight to the registration, the provider, and every
  consumer.
- Class dependencies need no token because `design:paramtypes` metadata
  carries the constructor reference automatically — requiring one anyway
  adds noise with zero benefit.

## Anti-patterns

- `@inject('DRIZZLE')` — string literal duplicates the Symbol's job without
  its safety.
- Defining a token in a consumer file instead of beside the registration —
  splits ownership.
- Registering a `@injectable()` class under an alias token with no interface
  in play (`useToken` redirect) — resolve the class directly instead.
