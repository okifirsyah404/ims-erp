# Warehouse Module

Own schema: **`warehouse`** (ADR-0026, accepted 2026-11-23, which split it out of
`inventory`). 9 tables. Tables, contracts and columns: `docs.dbml` (canonical)
and `docs/database/module-ownership.md` (profile 7).

> This page was rewritten 2026-11-24. Two earlier states are history only: the
> NestJS-era "one warehouse only, do not pretend multi-warehouse" rule is
> **retired** (the schema models as many warehouses as the company runs), and
> the ADR-0008/ADR-0024 arrangement that kept warehouses inside `inventory` is
> superseded by ADR-0026.

## Purpose and boundary

The physical estate: master data for the places stock sits. It owns **no
quantities and no movements** — those are the stock ledger, which stays in
`inventory`.

## Tables (`warehouse` schema)

| Table | Holds |
|---|---|
| `warehouse.warehouses` | Warehouse master; `organization_id` frozen at `NULL` (ADR-0010 — every warehouse is global), `responsible_employee_id` for the PIC |
| `warehouse.warehouse_images` | Gallery images per warehouse |
| `warehouse.warehouse_addresses` | Strict 1:1 satellite, ADR-0003 address shape; no `kind` discriminator |
| `warehouse.warehouse_storages` | Bins: one level deep (warehouse → storage), **no zone level** |
| `warehouse.warehouse_managers` | Person-in-charge rows (ADR-0017) |
| `warehouse.warehouse_organizations` | Which organizations may use a warehouse — the only source of org access |
| `warehouse.warehouse_settings` | Per-warehouse settings |
| `warehouse.warehouse_module_settings` | Module settings (one row) |
| `warehouse.code_numberings` | Per-module numbering series (ADR-0024 Q32) |

## HTTP surface

| Route | Guard | Notes |
|---|---|---|
| `/warehouses` | `session+warehouse` | CRUD, address/storage/manager sub-resources; application administrators only |
| `/warehouses/linked` | `erp` | The organization-scoped read used by business modules |
| `/warehouses/code-numberings` | `erp` | Numbering series management |

Two guards share the plugin on purpose: a **global** warehouse has no
organization context for `erpGuard` to resolve, so the admin surface uses
`sessionGuard` + the global-admin policy, while the org-scoped read uses `erp`.

## Cross-module contract

`ExportedWarehouseService` answers the `resolve*` / `assert*` questions other
modules ask before writing a logical warehouse id (ADR-0014). Consumers:
`inventory` movements, balances, serial units and borrowing lines (which
snapshot `origin_warehouse_id`), plus sale/procurement documents that record a
warehouse.

## Dependencies and rules

- **Inbound logical references:** `warehouse.warehouses.responsible_employee_id`
  → `human_resource.employees.id`; `warehouse.warehouse_organizations.organization_id`
  → `auth.organizations.id`. Both nullable, no cross-schema FK.
- Deactivate (`is_active`) instead of deleting when movements reference the
  warehouse; those references are `RESTRICT`.
- Uniqueness is a partial-index pair per organization scope (a global unique
  index where `organization_id IS NULL`, a per-organization one otherwise).

## Tests

`apps/backend/test/unit/**` warehouse suites: permission gates (org roles
denied), address 1:1 enforcement, storage depth, deactivation filtering, and
the exported facade's `assert`/`resolve` behaviour.
