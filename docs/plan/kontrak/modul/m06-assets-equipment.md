> Historical plan written before ADR-0024; module and schema names below are the pre-refactor ones (see docs/database/module-ownership.md for the current mapping).

# M06 — Assets and Equipment

## Purpose

A register of company assets and tools (installation equipment, test
devices, vehicles, office equipment): what each is worth, who holds it, what
condition it is in, and its loan and service history. Depreciation is a
journal posted by finance, not computed by the system.

## Stage 1 scope (baseline)

- Asset value register.
- Person in charge (PIC).
- Condition.
- Borrowing and return.
- Service notes.
- Depreciation **recorded as a finance journal entry** (manual).

_Interpretation, needs owner confirmation:_

| Entity | Minimum fields | Status flow |
|---|---|---|
| Asset | code, name, category, acquisition date, acquisition value (IDR), PIC, location note, condition | `active → in_service → active` / `inactive` (deactivated) |
| Loan | asset, borrower (employee), purpose (project/internal), out date, due date, return date, condition out/in | `borrowed → returned` |
| Service note | asset, date, description, cost, vendor | — (log) |

- Condition vocabulary: `good`, `needs_service`, `damaged`, `lost`.
- Deactivation (S07 "service/deactivation") is a soft status with a reason.
  Disposal value, if any, is journaled by finance in M09.
- Assets bought through a PO (M05) are registered here at receipt, using the
  PO cost as the acquisition value.
- Depreciation: finance posts the monthly depreciation journal in M09. The
  asset register may show the latest book value finance entered.

## Stage 2 scope (baseline)

- The register remains in use.
- Depreciation journals and service follow-up are still handled by
  admin/finance (manual).
- Stage 2 adds nothing to this module.

## Explicit limits (out of scope)
> **ADR-0030 (accepted by the owner 2026-11-25):** the finance ERP-grade extension lifts some of the limits below (see the ADR's "Limits lifted" table); where they conflict, the ADR wins.


- No barcode or QR labels or scanning.
- No service schedule (preventive maintenance plans, reminders).
- No automatic depreciation (no straight-line or declining-balance engine).

## Tasks

| ID | Task | PIC | Days | Price (IDR) |
|---|---|---|---|---:|
| T07 | Purchasing, stock, and basic assets | A | S1 9–10 | 337,500 (shared with M05) |

## SOPs

- **S07 Assets:** register, loan, return/condition, then record
  service/deactivation.

## Controls

- An asset cannot be lent while it is already `borrowed` or `inactive`.
- Asset value and service costs are integer IDR minor units.
- Deleting is not allowed once the asset is referenced by a journal or loan.
  Soft delete only (financial master data rule).
- The depreciation journal is posted and reviewed by finance (v5.1 p.9
  "Reconciliation").

## Acceptance

- UAT: asset scenarios in U01–U20, per Excel. Scenario text is not in the
  repo.
- _Interpretation:_ the tests cover register, lend, a second lend (rejected),
  return with condition `damaged`, a service note, and deactivation.

## Definition of Done

Common DoD in [README.md](README.md), plus:

- Loan state guards have tests (double lend, return of a non-borrowed
  asset).
- The asset list shows PIC, condition and current holder, and can be
  exported for the finance depreciation working paper.
- No depreciation calculation code exists. The depreciation journal is
  entered in M09.

## Dependencies

- Needs: T03 (employees as PIC/borrowers, from M08), M05 receipts (asset
  purchases), M09 (depreciation/disposal journals).
- Provides: tool availability for M07 projects.

## Current state vs plan (checked 2026-11-04)

| Plan item | `docs.dbml` (`assets`, 11 tables) | Code |
|---|---|---|
| Register | `asset_categories`, `assets` | none |
| PIC / holder | `asset_assignments`, `asset_movements` | none |
| Condition | `asset_condition_checks` | none |
| Service notes | `asset_maintenances` | none |
| Borrowing | (none in `assets`; lives in `inventory.borrowings`) | `inventory` borrowings shipped with UI (`/inventory/borrowings`) |

- Status: **planned** for the asset register (separate `assets` module).
  Borrowing/return is **covered by `inventory` borrowing** (ADR-0010,
  proposed): M06 does not build a second loan engine.
- `beyond-baseline`:
  - `asset_depreciations`, if it is used to calculate depreciation.
    Automatic depreciation is an explicit limit. Holding finance-entered book
    values is acceptable.
  - `asset_disposals` as a workflow, `tool_sets` / `tool_set_items` (kits)
    and `asset_documents`.
  - The `aftersales.maintenance_schedules` / `maintenance_plans` style
    scheduling. Service schedules are an explicit limit.
