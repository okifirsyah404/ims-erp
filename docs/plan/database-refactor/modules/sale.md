# sale - ERP-0077

Schema `sale` (was `sales`) · folder `src/app/sale` (was `sales`) · URL `/sales` · phase P4

## Current

Tables: quotations(+items, status_history), sales_orders(+items),
order_status_history, delivery_notes(+items), sales_returns(+items),
invoices(+items), receipts, payments (legacy). Repositories: delivery-note,
invoice, payment, quotation, sales-order, sales-return (several serve header +
items + history). Controllers: delivery-note, invoice, quotation-render
(`/public/v1/render/quotations`), quotation, receipt, sales-order,
sales-return, sales. `ExportedInvoiceService` exists. Consumers: web-admin
`quotation-api.ts`, `sales-order-api.ts`, `delivery-note-api.ts`,
`sales-return-api.ts`, `invoice-api.ts`, `dashboard-api.ts`; portal invoice
reads.

## Target tables

| Table | Change |
|---|---|
| quotations | `customer_id` -> customer.customers, + `company_id` -> customer.companies, `customer_contact_id` dropped (the person is `customer_id`), `lead_id` -> project.leads |
| quotation_items, order_items, delivery_note_items, return_items, invoice_items | `item_id` -> `product_id` (inventory.products); `invoice_items.item_variant_id`/`unit_id` dropped (catalog gone) |
| orders (was sales_orders), order_items, order_status_history | rename; FK columns `sales_order_id` -> `order_id`; + `company_id`, `lead_id` (copied) |
| returns (was sales_returns), return_items | rename; `sales_return_id` -> `return_id`; `stock_movement_id` -> `movement_id` |
| delivery_notes, invoices, receipts | re-pointed references (customer, payment, finance.payment_terms) |
| discount_requests, contracts, targets | target only (dbml) |
| settings, code_numberings | new |

Removed: `sales.payments`.

## Steps

1. **dbml** - rename section and tables; re-point references.
2. **Drizzle** - `sale.schema.ts` (`pgSchema('sale')`); delete `sales.schema.ts`.
3. **Repositories** (one per table) - quotation, quotation-item,
   quotation-status-history, order, order-item, order-status-history,
   delivery-note, delivery-note-item, return, return-item, invoice,
   invoice-item, receipt, setting, code-numbering. Header repositories may
   join their items for reads; writes of items go through the item repository
   inside the service's transaction.
4. **Services** - keep the existing use cases. Cross-module:
   `ExportedCustomerService` (snapshots), `ExportedLeadService` (project,
   cycle breaker), `ExportedInventoryService` + `StockService` (delivery and
   return posting), `FinancePostingService` (AR open item / journal),
   `PaymentService` (receipt -> payment + allocation), `TaxService` (VAT rate),
   `ExportedCompanyService` (letterhead). Publish `ExportedOrderService` for
   project and `ExportedInvoiceService` (kept) for finance/payment/customer
   portal.
5. **Controllers** - `/sales/quotations`, `/sales/orders`,
   `/sales/delivery-notes` (was `/delivery-notes`), `/sales/returns` (was
   `/sales-returns`), `/sales/invoices`, `/sales/receipts` (was `/receipts`),
   `/sales/public/v1/render/quotations` (+ alias
   `/public/v1/render/quotations`: links already sent to customers).
6. **Consumers** - the six web-admin wrappers above, sales routes and
   sidebar; customer/company pickers on quotation form; portal invoice
   endpoints via customer module.

## Exit

Quotation -> order -> delivery -> invoice -> receipt flow tests green with
new names; quotation PDF link alias verified.
