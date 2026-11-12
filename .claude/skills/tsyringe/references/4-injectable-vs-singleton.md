# 2.2 Default to Transient via @injectable()

**Impact: HIGH**

## The Rule

Classes are `@injectable()` (transient: one new instance per resolve) by
default. `@singleton()` only for genuinely stateful process-wide instances.
Scoped lifetimes (`@scoped(Lifecycle.ContainerScoped)` / request-scoped child
containers) are avoided until a per-request state need is measured, not
assumed.

## Lifetime Decision Table

| Decorator | Instance per | Use when | Examples here |
|---|---|---|---|
| `@injectable()` | resolve | default — stateless services/repositories | `ProvinceRepository`, `UserRepository` |
| `@singleton()` | process | holds mutable process-wide state | none yet (db client, config, logger are registered `useValue` instead) |
| `@scoped` / child containers | container/request | per-request cache or request identity | none yet — better-auth session context does not require it today |

## Canonical Example (from this repo)

```typescript
@injectable()
export class ProvinceRepository implements IBaseRepository<
	TProvinceInsert,
	TProvinceSelect
> {
	constructor(@inject(DRIZZLE_TOKEN) database: BunSQLDatabase) {}
	// ...
}
```

## Why

- Stateless classes are safe to re-instantiate; transient lifetimes remove
  a whole class of shared-mutable-state bugs and make tests trivial
  (construct directly or resolve fresh).
- `@singleton()` for everything "because it's cheaper" reintroduces global
  mutable state and order-dependent test behavior.
- Scoped lifetimes require child-container plumbing per request; adopt only
  when a measured need exists (e.g. request-scoped caching with eviction
  semantics that Keyv cannot provide).

## Note on useValue Registration

Process-wide instances that already exist as module singletons (the `drizzleDB`
client) skip decorators entirely: they are registered with
`{ useValue: instance }` under a Symbol token (rule 1.2). `@singleton()` is
for classes the container *constructs*, not for wrapping existing module
singletons.

## Anti-patterns

- `@singleton()` on a repository — repositories hold no process-wide state;
  a shared instance hides writes-in-flight coupling.
- Request-scoping "for safety" without a concrete per-request cache need.
- Wrapping an existing module singleton in a `@singleton()` class whose only
  job is to return it — register `useValue` directly.
