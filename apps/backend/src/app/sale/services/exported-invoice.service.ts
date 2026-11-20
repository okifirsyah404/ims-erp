import { inject, injectable } from 'tsyringe';
import type { TInvoiceSelect } from '@drizzle/schemas/sale.schema';
import { INVOICE_REPOSITORY_TOKEN } from '../constants/ar-di';
import type { TInvoiceRepository } from '../contracts/invoice.repository.interface';
import type { IExportedInvoiceService } from '../contracts/exported-invoice.contract';

/**
 * Cross-module export facade for the sales module's invoices.
 *
 * @remarks
 * Consumed by Accounting (AR sub-ledger mirror + month-end close checklist)
 * through `EXPORTED_INVOICE_SERVICE_TOKEN`. It deliberately depends **only on
 * Sales' own invoice repository** — never on another module's service — so
 * cross-module consumers cannot create a service-to-service dependency cycle.
 * Domain rules stay in `InvoiceService`; this class relays the two queries and
 * one write another module legitimately needs.
 */
@injectable()
export class ExportedInvoiceService implements IExportedInvoiceService {
	constructor(
		@inject(INVOICE_REPOSITORY_TOKEN)
		private readonly invoices: Pick<
			TInvoiceRepository,
			'findById' | 'update' | 'countDraftsInWindow'
		>,
	) {}

	findById(organizationId: string, id: string, tx?: unknown): Promise<TInvoiceSelect | null> {
		return this.invoices.findById(organizationId, id, tx);
	}

	/** The invoice totals the AR sub-ledger mirrors (`paid_total`, `outstanding_total`, `status`). */
	updateTotals(
		organizationId: string,
		id: string,
		patch: { paidTotal?: number; outstandingTotal?: number; status?: string },
		tx?: unknown,
	): Promise<TInvoiceSelect | null> {
		return this.invoices.update(organizationId, id, patch, tx);
	}

	countDraftsInWindow(organizationId: string, startDate: string, endDate: string): Promise<number> {
		return this.invoices.countDraftsInWindow(organizationId, startDate, endDate);
	}
}
