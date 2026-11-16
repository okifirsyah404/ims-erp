/**
 * Public entry point of the accounting module.
 *
 * @remarks
 * Exports the module's HTTP surface as a single Elysia factory
 * (`accountingModule()`) plus the composition-root registration, so
 * `src/app/app.ts` only mounts `.use(accountingModule())` and never lists
 * the module's controllers individually. Mirrors every other module
 * entry point.
 */
import Elysia from 'elysia';

import { LedgerController } from './controllers/ledger.controller';
import { PaymentController } from './controllers/payment.controller';
import { TaxController } from './controllers/tax.controller';

export { registerAccounting } from './container';
export { registerSupplierBillDueSchedule } from './queues/supplier-bill-due.queue';
export { startSupplierBillDueWorker } from './queues/supplier-bill-due.worker';
export { POSTING_SERVICE_TOKEN } from './constants/di';
export type { TPostingInput, TPostingLine, TPostingResult } from './services/posting.service';
export { PostingService } from './services/posting.service';

/** Elysia instance mounting every accounting controller, in route order. */
export function accountingModule() {
	return new Elysia({ name: 'accounting' })
		.use(TaxController.plugin())
		.use(LedgerController.plugin())
		.use(PaymentController.plugin());
}
