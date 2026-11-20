# Sale Module

> Created 2026-11-20 (ADR-0024). Replaces `sales.md` (deprecated, pre-refactor
> `sales` schema and NestJS-era scaffold audit).

Code: `apps/backend/src/app/sale`. Schema: `sale` (was `sales`). Profile:
`docs/database/module-ownership.md` (#7). Tables: `docs/database/docs.dbml`.

## Purpose and boundary

Quote-to-cash documents of the single company (company-wide, ADR-0011):
quotations (SPH), sales orders, delivery notes, sales returns, invoices and
receipts. Money movement is **not** here: payments live in `payment`, posting
in `finance`. Leads moved to `project`.

## Owned tables (18)

`quotations`, `quotation_items`, `quotation_status_history`, `orders`,
`order_items`, `order_status_history`, `delivery_notes`,
`delivery_note_items`, `returns`, `return_items`, `invoices`,
`invoice_items`, `receipts`, `discount_requests`, `contracts`, `targets`,
`settings`, `code_numberings` (`SaleNumberingService`).

## HTTP (all `erp` guard unless noted)

- `/sales/quotations` (create, patch, `submit`, `decision`, `revisions`,
  `send`, `lost`), `/sales/orders`, `/sales/delivery-notes` (`ship`,
  `deliver`, `cancel`), `/sales/returns` (`submit`, `decision`, `receive`),
  `/sales/receipts` (`:id/reverse`), `/sales/invoices` (`issue`, `void`,
  `cancel`, `:id/receipts`, `summary`).
- Public: `GET /sales/public/v1/render/quotations/:id?token=` - print view for
  the PDF renderer; the token is a 2-minute HMAC over the quotation id signed
  with `APP_SECRET` (ERP-0067).

## Contract

`ExportedOrderService.findOrder` (`EXPORTED_ORDER_SERVICE_TOKEN`) and
`ExportedInvoiceService.findById`, both repository-only facades. The invoice
side of online payment is served to `payment` through `IInvoicePaymentPort`.

## Permissions

Resources `quotation` (`read|create|update|submit|approve|reject|send|export`),
`sales_order`, `invoice` (`issue`, `void`, ...), `receipt` (`reverse`, ...),
`sales_return`, and `stock:issue` for delivery notes.

## Key rules

- Approval never by the author; quotation approval gates sending.
- Documents snapshot customer, item and price data at creation; later
  catalog changes never alter them.
- Deposits (DP) are liabilities until delivery; settlement never recognizes
  revenue twice.
- Customer and product references go through the `customer` and `inventory`
  contracts; the portal sees only the customer's own documents.
- Money is integer IDR minor units; datetimes are unix ms.
