> Updated 2026-11-20 (ADR-0024): `inventory` now also absorbs the former `assets` and `catalog` schemas and the warehouse tables (28 tables; product master `inventory.products`, physical units `inventory.items`). The public website catalog is served at `/inventory/public/v1/catalog`. Table names below that predate this are historical; the current list is in docs/database/module-ownership.md.

# Inventory Module

> Rewritten 2026-11-02. The previous content described `apps/backend-nest`
> (deleted) and a single-warehouse, COGS-free model that no longer matches the
> contract. Authoritative design: `docs/plan/plans/inventory.md` (decisions
> D1–D24) plus ADR-0008 and ADR-0009.

## Purpose and boundary

Track **physical things** — not just quantities — through their whole life:
pre-ordered, received, stored, borrowed, returned, lost, sold, or consumed as
a warranty replacement. The module owns the item master, the physical estate
it sits in, the append-only stock ledger, and the custody trail of anything
lent out.

**In scope**

- One item master for the whole ERP (`inventory.items`), superseding
  `catalog.items` (ADR-0008; the catalog schema itself was absorbed into `inventory` by ADR-0024).
- Individual unit tracking for serialized items (`serial_tracked_items`).
- Warehouses, warehouse addresses, and storages (bins).
- The authoritative stock ledger and its balance projection.
- Borrowing by registered users, customers, or guests, with a full event
  trail answering *who has it and where*.

**Explicitly out of scope (for now)**

- **Valuation / COGS.** `stock_balances.average_cost` and `total_value` exist
  but are never advanced (OPEN-3). Quantity only. Finance owns the numbers.
- Purchase requisitions/orders, transfers between warehouses, reservations,
  lot batches, and cycle counts — deferred (D20). Adjustments are expressed as
  raw `adjustment_in` / `adjustment_out` movements.
- A procurement module to attach real purchase-order lines to pre-ordered
  units ("develop soon"); only an unvalidated `purchase_order_line_id` seam
  exists today.

## Current state (2026-11-02, `feat/inventory-module`)

Slices S0 and S1 are implemented; S2–S4 are planned.

| Slice | Scope | State |
|---|---|---|
| S0 | Plan, ADRs, DBML contract, permission model | done |
| S1 | `items` + `serial_tracked_items`: schema, migration, service, controller, UI | done |
| S2 | Warehouses, addresses, storages (API + UI) | not started |
| S3 | `stock_movements` / `stock_balances` service + item-movements screen | not started |
| S4 | Borrowing state machine, late-return sweep, guest-PII retention | not started |

What exists in code today:

- `apps/backend/drizzle/schemas/inventory.schema.ts` - all 10 tables, the
  vocabularies, and the transition matrix tables.
- `apps/backend/database/migrations/20261028043801_create_inventory_schema/` -
  the migration (one migration per schema since ADR-0019). The **whole**
  migration chain replays cleanly (no index-name collisions).

  > Proven against real PostgreSQL 18 until 2026-11-14 by
  > `database/verify-inventory-constraints.ts` (29 assertions). That script was
  > deleted: it replayed `database/migrations/` through a hardcoded six-schema
  > `DROP` list, so it silently stopped working as schemas were added, and it
  > was outside the test suite's reach. Its unique contribution - asserting that
  > the CHECK constraints actually reject bad rows against a live server - is
  > currently **not** covered (the backend suite runs against `test/helpers/mock-db.ts`,
  > never a real connection). See `docs/plan/progress.md` 2026-11-14 "removed the
  > two stale one-shot database scripts".
- `apps/backend/src/app/inventory/**` - `ItemService`, repositories,
  contracts, controller, DI container, typed errors.
- `apps/web-admin/src/lib/inventory-api.ts`, `components/inventory/*`, and the
  `/inventory/products|components|materials|tools` + `/inventory/items/*`
  routes.

## Data ownership — `inventory` schema (one schema)

