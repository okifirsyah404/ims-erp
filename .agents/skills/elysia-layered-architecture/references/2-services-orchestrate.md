# 1.2 Services Orchestrate, Never Touch HTTP or Drizzle

**Impact: HIGH**

## The Rule

Services refine and combine repository results and translate domain
errors. They import no HTTP types and issue no Drizzle queries or cache
calls themselves.

## Canonical Example (from this repo)

`apps/backend/src/app/location/services/location.service.ts` — a
pass-through over four repositories, typed by repository contracts:

```typescript
@injectable()
export class LocationService {
	constructor(
		@inject(PROVINCE_REPOSITORY_TOKEN)
		private readonly provinceRepository: IProvinceRepository,
		@inject(REGENCY_REPOSITORY_TOKEN)
		private readonly regencyRepository: IRegencyRepository,
	) {}

	/**
	 * Fetches all non-deleted regencies of one province, by province id.
	 */
	getRegenciesByProvince(provinceId: string): Promise<TRegencySelect[]> {
		return this.regencyRepository.findByProvinceId(provinceId);
	}
}
```

## Why

- A pass-through service is fine; the layer exists so controllers can be
  swapped and repositories tested without HTTP.
- Services are where multi-repository rules live (e.g. "unique-violation
  race → 409" translation belongs here per api-conventions).
- Cache and SQL concerns in services duplicate repository behavior and
  break the single-writer rule for invalidation.

## Anti-patterns

- `this.database.select()` inside a service.
- Building `TApiResponseMeta` (`requestId`, `timestamp`) inside a service.
- A service importing from `elysia` for `status()`/`error()` helpers.
