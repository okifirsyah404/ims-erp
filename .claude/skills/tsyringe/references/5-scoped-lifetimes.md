# 3.1 Resolve Only at the HTTP Boundary

**Impact: MEDIUM-HIGH**

## The Rule

Route/controller code obtains services via `container.resolve(XService)`.
No `new Service()` inside a route; no `container.resolve` inside a
repository or another service — those receive dependencies via constructor
injection only.

## Intended Pattern (first real route should adopt this)

```typescript
// src/app/user/routes/user.routes.ts (illustrative)
import { container } from 'tsyringe';
import { UserService } from '../services/user.service';

const userService = container.resolve(UserService);

export const userRoutes = new Elysia({ prefix: '/users' })
  .get('/', () => userService.list(/* ... */));
```

## Why

- `new Service()` in a route bypasses injection of the service's own
  constructor dependencies — the service then fails at its own resolve
  point, or silently runs with undefined dependencies.
- `container.resolve` inside a repository hides its true dependency list
  from the type system and tests; the constructor signature is the contract.
- Resolving once at module scope (as above, outside handlers) keeps
  resolution cost out of the hot path; transient services resolve once per
  route module, which is fine for stateless classes (rule 2.2).

## Current-State Note

The codebase is scaffolded: repositories are `@injectable()` but no route
resolves a service yet. When the first slice wires routes → services, this
rule is the pattern to follow — do not hand-`new` the service "just for
now"; that debt is exactly what this convention prevents.

## Anti-patterns

- `const service = new UserService(db)` in a route — duplicates the
  container's job and pins the service's dependencies manually.
- Field-level `container.resolve` inside class bodies (property injection
  is a tsyringe non-goal anyway).
- Resolving inside a service constructor's dependencies *and* calling
  resolve again on the same token deeper down — trust the chain.
