# M02 — CRM and Sales

## Purpose

Covers selling from first contact to collected invoice: leads, follow-ups,
SPH (quotation), invoice, DP (down payment), receipt (kuitansi). In Stage 2,
online checkout feeds the same order/invoice flow through one payment
gateway.

## Stage 1 scope (baseline)

- Leads and follow-ups/surveys, **recorded manually**.
- SPH (quotation), invoice, DP, receipt.
- **One template per document** (SPH, invoice, receipt).
- Simple approval (price approval on SPH).

_Interpretation, needs owner confirmation:_

| Entity | Minimum fields | Status flow |
|---|---|---|
| Lead | name, contact, source (WA/website/referral/walk-in), need, PIC | `new → contacted → surveyed → won / lost` |
| Follow-up / survey | lead, date, channel, notes, next action date | none (it is a log) |
| Customer | name, NPWP (optional), contacts, addresses | created when a lead is won, or entered directly |
| SPH | customer, items (catalog item, qty, unit price, discount), validity date, notes | `draft → submitted → approved / rejected → sent` |
| Invoice | customer, source SPH/order, lines, tax lines (M10 rates), due date | `draft → issued → partially_paid → paid / void` |
| DP | invoice or SPH reference, amount | recorded as a **customer advance** (M09), not revenue |
| Receipt | payment reference, amount, date | generated when payment is verified |

- "Simple approval" means one approver role. The approver checks price or
  discount, then approves or rejects with a note. One level only.
- "Send manually" (S02) means the system produces a PDF and staff send it by
  WA or email themselves. The system sends nothing.

## Stage 2 scope (baseline) — add-on: Checkout / payment gateway (IDR 1,500,000)

- Checkout is connected to orders/invoices.
- Gateway payment status is shown on the order/invoice.
- Documents appear in the customer portal (M12/T25).
- One gateway, order/invoice, valid callback, status and reconciliation.
- **Refunds are handled by an administrator** (manually).

_Interpretation, needs owner confirmation:_

- Checkout flow: the customer picks catalog items (M04 website), and the
  system creates an order and an invoice, starts a gateway payment session
  and redirects the customer to the gateway.
- A callback is accepted only when its signature verifies against the server
  secret and its reference matches an open invoice. Callbacks are
  **idempotent**: the same gateway reference twice yields one payment.
- Payment states shown: `pending`, `paid`, `expired`, `failed`. Only `paid`
  from a valid callback, or a manual finance verification, counts as
  received.
- Gateway fee and settlement split feed M09 (T22).

## Explicit limits (out of scope)

- One template per document. No template designer and no per-customer
  layouts.
- No multi-level approvals.
- No fully automated CRM: no automatic lead scoring, drip campaigns or
  auto-assignment.
- One gateway only. No marketplace integration.
- No automatic refunds.
- AI (M04) cannot grant discounts or create financial transactions.

## Tasks

| ID | Task | PIC | Days | Price (IDR) |
|---|---|---|---|---:|
| T05 | CRM, quotation (SPH), invoice, and documents | B | S1 5–7 | 506,250 |
| T21 | Checkout and online orders | B | S2 1–6 | 900,000 |
| T22 | Payment callbacks and reconciliation | B | S2 7–10 | 600,000 |

T22 is shared with M09 (reconciliation posting). T03 (master data:
customers, items) is a prerequisite.

## SOPs

- **S01 CRM:** lead, contact/survey, manual follow-up, deal.
- **S02 SPH:** draft, price approval, PDF, send manually.
- **S03 Invoice and payment:** invoice/order, payment, valid callback or
  manual verification, reconciliation, receipt, then processing according to
  the terms.

## Controls

- DP received before delivery is a **customer advance**. The final payment
  must not record revenue twice (v5.1 p.9).
- Invoice corrections use void or a credit memo plus a reversing journal.
  Issued invoices are never edited in place.
- Postings to M09 carry a unique reference (invoice number, gateway
  reference).
- Gateway API secrets live in server config only and are never sent to the
  client.
- Customers see only their own orders/invoices/documents (M12), including
  through PDF download URLs.
- Money is stored as integer IDR minor units.

## Acceptance

- UAT: CRM/SPH/invoice scenarios in U01–U20 and gateway scenarios in
  U21–U32, per Excel. Scenario text is not in the repo.
- _Interpretation:_ the Stage 2 tests must include a replayed callback (no
  duplicate payment), a bad-signature callback (rejected) and a DP-then-final
  payment (revenue recorded once).

## Definition of Done

Common DoD in [README.md](README.md), plus:

- The SPH approval rule is enforced on the server. A non-approver gets 403,
  and an unapproved SPH cannot reach `sent`.
- A DP and final-payment test shows revenue posted exactly once and the
  advance cleared.
- Callback idempotency and signature tests pass. The callback endpoint is
  documented for the handover (T32 deliverable).
- SPH, invoice and receipt PDFs render from the single template, with
  Indonesian copy.

## Dependencies

- Needs: T03 master data (customers, items, units), M09 (journals,
  receivables, advance account), M10 (tax rates on invoice lines), M04
  catalog (Stage 2 checkout).
- Provides: invoices and payments to M09, won deals to M07 (projects), paid
  license invoices to M03, documents to the customer portal (M12).

## Current state vs plan (checked 2026-11-04)

| Plan item | `docs.dbml` | Code |
|---|---|---|
| Leads, follow-ups, customers | `crm` (10 tables: customers, leads, lead_activities, segments, credit limits…) | none |
| SPH | `sales.quotations`, `quotation_items`, `quotation_status_history`, `discount_requests` | `apps/backend/src/app/sales`: quotations create/list/get/update/submit/decision. `quotation_items` not in the Drizzle schema. No UI route. |
| Invoice, receipt, DP | `sales.invoices`, `sales.invoice_items`, `sales.receipts`; `payment_allocations` (plan D2: invoices owned by Sales; receipts moved to Sales 2026-11-08) | `sales.invoices` + invoice items in the Drizzle schema and `apps/backend/src/app/sales`; finance-side receipts/allocations pending M09 reconciliation |
| Payment | `finance.payments` **and** `sales.payments` | `sales` module: payments create/get/approve/execute |
| Documents/templates | `documents` (8 tables) | none |
| Checkout | `commerce.commerce_orders`, `commerce_order_items` | none |

- Status: **in progress (partial backend only)**. SPH has a backend; no
  invoice, CRM or UI exists.
- `beyond-baseline`:
  - `crm.customer_segments`, `customer_segment_members`,
    `customer_credit_limits` and `customer_groups`. Segmentation and credit
    control are not in v5.1.
  - `sales.sales_targets`, `sales_returns`, `contracts`, `delivery_notes`,
    `discount_requests` as a workflow.
  - `sales.payments` with approve/execute duplicates `finance.payments`.
    Ownership needs a decision: the plan puts payments under M09/T06.
  - The `commerce` promotions/promotion_rules tables. No promotions in v5.1.
