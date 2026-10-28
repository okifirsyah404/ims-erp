# 2.3 Domain container.ts Exports register<X>(container)

**Impact: CRITICAL**

## The Rule

Each domain has a `container.ts` exporting a `register<Domain>(container)`
function that registers the domain's repositories and service. The
composition root (`src/index.ts`) calls it after provider registration.

## Canonical Example (from this repo)

`apps/backend/src/app/location/container.ts`:

```typescript
export function registerLocation(container: DependencyContainer): void {
	container.register(PROVINCE_REPOSITORY_TOKEN, { useClass: ProvinceRepository });
	container.register(REGENCY_REPOSITORY_TOKEN, { useClass: RegencyRepository });
	container.register(DISTRICT_REPOSITORY_TOKEN, { useClass: DistrictRepository });
	container.register(VILLAGE_REPOSITORY_TOKEN, { useClass: VillageRepository });
	container.register(LOCATION_SERVICE_TOKEN, { useClass: LocationService });
}
```

`src/index.ts` — order matters:

```typescript
import 'reflect-metadata';
registerProvider(container);   // Drizzle, Redis connections first
registerLocation(container);   // then domain classes that inject them
```

## Why

- Provider registrations must precede domain registrations or repositories
  resolve `useValue` tokens that don't exist yet.
- One explicit call per domain keeps the boot sequence auditable in
  `src/index.ts` without grepping feature code.
- Registration (container.ts) stays separate from token definitions
  (contracts/), so services can import tokens without importing the
  container — no cycle.

## Anti-patterns

- `container.register` calls scattered in feature files — import order
  silently decides what's registered.
- Registering domains before providers.
- A domain module that self-registers via import side effects.
