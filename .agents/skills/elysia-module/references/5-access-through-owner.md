# 3.5 Cross-Module Data Access Goes Through the Owning Module

**Impact: HIGH**

## The Rule

If module A needs rows owned by module B, it calls B's service (resolved
via B's DI token) or reads through B's published contract. A's repository
never joins into B's schema tables. Compose with two queries + stitching
in the requesting service; cache hot compositions per the owning module's
conventions.

## Canonical Example (from this repo)

The pattern for a future `employee` module composing location data, using
the location module's public token (`location/constants/di.ts`) and
service:

```typescript
@injectable()
export class EmployeeService {
	constructor(
		@inject(LOCATION_SERVICE_TOKEN)
		private readonly locationService: LocationService,
	) {}

	async getEmployeeWithVillage(id: string) {
		const employee = await this.employeeRepository.findById(id); // own schema
		if (!employee?.villageId) return null;
		const village = await this.locationService.getVillage(employee.villageId);
		return { ...employee, village };
	}
}
```

## Why

- One owner per dataset: cache invalidation, soft-delete filtering, and
  query tuning stay in the module that owns the tables.
- Cross-schema SQL joins re-couple modules at the query level — invisible
  in code review, breaking extraction the same way FKs do.
- Stitching at the service layer is where authorization and composition
  rules belong anyway.

## Anti-patterns

- An employee repository with
  `select().from(employee).leftJoin(village, ...)` — joins across the
  module boundary.
- Duplicating location reads behind a local "employee_location" cache with
  its own invalidation — two writers for one dataset.
- Reaching for `auth.users` directly in a non-user module instead of the
  user module's service.
