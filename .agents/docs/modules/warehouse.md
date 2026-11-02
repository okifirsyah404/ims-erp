# Warehouse Module

> 2026-11-02: **This module has been folded into Inventory.** Warehouses are
> no longer a separate module or a separate Postgres schema; they are tables in
> `inventory` (ADR-0008). The content below is retained only as a pointer —
> see `.agents/docs/modules/inventory.md` for the implemented design.
>
> The earlier text here described the deleted NestJS backend
> (`apps/backend-nest`) and a "one warehouse only, do not pretend
> multi-warehouse" rule. That rule is **retired**: the schema models multiple
> warehouses, and the company currently runs as many as it needs.

## Purpose and boundary

Warehouse is physical estate: master data for the places stock sits. It owns
no quantities and no movements — those belong to the stock ledger.

## Where it lives now

| Concern | Table | Notes |
|---|---|---|
| Warehouse master | `inventory.warehouses` | `organization_id` nullable; `NULL` = global estate |
| Address | `inventory.warehouse_addresses` | Strict 1:1 satellite, ADR-0003 shape; no `kind` discriminator |
| Storages (bins) | `inventory.warehouse_storages` | One level deep: warehouse → storage, **no zone level** |

The retired `warehouse` schema and its `warehouse_zones` / `warehouse_bins`
tables are gone from `docs/database/docs.dbml`.

## Behavior targets

- Full CRUD, **application administrators only** (`user.role === 'admin'`).
  No organization role holds `warehouse:*`, including `owner`. Routes use
  `sessionGuard` + the global-admin policy, not `erpGuard`: a global warehouse
  has no organization context for `erpGuard` to resolve.
- Deactivation (`is_active`) rather than deletion when movements reference the
  warehouse — `stock_movements.warehouse_id` is `RESTRICT`.
- Uniqueness is a partial-index pair per organization scope, because
  `organization_id` may be `NULL` (ADR-0008).

## Dependencies and rules

- Consumed by `inventory` movements, balances, serial units, and borrowing
  lines (which snapshot `origin_warehouse_id`).
- `responsible_employee_id` is a logical reference to `hr.employees` — no
  cross-module FK.

## Tests

Planned for slice S2 (ERP-0027): permission gates proving org roles are
denied, address 1:1 enforcement, and deactivation filtering.
