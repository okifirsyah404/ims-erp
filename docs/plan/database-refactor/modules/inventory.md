# inventory - ERP-0076

Schema `inventory` · folder `src/app/inventory` (absorbs `assets` and
`catalog`) · URL `/inventory` · phase P3

## Current

- `inventory` (12 tables): warehouses, warehouse_addresses, warehouse_storages,
  warehouse_organizations, warehouse_managers, item_categories, items,
  stock_movements, stock_balances, stock_adjustments, stock_adjustment_items,
  serial_tracked_items. 11 repositories; controllers adjustment,
  item-category, item, stock-valuation, stock, warehouse.
  `ExportedWarehouseService` exists.
- `assets` (14 tables): asset_types, asset_categories, assets, asset_movements,
  asset_condition_checks, asset_maintenances, asset_depreciations,
  asset_disposals, asset_documents, tool_sets, tool_set_items, borrowings,
  borrowing_lines, borrowing_events. 4 repositories (asset, asset-category,
  asset-operations, borrowing); `ExportedAssetService`.
- `catalog.web_listings`; repository listing; controllers `/catalog/listings`,
  `/public/v1/catalog`.
- Consumers (web-admin): `inventory-api.ts`, `item-category-api.ts`,
  `stock-api.ts`, `stock-valuation-api.ts`, `adjustment-api.ts`,
  `warehouse-api.ts`, `asset-api.ts`, `borrowing-api.ts`, `catalog-api.ts`,
  `document-image-api.ts`; ~11 asset route files. web-landing catalog
  (`src/lib/catalog.ts`, mostly local data + public catalog API).

## Target tables (Q14a, Q15, Q24-Q27)

| Table | Notes |
|---|---|
| products | SKU master (was `items`): code, sku, name, product_kind (product/component/material), product_category_id, brand, specification, image_object_key, unit_label, is_serialized, is_stock_tracked, min_stock_qty, prices; **listing columns from `web_listings`**: slug (partial unique), is_published, published_at, listing_specs, price_mode, price_caption, out_of_stock_mode, lead_time_label, applications, popularity |
| product_categories | was `item_categories` (website slug) |
| item_serials | was `serial_tracked_items`; `product_id`; `customer_id` -> customer.customers, `company_id` -> customer.companies (both nullable) |
| items | was `assets.assets`, one row per physical unit: code, name, item_kind (equipment/tool/vehicle/it/furniture - from `asset_types` codes), item_category_id, serial_number, acquisition data, book_value, condition, status, warehouse_id/storage_id (intra-schema FK now), custodian_employee_id, supplier_company_id, purchase_order_id |
| item_categories | was `asset_categories` (default depreciation rule) |
| documents | product_id / item_id (exactly one), document_type (photo/manual/datasheet/certificate/invoice/contract), object_key, file_name, mime_type, size_bytes |
| movements | product movements (quantity, unit_cost, bin) and item movements (quantity = 1, from/to warehouse+storage, from/to free-text location); CHECK exactly one of product_id/item_id; vocabulary = union of both, minus the superseded `borrowing_out/in` |
| stocks | was `stock_balances` (products only) |
| stock_adjustments, stock_adjustment_items | `item_id` -> `product_id` |
| borrowing_requests | draft -> requested -> approved / rejected / cancelled; purpose, borrower (user/customer/guest), due_at, requested/approved by; `tool_set_id` (nullable FK) when a whole kit is requested - its items become the request's `borrowing_items` |
| borrowings | issued -> partially_returned -> returned / closed; borrowing_request_id FK (unique, Q26); borrower snapshot copied from the request |
| borrowing_items | was `borrowing_lines` (`asset_id` -> `item_id`); borrowing_request_id FK (not null, the requested unit) + borrowing_id FK (null until issued) - no separate request-lines table |
| borrowing_events | unchanged, `asset_movement_id` -> `movement_id` |
| maintenances, condition_checks, disposals | was `asset_*`, `asset_id` -> `item_id` |
| tool_sets | was `assets.tool_sets` (Q37): code, name, custodian_employee_id, status (available/lent/maintenance/retired) |
| tool_set_items | was `assets.tool_set_items`: tool_set_id FK, `item_id` FK (was `asset_id`); unique (tool_set_id, item_id) |
| warehouses, warehouse_addresses, warehouse_storages, warehouse_managers, warehouse_organizations | unchanged (address Q10) |
| warehouse_settings | warehouse_id FK, key, value, value_type |
| settings | module key-value |
| code_numberings | item_product/material/component, asset, borrowing, adjustment, maintenance, disposal codes |

Depreciation runs leave for `finance.asset_depreciations`; `items.book_value`
and `accumulated_depreciation` are written only through
`InventoryItemService.applyDepreciation()` called by finance.

## Steps

1. **dbml** - rewrite the inventory section; remove `assets` and `catalog`.
2. **Drizzle** - `inventory.schema.ts` gains the asset tables; delete
   `asset.schema.ts`, `catalog.schema.ts`.
3. **Repositories** (one per table) - product, product-category, item-serial,
   item, item-category, document, movement, stock, stock-adjustment,
   stock-adjustment-item, borrowing-request, borrowing, borrowing-item,
   borrowing-event, maintenance, condition-check, disposal, warehouse,
   warehouse-address, warehouse-storage, warehouse-manager,
   warehouse-organization, warehouse-setting, setting, code-numbering.
   Today's `asset-operations` and `stock-valuation` repositories become
   queries on the per-table repositories (joins inside the schema allowed).
4. **Services** - ProductService, ProductListingService (was catalog),
   StockService (posting, moving average), ItemService, BorrowingService,
   MaintenanceService, DisposalService, WarehouseService.
   `ExportedInventoryService` (repository-only) replaces
   `ExportedWarehouseService` + `ExportedAssetService`: warehouse/storage
   assertions, product snapshot for documents, serial checks, item lookups.
   Stock posting for sale/procurement stays a full-service call
   (`StockService.post*`) because inventory never calls sale/procurement.
5. **Controllers** - `/inventory/products`, `/inventory/product-categories`,
   `/inventory/item-serials`, `/inventory/items`, `/inventory/item-categories`,
   `/inventory/documents`, `/inventory/movements`, `/inventory/stocks`,
   `/inventory/stock-adjustments`, `/inventory/stock-valuation`,
   `/inventory/borrowing-requests`, `/inventory/borrowings`,
   `/inventory/maintenances`, `/inventory/disposals`, `/inventory/warehouses`,
   `/inventory/public/v1/catalog` (+ alias `/public/v1/catalog`, Q34).
6. **Consumers** - web-admin: merge `asset-api.ts`/`borrowing-api.ts` into
   inventory item/borrowing wrappers; `inventory-api.ts` -> products;
   `catalog-api.ts` -> product listing fields on the product form; routes
   `/assets/*` -> `/inventory/items/*`, sidebar entries, `routeTree.gen.ts`.
   web-landing: catalog source URL. Locales en/id for renamed labels.

## Exit

Moving average, serial lifecycle, borrowing issue/return and disposal tests
pass on the new repositories; no code references `assets`/`catalog` schemas.
