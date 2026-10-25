# Warehouse Module

## Purpose and boundary

Warehouse master data for **the** operational warehouse — v5.1 pins one
warehouse for both stages (no multiple-warehouse delivery). Owns warehouse
records and responsible-person assignment; stock movements/quantities belong
to inventory.

## Current state (audit, 2026-10-25)

**Scaffold only:**

- `modules/warehouse/**` — empty stubs; registered in `app.module.ts`.
- Pre-written unit specs (controller/service) exist.

## Data ownership (planned, Phase 3 — commercial T03/T07)

- `erp.warehouses` — code, name, address, responsible employee ref
  (employee contract), status/deleted_at. One operational row in the agreed
  package; schema must not pretend multi-warehouse (no unique-combination
  complexity until a real second warehouse is contracted).

## Behavior targets

- CRUD restricted to elevated roles; referenced by inventory movements and
  (stage-1) stock transfer records.

## Dependencies and rules

- Leaf master data consumed by inventory via contracts. Resist speculative
  multi-warehouse features (contractual + YAGNI).

## Tests

- Existing stub specs to replace.
- Required: permission gates, referential integrity with employee
  responsible-person link, deactivation filtering.
