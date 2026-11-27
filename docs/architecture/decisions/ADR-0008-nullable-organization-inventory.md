# ADR-0008 — Nullable-Organization Inventory

- **Status:** accepted (2026-11-02). Amends ADR-0007 §2 for the `inventory`
  module only. `organization_id` is nullable on every cross-module reference
  per **ADR-0014**; the scope semantics below are an addition to that rule,
  not a replacement.
- **Status update 2026-11-28 (T-6, recorded by programmer B, reviewed by Oki):** to be **amended** by the K12 ADR (`organization_id` columns dropped in stage 3).
- **Context:** ADR-0007 decided master data is company-wide and therefore
  carries **no** `organization_id` tenant column. The inventory module cannot
  honour that literally, because inventory records genuinely belong to three
  different scopes at once:
  - **Organization-owned** — a Jakarta branch's tools, held and borrowed by
    that branch's staff.
  - **Company-wide** — shared items every organization may issue from, owned by
    nobody in particular.
  - **Borrower-held** — a serialized unit that is currently with a customer or
    a guest, and therefore has no warehouse at all.

  A `NOT NULL organization_id` would force a fake owning organization for the
  second and third cases. A *missing* column would force duplicating shared
  items into every organization and make cross-organization custody
  unrepresentable.

- **Decision:**
  1. **`organization_id` is nullable on every `inventory` table.** `NULL` means
     "global / company-wide" — it is a first-class scope, never a missing
     value. Repositories take `organizationId: string | null` and match with
     `IS NULL`, never "any organization".
  2. **Uniqueness uses a partial-index pair, not a composite index.**
     PostgreSQL treats every `NULL` as distinct, so a plain
     `UNIQUE (organization_id, code)` would stop constraining global rows
     entirely. Every coded table therefore gets **two** indexes:
     `UNIQUE (organization_id, code) WHERE organization_id IS NOT NULL` and
     `UNIQUE (code) WHERE organization_id IS NULL`.
  3. **Warehouses are global and application-admin-only.** A warehouse is
     physical estate, not branch property, so `warehouse:*` permissions are
     held by **no** organization role — including `owner`, whose blanket
     statement spread must be explicitly emptied. All warehouse routes ride
     `sessionGuard` + the global-admin policy (`user.role === 'admin'`), never
     `erpGuard`: a global warehouse has no organization context for `erpGuard`
     to resolve.
  4. **Warehouse addresses are a strictly 1:1 satellite.** `warehouse_addresses`
     holds the structured address (ADR-0003 shape), one row per warehouse, no
     `kind` discriminator. This is normalization, not a general
     "many addresses" model.
  5. **Storage is one level deep: warehouse → storage.** There is no
     `warehouse_zones` level; a storage row is a bin inside a warehouse.
  6. **`stock_balances` is a service-maintained cache, not a trigger
     projection.** The balance row is updated in the same transaction as the
     movement that caused it, and `recomputeFromLedger` is the repair
     operation. Triggers were rejected because they make movement posting
     untestable in isolation and hide the write in the database.
  7. **`stock_movements` is the authoritative append-only ledger** — no
     `updated_at`, no `deleted_at`, and reversals are new rows, never edits.
  8. **`inventory.items` supersedes `catalog.items`.** One item master for the
     whole ERP. The `product:*` permission name is retained (it is the
     vocabulary ERP roles already carry) even though the table is `items`.
  9. **Unit statuses are `{pre_order, in_stock, borrowed, lost, sold,
     applied_warranty}`.** `ready` is never a stored value; the UI label for
     `in_stock` is "Siap" / "Ready". `sold` and `applied_warranty` are
     **product-family only** — a rule the service enforces, because a unit row
     cannot see its item's kind without a join.

- **Consequences:**
  - Every inventory repository query must state its scope explicitly. There is
    no ambient tenant predicate to fall back on, so a missing `isNull` /
    `eq` is a visible bug rather than a silently-global read.
  - Every coded inventory table carries two uniqueness indexes instead of one.
  - Organization roles lost `warehouse:*` entirely; the permission statement
    stays in the catalog so the vocabulary remains complete and typed.
  - `docs/database/module-ownership.md`'s blanket "Tenant" obligation no
    longer describes inventory and was updated alongside this ADR.
  - Deferred to later slices: `stock_adjustments`, `stock_transfers`,
    `stock_reservations`, `lot_batches`, and `cycle_counts`. Adjustments are
    expressed today as raw `adjustment_in` / `adjustment_out` movements.

- **Accepted risk:** a global item and an organization item may share a SKU
  string. That is intentional — they are different keys under the partial
  indexes — but it means a human reading two lists can see "the same" SKU
  twice. The `organization_id` column is rendered in the admin UI to
  disambiguate.

- **Alternatives considered:**
  - **`NOT NULL organization_id` with a synthetic "HQ" organization** —
    rejected: it invents an owner for shared estate and makes the borrowed
    (warehouse-less) case unrepresentable.
  - **No `organization_id` at all, following ADR-0007 literally** — rejected:
    it forces shared items to be duplicated per organization and loses
    cross-organization custody.
  - **A single `UNIQUE (organization_id, code)` relying on `NULLS NOT DISTINCT`
    (PostgreSQL 15+)** — viable, but the partial-index pair expresses the two
    scopes as two explicit rules, keeps the index smaller, and does not depend
    on a non-default index option that Drizzle does not model first-class.
  - **Database triggers maintaining `stock_balances`** — rejected: it hides the
    write from the service, breaks per-movement testing, and makes a
    recomputation path impossible to share with the normal write path.
