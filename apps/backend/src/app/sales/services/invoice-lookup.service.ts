import { inject, injectable } from 'tsyringe';
import { INVOICE_REPOSITORY_TOKEN } from '../constants/ar-di';
import type { TInvoiceRepository } from '../contracts/invoice.repository.interface';

/**
 * Sales contract for other modules: whether an order has been billed, and the
 * money received on its live invoices. Depends only on the invoice repository,
 * so Sales can serve it without a dependency cycle.
 */
@injectable()
export class InvoiceLookupService {
	constructor(
		@inject(INVOICE_REPOSITORY_TOKEN)
		private readonly invoices: Pick<TInvoiceRepository, 'hasLiveInvoices' | 'listByOrder'>,
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
		return invoices
			.filter((invoice) => invoice.status !== 'void')
			.reduce((sum, invoice) => sum + invoice.paidTotal, 0);
	}
}
