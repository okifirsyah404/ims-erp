import { inject, injectable } from 'tsyringe';
import { INVOICE_REPOSITORY_TOKEN } from '../constants/di';
import type { IInvoiceRepository } from '../contracts/invoice.repository.interface';

/**
 * Finance contract for the Sales module: whether an order has been billed.
 * Depends only on the Finance repository, so Sales may use it while Finance
 * reads orders through the Sales contract, without a dependency cycle.
 */
@injectable()
export class InvoiceLookupService {
	constructor(
		@inject(INVOICE_REPOSITORY_TOKEN)
		private readonly invoices: Pick<IInvoiceRepository, 'hasLiveInvoices'>,
	) {}

	/** True when the order has any invoice that is not void. */
	hasLiveInvoices(salesOrderId: string): Promise<boolean> {
		return this.invoices.hasLiveInvoices(salesOrderId);
	}
}
