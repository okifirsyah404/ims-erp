import { inject, injectable } from 'tsyringe';
import { OUTBOX_SERVICE_TOKEN } from '@app/automation/constants/di';
import type { OutboxService } from '@app/automation/services/outbox.service';
import type { TInvoiceSelect, TReceiptSelect } from '@drizzle/schemas/sale.schema';
import type { TTx } from '@drizzle/types';
import { INVOICE_REPOSITORY_TOKEN, RECEIPT_LEDGER_SERVICE_TOKEN } from '../constants/ar-di';
import type { ReceiptLedgerService } from './receipt-ledger.service';
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
		/** ERP-0139: an online payment posts Dr gateway clearing / Cr receivable. */
		@inject(RECEIPT_LEDGER_SERVICE_TOKEN)
		private readonly ledger?: Pick<ReceiptLedgerService, 'post'>,
	) {}

	findById(organizationId: string, id: string, tx?: unknown): Promise<TInvoiceSelect | null> {
		return this.invoices.findById(organizationId, id, tx);
	}

	/** The gateway's receipt, posted to the ledger in the caller's transaction (ERP-0139). */
	async addReceipt(
		data: TReceiptData,
		options?: { tx?: unknown; capToOutstanding?: boolean },
	): Promise<TReceiptSelect | null> {
		const receipt = await this.invoices.addReceipt(data, options);
		if (receipt && this.ledger && options?.tx) {
			const invoice = await this.invoices.findById(data.organizationId, data.invoiceId, options.tx);
			await this.ledger.post(
				options.tx as TTx,
				receipt,
				{ id: data.invoiceId, code: invoice?.code ?? null, customerId: invoice?.customerId ?? null },
				true,
			);
		}
		return receipt;
	}

	/** M04: an online payment is a received payment for n8n too. */
	async publishReceiptRecorded(receipt: TReceiptSelect, invoice: TInvoiceSelect): Promise<void> {
		await this.outbox.publish('receipt.recorded', { type: 'receipt', id: receipt.id }, receiptRecordedEvent(receipt, invoice));
	}
}
