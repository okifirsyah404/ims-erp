/**
 * Public entry point of the Procurement module: composition-root
 * registration, the HTTP controllers, and the exported services.
 */
import Elysia from 'elysia';

import { ProcurementCodeNumberingController } from './controllers/code-numbering.controller';
import { GoodsReceiptController } from './controllers/goods-receipt.controller';
import { PurchaseOrderController } from './controllers/purchase-order.controller';
import { PurchaseReturnController } from './controllers/purchase-return.controller';
import { PurchaseRequestController } from './controllers/purchase-request.controller';

export { registerProcurement } from './container';
export {
	PURCHASE_BILLING_SERVICE_TOKEN,
	PURCHASE_ORDER_SERVICE_TOKEN,
} from './constants/di';
export type { PurchaseBillingService, TBillableOrder } from './services/purchase-billing.service';

/** Elysia instance mounting every procurement controller, in route order. */
export function procurementModule() {
	return new Elysia({ name: 'procurement' })
		// Static `/code-numberings` routes: settings of this module's series.
		.use(ProcurementCodeNumberingController.plugin())
		.use(PurchaseRequestController.plugin())
		.use(PurchaseOrderController.plugin())
		.use(GoodsReceiptController.plugin())
		.use(PurchaseReturnController.plugin());
}
