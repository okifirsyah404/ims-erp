# 1.1 Register at One Composition Root

**Impact: CRITICAL**

## The Rule

All `container.register(...)` calls live in dedicated container modules next
to the provider they register. Feature files (`src/app/<domain>/**`) never
call `container.register` directly. One container module per provider; the
entrypoint imports them transitively (container modules are imported by the
provider's consumers, which keeps registration order automatic).

## Canonical Example (from this repo)

`apps/backend-elysia/drizzle/container.ts`:

```typescript
import { container } from 'tsyringe';
import { drizzleDB } from './db';

const DRIZZLE_TOKEN = Symbol('DRIZZLE_TOKEN');

container.register(DRIZZLE_TOKEN, { useValue: drizzleDB });

export { DRIZZLE_TOKEN };
```

Adding a new provider (e.g. a Keyv cache instance) follows the same shape:
`providers/keyv/container.ts` builds the instance, registers it under a
module-scoped Symbol, exports the token. Nothing else registers.

## Why

- The object graph is auditable by reading a handful of `container.ts`
  files instead of grepping feature code.
- Side-effect registrations buried in feature files cause resolution-order
  bugs: a token may be registered only if some unrelated module happened to
  be imported first.
- Provider lifetime decisions (useValue vs factory vs class) are made once,
  in one place, per provider.

## Anti-patterns

- `container.register(...)` inside a route handler or service method.
- Registering the same token in multiple feature files (last import wins —
  silent override).
- A `providers` module that both builds an instance and expects callers to
  register it: the container module owns both.
