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
		private readonly invoices: Pick<IInvoiceRepository, 'hasLiveInvoices' | 'listByOrder'>,
	) {}

	/** True when the order has any invoice that is not void. */
	hasLiveInvoices(salesOrderId: string): Promise<boolean> {
		return this.invoices.hasLiveInvoices(salesOrderId);
	}

	/**
	 * Money received on the order's live invoices (receipts are verified when
	 * recorded; reversed ones are already taken out). Licensing compares it
	 * with the order total to renew on full payment (M03 stage 2).
	 */
	async paidTotal(salesOrderId: string): Promise<number> {
		const invoices = await this.invoices.listByOrder(salesOrderId);
		return invoices.filter((invoice) => invoice.status !== 'void').reduce((sum, invoice) => sum + invoice.paidTotal, 0);
	}
}
