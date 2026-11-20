# procurement - ERP-0078

Schema `procurement` · folder `src/app/procurement` · URL `/procurement` · phase P4

## Current

Tables suppliers, purchase_requests(+items), purchase_orders(+items),
goods_receipts(+items), purchase_returns(+items). Repositories: goods-receipt,
purchase-order, purchase-request, purchase-return, supplier. Controllers
`/purchase-requests`, `/purchase-orders`, `/goods-receipts`,
`/purchase-returns`, `/suppliers`. Consumers: web-admin `procurement-api.ts`,
`goods-receipt-api.ts`, `purchase-return-api.ts`.

## Target tables

All eight document tables stay. Changes:
- `purchase_orders.supplier_id` -> `supplier_company_id` (logical ->
  supplier.companies) + `supplier_pic_id` (-> supplier.suppliers); snapshot
  unchanged. Same for `purchase_returns.supplier_id`. The intra-schema FK to
  `procurement.suppliers` disappears.
- `*_items.item_id` -> `product_id` (inventory.products).
- `goods_receipt_items.stock_movement_id`, `purchase_return_items.stock_movement_id` -> `movement_id`.
- New `code_numberings` (purchase_request, purchase_order, goods_receipt,
  purchase_return).

## Steps

1. **dbml** - edit section; move suppliers out (ERP-0075).
2. **Drizzle** - `procurement.schema.ts`.
3. **Repositories** - one per table (8) + code-numbering; supplier repository
   moves to the supplier module.
4. **Services** - supplier checks through `ExportedSupplierService`; stock
   posting through `StockService`; publish `ExportedPurchaseOrderService`
   (repository-only) for finance supplier bills.
5. **Controllers** - `/procurement/purchase-requests`,
   `/procurement/purchase-orders`, `/procurement/goods-receipts`,
   `/procurement/purchase-returns`.
6. **Consumers** - three web-admin wrappers, routes, sidebar.

## Exit

PR -> PO -> GR -> return and PO -> supplier bill tests green.
