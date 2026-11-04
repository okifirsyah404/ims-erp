# Inventory Module Plan — Items, Warehouses, Stock, Borrowing

> Status: draft plan (sharpened through a grilling session; 3 open questions
> remain, marked `OPEN-1..3`)
> Scope: `inventory` module from zero — item master + serialized units,
> warehouses + addresses + storages, stock ledger + balances, borrowing with
> guest support and a custody event trail, per-slice admin UI, and the
> contract/ADR/backlog sync that makes those true.
> Owner: B (backend inventory). Overrides ERP-0014's original "movement
> boundaries only" scope — see §0.

## 0. What this plan replaces

Four documents currently describe inventory, and all four are wrong in ways
that matter. S0 exists to fix them before code lands.

| Document | Current claim | Reality after this plan |
|---|---|---|
| `docs/database/docs.dbml` | Canonical persistence contract: `catalog.items` (item master, `item_type ∈ good\|service\|bundle\|subscription`), `inventory.warehouses` with `location_text`/`village_id`, `inventory.warehouse_zones`, `inventory.serial_tracked_items` (`status ∈ in_stock\|installed\|in_service\|sold\|disposed`), `stock_movements.movement_type` without borrowing | Item master moves into `inventory.items`; 3 borrowing tables are added; status vocabulary changes; `warehouse_zones` dropped; `movement_type` gains `borrowing_out`/`borrowing_in`; **`catalog` satellites left in place, flagged (OPEN-1)** |
| `docs/architecture/modules/inventory.md` | Self-flagged stale (line 1: describes deleted `apps/backend-nest`) | Rewritten to describe what ships |
| `docs/plan/backlog.md` ERP-0014 | "stock movements + valuation boundaries; reconciliation to GL control", Phase 5, depends on ERP-0010 | Re-scoped: no GL reconciliation (accounting does not exist), borrowing added, depends on nothing but auth |
| `packages/common/.../erp-permissions.ts` | `warehouse`, `stock`, `stock_adjustment`, `product` statements; `warehouse:read` granted to 8 org roles | `borrowing` statement added; `warehouse:*` stripped from every org role |
| `docs/architecture/data-model.md` | "Nothing exists for inventory/stock/warehouse" | Still accurate today; updated per slice |

**Phase gate override.** `backlog.md` puts inventory in Phase 5 behind
`ERP-0010` (accounting), which depends on `ERP-0008`, which does not exist.
This plan builds inventory with **no dependency on accounting**: stock
*quantities* are tracked, stock *valuation* is not. `stock_balances.average_cost`
/ `total_value` stay at their contract defaults and are not computed. That is
the honest boundary — valuation needs a COA and a posting engine that are not
there.

## 1. Implementation Status

Honest record. Nothing shipped yet.

