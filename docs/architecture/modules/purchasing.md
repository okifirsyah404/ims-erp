> 2026-10-28: content below describes the deleted NestJS backend (apps/backend-nest). Domains listed as modules/ stubs do not exist in apps/backend-elysia (which has only user, organization, location). Treat as historical audit; re-verify against backend-elysia before acting.

# Purchasing Module

## Purpose and boundary

Procure-to-pay for the single company: purchase bills against supplier
orders, payables lifecycle, and supplier payment coordination (payment
execution stays with payment/finance). v5.1 limits (M05): **no multi-level
purchase requisitions/orders, no automatic reservations/returns** — receiving
and approvals are manual and simple.

## Purchase requests (ERP-0060, 2026-11-15, implemented)

The code lives in `apps/backend/src/app/procurement`; this file predates the
Elysia backend. The owner's decisions of 2026-11-15:

- **Company-wide** like POs (ADR-0011). The requester's organization is
  recorded for information only.
- **Lines** are an item of the master or free text. Purchasing maps free
  text to an item when ordering it.
- **One-level approval:** `purchase_request:approve` / `reject`, never by the
  requester. Rejection returns the request to draft with the reason.
- **Ordering by lines:** purchasing picks approved lines into a PO per
  supplier. One PR can feed several POs, and one PO can merge several PRs.

Data: `procurement.purchase_requests`, `purchase_request_items`, and
`purchase_order_items.purchase_request_item_id`.

- A request line is *ordered* while a live, not cancelled PO line
  references it.
- A PO claims its lines under a row lock (`repositories/request-ordering.ts`).
  A line goes on at most one live PO; a line that is not open answers 422 with
  the PO line number.
- The request moves `approved ↔ ordered` in the same transaction. Cancelling
  or editing a PO frees its lines.
- The requester cancels only while nothing is ordered; the same lock
  serializes this with PO claims.
- The number `purchase_request` (`0001/PR/<COMPANY>/<MM_ROMAN>/<YY>`) is
  allocated on the first submit.

Routes, under `/purchase-requests`:

| Route | Permission | Notes |
| --- | --- | --- |
| list (`mine=true`), detail | `read` | |
| `GET /open-lines` | `read` + `purchase_order:create` | approved lines not yet ordered |
| `GET /items` | `create` | item search for requesters, who hold no `product:read`; through `ItemService.paginate` |
| create, edit | `create` | the requester only |
| `/submit` | `submit` | the requester only |
| `/approve`, `/reject` | `approve` / `reject` | not the requester |
| `/cancel` | `create` | the requester only |

Web: `/procurement/purchase-requests` (list, new, detail, edit). The PO form
adds a "Dari permintaan pembelian" picker, prefill from
`?fromRequest=<id>`, and an item mapper for free-text lines.

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
