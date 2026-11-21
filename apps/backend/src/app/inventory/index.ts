import Elysia from 'elysia';

import { InventoryCodeNumberingController } from './controllers/code-numbering.controller';
import { BorrowingController, BorrowingRequestController } from './controllers/borrowing.controller';
import { ItemController } from './controllers/item.controller';
import { SerialUnitController } from './controllers/serial-unit.controller';
import { ItemOperationsController } from './controllers/item-operations.controller';
import { ItemCategoryController } from './controllers/item-category.controller';
import { StockController } from './controllers/stock.controller';
import { StockValuationController } from './controllers/stock-valuation.controller';
import { AdjustmentController } from './controllers/adjustment.controller';

export { registerInventory } from './container';

/**
 * Elysia instance mounting every inventory controller.
 *
 * @remarks
 * The product master (`product`) and the warehouses (`warehouse`) moved to
 * their own modules (ADR-0026); what is left here is stock, items, borrowing
 * and the stock value report.
 *
 * `StockValuationController` mounts before `StockController`: a static path
 * must not be shadowed by `/stock/:…`.
 */
export function inventoryModule() {
	return new Elysia({ name: 'inventory' })
		// Static `/code-numberings` routes: settings of this module's series.
		.use(InventoryCodeNumberingController.plugin())
		.use(ItemController.plugin())
		// Nested under the product it describes, but the unit rows and the status
		// matrix are this module's (ADR-0026).
		.use(SerialUnitController.plugin())
		.use(ItemCategoryController.plugin())
		.use(ItemOperationsController.plugin())
		.use(BorrowingRequestController.plugin())
		.use(BorrowingController.plugin())
		.use(StockValuationController.plugin())
		.use(StockController.plugin())
		.use(AdjustmentController.plugin());
}
