import { inject, injectable } from 'tsyringe';
import { OUTBOX_SERVICE_TOKEN } from '@app/automation/constants/di';
import type { OutboxService } from '@app/automation/services/outbox.service';
import type { TInvoiceSelect, TReceiptSelect } from '@drizzle/schemas/sale.schema';
import { INVOICE_REPOSITORY_TOKEN } from '../constants/ar-di';
import type { TInvoiceRepository, TReceiptData } from '../contracts/invoice.repository.interface';
import type { IInvoicePaymentPort } from '../contracts/invoice-payment.port';
import { receiptRecordedEvent } from '../utils/invoice-events';

/**
 * Sales' implementation of {@link IInvoicePaymentPort} (ADR-0023): the payment
 * module records an online receipt through this, never through the repository.
 */
@injectable()
export class InvoicePaymentPortService implements IInvoicePaymentPort {
	constructor(
		@inject(INVOICE_REPOSITORY_TOKEN)
		private readonly invoices: Pick<TInvoiceRepository, 'findById' | 'addReceipt'>,
		@inject(OUTBOX_SERVICE_TOKEN)
		private readonly outbox: Pick<OutboxService, 'publish'>,
	) {}

	findById(organizationId: string, id: string, tx?: unknown): Promise<TInvoiceSelect | null> {
		return this.invoices.findById(organizationId, id, tx);
	}

	addReceipt(
		data: TReceiptData,
		options?: { tx?: unknown; capToOutstanding?: boolean },
	): Promise<TReceiptSelect | null> {
		return this.invoices.addReceipt(data, options);
	}

	/** M04: an online payment is a received payment for n8n too. */
	async publishReceiptRecorded(receipt: TReceiptSelect, invoice: TInvoiceSelect): Promise<void> {
		await this.outbox.publish('receipt.recorded', { type: 'receipt', id: receipt.id }, receiptRecordedEvent(receipt, invoice));
	}
}
