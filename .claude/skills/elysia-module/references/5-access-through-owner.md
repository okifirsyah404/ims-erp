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

## No Cycles

`A → B → A` service cycles are forbidden — tsyringe cannot construct
them and the design coupling is real. The fix is an **exported service**
(below); `delay()` (tsyringe rule 3.2) is the last resort, and extracting
a shared contract into a third module is for genuinely shared vocabulary,
not cycle-breaking.

## Cycles: Fix with an Exported Service (real case in this repo)

When two modules need each other's data — inventory wants equipment
counts, assets wants warehouse names — plain service-to-service creates
`AService ⇄ B2Service`, which tsyringe cannot construct. The fix is a
pair of **exported services**, each depending only on its own module's
repository:

```typescript
// assets/services/exported-asset.service.ts (real: this repo)
@injectable()
export class ExportedAssetService {
	constructor(
		@inject(ASSET_REPOSITORY_TOKEN) // own repository only
		private readonly assetRepository: IAssetRepository,
	) {}

	/** Repository-only relay — domain rules stay in AssetService. */
	countByWarehouse(warehouseIds: string[], assetType?: string) {
		return this.assetRepository.countByWarehouse(warehouseIds, assetType);
	}
}

// inventory/services/exported-warehouse.service.ts (real: this repo)
@injectable()
export class ExportedWarehouseService {
	constructor(
		@inject(WAREHOUSE_REPOSITORY_TOKEN) // own repository only
		private readonly warehouseRepository: IWarehouseRepository,
	) {}

	async getNameMap(ids: string[]): Promise<Map<string, string>> {
		const rows = await this.warehouseRepository.findNamesByIds(ids);
		return new Map(rows.map((row) => [row.id, row.name]));
	}
}
```

Consumers wire to the facade tokens, not the domain services:

```typescript
// WarehouseService injects EXPORTED_ASSET_SERVICE_TOKEN (ExportedAssetService)
// AssetService injects EXPORTED_WAREHOUSE_SERVICE_TOKEN (ExportedWarehouseService)
```

The resulting graph is acyclic — each facade depends only on repositories:

```
WarehouseService → ExportedAssetService      → AssetRepository
AssetService     → ExportedWarehouseService  → WarehouseRepository
```

House rules for exported services:

- Depends **only on its own module's repository** — never another
  module's service, or the cycle re-forms one hop deeper.
- Repository-only relay methods; domain rules (validation, status
  machines, audit) stay in the domain service.
- One per (module, consumer-need); named `Exported<Module>Service`, next
  to the domain service in `services/`, with its own
  `EXPORTED_<MODULE>_SERVICE_TOKEN` in `constants/di.ts` and a
  `container.register` in the module's `container.ts`.
- TSDoc states the constraint ("depends only on the module's own
  repository — never another module's service") so the next contributor
  doesn't re-introduce the cycle.
- Prefer preventing the cycle in the first place: before injecting a
  foreign service, ask whether the reverse edge exists or is plausible.
  If both modules merely read each other's aggregates for decoration
  (counts, names, labels), reach for the exported-service pair directly.

Note the asymmetry that makes this work: cross-module calls must be
service→service, but a facade consuming only its own repository is
inside its own module — rule 3.4's "no foreign repository imports" bars
importing *another module's* repository class, not the facade's own.

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
- Circular `AService ↔ B2Service` constructor dependencies — fix with the
  exported-service pair (see "Cycles" above), not `delay()`.
- An exported service injecting a foreign service (or anything beyond its
  own repository) — the cycle re-forms one hop deeper.
- Duplicating location reads behind a local "employee_location" cache with
  its own invalidation — two writers for one dataset.
- Reaching for `auth.users` directly in a non-user module instead of the
  user module's service.