| Slice | State | Commit | Delivered |
|---|---|---|---|
| S0 | ✅ shipped | `a9b2821` | Contract sync: `docs.dbml`, ADR-0008, ADR-0009, backlog ERP-0014 re-scope, `modules/inventory.md` rewrite, permission catalog |
| S1 | ✅ shipped | `a9b2821` | `inventory.items` + `inventory.serial_tracked_items` (widened), migrations, item service/API, item UI |
| S2 | ✅ shipped | — | `inventory.warehouses` + `warehouse_addresses` + `warehouse_storages` service/API, `requireGlobalAdmin` extraction, warehouse UI with searchable province→village cascade, inventory seeder (S1's item seeder folded in) |
| S3 | ✅ shipped and applied | — | `inventory.stock_movements` + `stock_balances` + `stock_adjustments`/`stock_adjustment_items`; ledger service with transactional balance maintenance, reversal, recompute repair, the adjustment approval workflow, and the stock/adjustment UI |
| S4 | ⬜ pending | — | `inventory.borrowings` + `borrowing_lines` + `borrowing_events`, issue/return/late/lost state machine, late-return scheduled job, borrowing UI |

**Notes recorded during implementation.**

- The warehouse tables were already created by the S1 migration, so S2 wrote
  **no migration**; it is service/API/UI/tests/seeder only.
- `requireGlobalAdmin` had **no** test coverage despite the plan asserting
  "covered by its existing tests"; `test/unit/require-global-admin.test.ts`
  now covers it.
- The shared auth test harness did not emit a platform `role` on the mock
  session, so **no fixture could ever pass the global-admin policy**. Fixed in
  `test/authorization/test-app.ts` with a separate `globalRole` field.
- S2 decisions, settled with the product owner: one default **enforced** per
  scope (D-A); full **searchable** province→village cascade (D-B);
  `organizationId` **defaults to `NULL`** (global), scope immutable after
  creation (D-C); S1's missing seeder **folded into S2** (D-D).

## 2. Context

An Indonesian access-control business (hardware, software, installation,
maintenance). Two facts drive the whole design:

1. **Tools walk out the door.** Technicians take tools and test units to job
   sites. Today there is no record of who has what. A lost controller is a
   total loss with no recoverable claim, because the borrower was never
   recorded.
2. **A unit is not a SKU.** A door controller model (SKU) has individual units
   (serials) with individual warranties, individual locations, and individual
   fates — sold, installed at customer X, applied against a warranty claim, or
   lost in a van. Quantity-level stock cannot express that.

Inventory exists to answer, at any moment: *what do we own, where is it, who
has it, and what state is it in.*

### Terminology

| Term | Meaning |
|---|---|
| **Item** | SKU-level master row. `inventory.items` |
| **Unit** | One physical, serialized instance of an item. `inventory.serial_tracked_items` (name kept deliberately — see D9) |
| **Kind** | `product \| component \| material \| tool \| service`. Drives the consumption matrix |
| **Custody** | Who physically holds a unit right now: a warehouse, or a borrower |
| **Movement** | One append-only ledger row describing a stock quantity change |

## 3. Locked Decisions

| # | Decision |
|---|---|
| D1 | **The item master lives in `inventory.items`.** `catalog.items` is superseded. There is one item master, owned by the Inventory module. The `product:*` permission keeps its name. |
| D2 | **Item kinds are `product \| component \| material \| tool \| service`.** A DB `CHECK`, not a native enum (project rule: status vocabularies are text guarded by checks). |
| D3 | **`organization_id` is nullable on every inventory table.** Global inventory is first-class, not an accident. Consequence accepted: the "Tenant" contract obligation in `module-ownership.md` no longer protects these tables; every consumer must tolerate NULL. |
| D4 | **Warehouse writes are application-admin-only** (`user.role === 'admin'`). Writes ride `sessionGuard` + a `requireGlobalAdmin` policy, *not* `erpGuard`, because a global warehouse has no organization context and `erpGuard` 403s before any role check. Copied from `organization-bootstrap.controller.ts`. |
| D5 | **Organization roles lose `warehouse:*` entirely**, including `read`. A non-admin cannot see warehouses. |
| D6 | **`inventory.warehouse_addresses` is strict 1:1 with `warehouses`.** Address columns leave `warehouses`. `UNIQUE(warehouse_id)`. No `kind` discriminator. Structured per ADR-0003: street detail text + `village_id` logical ref + `rt`/`rw`/`postal_code`. |
| D7 | **Borrowing is new and module-owned.** `borrowings` / `borrowing_lines` / `borrowing_events`. Borrowers may be a registered user, a registered customer, or a **guest** whose identity is snapshotted onto the header. |
| D8 | **One issue/return engine.** "Tested" is a borrowing with `purpose = 'testing'`, not a parallel flow. Purposes: `rental \| internal_use \| testing \| warranty_service`. |
| D9 | **`serial_tracked_items` keeps its name** and is widened. `item_units` never exists. Renaming would churn 33 logical-ref documentations for no gain. |
| D10 | **Borrowing writes the stock ledger.** `movement_type` gains `borrowing_out` and `borrowing_in`. A tool in a technician's van is not available stock. |
| D11 | **Item status lives only on serialized units.** A material has no status. Quantity-level state is derived from `stock_balances`. |
| D12 | **Status vocabulary: `pre_order \| in_stock \| borrowed \| lost \| sold \| applied_warranty`.** `ready` from the original requirement becomes `in_stock` in the DB and "Siap" in the UI. `sold` and `applied_warranty` are **product-only**, enforced by a service-level transition matrix. |
| D13 | **Pre-ordered units get a provisional serial** (`PO-<sequence>`), replaced exactly once on receipt. `serial_number` stays NOT NULL. The one-time mutation is guarded in the repository, not the DB. |
| D14 | **Storage is two levels: warehouse → storage (bin).** No zones. `warehouse_zones` is dropped from the contract. |
| D15 | **Nullable-org uniqueness uses a partial-index pair** per coded table: `UNIQUE(organization_id, code) WHERE organization_id IS NOT NULL` plus `UNIQUE(code) WHERE organization_id IS NULL`. Postgres treats NULLs as distinct, so a plain composite index would silently stop constraining global rows. |
| D16 | **`stock_balances` is a service-maintained cache**, written in the same transaction as the movement. No triggers. A `recomputeFromLedger` repair operation exists and is tested against the ledger. |
| D17 | **Adjustments are documents with an approval chain.** `stock_adjustments` + `stock_adjustment_items` are implemented in S3: `draft → submitted → approved\|rejected → posted\|cancelled`. Only `posted` writes movements, at most once (`posted_at IS NOT NULL` is the guard). A line stores `quantity_before`/`quantity_after` (counted totals, not deltas) so a recount is auditable; a line with no delta writes **no** movement (`stock_movements_quantity_check` also forbids `quantity = 0`). Self-approval is refused unless the actor holds `stock_adjustment:approve`. `stock_transfers` / `stock_reservations` / `lot_batches` / `cycle_counts` remain **deferred** and stay in the contract marked not-implemented. |
| D18 | **`borrowing_events` is the business timeline; movements never point back at events.** Physical event types (`issued`, `returned`, `lost`) carry a non-null `stock_movement_id`; non-physical types (`requested`, `approved`, `marked_late`, `due_date_extended`, `cancelled`, `rejected`) carry NULL. Enforced by a check constraint plus a test. |
| D19 | **Borrowing status machine:** `draft → requested → approved → issued → partially_returned → returned → closed`, branches `rejected` / `cancelled`. The API creates rows directly in `requested` (no draft step in the UI); `approved` is **skippable** when the issuer holds `owner \| admin \| operations_manager`. |
| D20 | **Request/issue separation.** Issuing requires `borrowing:issue`; the issuer is expected to differ from the requester. `borrowing:mark_lost` is restricted to `owner \| admin \| operations_manager`. |
| D21 | **Late return is both derived and recorded.** A scheduled job writes one `marked_late` event per line when `due_at` passes, and reads also derive `due_at < now() AND returned_at IS NULL` so the UI is never stale. |
| D22 | **Custody while borrowed: `warehouse_id IS NULL`.** `serial_tracked_items.warehouse_id` is cleared on issue and restored on return. Borrowing lines carry optional `project_id` (logical ref) and `site_address_text` for "which site". |
| D23 | **Guest PII is snapshotted on `borrowings`**: `guest_name`, `guest_phone`, `guest_id_type`, `guest_id_number`, `guest_address_text`, `guest_id_document_ref` (plain text until a Documents module exists). Retention and access tier in §7. |
| D24 | **S0 is contract-first.** No slice writes code against a knowingly-wrong `docs.dbml`. |

## 4. Rules established during grilling

- **Tools can only be borrowed.** Nothing else consumes a tool. Attempting
  `sold` / `applied_warranty` on a `tool` is a 422.
- **Products, components, and materials** may be `sold`, applied to warranty,
  borrowed, or tested — the last two are both borrowings (D8).
- **A material never has a serial and never has a status.** Do not add a
  status column to `items` to work around this.
- **A `service` item is never stock-tracked and never serialized.** `is_serialized`
  and `is_stock_tracked` must both be false for kind `service` (check constraint).
- **A tool defaults to `is_serialized = true`.** Not enforced by the DB — a
  non-serialized tool is nonsense but a serialized material is merely
  wasteful — enforced by a seeder default and a service warning.
- **Every physical state change writes a movement, in one transaction, with
  the custody change.** Never a movement without a status change, never a
  status change without a movement.
- **Provisional serial replacement happens exactly once and only while status
  is `pre_order`.** After that, `serial_number` is immutable.
- **Global rows are addressed with `organization_id IS NULL`.** Do not
  substitute `''` or a sentinel organization.
- **Warehouse reads by non-admins return 403, not an empty list.**
- **"Siap" in the UI is `in_stock` in the API.** No `ready` string anywhere
  outside the Indonesian label bundle.

## 5. Data model

New/rewritten Postgres schema: `inventory`. Intra-module FKs are real FKs.
References to `auth.users`, `auth.organizations`, `location.villages`,
`crm.customers`, and `projects.projects` are **logical ref columns plus a
column note**, never FKs (project rule: zero cross-module refs).

### `inventory.items`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | `DEFAULT uuidv7()` (PG 18+, already used by `location.schema.ts`) |
| `organization_id` | text NULL | logical ref `auth.organizations.id` |
| `sku` | varchar(64) NOT NULL | |
| `name` | text NOT NULL | |
| `description` | text NULL | |
| `item_kind` | text NOT NULL | check: `product\|component\|material\|tool\|service` |
| `category` | text NULL | free text for now. `catalog.item_categories` is not adopted (OPEN-1) |
| `unit_label` | varchar(32) NULL | "pcs", "m", "roll". `catalog.units` not adopted (OPEN-1) |
| `is_serialized` | boolean NOT NULL DEFAULT false | |
| `is_stock_tracked` | boolean NOT NULL DEFAULT true | |
| `min_stock_qty` | numeric(18,3) NOT NULL DEFAULT 0 | |
| `barcode` | text NULL | |
| `selling_price` | bigint NOT NULL DEFAULT 0 | IDR minor units (ADR-0002) |
| `purchase_price` | bigint NOT NULL DEFAULT 0 | IDR minor units |
| `currency_code` | varchar(3) NOT NULL DEFAULT 'IDR' | |
| `created_at` / `updated_at` | bigint NOT NULL | `unixTimestamp` |
| `deleted_at` | bigint NULL | soft delete |

Indexes: `items_org_sku_uq` = `UNIQUE(organization_id, sku) WHERE organization_id IS NOT NULL`;
`items_global_sku_uq` = `UNIQUE(sku) WHERE organization_id IS NULL`;
`items_kind_idx`; `items_org_name_idx`; `items_barcode_idx`.
Checks: `item_kind` vocabulary; prices `>= 0`; `min_stock_qty >= 0`;
`NOT (item_kind = 'service') OR (NOT is_serialized AND NOT is_stock_tracked)`.

### `inventory.serial_tracked_items` (widened, D9)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | `uuidv7()` |
| `organization_id` | text NULL | |
| `item_id` | uuid NOT NULL | **real FK** → `inventory.items.id`, `ON DELETE RESTRICT` |
| `serial_number` | text NOT NULL | |
| `is_provisional_serial` | boolean NOT NULL DEFAULT false | D13 |
| `asset_tag` | text NULL | tools especially |
| `status` | text NOT NULL DEFAULT 'in_stock' | D12 vocabulary |
| `warehouse_id` | uuid NULL | **real FK** → `warehouses.id`, `ON DELETE SET NULL`; NULL while borrowed/lost (D22) |
| `bin_id` | uuid NULL | **real FK** → `warehouse_storages.id`, `ON DELETE SET NULL` |
| `current_borrowing_line_id` | uuid NULL | **real FK** → `borrowing_lines.id`, `ON DELETE SET NULL` |
| `acquired_on` | date NULL | kept |
| `warranty_expires_on` | date NULL | kept |
| `purchase_order_line_id` | text NULL | logical ref, **unvalidated** — Procurement does not exist. Documented as such |
| `customer_id` | uuid NULL | logical ref `crm.customers.id`, set when sold |
| `stock_movement_id` | uuid NULL | logical ref → `stock_movements.id`, last movement that touched it |
| `notes` | text NULL | |
| `created_at` / `updated_at` | bigint NOT NULL | |
| `deleted_at` | bigint NULL | |

Indexes: `serial_tracked_items_org_serial_uq` = `UNIQUE(organization_id, serial_number) WHERE organization_id IS NOT NULL`;
`serial_tracked_items_global_serial_uq` = `UNIQUE(serial_number) WHERE organization_id IS NULL`;
`item_id`; `status`; `warehouse_id`; `asset_tag`.
Checks: `status` vocabulary; `warranty_expires_on`/`acquired_on` ordering;
`is_provisional_serial = false OR status = 'pre_order'`.

> **Circular FK note:** `serial_tracked_items.current_borrowing_line_id` →
> `borrowing_lines` and `borrowing_lines.serial_tracked_item_id` →
> `serial_tracked_items`. Drizzle cannot express that in one pass. Resolve by
> creating `serial_tracked_items` **without** the column in the same migration
> that creates `borrowing_lines`, then `ALTER TABLE ... ADD CONSTRAINT` in a
> second migration. Do not denormalize one side away — both directions are
> queried.

### `inventory.warehouses`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `organization_id` | text NULL | D3 |
| `code` | varchar(32) NOT NULL | |
| `name` | text NOT NULL | |
| `responsible_employee_id` | uuid NULL | logical ref `hr.employees.id` (module absent) |
| `is_default` | boolean NOT NULL DEFAULT false | |
| `is_active` | boolean NOT NULL DEFAULT true | |
| `created_at` / `updated_at` / `deleted_at` | | |

`location_text` and `village_id` **removed** (D6).
Indexes: partial unique pair on `code` (D15); `warehouses_is_default_idx`.

### `inventory.warehouse_addresses` (D6)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `warehouse_id` | uuid NOT NULL | **real FK**, `ON DELETE CASCADE`, `UNIQUE` |
| `label` | text NULL | "Gudang utama" |
| `street` | text NOT NULL | ADR-0003 free-text detail |
| `rt` / `rw` | varchar(8) NULL | |
| `postal_code` | varchar(10) NULL | |
| `village_id` | uuid NULL | logical ref `location.villages.id` |
| `latitude` / `longitude` | numeric(10,7) NULL | |
| `created_at` / `updated_at` / `deleted_at` | | |

### `inventory.warehouse_storages`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `warehouse_id` | uuid NOT NULL | **real FK**, `ON DELETE CASCADE` |
| `code` | varchar(32) NOT NULL | |
| `name` | text NULL | |
| `bin_type` | text NULL | free text |
| `capacity` | numeric(18,3) NULL | |
| `is_active` | boolean NOT NULL DEFAULT true | |
| timestamps | | |

`zone_id` **removed** (D14). Index: `UNIQUE(warehouse_id, code) WHERE deleted_at IS NULL`.

### `inventory.stock_movements` (append-only)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `organization_id` | text NULL | |
| `code` | varchar(32) NOT NULL | document numbering, ERP-0009 does not exist → generate in-service |
| `movement_type` | text NOT NULL | **`receipt \| issue \| transfer_in \| transfer_out \| adjustment_in \| adjustment_out \| return_in \| return_out \| consumption \| borrowing_out \| borrowing_in`** |
| `item_id` | uuid NOT NULL | **real FK** → `items.id`, RESTRICT |
| `warehouse_id` | uuid NOT NULL | **real FK** → `warehouses.id`, RESTRICT |
| `bin_id` | uuid NULL | **real FK** → `warehouse_storages.id`, SET NULL |
| `target_warehouse_id` | uuid NULL | real FK → `warehouses.id` |
| `quantity` | numeric(18,3) NOT NULL | check `<> 0` |
| `unit_cost` / `currency_code` | | **not computed** in this plan — valuation is out of scope (§0) |
| `reference_type` | text NULL | `manual_adjustment \| borrowing \| ...` |
| `reference_id` | text NULL | |
| `status` | text NOT NULL DEFAULT 'posted' | `draft \| posted \| reversed` — only `posted`/`reversed` used |
| `occurred_at` | bigint NOT NULL | |
| `created_by` | text NULL | logical ref `auth.users.id` |
| `notes` | text NULL | |
| `created_at` | bigint NOT NULL | **no `updated_at`, no `deleted_at`** |

Append-only: no soft delete. Corrections are reversing rows.
Checks: `movement_type` vocabulary; `quantity <> 0`;
transfer pairs require `target_warehouse_id`; `borrowing_out`/`borrowing_in`
require `reference_type = 'borrowing'`.
Indexes: partial unique pair on `code`; `(organization_id, item_id, warehouse_id, occurred_at)`;
`reference_type`; `reference_id`; `bin_id`.

### `inventory.stock_balances` (service-maintained cache, D16)

Same as contract, minus valuation: `quantity_on_hand`, `quantity_reserved`,
`quantity_available`, `average_cost`/`total_value` **present but never
advanced**, `last_movement_at`. `UNIQUE(organization_id, warehouse_id, item_id, bin_id)`
expressed as two partial indexes under D15.
`quantity_available = quantity_on_hand - quantity_reserved` as a check.

> **`quantity_reserved` is unused in this plan.** Reservations are deferred
> (D17). Keep the column at 0 so the deferred slice does not migrate.

### `inventory.borrowings` (D7, D23)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `organization_id` | text NULL | |
| `code` | varchar(32) NOT NULL | `BRW-YYYYMM-####` |
| `status` | text NOT NULL | D19 |
| `purpose` | text NOT NULL DEFAULT 'internal_use' | `rental \| internal_use \| testing \| warranty_service` |
| `borrower_type` | text NOT NULL | `user \| customer \| guest` |
| `borrower_user_id` | text NULL | logical ref `auth.users.id` |
| `borrower_customer_id` | uuid NULL | logical ref `crm.customers.id` |
| `guest_name` | text NULL | |
| `guest_phone` | text NULL | |
| `guest_id_type` | text NULL | `ktp \| sim \| passport \| other` |
| `guest_id_number` | text NULL | |
| `guest_address_text` | text NULL | |
| `guest_id_document_ref` | text NULL | until Documents exists |
| `requested_by` | text NULL | logical ref `auth.users.id` |
| `requested_at` | bigint NULL | |
| `approved_by` / `approved_at` | text / bigint NULL | |
| `issued_by` / `issued_at` | text / bigint NULL | |
| `due_at` | bigint NOT NULL | |
| `closed_by` / `closed_at` | text / bigint NULL | |
| `notes` | text NULL | |
| timestamps | | |

Checks: status vocabulary; purpose vocabulary; borrower_type vocabulary;
borrower consistency — exactly one of the three identity paths populated:
`(borrower_type='user' AND borrower_user_id IS NOT NULL AND guest_name IS NULL AND borrower_customer_id IS NULL) OR (borrower_type='customer' AND borrower_customer_id IS NOT NULL AND guest_name IS NULL AND borrower_user_id IS NULL) OR (borrower_type='guest' AND guest_name IS NOT NULL AND guest_phone IS NOT NULL AND guest_id_number IS NOT NULL AND borrower_user_id IS NULL AND borrower_customer_id IS NULL)`.
Indexes: partial unique pair on `code`; `status`; `borrower_user_id`;
`borrower_customer_id`; `due_at`.

### `inventory.borrowing_lines`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `borrowing_id` | uuid NOT NULL | **real FK**, CASCADE |
| `serial_tracked_item_id` | uuid NOT NULL | **real FK**, RESTRICT — borrowing is serialized-only (Q5) |
| `issued_at` / `due_at` / `returned_at` | bigint NULL | |
| `returned_condition` | text NULL | `good \| damaged \| incomplete` |
| `marked_late_at` | bigint NULL | |
| `marked_lost_at` | bigint NULL | |
| `lost_reported_by` | text NULL | logical ref `auth.users.id` |
| `site_address_text` | text NULL | D22 |
| `project_id` | uuid NULL | logical ref `projects.projects.id` |
| `notes` | text NULL | |
| timestamps | | |

Checks: `due_at > issued_at` when both present;
`returned_condition` vocabulary.
Index: `UNIQUE(borrowing_id, serial_tracked_item_id)`;
`serial_tracked_item_id` where open.

### `inventory.borrowing_events` (D18, D21)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `borrowing_id` | uuid NOT NULL | **real FK**, CASCADE |
| `borrowing_line_id` | uuid NULL | real FK, CASCADE (NULL = header-level event) |
| `event_type` | text NOT NULL | `requested \| approved \| rejected \| issued \| returned \| marked_late \| marked_lost \| due_date_extended \| cancelled \| closed` |
| `stock_movement_id` | uuid NULL | logical ref → `stock_movements.id` |
| `actor_user_id` | text NULL | logical ref `auth.users.id` |
| `occurred_at` | bigint NOT NULL | |
| `note` | text NULL | |

Check: `(event_type IN ('issued','returned','marked_lost') AND stock_movement_id IS NOT NULL) OR (event_type NOT IN ('issued','returned','marked_lost') AND stock_movement_id IS NULL)`.
No soft delete — timeline is append-only. Index: `(borrowing_id, occurred_at)`;
`borrowing_line_id`.

## 6. Authorization

Single grant source: `packages/common/src/authorization/erp-permissions.ts`.

**New statement.**

```ts
borrowing: ['read', 'create', 'update', 'approve', 'issue', 'return', 'extend', 'mark_late', 'mark_lost', 'export'],
```

**Role grants to add (and to strip).**

| Role | Change |
|---|---|
| `owner` | already `...allErpStatements` → gains `borrowing:*` automatically; keep full |
| `admin` | add `borrowing: ['read','create','update','approve','issue','return','extend','mark_late','mark_lost','export']` |
| `operations_manager` | add `borrowing: ['read','create','update','approve','issue','return','extend','mark_late','mark_lost','export']` |
| `warehouse` | add `borrowing: ['read','update','issue','return','extend','mark_late','mark_lost','export']`; **remove** `warehouse: ['read']` |
| `technician` | add `borrowing: ['read','create']` |
| `sales` / `sales_manager` | add `borrowing: ['read','create']` |
| `project_manager` | add `borrowing: ['read','create','approve']` |
| `customer_service` | add `borrowing: ['read','create']` |
| `finance`, `accountant`, `auditor`, `marketing`, `hr`, `freelancer`, `investor`, `customer`, `member` | **remove any `warehouse`/`stock` grant they hold**; `auditor` gains `borrowing: ['read','export']` |
| `purchasing` | add `product: ['read']`, `stock: ['read']`; keeps no `warehouse:*` |

`product` and `stock` grants stay as they are otherwise — item and stock
reads are ordinary org-scoped permissions.

**Warehouse endpoints (D4, D5).**

```
sessionGuard + erpSession({ policy: requireGlobalAdmin })
```

`requireGlobalAdmin` is lifted from `organization-bootstrap.controller.ts:21-28`
into a shared helper (`apps/backend/src/authorization/require-global-admin.ts`)
rather than copy-pasted a third time. Warehouse routes carry **no** org
requirement and **no** `warehouse:*` permission check — being an application
admin *is* the check. Non-admin gets 403 `user.globalAdminRequired`.

**Guest PII tier.** `guest_id_number`, `guest_id_document_ref`, and
`guest_address_text` are returned only when the caller holds `borrowing:mark_lost`
or is an application admin. Everyone else gets the borrowing with those three
fields redacted to `null` and a `guest_identity_redacted: true` flag. This is a
projection concern in the service, not a separate permission — a new
`borrowing:read_pii` statement would fragment the grant catalog for one field
group.

## 7. API surface

Routes mount at the noun, no `/api/v1` prefix (matches `/locations`,
`/organizations`, `/admin/*`). Envelope per `api-conventions.md`
(`meta`/`data`), `page`+`limit` pagination, 400/401/403/404/409/422 mapping.

### Items — `erpGuard` on `product:*`

| Method | Path | Permission |
|---|---|---|
| GET | `/items` | `product:read` |
| GET | `/items/:id` | `product:read` |
| POST | `/items` | `product:create` |
| PATCH | `/items/:id` | `product:update` |
| DELETE | `/items/:id` | `product:archive` |
| GET | `/items/:id/units` | `product:read` |
| POST | `/items/:id/units` | `product:update` (provisional serial registration) |
| PATCH | `/items/:id/units/:unitId` | `product:update` (provisional serial → real, once) |

### Warehouses — `sessionGuard` + global admin

| Method | Path | Gate |
|---|---|---|
| GET | `/warehouses` | global admin |
| GET | `/warehouses/:id` | global admin |
| POST / PATCH / DELETE | `/warehouses[/:id]` | global admin |
| GET / PUT | `/warehouses/:id/address` | global admin |
| GET / POST / PATCH / DELETE | `/warehouses/:id/storages[/:sid]` | global admin |

### Stock — `erpGuard` on `stock:*`

| Method | Path | Permission |
|---|---|---|
| GET | `/stock/balances` | `stock:read` |
| GET | `/stock/movements` | `stock:read` |
| GET | `/stock/units` | `stock:read` |
| POST | `/stock/receipts` | `stock:receive` |
| POST | `/stock/issues` | `stock:issue` |
| POST | `/stock/adjustments` | `stock_adjustment:create` |
| POST | `/stock/movements/:id/reverse` | `stock_adjustment:post` |
| POST | `/stock/balances/recompute` | `stock_adjustment:post` (repair op, D16) |

### Borrowing — `erpGuard` on `borrowing:*`

| Method | Path | Permission |
|---|---|---|
| GET | `/borrowings` | `borrowing:read` |
| GET | `/borrowings/:id` | `borrowing:read` |
| POST | `/borrowings` | `borrowing:create` (status → `requested`) |
| POST | `/borrowings/:id/approve` | `borrowing:approve` |
| POST | `/borrowings/:id/reject` | `borrowing:approve` |
| POST | `/borrowings/:id/issue` | `borrowing:issue` |
| POST | `/borrowings/:id/return` | `borrowing:return` (per-line) |
| POST | `/borrowings/:id/extend` | `borrowing:extend` |
| POST | `/borrowings/lines/:lineId/mark-late` | `borrowing:mark_late` |
| POST | `/borrowings/lines/:lineId/mark-lost` | `borrowing:mark_lost` |
| POST | `/borrowings/:id/cancel` | `borrowing:create` (requester only) |

**Transactional invariants per endpoint** (all in one `drizzle/container.ts`
transaction, §9 of `architecture.md` — services own transactions):

- `issue` → for each line: set unit `status='borrowed'`, `warehouse_id=NULL`,
  `current_borrowing_line_id`, write `stock_movements` row
  (`borrowing_out`, `reference_type='borrowing'`), update `stock_balances`,
  append `issued` event with the movement id.
- `return` → inverse; `stock_movements` `borrowing_in`; `returned` event.
- `mark-lost` → `status='lost'`, no warehouse restored; movement
  `adjustment_out` with `reference_type='borrowing'`; `marked_lost` event.
  **Note:** this is the one event type where "physical" is ambiguous —
  D18 says all `marked_lost` events carry a movement, so the loss writes a
  stock reduction of 1 at the warehouse the unit left from, captured on the
  line at issue time (`lines.origin_warehouse_id` — **add this column**).

## 8. Scheduled job

First scheduled worker in the backend. `@providers/queue` exists; verify it
supports a repeating job before S4 starts, and if it does not, fall back to a
`setInterval` inside `src/index.ts` guarded by a `scheduler.enabled` config
flag so it can be disabled in tests.

**Late-return sweep** — every 15 minutes:

1. Find `borrowing_lines` where `due_at < now()`, `returned_at IS NULL`,
   `marked_late_at IS NULL`, `marked_lost_at IS NULL`.
2. For each, set `marked_late_at` and append a `marked_late` event
   (`stock_movement_id = NULL`, `actor_user_id = NULL`, `note = 'auto'`).
3. Idempotent by construction: the `marked_late_at IS NULL` predicate is the
   guard. Run it twice, get one event.

## 9. Audit events

`audit.audit_logs` already exists (`actor_id`, `action`, `resource_type`,
`resource_id`, `metadata`). Write entries for: item create/update/archive,
unit serial replacement, warehouse create/update/archive, address update,
storage create/update/archive, every stock movement post and reversal, and
every borrowing state transition. Guest PII never appears in `metadata` —
record `guest_id_number_present: true`, never the number.

## 10. Frontend — `apps/web-admin`

Route files live under `src/routes/`, components under `src/features/inventory/`
(per `architecture.md`'s feature-folder rule). TanStack Router file-based
codegen — never edit `routeTree.gen.ts`. TanStack Query for data, TanStack Form
is already a dependency but unused; use plain `useState` forms to match the
existing admin pages rather than introducing a second form idiom mid-project.

| Slice | Routes | Notes |
|---|---|---|
| S1 | `_authed/inventory/items/index.tsx`, `items/new.tsx`, `items/$itemId.edit.tsx`, `items/$itemId.units.tsx` | Kind filter chips (Produk/Komponen/Material/Alat/Jasa), serial column, "Siap"/"Dipesan"/"Dipinjam"/"Hilang"/"Terjual"/"Klaim Garansi" status labels |
| S2 | `_authed/inventory/warehouses/index.tsx`, `new.tsx`, `$warehouseId.edit.tsx`, `$warehouseId.storages.tsx` | Cascading province→regency→district→village selects from the existing paginated lookup API (ADR-0003); hidden entirely for non-admins |
| S3 | `_authed/inventory/stock/index.tsx`, `stock/movements.tsx`, `stock/adjust.tsx`, `stock/adjustments/index.tsx`, `stock/adjustments/$adjustmentId.tsx` | Balance table with `on_hand` / `reserved` / `available` + shared-scope badge and in-stock filter; movement ledger with reference/notes columns and confirm-gated reversal; adjustment create form (counted totals, system quantity and derived difference per line); adjustment list and detail with the per-status workflow actions. Not wrapped in `AdminOnly` — these ride `erpGuard` on `stock:*` |
| S4 | `_authed/inventory/borrowings/index.tsx`, `new.tsx`, `$borrowingId.tsx` | Borrow form with user/customer/guest tab, guest form warns about KTP capture; detail page renders the event timeline with custody trail |

Nav: `src/components/sidebar/nav-inventory.tsx` currently points at routes that
do not exist and has no permission gate. Gate it on `product:read` **or**
global-admin, and only light it up per slice as routes land.

i18n: new `inventory` namespace in `packages/locales/src/{en,id}/`, registered
in `en/index.ts`, `id/index.ts`, `i18next.d.ts`, and `NAMESPACES`. Both locale
parity tests must pass. UI copy is Indonesian by default; English keys mirror it.

Required states per data surface (project rule): loading, empty, error,
validation, unauthorized.

## 11. Guest PII, retention, and access

- `borrowings.guest_*` columns hold KTP-class personal data. Access tier in §6.
- Retention: guest PII is **nulled** 24 months after `closed_at`, by the same
  scheduled worker family as §8 (a second sweep). The borrowing row and its
  event timeline survive — the *link between an event trail and a human* is
  what expires.

  > `OPEN-2`: 24 months is my recommendation, not a client requirement.
  > Indonesian record-keeping norms and any KTP-handling policy should confirm
  > it. Overridable.

## 12. Contract sync (S0 deliverables)

1. **`docs/database/docs.dbml`**
   - Add module tables `inventory.items`, `inventory.warehouse_addresses`,
     `inventory.borrowings`, `inventory.borrowing_lines`,
     `inventory.borrowing_events`.
   - Rewrite `inventory.warehouses` (drop `location_text`, `village_id`;
     nullable `organization_id`).
   - Drop `inventory.warehouse_zones`.
   - Widen `inventory.serial_tracked_items` per §5.
   - Widen `stock_movements.movement_type` check; make `organization_id`
     nullable on all `inventory.*`.
   - Mark `catalog.items` **superseded** with a `Note:` pointing at
     `inventory.items`. **Leave all 11 `catalog.*` satellite tables in place,
     flagged `OPEN-1`** — retiring them without a home for
     `item_categories` / `units` / `item_prices` / `price_lists` /
     `item_suppliers` / `item_cost_histories` / `item_variants` /
     `item_bundles` / `item_attributes` / `item_documents` /
     `item_uom_conversions` would delete 11 tables from the contract and
     silently orphan every logical ref pointing at them.
     `item_variants` in particular is likely needed before serialized units
     are usable at real volume.
2. **`docs/database/module-ownership.md`** — Inventory module row becomes
   `inventory` only; record that the "Tenant" obligation does not apply to
   `inventory.*` because `organization_id` is nullable (D3). Regenerate via
   `gen-logical-references.ts` + `validate-dbml.ts`.
3. **New ADR-0008 — Nullable-organization inventory.** Records D3, D14, D15
   and explicitly amends ADR-0007's "no `organization_id` tenant columns on
   ERP master tables" reading, which this plan contradicts.
4. **New ADR-0009 — Serialized unit tracking and borrowing custody.** Records
   D7–D13, D18, D22 and the one-time provisional-serial mutation.
5. **`docs/plan/backlog.md`** — rewrite ERP-0014 as five slices with the
   overridden dependency (`—` instead of `ERP-0010`), and note the deferred
   tables (D17).
6. **`docs/architecture/modules/inventory.md`** — replace the stale-content banner
   with a description of what actually ships.
7. **`packages/common/.../erp-permissions.ts`** — §6 grants.
8. **`docs/plan/progress.md`** — record the phase-gate override.

## 13. Bootstrap & sequencing

**S0 — Contract.** All of §12. No application code. Exit: `validate-dbml.ts`
passes, `gen-logical-references.ts` output committed, ADRs 0008/0009 accepted.

**S1 — Items and units.**
1. `inventory.schema.ts` (items + widened `serial_tracked_items`, minus the
   circular column), migration, container/DI registration.
2. Repository + service: item CRUD, unit registration, provisional→real serial
   guard, status transition matrix enforcing D12's kind scoping.
3. Item/unit API + audit events.
4. Seeder: 5 kinds, a serialized tool set, a non-serialized material set.
5. UI: items list/create/edit + unit list.
6. Tests: kind×status matrix (every illegal pair rejected), provisional-serial
   double-replacement rejected, partial-unique behaviour for NULL org.

**S2 — Warehouses.**
1. Schema (warehouses, addresses, storages) + circular-FK-free migration.
2. `requireGlobalAdmin` shared helper extraction (refactor of the existing
   bootstrap controller, covered by its existing tests).
3. Repository + service for warehouses/addresses/storages; 1:1 address
   enforcement.
4. API + UI (address form cascades on the existing location lookup).
5. Tests: 403 for every org role on every warehouse route; 404 for other-org
   warehouses; address uniqueness.

**S3 — Stock.**
1. `stock_movements` + `stock_balances` schema and migrations.
2. Movement service: post movement + balance update + replenishment check in
   one transaction; reversal; `recomputeFromLedger` repair.
3. Receipt/issue/adjustment endpoints; unit custody updates for serialized
   items.
4. UI: balances, movements, adjust form.
5. Tests: ledger/balance agreement under interleaved posts, reversal
   conservation, recompute idempotency, no negative balance where forbidden.

> **Applied and verified against `ims_erp_local`.** The migration
> (`20261102161010_purple_robin_chapel`) is applied — the two adjustment tables
> exist and the four valuation columns are gone. The seeder was run twice: the
> second run wrote nothing and left 4 movements / 4 balances / 720 total, and
> ledger totals equal `quantity_on_hand` on every `(organization, warehouse,
> item)` key. The first attempt exposed a real scope bug — opening stock was
> written with the *caller's* organization instead of the *warehouse's* — which
> is fixed; the balance lookup is now scoped by organization too, so it cannot
> fold a global warehouse's shared row into a tenant's.

**S4 — Borrowing.** **Status: shipped.** The slice landed larger and smaller
than planned in equal measure: step 1's three tables, constraints, indexes, and
every §6 permission were **already in place** before S4 started (only the
circular FK was genuinely missing), while the whole of the borrowing module —
repository, state machine, worker, API, UI, tests — was written here.
1. ~~Schema~~ — done before the slice. The one real gap was
   `serial_tracked_items.current_borrowing_line_id`, whose FK closes a cycle
   (`serial_tracked_items → borrowing_lines → serial_tracked_items`) that no
   `CREATE TABLE` order satisfies. `drizzle-kit generate` emits the column and
   index; the `REFERENCES` is hand-written in migration
   `20261102174836_colorful_rattler` with `ON DELETE SET NULL`, not `RESTRICT`:
   deleting a borrowing already discards the link's meaning, and blocking the
   delete would strand a borrowing that must remain removable. A unit's `status`,
   not the pointer, is the source of truth for custody.
2. State machine (D19) in `borrowing.service.ts`. Transitions are declared as
   data (`BORROWING_TRANSITIONS`), so an illegal edge cannot be forgotten. Every
   physical transition is **one transaction** covering the unit's custody, the
   movement, the balance delta, and the event that references the movement —
   which required the one cross-cutting change outside the module:
   `StockService.postMovement` now takes an optional `tx` and joins it instead of
   opening a nested `database.transaction()`. A nested transaction would have
   been a savepoint, so an outer rollback would not have undone a committed
   movement.
3. Both sweeps. **Decision: a real BullMQ worker, not the `setInterval`
   fallback the plan allowed.** A repeat schedule must survive a restart and must
   not double-fire across instances; `upsertJobScheduler` keys on a stable
   scheduler id, so declaring the same two ids from every instance yields
   exactly two schedules. Two layers of idempotency remain regardless, because a
   worker can be killed mid-job: the late sweep's candidate query *and* its
   `UPDATE` both require `marked_late_at IS NULL`, and the retention sweep
   requires `guest_name IS NOT NULL`. Shutdown order in `index.ts` drains the
   worker **before** `closeQueueConnection()`, or BullMQ reports a spurious
   failure and retries.
4. API + UI: `/borrowings` CRUD, six bodyless transitions, return (per-line or
   all), extend, and `mark-lost`; list, `new` with the three borrower paths, and
   a detail page whose timeline renders the movement id behind every physical
   event.
5. Tests: 60 new cases. The unit suite (`borrowing.service.test.ts`, 30) pins
   every legal and illegal edge, the approval-skip permission rule, one-movement-
   per-physical-event with the movement id present on the event, partial vs full
   return, sweep idempotency for both sweeps, and PII redaction per actor tier.
   The integration suite (`borrowing-authorization.test.ts`, 30) drives the real
   `erpGuard` for 401/403 on all twelve routes, the technician/cannot-issue and
   warehouse/cannot-approve split, and cross-tenant 404.
   **OPEN-2 closed**: guest PII is nulled 24 months after `closed_at`, exposed as
   `scheduler.guestPiiRetentionMonths` so the window can change without a code
   change. The borrowing row and its whole timeline survive — what expires is the
   link between a trail and a person.

**Known limitation, recorded rather than hidden:** the scheduler worker runs
inside the API process, so a restart kills an in-flight sweep. That is
acceptable only because both jobs are idempotent and the next tick re-runs them.
A separate worker process is the eventual answer and is not yet scheduled.

## 14. Open questions

Recorded because they were raised and not answered. Each has a working
default so implementation is not blocked, and each must be closed before its
slice is called *accepted*.

| ID | Question | Working default taken | Blocks |
|---|---|---|---|
| `OPEN-1` | Do the 11 `catalog.*` satellite tables move into `inventory.*`, or does `catalog` survive as a module with only `items` relocated? Specifically: is `item_variants` needed before serialized units are usable? | **Closed 2026-11-04 (ADR-0010 grilling)** — `inventory.items` is the only item master; `category`/`unit_label` stay plain text; `catalog.*` satellites frozen in `docs.dbml`, none adopted | — |
| `OPEN-2` | Guest-PII retention period | **Closed in S4** — 24 months after `closed_at`, shipped as the `scheduler.guestPiiRetentionMonths` config constant (`GUEST_PII_RETENTION_MONTHS` env), so the window can change without a code change or migration | — |
| `OPEN-3` | Stock valuation (`average_cost`, `total_value`) is absent from this plan. It needs a COA and a posting engine. Is quantity-only inventory acceptable for the first release, or must valuation land with S3? | **Closed 2026-11-04** — quantity-only is the v5.1 baseline; finance posts the period inventory value/HPP summary manually in M09 | — |

## 15. Risks

| Risk | Mitigation |
|---|---|
| Nullable `organization_id` erodes the tenant guarantee for every consumer | ADR-0008 states it loudly; D3 applies only to `inventory.*`; borrowings/stock queries always carry an explicit org predicate and a test asserts cross-org isolation for non-NULL rows |
| 1:1 `warehouse_addresses` (D6) buys normalization but no query-time benefit, and requires every warehouse to be created with an address or left addressless | Service creates address in the same transaction as warehouse; `POST /warehouses` accepts optional `address` and the UI makes it required |
| Full UI per slice inflates each slice | UI is explicitly last in each slice's sequencing, so a slice can ship backend-only and the UI can be deferred without blocking the next slice |
| First scheduled worker in the codebase | Fallback `setInterval` path (§8) keeps it testable and disableable |
| Provisional-serial mutation is an immutability hole | Guarded in one repository method, one-time only, `is_provisional_serial` check constraint ties it to `pre_order` status, and a dedicated negative test |
| `docs.dbml` is canonical and this plan rewrites 6 tables | S0 is a standalone, reviewable slice with no application code, and it runs first |
