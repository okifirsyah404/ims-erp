# Inventory Module

## Purpose and boundary

Stock movements and inventory value boundaries for **one warehouse** (v5.1
M05 pins this for both stages). Receiving/transfers/adjustments; serial-number
references only when needed. **COGS/valuation summaries remain manual through
finance — no automatic COGS** (contractual limit; valuation boundaries means
this module provides the data, finance owns the numbers).

## Current state (audit, 2026-10-25)

**Scaffold only:**

- `modules/inventory/**` — empty stubs; registered in `app.module.ts`.
- Pre-written unit specs (controller/service) exist.

## Data ownership (planned, Phase 4 — commercial T07)

- `erp.stock_movements` — item (product/service catalog ref), quantity,
  movement type (receive/transfer/adjust/issue), warehouse (single row per
  v5.1), serial references (optional), reference to source doc (purchase
  receipt, sales issue), business date, created-by.
- Stock balances derived, not duplicated — reconciliation-ready to GL control
  account (finance).
- No multi-warehouse, no multi-level purchase requisitions/orders, no
  automatic reservations/returns (contractual limits).

## Behavior targets

- Receive/transfer/adjust movements with permission gates
  (`inventory.stock.view|receive|adjust`).
- Movement history immutable; corrections via reversing movement (traceable).
- Provide quantity/value summaries **to finance** — finance approves and
  posts; this module does not compute/post COGS itself.

## Dependencies and rules

- Consumes product catalog (items) and warehouse (location) via contracts;
  finance owns valuation posting. Sales/purchasing create movements through
  this module's exported service in one transaction with their own writes.

## Tests

- Existing stub specs to replace.
- Required: movement integrity (no negative balance where policy forbids),
  transfer A→B conservation, immutable history, reconciliation tie-out to
  GL control on a disposable DB.
