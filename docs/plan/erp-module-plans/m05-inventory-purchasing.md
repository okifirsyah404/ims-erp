# M05 — Inventory and Purchasing

## Purpose

Track what is bought, received, held and moved in **one warehouse**, with
optional serial-number references for access-control hardware. Inventory
value and HPP (COGS) are summarized by finance, not computed automatically.

## Stage 1 scope (baseline)

- One warehouse.
- Purchasing and receiving.
- Stock transfers (movements in/out).
- Serial-number (SN) references where needed.
- Inventory value and HPP handled **through finance summaries** (manual).

_Interpretation, needs owner confirmation:_

| Entity | Minimum fields | Status flow |
|---|---|---|
| Supplier | name, contact, NPWP (optional), payment terms | — |
| Purchase (PO) | supplier, items, qty, unit cost, expected date | `draft → approved → partially_received → received / cancelled` |
| Goods receipt | PO, received qty per line, SN list (if serial-tracked), date | `posted` |
| Stock movement | item, qty, type (`receipt`, `issue`, `adjustment_in/out`, `return`), reference | — |
| Stock balance | item → qty on hand | derived from movements |

- Approval of requirements is **manual** (S06). One approver approves the PO,
  and there is no PR (purchase request) stage.
- "Stock transfer" in one warehouse means issuing stock to projects (M07) or
  internal use and receiving it back. _Interpretation:_ no bin-to-bin
  transfers are needed.
- A goods receipt creates a supplier payable in M09 (S06 "→ payable").
  Received fixed assets go to M06 instead of stock.
- HPP: finance enters or approves the period inventory value/COGS summary,
  which posts a journal in M09.

## Stage 2 scope (baseline)

- Still one warehouse.
- HPP/value summaries and finance approval **remain manual**.
- No new automation. Stage 2 adds nothing to this module.

## Explicit limits (out of scope)

- No multiple warehouses.
- No multi-level purchase requisitions or purchase orders (no PR → PO chain).
- No automatic reservations or automatic returns.
- No automatic HPP/COGS (no FIFO or average engine).
- No barcode scanning (see also M06).

## Tasks

| ID | Task | PIC | Days | Price (IDR) |
|---|---|---|---|---:|
| T07 | Purchasing, stock, and basic assets | A | S1 9–10 | 337,500 (shared with M06) |

Prerequisites: T03 (items, units, suppliers) and T06 (payables, in M09).

## SOPs

- **S06 Procurement:** manually approve the requirement, purchase, receive,
  then inventory/assets, then payable.

## Controls

- Stock balance must never go negative. A DB check plus a service guard
  enforce this.
- Posted receipts and movements are immutable. Corrections use reversing
  movements.
- The HPP/inventory value journal is posted only after finance approval (v5.1
  p.9 "Reconciliation").
- Money is integer IDR minor units. Quantity follows the data-dictionary
  convention.

## Acceptance

- UAT: procurement and stock scenarios in U01–U20, per Excel. Scenario text
  is not in the repo.
- _Interpretation:_ the tests cover PO, partial receipt and full receipt
  (balance and payable both correct), an issue larger than the stock
  (rejected), and an SN captured on receipt that is traceable to the issue.

## Definition of Done

Common DoD in [README.md](README.md), plus:

- Receipt-to-payable handoff to M09 goes through the finance contract/service
  token, not a direct table write.
- The negative-stock guard has a test.
- Warehouse pickers list only warehouses linked to the active organization
  (`GET /warehouses/linked`); unlinked access returns 404 (ADR-0010).
- Goods receipts require a warehouse; storage optional.

## Dependencies

- Needs: T03 master data (catalog items, units, suppliers), M09 payables and
  the inventory/COGS accounts.
- Provides: stock for M07 projects, received assets for M06, stock value to
  the M01 dashboard (from the finance summary).

## Current state vs plan (checked 2026-11-04)

| Plan item | `docs.dbml` | Code |
|---|---|---|
| Suppliers, PO, receipts | `procurement` (11 tables) | none |
| Items | `catalog.items` (+11) **and** `inventory.items` | `inventory.items` shipped (kinds: product, component, material, tool, service), with admin UI |
| Stock movements/balances | `inventory.stock_movements`, `stock_balances` | shipped, with UI (`/inventory/stock`, `/stock/movements`) |
| SN reference | `inventory.serial_tracked_items` | shipped (statuses: pre_order, in_stock, borrowed, lost, sold, applied_warranty) |
| Warehouse | `inventory.warehouses` | shipped **as multi-warehouse** CRUD with addresses and storages |

- Status: **implemented (stock side)**. The purchasing side is **planned**
  (ERP-0035, own `procurement` module posting receipts through the inventory
  stock service).
- **Rebaseline proposed 2026-11-04 (ADR-0010, owner sign-off pending):**
  inventory is kept as built. Multiple warehouses and storages are in scope so
  departments can track products, materials and tools; access via
  warehouse↔organization links (ERP-0031). Transfers warehouse→warehouse and
  storage→storage, both recorded in the ledger (ERP-0032), replace the earlier
  "no bin-to-bin transfers" interpretation. Tracking views: ERP-0033. OPEN-1
  and OPEN-3 closed (`plans/inventory.md`). The `beyond-baseline` list below
  is historical.
- `beyond-baseline`:
  - Multiple warehouses, `warehouse_addresses` and `warehouse_storages`, all
    with UI. This conflicts with the explicit limit "no multiple warehouses".
  - `stock_reservations`. Automatic reservations are an explicit limit.
  - `stock_adjustments` with a submit/approve/post workflow. Adjustments are
    fine, but the multi-step approval is extra.
  - `inventory.borrowings` / `borrowing_lines` / `borrowing_events`. The plan
    puts borrowing in **M06 Assets** as a register.
  - `procurement.purchase_requests` and `purchase_returns`. PR → PO chains
    and automatic returns are explicit limits.
  - The `catalog.item_cost_histories` and `price_lists` duplication with
    `inventory.items`. Ownership needs a decision.
