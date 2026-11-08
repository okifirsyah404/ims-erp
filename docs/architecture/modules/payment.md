> 2026-10-28: content below describes the deleted NestJS backend (apps/backend-nest). Domains listed as modules/ stubs do not exist in apps/backend-elysia (which has only user, organization, location). Treat as historical audit; re-verify against backend-elysia before acting.

# Payment Module

## Purpose and boundary

Money in / money out events against sales documents: cash/bank recording,
receivables settlement, supplier payments (via purchasing contracts), and —
stage 2 — checkout with **one gateway** (tasks T21–T22). Owns payment
gateway callback validation and gateway reconciliation data. Payment
transactions are recorded in `finance.payments`, which Finance owns.
Revenue recognition stays with sales/finance rules; this module never
creates revenue by settling receivables (deposits are liabilities until
delivery).

## Current state (audit, 2026-10-25)

**Scaffold only:**

- `modules/payment/**` — empty stubs; registered in `app.module.ts`.
- Pre-written unit specs (controller/service) exist.

## Data ownership (planned; Phase 4 for cash/receivables, Stage 2 for gateway)

- `finance.payments` (owned by Finance, the single money-movement ledger;
  this module adds no second ledger) — payment type (customer receipt / supplier payment /
  refund), business date, amount (**integer IDR minor units**), cash/bank
  account ref (finance-owned master), source document refs (invoice/bill),
  unique posting reference, journal ref (via finance posting), status.
- Gateway (stage 2): gateway transaction refs, gross amount / fees /
  pending-settlement / net-cash received (v5.1 reconciliation requirement),
  callback event log with idempotency keys.
- Refunds are **administrator-handled** (v5.1 limit), not self-service.

## Behavior targets

- Stage 1 (T06): record payments against receivables/payables in
  `finance.payments` with unique references. The kwitansi document is Sales
  (`sales.receipts`), not payment. Settlement never double-posts revenue;
  DP-before-delivery stays a liability (S03).
- Stage 2 (T21–T22): checkout linked to order/invoice; valid callback
  (signature-verified) with **amount/currency/order checks, uniqueness,
  idempotency, retry/out-of-order safety**; browser redirect is never proof
  of payment; gateway fees reconciled (S03/S05).

## Dependencies and rules

- Finance owns posting, cash/bank master and the payment ledger; sales owns
  invoices and receipts (this module references them); purchasing owns bills. External effects (gateway calls)
  only after local commit. Idempotency mandatory on callback processing
  (duplicate events are safe).

## Tests

- Existing stub specs to replace.
- Required: settlement idempotency (same payment twice posts once), DP
  liability accounting test, callback signature/amount/order validation,
  duplicate/delayed/out-of-order event tests, gross/fees/net reconciliation
  math on integer units.
