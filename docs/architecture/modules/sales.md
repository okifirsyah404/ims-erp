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

- `sales.quotations` (SPH) — customer ref, lines (item/unit/qty/price minor
  units), status (draft → price approval → PDF → sent manually per S02),
  doc number (numbering service).
- `sales.invoices` — quotation/order ref, lines, status, DP terms, doc number.
- `sales.sales_orders` (as needed by checkout stage 2, T21).
- Documents snapshot customer/item/price data at creation (financial
  correctness; catalog prices may change later).
- `sales.receipts` — kwitansi, the customer-facing proof of a payment. Owned
  by Sales since 2026-11-08 (moved from `finance.receipts`). `sales_invoice_id`
  references `sales.invoices` inside the module; `payment_id` is a nullable
  logical reference to `finance.payments.id`, validated through the Finance
  contract (`resolvePayment`). The money movement stays in `finance.payments`
  (S03 chain: invoice → payment → verification → receipt).

## Behavior targets

- SPH → approval → invoice → DP/partial → settlement flow with receivables
  tracking (balances reconciled in finance).
- Revenue recognition: final payment must not duplicate revenue; DP
  pre-delivery is a liability (v5.1 financial controls).
- Permissions per matrix (`sales.quote.view|create|approve`,
  `sales.order.*`, `sales.invoice.*`).
- Stage 2: checkout connects orders/invoices to gateway payment status and
  customer-portal document visibility (T21/T25).

## Quotation PDF (ERP-0067)

Sending an approved SPH enqueues `quotation-sent`: the
`QuotationDeliveryService` renders the web admin's public print view
(`/print/quotations/:id`, the same `QuotationDocument` as the print page) to a
PDF with headless Chromium, files it on the quotation's registry document,
shares it for 30 days and publishes `quotation.sent` with the link
(`automation.md`). The print view reads
`GET /public/v1/render/quotations/:id?token=`; the token is a 2-minute HMAC
over the quotation id, signed with `APP_SECRET`, and anything else answers 404.

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
