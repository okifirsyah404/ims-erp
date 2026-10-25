# Purchasing Module

## Purpose and boundary

Procure-to-pay for the single company: purchase bills against supplier
orders, payables lifecycle, and supplier payment coordination (payment
execution stays with payment/finance). v5.1 limits (M05): **no multi-level
purchase requisitions/orders, no automatic reservations/returns** — receiving
and approvals are manual and simple.

## Current state (audit, 2026-10-25)

**Scaffold only:**

- `modules/purchasing/**` — empty stubs; registered in `app.module.ts`.
- Pre-written unit specs (controller/service) exist.

## Data ownership (planned, Phase 4 — commercial T07 with supplier/payables in T06)

- `erp.purchase_bills` — supplier ref, business date, lines (item/unit/
  qty/price in minor units), status (draft→approved→posted), unique doc
  number (numbering service, ERP-0009), journal ref (finance).
- Payables balances are derived from bills − payments (payments owned by
  payment module; balances reconciled in finance).

## Behavior targets

- Bill entry/approval/posting (S06: manually approve requirement → purchase →
  receive → inventory/assets → payable).
- Receiving creates inventory movements through the inventory contract in one
  transaction.
- Supplier payment requests handed to payment/finance; restricted visibility
  of supplier bank details (permission-gated, masked in lists).

## Dependencies and rules

- Consumes supplier (master), inventory (receiving), finance (posting);
  payment executes settlements. No direct imports of other modules'
  repositories.

## Tests

- Existing stub specs to replace.
- Required: approval-gated posting, payable balance derivation correctness
  (bill − payments), receiving→stock movement consistency, supplier bank
  detail access-denial tests.
