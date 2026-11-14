# 2.4 Tokens Live in constants/di.ts

**Impact: HIGH**

## The Rule

DI token symbols for a domain live in `constants/di.ts`. The domain
`container.ts` re-exports them. Services import tokens from the constants
module — never from the container.

## Canonical Example (from this repo)

`apps/backend/src/app/location/constants/di.ts`:

```typescript
export const PROVINCE_REPOSITORY_TOKEN: InjectionToken<IProvinceRepository> =
	Symbol('PROVINCE_REPOSITORY');
export const LOCATION_SERVICE_TOKEN: InjectionToken<LocationService> =
	Symbol('LOCATION_SERVICE');
// ...
```

`container.ts` re-exports: `export * from './constants/di';`

Both `services/location.service.ts` (`@inject`) and `container.ts`
(`register`) import from the constants module — no cycle.

## Why

- Tokens defined in `container.ts` create a service ↔ container cycle:
  the container imports the service class, the service imports the tokens.
  Real crash: `ReferenceError: Cannot access 'PROVINCE_REPOSITORY_TOKEN'
  before initialization`.
- Standalone token modules stay type-only at the edges
  (`import type` for the interfaces they reference), so Bun never
  attempts a runtime export that doesn't exist.

## Anti-patterns

- Token constants exported from `container.ts` or `contracts/`.
- String tokens (`@inject('IProvinceRepository')`) — silent resolution
  failure when names drift.
- Splitting one domain's tokens across multiple modules.
