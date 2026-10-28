# 3.4 Cross-Module Imports: Schema Types and DI Tokens Only

**Impact: HIGH**

## The Rule

A module may import from another module only:
- `import type` of row types from `drizzle/schemas/<other>.schema.ts`
- DI tokens from `<other>/constants/di.ts` (to resolve the other's service)

Nothing else crosses the line — no repositories, controllers, containers,
or internal constants.

## Canonical Example (from this repo)

The location module is fully self-contained (its imports are only its own
contracts and schema). The allowed cross-module shape, per the employee
example in rule 3.5:

```typescript
import type { LocationService } from '@modules/location/services/location.service';
import { LOCATION_SERVICE_TOKEN } from '@modules/location/constants/di';
```

Token-plus-type imports; internals stay private. That pair — the foreign
service type plus its DI token — **is** the service-to-service
communication channel (rule 3.5): the type is erased at runtime, the token
carries the actual dependency.

## Why

- Type-only imports vanish at runtime — zero coupling in the compiled app,
  and Bun never trips on missing runtime exports (real crash in this repo:
  value-importing an interface produced `Export named 'IProvinceRepository'
  not found`).
- Token-mediated service calls keep one writer per module's data; direct
  repository imports fork query logic and cache invalidation.
- Narrowing the public surface makes module extraction feasible: only
  tokens and types are the API.

## Anti-patterns

- `import { ProvinceRepository } from '@modules/location/repositories/...'`
  in another module — instantiates a second owner for the same tables.
- Value-importing a schema/interface type (Bun runtime export crash).
- Deep imports like `../location/services/../repositories/province.repository`
  to "just reuse one method".
