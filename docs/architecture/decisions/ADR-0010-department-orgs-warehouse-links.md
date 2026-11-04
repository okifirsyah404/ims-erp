# ADR-0010 — Department Organizations and Warehouse Links

- **Status:** proposed (2026-11-04). Not accepted until the owner signs the
  v5.1 change-control note. Amends ADR-0008 §1 (warehouse scope) and §3
  (warehouse access).
- **Context:** The v5.1 plan (`docs/plan/erp-plan-en.md`) fixes one business
  entity and one warehouse. The build shipped multiple internal organizations
  (ADR-0007) and multiple warehouses with storages (ERP-0027). Warehouses were
  global-admin-only, so department staff had no scoped way to track items
  (products, materials, tools) in the warehouses they actually run.
- **Decision:**
  1. **Organizations are internal departments.** One company, one ledger, one
     tax identity. Multi-org is consistent with v5.1 "one business entity".
  2. **Inventory is rebaselined as built**, including multi-warehouse and
     multi-storage. No further inventory extras until procurement lands.
  3. **`inventory.warehouse_organizations`** links warehouses to organizations
     many-to-many (soft delete; unique `(warehouse_id, organization_id)` where
     `deleted_at IS NULL`). It is the only warehouse access rule.
  4. **Every warehouse is global.** `warehouses.organization_id` is frozen at
     `NULL` (column kept; migrations are append-only). Balances stay one shared
     row per (warehouse, item, storage). Migration backfills one link per
     existing non-null `organization_id`, then nulls it.
  5. **Access = role + link.** The caller's role in the active organization
     decides the action; the target warehouse must be linked to that
     organization. Services check via one `assertWarehouseLinked` repository
     method; lists filter with an `EXISTS` join. Unlinked → **404**.
  6. **Global admin** bypasses the link check on `erp` routes (`created_by`
     still records the actor) and alone manages warehouses, storages, and
     links. Link changes are audited; unlink is **409** while the organization
     has open borrowings in that warehouse.
  7. **Org `admin`** gains `stock: read, export` and `stock_adjustment: read`,
     scoped to linked warehouses. The `warehouse` role does stock operations.
     No organization role holds `warehouse:*` (ADR-0008 §3 kept on that point).
  8. **`GET /warehouses/linked`** (`erp` guard) returns active linked
     warehouses + storages for pickers.
  9. **Transfers** are one service operation writing a `transfer_out` +
     `transfer_in` pair (`reference_type = 'transfer'`, shared `reference_id`)
     in one transaction. Covers warehouse→warehouse and storage→storage
     (same warehouse: `target_warehouse_id` = source). Both warehouses must be
     linked to the active organization. Serialized units are picked by SN,
     must be `in_stock`, and move `warehouse_id`/`bin_id` in the same
     transaction.
  10. **`responsible_employee_id`** is a display-only person in charge; it
      grants no access and waits for a minimal HR slice.
- **Consequences:** one new inventory table; migration + backfill; role
  catalog change for `admin`; every inventory service gains the link check;
  denial tests (unlinked 404, cross-org transfer rejected, unlink 409).
- **Alternatives considered:**
  - Per-warehouse responsible employee as the access rule — rejected: blocks on
    HR (M08) and fits one person, not a department.
  - Named member assignment per warehouse — rejected: a second permission
    system; add only if a department must exclude some members.
  - Keep `warehouses.organization_id` alongside links — rejected: two sources
    of truth.
