# 3.5 Cross-Module Communication Is Service to Service

**Impact: HIGH**

## The Rule

Cross-module communication happens only between services: `AService`
constructor-injects `B2Service` via B's DI token from
`moduleB/constants/di.ts` and calls its public methods. Repositories and
controllers never communicate cross-module. A's repository never joins
into B's schema tables — compose with two queries + stitching in the
requesting service.

## Canonical Example (from this repo)

The pattern for a future `employee` module (moduleA) communicating with
the location module (moduleB), using location's public token
(`location/constants/di.ts`) and service:

```typescript
// moduleA/services/a.service.ts — the pattern
@injectable()
export class EmployeeService {
	constructor(
		@inject(LOCATION_SERVICE_TOKEN) // moduleB/constants/di.ts
		private readonly locationService: LocationService, // moduleB/services/location.service.ts
	) {}

	async getEmployeeWithVillage(id: string) {
		const employee = await this.employeeRepository.findById(id); // own schema
		if (!employee?.villageId) return null;
		// AService -> B2Service: the only sanctioned cross-module call
		const village = await this.locationService.getVillage(employee.villageId);
		return { ...employee, village };
	}
}
```

## Direction Rules

- `controller → own service → (own repo | foreign service)`. Foreign
  service calls happen only inside the service layer.
- A controller needing B's data goes through its own `AService`, which
  calls `B2Service` — never injects B's token directly.
- A repository never receives or resolves a foreign service.

## Error Translation

The consuming `AService` catches `B2Service` failures and maps them into
A's domain errors (and A's controller maps those to HTTP semantics).
B's internal error shapes must not leak through A's API.

## No Cycles

`A → B → A` service cycles are forbidden — tsyringe cannot construct
them and the design coupling is real. Extract a shared contract into a
third module, or invert the dependency (tsyringe rule 3.2: `delay()` is
the last resort).

## Sync Now, Events Later

Cross-module calls are direct in-process `await`s today. If coupling
becomes a problem (temporal coupling, fan-out, transactions spanning
modules), the extraction path is domain events (e.g. an outbox table in
the publishing module) — never direct reads of another module's tables.

## Why

- One owner per dataset: cache invalidation, soft-delete filtering, and
  query tuning stay in the module that owns the tables.
- Cross-schema SQL joins re-couple modules at the query level — invisible
  in code review, breaking extraction the same way FKs do.
- Service-to-service keeps exactly one communication channel per boundary,
  so the future move to events (or services) has a single seam to replace.
- Stitching at the service layer is where authorization and composition
  rules belong anyway.

## Anti-patterns

- A controller injecting `LOCATION_SERVICE_TOKEN` directly to compose with
  its own module's rows — composition belongs in its own service.
- An employee repository with
  `select().from(employee).leftJoin(village, ...)` — joins across the
  module boundary.
- A repository calling another module's repository — two owners, two
  invalidation writers.
- Circular `AService ↔ B2Service` constructor dependencies.
- Duplicating location reads behind a local "employee_location" cache with
  its own invalidation — two writers for one dataset.
- Reaching for `auth.users` directly in a non-user module instead of the
  user module's service.