| Table | Role |
|---|---|
| `warehouses` | Warehouse master. Writes are **application-admin only**. |
| `warehouse_addresses` | Strict 1:1 satellite of `warehouses` (ADR-0003 shape). |
| `warehouse_storages` | Bins inside a warehouse. One level deep, no zones. |
| `items` | SKU master. `is_serialized` decides whether units exist. |
| `serial_tracked_items` | One row per physical unit; carries its own status/location. |
| `stock_movements` | **Authoritative** append-only ledger. |
| `stock_balances` | Service-maintained projection; `recomputeFromLedger` repairs it. |
| `borrowings` | Borrowing header, incl. snapshotted guest identity. |
| `borrowing_lines` | One borrowed unit (serialized-only, never a quantity). |
| `borrowing_events` | Append-only business timeline. |

Deferred tables (`stock_adjustments`, `stock_adjustment_items`,
`stock_transfers`, `stock_transfer_items`, `stock_reservations`) remain in the
DBML marked *planned, not implemented*.

## Invariants

1. **`organization_id` is nullable on every table.** `NULL` means global /
   company-wide and is a first-class scope, never a missing value. Every coded
   table therefore carries a **partial-unique pair** —
   `UNIQUE(org, code) WHERE org IS NOT NULL` plus
   `UNIQUE(code) WHERE org IS NULL` — because PostgreSQL treats each NULL as
   distinct (ADR-0008).
2. **Status lives only on a serialized unit**, never on the item. Vocabularies:
   `pre_order, in_stock, borrowed, lost, sold, applied_warranty`. `ready` is
   never stored; the UI labels `in_stock` as "Siap" / "Ready" (D7).
3. **Consumption matrix.** `product`/`component`/`material` may be sold,
   applied to warranty, borrowed, or tested. `tool` may **only** be borrowed.
   `service` is never stocked or serialized. Enforced by
   `assertTransitionAllowed` (needs the parent item's kind) plus a CHECK for
   the kind-independent parts.
4. **`stock_movements` is append-only** — no `updated_at`, no `deleted_at`; a
   reversal is a new row. `borrowing_out` / `borrowing_in` must carry
   `reference_type = 'borrowing'`, so they can never be posted by hand.
5. **Custody beats location.** `serial_tracked_items.warehouse_id` is `NULL`
   while a unit is borrowed or lost; `borrowing_lines.origin_warehouse_id`
   remembers where it left from (ADR-0009).
6. **A provisional serial is replaced exactly once.** The guard is part of the
   `UPDATE` predicate, so a concurrent second replacement matches no row
   instead of overwriting.

## Permissions

- `product:*` gates the item endpoints. The name is retained from the ERP
  vocabulary even though the table is `items`.
- `borrowing:*` — `read`, `create`, `update`, `approve`, `issue`, `return`,
  `extend`, `mark_late`, `mark_lost`, `export`. A technician may request but
  not issue; `mark_lost` is `owner` / `admin` / `operations_manager` only.
- `warehouse:*` is held by **no** organization role, including `owner`, whose
  blanket statement spread is explicitly emptied. Warehouse routes ride
  `sessionGuard` + the global-admin policy, never `erpGuard`, because a global
  warehouse has no organization context for `erpGuard` to resolve.

## Dependencies and rules

- Consumes `auth.organizations`/`auth.users`, `location.villages`, and
  `customer.customers` through logical references only — no cross-module FKs.
- Other modules must create stock movements through this module's exported
  service, in one transaction with their own writes, never by inserting into
  `stock_movements` directly.

## Tests

- `test/unit/item-status-matrix.test.ts` — the per-kind transition matrix.
- `test/unit/item.service.test.ts` — item rules (SKU scoping, archive guards).
- `test/authorization/inventory-authorization.test.ts` - guard boundaries,
  including that org roles hold no `warehouse:*`.

No test in this suite opens a database connection: every one runs against
`test/helpers/mock-db.ts`. The real-PostgreSQL constraint proof that used to sit
next to this list (`database/verify-inventory-constraints.ts`) was removed on
2026-11-14; nothing replaces it yet.
