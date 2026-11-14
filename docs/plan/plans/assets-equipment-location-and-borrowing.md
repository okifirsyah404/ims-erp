# Assets & Equipment: Location Tracking and Borrowing Ownership

> Status: design approved through a 7-round grilling session (2026-11-05).
> Stage 0 execution review completed 2026-11-05 (see "Stage 0 — blocking
> defects and rulings"); D11, D12, D13, D15, D16, D17 amended there.
> Not implemented. No production database exists; the destructive steps below
> are accepted on that basis only.
> Scope: move physical tools out of the inventory item lifecycle into the
> `assets` module, give assets real warehouse/storage location tracking, and
> move the whole borrowing engine into `assets`.
> Builds on: `docs/plan/plans/inventory-and-assets-hardening.md` (Part II
> shipped the `assets` module and the inventory borrowing engine),
> `docs/plan/plans/inventory.md` (ADR-0008 / ADR-0009 decisions),
> `docs/plan/plans/warehouse-hardening.md` (warehouse/storage CRUD + UI).
> Contract home: `docs/database/docs.dbml` (canonical, edited first).
>
> **Superseded in part (2026-11-15, ERP-0041):** grants no longer live in an
> `auth.roles.permissions` jsonb column - organization roles are a closed enum
> in `@ims-erp/common` and `auth.roles` does not exist. D15/B3 and the Stage 0
> `UPDATE auth.roles ...` steps below are void: renaming a resource is now a
> pure code edit in `erp-permissions.ts`.

## Why

Three facts make today's model wrong, not merely inconvenient:

1. Seeded tools are already asset-shaped — `apps/backend/database/seeders/seed/inventory.seeder.ts:104-119`
   sets `isSerialized: true, isStockTracked: false, sellingPrice: 0` with the
   comment "Tools are internal equipment: not sellable" — yet
   `assertItemShape` (`apps/backend/src/app/inventory/services/item.service.ts:450-454`)
   rejects exactly that shape. Tool SKUs exist only because the seeder
   bypasses the API.
2. Tools are borrowable (`ADR-0009`), have serial numbers, warehouse and bin
   (`inventory.serial_tracked_items`, `docs/database/docs.dbml:2498-2531`) —
   everything an asset needs and nothing a stock item needs.
3. `assets` has **no real location model**: `assets.location_description` is
   free text and `asset_movements.from_location` / `to_location` are free text
   (`apps/backend/drizzle/schemas/asset.schema.ts:346-380`). A tool moved into
   the asset module today would lose warehouse/storage tracking.

Net effect: two writable paths for one physical object, and a "movement"
record that cannot be reconciled with a warehouse.

## Resolved decisions

| # | Decision |
|---|---|
| D1 | **The asset row is the physical unit.** One row per physical tool, quantity is always 1. Bulk consumables (drill bits, gloves, cable) are inventory `material`/`component`, never assets. No `asset_units` table; `tool_sets.tool_set_items` already composes `assets.id`, and borrowing lines point at `asset_id` directly. |
| D2 | **Assets gain real location.** `assets.warehouse_id` + `assets.storage_id` (nullable; `storage_id` implies `warehouse_id`), mirroring `serial_tracked_items`. Column is named `storage_id` because the warehouse model has *storages*, not bins, since ADR-0008. |
| D3 | **`asset_movements` gains location ids and a real vocabulary**: `from_warehouse_id`, `from_storage_id`, `to_warehouse_id`, `to_storage_id`; `movement_type IN ('receipt','transfer','borrow_out','borrow_return','project_site','disposal','lost')`. Free-text `from_location`/`to_location` stay for off-site detail. |
| D4 | **Asset borrowing does not write the stock ledger.** `inventory.stock_movements.item_id` is `NOT NULL` and tools have no item. Borrowing writes `asset_movements`; issue clears the asset's warehouse/storage, return restores them. |
| D5 | **Borrowing moves into `assets`.** Fresh `assets.borrowings` / `assets.borrowing_lines` (`asset_id`) / `assets.borrowing_events` (`asset_movement_id`). The full ADR-0009 model is retained: user/customer/guest borrowers, guest PII redaction by permission tier, 24-month retention sweep, 4-stage approval, due dates, extend, late/lost marking, append-only event timeline. Code is ported by `git mv`, not rewritten; existing tests are retargeted and must stay green. |
| D6 | **One custody mechanism.** `asset_assignments` is dropped together with its endpoints and UI. Internal lending is a borrowing with `purpose = 'internal_use'`. `tool_sets` lend by expanding to one borrowing line per member asset, which finally gives `tool_sets.status='lent'` a writer. |
| D7 | **Asset status vocabulary**: `ready \| borrowed \| maintenance \| inactive \| disposed \| lost`. `inactive ⇔ deactivation_reason IS NOT NULL` (D18 SOP retained). For unit-backed assets the status is **derived** by one `reconcileStatus(assetId, tx)` helper called inside the transaction of every event; `inactive` stays the only asset-owned state and is never overwritten by reconcile. |
| D8 | **`custodian_employee_id` / `borrowed_since` are a written denormalisation**, produced only by `syncCustody(assetId, tx)` in the same transaction as borrow issue / return / disposal / loss. Never accepted from a request body. `assigned_at` is renamed `borrowed_since`. |
| D9 | **Inventory shrinks to consumables.** `item_kind IN ('product','component','material')`; `tool` and `service` are dropped, along with the service clause of the CHECK (`docs/database/docs.dbml:2313`). `pre_order` and `lost` stay (ADR-0009 provisional serials and shrinkage are real); only `borrowed` leaves the unit vocabulary. `serial_tracked_items` therefore serves serialized products only. |
| D10 | **`asset_type` becomes a lookup table**, `assets.asset_types`, seeded with `equipment`, `vehicle`, `tool`, `furniture`, `it`, `intangible`. `assets.asset_type` and `asset_categories.asset_type` are text codes FK'd to `asset_types.code` — the code is the stable identity, `name` is the editable label. Types are global (no `organization_id`), app-admin CRUD, seeded. A type cannot be soft-deleted while an asset or category references it; `is_active` is the "stop offering it" switch. |
| D11 | **Tenancy.** All asset tables move to `organization_id` nullable (global = company-wide, per ADR-0008's meaning). Global assets are **app-admin write, org read** (mirrors warehouses, ADR-0010) — never last-writer-wins, enforced with `isGlobalAdmin()` (`src/authorization/require-global-admin.ts`) at the service boundary, not by a second route surface. An org-scoped asset may only be stored in a warehouse that org can reach; a global asset may sit in any warehouse. **That check is stubbed until ERP-0031 lands**: every warehouse is global today, so `assertWarehouseReachableByOrg` returns true for every `(warehouseId, organizationId)`. It is a real Inventory contract method with a real call site, so ERP-0031 replaces the body and nothing in Assets changes. `asset_types` has no `organization_id` (D10). `document_sequences.organization_id` is **not** changed — see Stage 0, B4. |
| D12 | **Asset numbering for global rows** uses the existing null → `''` sentinel in `DocumentNumberingService` (`apps/backend/src/app/organization/services/document-numbering.service.ts:52-74`, convention already documented in `apps/backend/src/app/assets/constants/doc-types.ts:8-9`). No new sentinel concept. |
| D13 | **Serial and code uniqueness.** `assets.code` is **globally unique** (plain unique index, no org split): an org asset and a global asset can never share a code, which is what the acceptance line actually requires, and a partial `(organization_id, code)` index does not deliver it. That only holds if numbering is global too, so asset codes always allocate from the null → `''` sentinel sequence regardless of tenant (D12), giving one monotonic `AST-…` space. Serials stay per-scope: unique index on `(coalesce(organization_id, ''), serial_number) WHERE serial_number IS NOT NULL AND deleted_at IS NULL` — `organization_id` alone would let every global asset repeat because `NULL` never conflicts in a unique index. |
| D14 | **Borrowing codes keep `BRW-YYYYMM-####`** under the new doc-type key `asset_borrowing`. The human format is on printed slips; only the sequence row moves. |
| D15 | **Permission resource is renamed** `borrowing` → `asset_borrowing`, keeping **all ten** actions actually granted today (`read/create/update/approve/issue/return/extend/mark_late/mark_lost/export` — `erp-permissions.ts:71-82`, not eight) and every role grant byte-for-byte. No privilege change. Because grants live in jsonb (`auth.roles.permissions`) and the role seeder is insert-only, the rename needs an idempotent data migration or every organization silently loses borrowing access — see Stage 0, B3. |
| D16 | **Destructive migration, accepted.** One migration creates the new asset tables and drops `inventory.borrowings` / `borrowing_lines` / `borrowing_events` and `assets.asset_assignments`. A one-shot cleanup script (mandatory `--dry-run` first pass) hard-deletes `items(kind='tool')` and their `serial_tracked_items`. Safe **only** because no production database exists; must not run against any `POSTGRES_URL` the author cannot name. |
| D17 | **Dead-but-documented vocabulary stays.** `stock_movements` types `borrowing_out`/`borrowing_in`, its `reference_type='borrowing'` CHECK, and `serial_tracked_items.current_borrowing_line_id` are superseded: nothing writes them, they are listed as superseded in `progress.md`, and removal is a later cleanup migration. Do not compound the irreversible step. The **FK constraint** on `current_borrowing_line_id` cannot survive the drop of `borrowing_lines` and is dropped in this migration; the column and its index stay. |
| D18 | **UI surface.** "Assets & Equipment" is the only surface for equipment. The inventory Tools page, the warehouse detail Tools tab, and the inventory borrowings pages are removed with their locale keys. Borrowing UI moves under the assets section. `assets:type.*` locale keys die once type labels come from `asset_types.name`. |
| D19 | **`location_description` stays** as the off-site / non-warehouse location (customer site, technician van, vehicle without a storage). Both it and warehouse/storage may be set ("in W1, en route to site X"). |
| D20 | **Ship as five slices, one commit each**, contract first; the destructive slice is reviewable on its own and gated on a fresh `drizzle:migrate` + `drizzle:seed` run twice. |

## Stage 0 — execution review (2026-11-05)

Plan checked against the code before any work. Design holds; the plan was not
executable as written. Findings and their rulings:

| # | Defect | Evidence | Ruling |
|---|---|---|---|
| B1 | D11's reachability rule needs `inventory.warehouse_organizations`, which does not exist in Drizzle or any migration | `docs.dbml:2268` only; backlog ERP-0031 still `planned`; `progress.md:192` names ERP-0031 as next task | **Decided: global assets ship now, reachability stubbed.** `assertWarehouseReachableByOrg` exists as a real Inventory contract method and returns `true` for every warehouse (all warehouses are global today). ERP-0031 replaces only the body. |
| B2 | Slice order breaks the migration: tightening the `items.item_kind` CHECK fails while seeded `tool`/`service` rows exist, and the cleanup script is Slice 4 | `inventory.seeder.ts:88-94`; plan Slice 2 vs Slice 4 | **Cleanup script + inventory-seeder trim move into Slice 2, before `drizzle:generate`.** |
| B3 | Permission rename silently revokes access: grants are jsonb and the role seeder is insert-only | `role.schema.ts:73`; `organization-roles.seeder.ts` | **Add an idempotent jsonb key-rename data migration in the same slice as the package rename.** |
| B4 | D11's `document_sequences.organization_id` nullable change is wrong and harmful | `document-numbering.service.ts:62` already writes `''`; `NULL` never conflicts in `ON CONFLICT (organization_id, doc_type)` and would mint duplicate sequences | **Clause dropped. No schema change, no migration.** Current `notNull` + sentinel stays. |
| B5 | Acceptance says a global asset and an org asset cannot share a code, but `(org, code)` unique + `code` unique-where-null does not deliver that | `asset.schema.ts:254` | **`assets.code` globally unique, codes allocate from the global sequence.** See D13. |
| B6 | D15 claimed eight actions; the grant set has ten | `erp-permissions.ts:71-82` | **Rename only, keep ten.** D15 amended. |
| B7 | Borrowing port needs schema the plan never listed: `origin_storage_id`, no cross-schema FK to `inventory.warehouses`, the `asset_movement_id` FK policy, movement rows for disposal/maintenance, `asset_type` seeding before the FK | plan Slice 1/3 | **Added explicitly to Slices 1–2.** |
| B8 | D7's `reconcileStatus` had no input rules, and the transition map, contract enums and UI literals all assume `in_stock`/`in_use` | `asset.service.ts:37-44`; `asset.contract.ts:110`; `asset-api.ts:22-30` | **Sources fixed:** open borrowing → `borrowed`; in-progress maintenance → `maintenance`; terminal writes `disposed`/`lost`; else `ready`; `inactive` sticky. `in_stock`→`ready`, `in_use`→`borrowed` backfill in the migration. |
| B9 | Untouched surfaces: scheduler worker, warehouse `toolsCount`, `item-status-matrix`/`inventory-seeder.data` tests, borrowing error classes inside `inventory.errors.ts`, asset-type endpoints, `asset_types` seed ordering | `inventory-scheduler.worker.ts:60`; `warehouse.repository.ts:182` | **Folded into Slices 2–5.** |

Decisions taken here: **D11 global-assets-now with a stubbed reachability
method**, **D13 global unique code**, **B4 no numbering change**. Everything
else in D1–D20 stands.

## Phases

### Slice 1 — Contract (`docs/database/docs.dbml`)

1. Rewrite the **Assets** module block (line 4708 onward):
   - new `assets.asset_types` table: `id`, `code varchar(32)` unique, `name`,
     `default_useful_life_months`, `default_depreciation_method`, `is_active`,
     `created_at`, `updated_at`, `deleted_at`.
   - `assets.assets`: add `warehouse_id`, `storage_id` (logical refs to
     `inventory.warehouses` / `inventory.warehouse_storages`, standard
     cross-module note), `borrowed_since` (renamed), `asset_type` as logical
     reference to `assets.asset_types.code`; new status CHECK
     (`ready|borrowed|maintenance|inactive|disposed|lost`); new indexes
     (unique `code` globally, unique `(coalesce(organization_id,''),
     serial_number)` partial, `asset_type`, `warehouse_id`, `storage_id`).
   - `assets.asset_movements`: add the four location columns, new
     `movement_type` CHECK, indexes on the new columns.
   - `assets.borrowings` / `borrowing_lines` / `borrowing_events`: copied from
     the inventory block with `asset_id` / `asset_movement_id` substituted,
     plus `origin_warehouse_id` / `origin_storage_id` on the header and the
     `asset_movement_id` FK on events (B7).
   - Delete `assets.asset_assignments`.
   - Keep `tool_sets` / `tool_set_items` unchanged.
2. Rewrite the **Inventory** module block (line 2202 onward):
   - delete `inventory.borrowings`, `borrowing_lines`, `borrowing_events` and
     their refs;
   - `inventory.items.item_kind` CHECK → `('product','component','material')`,
     delete the service clause;
   - `serial_tracked_items` status vocabulary drops `borrowed`; note
     `current_borrowing_line_id` as superseded;
   - note `stock_movements` borrowing types as superseded.
3. `docs/database/module-ownership.md`: Assets gains borrowing + asset types;
   Inventory loses borrowing. `document_sequences` is unchanged — no
   nullable-org carve-out (B4).
4. Update `docs/database/data-dictionary.md` if any new column family appears.
5. Run:

```text
bun docs/database/gen-logical-references.ts
bun docs/database/validate-dbml.ts   # must print OK: 0 cross-module refs, 0 timestamp gaps
```

**Status: DONE (2026-11-05).** Contract edited; both gates green. Deviations
from the sketch above, all forced by the parser or by evidence:

- `assets.asset_type` is a real intra-module `Ref` to `assets.asset_types.code`
  (not a logical reference); the old `asset_type IN (...)` CHECKs are deleted.
- `movement_type` vocabulary is `receipt|transfer|borrow_out|borrow_return|project_site|disposal|lost`
  (D3 says `borrow_return`, earlier text said `return`).
- `borrowing_events` has **no** `updated_at`/`deleted_at`, so it was added to
  `TIMESTAMP_EXEMPT` in `validate-dbml.ts` (the entry for
  `inventory.borrowing_events` was retargeted, not duplicated).
- `validate-dbml.ts` was **broken**: `@dbml/core` v11 leaves `db.refs` empty and
  puts all 228 refs on `schema.refs`, so the cross-module check had been passing
  vacuously. It now reads every ref (and prefers `endpoint.schemaName` over the
  bare-name map, which is ambiguous for `items`). Same 228 refs, now really checked.
- `gen-logical-references.ts` anchors its note regex at the start of the note, so
  every cross-module note must **begin** with `Logical reference to …`; two of
  the new notes were rewritten to satisfy it. Count is 513 (was 509); the 8 new
  asset→inventory links are offset by the notes that lived on the dropped
  inventory borrowing tables.
- **The contract file at `HEAD` did not parse at all**: it carried a
  `[note: …]` setting on a `Checks` entry (`assets.assets.status`), which
  `@dbml/core` rejects with `Unknown check setting 'note'`. Those notes were
  folded into the table `Note:` strings, so the file parses again — the gate
  could not have been green before this change.

### Slice 2 — Cleanup, schema, and the destructive migration

Order inside the slice matters: the CHECK tightens only after the rows are gone.

1. `apps/backend/database/cleanup-tool-items.ts` (B2, moved up from Slice 4):
   - `--dry-run` prints counts and refuses to write; mandatory first pass;
   - refuses to run when it finds a borrowing it cannot classify;
   - hard-deletes `items(kind='tool')` and their `serial_tracked_items`,
     cancelling any open borrowing with an audit row (D16).

   > **Done, then deleted 2026-11-14.** The script ran its dry run and
   > `--apply` on 2026-11-06 (8 items, 12 units removed) and is now a permanent
   > no-op: no `tool`/`service` rows exist and `ITEM_KINDS` no longer admits
   > them. It was removed from the tree rather than kept as a dead one-shot;
   > `docs/plan/progress.md` 2026-11-14 "removed the two stale one-shot database
   > scripts" has the reasoning.
2. Trim `database/seeders/seed/inventory.seeder.ts` to
   `product|component|material`; delete the tool and service blocks
   (`:104-155`) and their kinds entry (`:88-94`).
3. `apps/backend/drizzle/schemas/asset.schema.ts`:
   - `assetTypes` table; `assets.assetType` FK to it; location columns;
     `borrowedSince`; new CHECKs and unique indexes (D7, D13).
   - `assetMovements` location columns + vocabulary constant.
   - new `borrowings` / `borrowingLines` / `borrowingEvents` tables, with
     `origin_warehouse_id` + `origin_storage_id` on the header and
     `asset_movement_id` on events (B7).
   - delete `assetAssignments`; update the exported type aliases.
4. `apps/backend/drizzle/schemas/inventory.schema.ts`: remove the borrowing
   trio, tighten `ITEM_KINDS`, drop `borrowed` from the unit status vocabulary.
5. **No `organization.schema.ts` change** (B4).
6. Location columns are **logical refs only** (plain `uuid`), never FKs into
   `inventory.*` — the module boundary forbids cross-schema FKs.
7. `bun run drizzle:generate` in `apps/backend`; inspect and **hand-edit** the
   SQL:
   - `ALTER TABLE inventory.serial_tracked_items DROP CONSTRAINT
     serial_tracked_items_current_borrowing_line_id_borrowing_lines_id_fkey`
     before dropping `borrowing_lines` — the constraint exists in the database
     and in `20261102174836_colorful_rattler` but **not** in Drizzle metadata,
     so generate will omit it and the drop will fail;
   - `INSERT INTO assets.asset_types … ON CONFLICT DO NOTHING` **before** the
     `assets`/`asset_categories` FKs to it are added;
   - status backfill `in_stock→ready`, `in_use→borrowed` before the new CHECK;
   - confirm the migration contains exactly the intended `DROP TABLE`s and
     touches no unrelated table.
8. Dead vocabulary from D17 stays in the schema, annotated as superseded.
9. Apply to a disposable database only; then `bun run drizzle:migrate` and
   `bun run drizzle:seed` **twice** to prove idempotency.

**Status: DONE (2026-11-05), with one sequencing deviation.** Cleanup script
applied; asset/inventory schemas and the destructive migration landed; reset +
migrate + seed run twice; 530 tests pass; DB CHECKs verified.

- **Sequencing deviation:** the inventory borrowing trio,
  `serial_tracked_items.borrowed` + its CHECK, and `assets.asset_assignments`
  are **not** dropped in this slice. Dropping them while `borrowing.service.ts`
  and the assignment endpoints still use them would leave a commit that cannot
  compile or serve traffic. The code moves in Slice 3 and the `DROP TABLE`s
  ride that migration. The contract (`docs.dbml`) still describes the target.
- Migration `20261105123204_faulty_ikaris` was hand-edited beyond the plan:
  asset-type seed inserts placed after their unique index and before the FK
  adds; old status/movement CHECKs dropped **before** the backfills and
  re-added after (`UPDATE … 'ready'/'borrowed'`, `loan→borrow_out`,
  `return→borrow_return`); asset-table org columns dropped `NOT NULL`; the
  scope-split unique pairs replaced the old org-only codes.
- `database/seeders/index.ts` gained `import 'reflect-metadata'` first: both
  `drizzle:seed` and `drizzle:migrate-reset` crashed on Bun 1.4.4 without it.
- `asset.service.ts` / `asset-operations.service.ts` were retargeted to the new
  status and movement vocabulary so the slice compiles; Slice 3 replaces the
  custody path with borrowing.

### Slice 3 — Borrowing port, capacity reconcile, movements

1. `git mv` the inventory borrowing files into `apps/backend/src/app/assets/`:
   - `services/borrowing.service.ts`, `repositories/borrowing.repository.ts`,
     `controllers/borrowing.controller.ts`, `contracts/borrowing.*`,
     `test/unit/borrowing.service.test.ts`,
     `test/authorization/borrowing-authorization.test.ts`
     (import paths and module registrations updated).
2. Retarget: `serial_tracked_item_id` → `asset_id`; `stock_movement_id` →
   `asset_movement_id`; `postMovement`/`applyDelta` calls replaced by
   `asset_movements` writes. Guest/PII/approval/due-date logic unchanged.
3. Add to `AssetOperationsService` (or a sibling service, not both):
   - `reconcileStatus(assetId, tx)` (D7);
   - `syncCustody(assetId, tx)` (D8);
   - `place(assetId, { warehouseId, storageId }, tx)` writing a `receipt`
     movement;
   - `transfer(assetId, { toWarehouseId, toStorageId }, tx)` writing
     `transfer`, clearing the source location.
4. Inventory contract additions used by Assets (called through DI tokens, never
   by injecting inventory repositories):
   - `assertStorageInWarehouse(storageId, warehouseId)`;
   - `assertWarehouseReachableByOrg(warehouseId, organizationId | null)` —
     **stub returning `true` until ERP-0031 adds
     `inventory.warehouse_organizations`** (B1). Keep the call site real so the
     follow-up is a body swap, not a refactor.
5. `tool_sets`: lending a set expands to N borrowing lines (D6) and writes
   `tool_sets.status='lent'`; return restores `'available'`.
6. Audit actions for the new events (`asset.borrowed`, `asset.returned`,
   `asset.placed`, `asset.transferred`, `asset.disposed`, `asset.lost`) through
   the existing `InventoryAuditWriter`.

**Status: DONE (2026-11-06).** Borrowing engine lives in `assets`; the
assignment custody path is gone; the destructive migration landed and the full
gate set is green.

- `git mv` carried the service/repository/controller/contracts and both test
  suites into `apps/backend/src/app/assets/`; DI tokens, container
  registration, `app.ts` mounts and the asset `index.ts` export retargeted.
- `BorrowingService` now calls `AssetOperationsService.borrowOut` /
  `borrowReturn` / `markAssetLost` / `syncCustody` / `reconcileStatus`; one
  `asset_movements` row per physical transition, and the event CHECK
  (`issued|returned|marked_lost` require `asset_movement_id`) holds.
- `AssetOperationsService` gained `reconcileStatus`, `syncCustody`, `place`,
  `transfer`, `setToolSetStatus`, `toolSetAssetIds` and a private
  `assertLocation`; `asset_assignments` code, contract, repository methods and
  controller routes were deleted.
- Inventory exposes the two contract methods through
  `WarehouseService`: `assertStorageInWarehouse` is real, and
  `assertWarehouseReachableByOrg` returns `true` as the documented ERP-0031
  stub. Assets never touches an inventory repository.
- Locale keys were re-keyed `inventory:borrowing.*` → `assets.borrowing.*` in
  both `en` and `id`; audit vocabulary is
  `asset.borrowed|returned|lost|moved|placed|transferred|disposed|…`.
- Migration `20261105221923_erp0036_slice3_borrowing_engine`: drops the
  inventory borrowing trio and `assets.asset_assignments`, adds
  `assets.borrowings.tool_set_id`, and tightens
  `serial_tracked_items.status_check` (no `borrowed`). Hand-edited to drop the
  manually-created
  `serial_tracked_items_current_borrowing_line_id_borrowing_lines_id_fkey`
  **before** `borrowing_lines` disappears (it was never in Drizzle metadata).
  `serial_tracked_items.current_borrowing_line_id` stays as dead-but-documented
  (D17).
- Tests retargeted asset-shaped: borrowing service (state machine, approval
  skip, sweeps), borrowing authorization, asset operations (reconcile, place,
  transfer), kind×status matrix, item service, inventory authorization.
  `verify-inventory-constraints.ts` now probes `assets.borrowings` /
  `assets.borrowing_events`, and its D18 asset probes use `ready` instead of
  the retired `in_stock`.

  > That verifier was **deleted** on 2026-11-14: by then it failed 14 of its own
  > checks (missing `items.code`, `organization.document_sequences` moved to
  > `code_number`, a hardcoded six-schema `DROP` that broke the second run), so
  > the sentence above describes its state on 2026-11-06 only. No successor runs
  > constraint checks against a live server.

```text
bun run typecheck                      → clean (backend, locales, ui)
bun run test                           → 526 pass, 0 fail (27 files, 979 expects)
bun run lint                           → 0 errors (6 pre-existing warnings)
bunx --bun drizzle-kit generate --hints-file … 
  → 20261105221923_erp0036_slice3_borrowing_engine (hand-edited)
bun run drizzle:migrate                → migrations applied successfully
bun run drizzle:seed                   → complete (run 1)
bun run drizzle:seed                   → complete (run 2, idempotent)
bun docs/database/validate-dbml.ts     → 255 tables, 228 refs, 0 cross-module,
                                         0 timestamp gaps, OK
```

Post-migration DB checks (`ims_erp_local`): only the three `assets.borrowing*`
tables exist (no `inventory.borrowing*`, no `assets.asset_assignments`),
`assets.borrowings.tool_set_id` present, the manual FK is gone, and
`serial_tracked_items_status_check` is
`pre_order|in_stock|lost|sold|applied_warranty`. `docs/database/` was reviewed
and needed no change beyond Slice 1/2 (no table, column, link or vocabulary
moved in this slice).

### Slice 4 — Permissions, numbering, seed

1. Rename the permission resource `borrowing` → `asset_borrowing` across
   `packages/common/src/authorization/erp-permissions.ts` (10 blocks, all ten
   actions — B6) and every `@RequiresPermission` string; update
   `apps/backend/test/authorization/borrowing-authorization.test.ts`.
2. **Data migration in the same commit** (B3): idempotently move existing jsonb
   grants, since role rows are seeded insert-only and would otherwise keep the
   old key and lose access:
   `UPDATE auth.roles SET permissions = (permissions - 'borrowing') ||
   jsonb_build_object('asset_borrowing', permissions->'borrowing')
   WHERE permissions ? 'borrowing' AND NOT permissions ? 'asset_borrowing';`
3. Register doc-type `asset_borrowing`; keep `BRW-YYYYMM-####` (D14). Asset
   register codes allocate on the global sequence (D13).
4. Seed:
   - `assets.asset_types` with the six values (idempotent on `code`);
   - equipment assets with warehouse/storage placement and a `receipt`
     movement;
   - a sample tool set with members;
   - an open borrowing, a returned borrowing, and one lost asset;
   - no `tool`/`service` item kinds (trimmed in Slice 2).
   The seeder runs after `seedInventory()`; types seed before any asset row.

**Status: DONE (2026-11-06).** Permission resource renamed, the jsonb grants
migrated, numbering keys moved, and the assets seeder landed.

- `packages/common/src/authorization/erp-permissions.ts`: all ten actions moved
  from `borrowing` to `asset_borrowing` for every role that held them — no
  action added or removed (B6). Backend route guards and the controller's
  `actorFor` capability checks use the new resource.
- Migration `20261105223616_erp0036_slice4_permission_rename` is **data only**
  (custom, snapshot unchanged): idempotently renames `auth.roles.permissions`
  `borrowing` → `asset_borrowing`, and renames the
  `organization.document_sequences` row so the allocated BRW number is kept
  rather than restarted. If a target row already exists the stale source row is
  deleted instead of violating the unique key.
- `ASSET_DOC_TYPES.borrowing = 'asset_borrowing'`; `BorrowingService` allocates
  through it and keeps `BRW-YYYYMM-####`. `AssetService` now allocates on the
  **global** (`''`) sequence (D13), matching the globally-unique `assets.code`.
- New `database/seeders/seed/assets.seeder.ts`, wired after `seedInventory()`:
  six `asset_types` (upsert, idempotent on `code`), six assets with
  warehouse/storage placement and `receipt` movements, the `TS-SEED-01` tool
  set with two members, and three borrowings (`issued` asset out, `returned`
  asset back, `issued` with a `marked_lost` line). Every row is guarded by its
  fixed code/note, so re-runs are no-ops.

```text
bun run typecheck                      → clean
bun test                               → 526 pass, 0 fail (979 expects)
bun run drizzle:migrate                → migrations applied successfully
bun run drizzle:seed                   → complete (run 1)
bun run drizzle:seed                   → complete (run 2, idempotent)
bun docs/database/validate-dbml.ts     → 255 tables, 228 refs, 0 cross-module,
                                         0 timestamp gaps, OK
```

Post-migration DB checks (`ims_erp_local`): 19 role rows carry
`asset_borrowing` and zero carry `borrowing`; six seeded assets with the
expected statuses (one `borrowed`, one `lost`, four `ready`); 5 receipts, 3
`borrow_out`, 1 `borrow_return`, 1 `lost` movement; three borrowings with one
line each; physical events all carry `asset_movement_id`; `TS-SEED-01` has two
members. `docs/database/` reviewed — no change required (permission/numbering
keys are not part of the persistence contract).

### Slice 5 — UI, i18n, removals

**Status: DONE (2026-11-06).** Screens moved, lookup wired, removals and
locale re-keying complete.

1. Borrowing screens move under Assets & Equipment (list, detail, form) using
   the ported `borrowing-api.ts`; the loans page becomes a borrowing list
   filtered to open borrowings.
2. Asset register: type filter and both forms load options from
   `GET /assets/types` (active only); type labels render from `name`, not from
   `t('assets:type.*')`; detail page gains a location card and a "place" /
   "transfer" action with a warehouse → storage picker.
3. Remove the inventory Tools page (`routes/_authed/inventory/tools/index.tsx`),
   the warehouse Tools tab (`$warehouseId.tsx:168`), the inventory borrowings
   routes and components, `item-kind-list.tsx` tool usage, and the
   `inventory:tools.*` / `inventory:borrowings.*` / `assets:type.*` locale keys
   in both `en` and `id`.
4. Update `DYNAMIC_PREFIXES` in `packages/locales/src/locale-dead-keys.test.ts`
   so composed keys still resolve.
5. New `assets` namespace keys for types CRUD, location, and borrowing (en and
   id).

## Acceptance criteria

- `bun docs/database/validate-dbml.ts` prints `OK: 0 cross-module refs, 0
  timestamp gaps`.
- `bun run drizzle:migrate` and `bun run drizzle:seed` each run twice cleanly on
  a disposable database.
- A tool can be created as an asset, placed in a warehouse/storage, transferred
  between storages, borrowed by a guest, returned with a condition, and
  disposed — every step producing the right `asset_movements` row and no
  `stock_movements` row.
- Asset status is never hand-written for unit-backed rows: a borrowed asset
  shows `borrowed`, a returned one `ready`, and `inactive` survives a reconcile.
- A serialized product can still be received, moved, and sold through inventory;
  the inventory API rejects `item_kind = 'tool'` and `'service'`.
- Two assets cannot share a serial number within a scope; a global asset and an
  org asset cannot share a code (global unique code, D13).
- A global asset is writable only by app admin; an org user can read it.
- Reachability ("an org-scoped asset cannot be placed in a warehouse the org has
  no link to, 422 not a silent success") is **deferred to ERP-0031** and is not
  an acceptance criterion of this change: the table it needs does not exist.
  This slice only guarantees the call site exists and is exercised by a test
  double.
- Every borrowing action appears in the audit trail with the acting org.
- `bun run lint`, `bun run typecheck`, `bun run test` green, including locale
  parity and dead-key guards.
- No `assets:type.*`, `inventory:tools.*` or `inventory:borrowings.*` keys
  remain in either bundle.

## Risks and accepted costs

- **Irreversible.** D16 drops tables and hard-deletes rows. Safe only while no
  production database exists. A reviewer must confirm the target
  `POSTGRES_URL` before the migration is applied anywhere.
- **Two ledgers.** `asset_movements` and `stock_movements` both exist. Bin
  occupancy across items and assets is a union query; no view is built until
  reporting asks for one.
- **Derived status.** `assets.status` is a denormalisation for unit-backed
  rows. A missed reconcile call is a stale-status bug; every event must go
  through the helper, which is why it lives next to the service methods rather
  than in the repository.
- **Global assets are app-admin-write.** Field organizations cannot create or
  move company-wide equipment without an admin. Deliberate; the alternative is
  a write-authorisation hole.
- **Dropping `service` and `tool`** retires a vocabulary value that Sales
  quoting may want later; re-adding it is a new migration against a schema that
  is documented as target, not history.

## Explicit follow-ups (deferred)

- Remove the superseded inventory vocabulary (`borrowing_*` movement types,
  `reference_type='borrowing'` CHECK, `serial_tracked_items.current_borrowing_line_id`)
  in a separate cleanup migration.
- Bin/asset occupancy view combining `stock_balances` and asset placements.
- Asset transfer approval document (today a transfer is a single atomic move
  with an audit row).
- Per-unit acquisition cost for migrated tools (the cleanup script deletes them
  rather than migrating, so no cost split is performed).
- Notifications/scheduler for overdue asset borrowings.
- Provisioning (`pre_order`) for assets, if purchase orders ever need it.
