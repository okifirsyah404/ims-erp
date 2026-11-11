/**
 * Public entry point of the Procurement module: composition-root
 * registration, the HTTP controllers, and the exported services.
 */
import Elysia from 'elysia';

import { GoodsReceiptController } from './controllers/goods-receipt.controller';
import { PurchaseOrderController } from './controllers/purchase-order.controller';
import { SupplierController } from './controllers/supplier.controller';

export { registerProcurement } from './container';
export {
	PURCHASE_ORDER_SERVICE_TOKEN,
	SUPPLIER_SERVICE_TOKEN,
} from './constants/di';

/** Elysia instance mounting every procurement controller, in route order. */
export function procurementModule() {
	return new Elysia({ name: 'procurement' })
		.use(SupplierController.plugin())
		.use(PurchaseOrderController.plugin())
		.use(GoodsReceiptController.plugin());
}
