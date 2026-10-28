> 2026-10-28: content below describes the deleted NestJS backend (apps/backend-nest). Domains listed as modules/ stubs do not exist in apps/backend-elysia (which has only user, organization, location). Treat as historical audit; re-verify against backend-elysia before acting.

# Sales Module

## Purpose and boundary

Quote-to-cash documents: leads (manual stage 1), quotations (SPH), orders,
invoices, down payments (DP), receipts, and document templates. One template
per document (v5.1 M02 limit); simple approvals only — no multi-level
approvals or fully automated CRM.

## Current state (audit, 2026-10-25)

**Scaffold only:**

- `modules/sales/**` — empty stubs; registered in `app.module.ts`.
- Pre-written unit specs (controller/service) exist.

## Data ownership (planned, Phase 4 — commercial T05)

- `erp.quotations` (SPH) — customer ref, lines (item/unit/qty/price minor
  units), status (draft → price approval → PDF → sent manually per S02),
  doc number (numbering service).
- `erp.invoices` — quotation/order ref, lines, status, DP terms, doc number.
- `erp.orders` (as needed by checkout stage 2, T21).
- Documents snapshot customer/item/price data at creation (financial
  correctness; catalog prices may change later).
- Receipts/settlements are **payment module** transactions; this module only
  references them (S03 chain: invoice → payment → verification → receipt).

## Behavior targets

- SPH → approval → invoice → DP/partial → settlement flow with receivables
  tracking (balances reconciled in finance).
- Revenue recognition: final payment must not duplicate revenue; DP
  pre-delivery is a liability (v5.1 financial controls).
- Permissions per matrix (`sales.quote.view|create|approve`,
  `sales.order.*`, `sales.invoice.*`).
- Stage 2: checkout connects orders/invoices to gateway payment status and
  customer-portal document visibility (T21/T25).

## Dependencies and rules

- Consumes customer + product catalogs via contracts; payment for
  settlements; finance for posting (transaction owner when both write).
- Customer-portal scoping: customers see only their own documents
  (enforced server-side; tested cross-customer).

## Tests

- Existing stub specs to replace.
- Required: document number uniqueness under concurrency, price snapshot
  immutability, DP liability accounting, approval gating, no-double-revenue
  on settlement, portal ownership scoping.
