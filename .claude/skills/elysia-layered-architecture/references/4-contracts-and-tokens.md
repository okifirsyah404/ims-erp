# 1.4 Contracts in contracts/, DI Tokens in constants/di.ts

**Impact: CRITICAL**

## The Rule

Zod request/response schemas and repository interfaces belong in the
domain's `contracts/` directory. DI token symbols belong in
`constants/di.ts` — a standalone module so services and the composition
root can both import them without a circular dependency.

## Canonical Example (from this repo)

`apps/backend/src/app/location/constants/di.ts`:

```typescript
export const PROVINCE_REPOSITORY_TOKEN: InjectionToken<IProvinceRepository> =
	Symbol('PROVINCE_REPOSITORY');
export const LOCATION_SERVICE_TOKEN: InjectionToken<LocationService> =
	Symbol('LOCATION_SERVICE');
// ...
```

Imported by both `services/location.service.ts` (for `@inject`) and
`container.ts` (for `register`) — no cycle.

## Why

- Inline tokens in `container.ts` create a service ↔ container import
  cycle: the container imports the service class, the service imports the
  tokens. Real crash observed:
  `ReferenceError: Cannot access 'PROVINCE_REPOSITORY_TOKEN' before initialization`.
- Contracts-first keeps the domain's public surface greppable in one
  directory.
- Symbol tokens beside their interfaces stay type-safe
  (`InjectionToken<IProvinceRepository>`).

## Anti-patterns

- Token constants exported from `container.ts` or `contracts/` — cycle
  (see crash above).
- String tokens (`@inject('IProvinceRepository')`) — no type checking and
  a silent resolution failure when the name drifts.
- Interfaces declared inline in the service or repository file instead of
  `contracts/`.
