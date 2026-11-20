import Elysia from 'elysia';

import { ProductCategoryController } from './controllers/product-category.controller';
import { ProductController } from './controllers/product.controller';
import { BorrowingController, BorrowingRequestController } from './controllers/borrowing.controller';
import { ItemController } from './controllers/item.controller';
import { ProductListingController } from './controllers/product-listing.controller';
import { PublicCatalogController } from './controllers/public-catalog.controller';
import { ItemOperationsController } from './controllers/item-operations.controller';
import { ItemCategoryController } from './controllers/item-category.controller';
import { StockController } from './controllers/stock.controller';
import { StockValuationController } from './controllers/stock-valuation.controller';
import { WarehouseController } from './controllers/warehouse.controller';
import { AdjustmentController } from './controllers/adjustment.controller';

export { registerInventory } from './container';

/**
 * Elysia instance mounting every inventory controller.
 *
 * @remarks
 * `/warehouses/linked` mounts before the admin CRUD: both prefixes start
 * with `/warehouses`, and the linked read needs the `erp` guard, not the
 * session guard. Static segments win, but mounting first keeps the intent
 * obvious. `StockValuationController` mounts before `StockController`: a
 * static path must not be shadowed by `/stock/:…`.
 */
export function inventoryModule() {
	return new Elysia({ name: 'inventory' })
		.use(ProductController.plugin())
		.use(ProductCategoryController.plugin())
		.use(ItemController.plugin())
		.use(ItemCategoryController.plugin())
		.use(ProductListingController.plugin())
		// Server-to-server website API (API-key guard, no session): the primary URL
		// at `/inventory/public/v1/catalog`.
		.use(PublicCatalogController.plugin())
		.use(ItemOperationsController.plugin())
		.use(BorrowingRequestController.plugin())
		.use(BorrowingController.plugin())
		.use(WarehouseController.linkedPlugin())
		.use(WarehouseController.plugin())
		.use(StockValuationController.plugin())
		.use(StockController.plugin())
		.use(AdjustmentController.plugin());
}
