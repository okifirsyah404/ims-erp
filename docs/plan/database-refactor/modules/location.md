# location - ERP-0071

Schema `location` · folder `src/app/location` · URL `/locations` · phase P1

## Current

Tables `provinces`, `regencies`, `districts`, `villages` (built, seeded from
`database/seeders/raw/location`). Repositories: province, regency, district,
village. Controller `/locations`. Consumer: `apps/web-admin/src/lib/location-api.ts`.

## Steps

1. **dbml** - no table change. Re-point every logical-reference note that
   says "Validated through the Location module contract" to name
   `ExportedLocationService` methods.
2. **Drizzle** - none.
3. **Repositories** - add `findVillagePaths(villageIds[])` to the village
   repository (join village -> district -> regency -> province, same schema,
   cached like today's reads).
4. **Services** - new `ExportedLocationService` (repository-only):
   `assertVillage(id)`, `resolveVillagePath(ids[])`. Token in
   `location/constants/di.ts`. Every address-owning module (company, customer,
   supplier, inventory, project, human-resource) injects it (Q10).
5. **Controllers** - unchanged (`/locations` already matches Q33).
6. **Consumers** - none. The address picker in web-admin keeps
   province -> regency -> district -> village cascading but only submits
   `villageId`.

## Exit

`ExportedLocationService` unit tests (batched path, unknown id rejected);
lint/test/typecheck green.
