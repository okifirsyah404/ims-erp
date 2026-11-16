/**
 * Public entry point of the sales module.
 *
 * @remarks
 * Exports the module's HTTP surface as a single Elysia factory
 * (`salesModule()`) plus the composition-root registration, so
 * `src/app/app.ts` only mounts `.use(salesModule())` and never lists
 * the module's controllers individually. Mirrors every other module
 * entry point.
 */
import Elysia from 'elysia';

import { DeliveryNoteController } from './controllers/delivery-note.controller';
import { InvoiceController } from './controllers/invoice.controller';
import { QuotationController } from './controllers/quotation.controller';
import { ReceiptController } from './controllers/receipt.controller';
import { SalesController } from './controllers/sales.controller';
import { SalesOrderController } from './controllers/sales-order.controller';

export { registerSales } from './container';
export { registerQuotationFollowUpSchedule } from './queues/quotation-follow-up.queue';
export { startQuotationFollowUpWorker } from './queues/quotation-follow-up.worker';

/** Elysia instance mounting every sales controller, in route order. */
export function salesModule() {
	return new Elysia({ name: 'sales' })
		.use(QuotationController.plugin())
		.use(SalesOrderController.plugin())
		.use(DeliveryNoteController.plugin())
		.use(InvoiceController.plugin())
		.use(ReceiptController.plugin())
		.use(SalesController.plugin());
}
