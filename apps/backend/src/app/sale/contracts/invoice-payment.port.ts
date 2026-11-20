import type { TInvoiceSelect, TReceiptSelect } from '@drizzle/schemas/sale.schema';
import type { TReceiptData } from './invoice.repository.interface';

/**
 * Sales' contract for the payment module (ADR-0023).
 *
 * @remarks
 * The payment module owns `payment.gateway_payments`, but the invoice and the
 * receipt (kwitansi) stay Sales'. This port is the only way in: it resolves the
 * invoice, records the receipt the gateway paid for, and publishes
 * `receipt.recorded` — Sales keeps the event shape. Never the repository.
 */
export interface IInvoicePaymentPort {
	/** The invoice, or null when it does not exist in this organization. */
	findById(organizationId: string, id: string, tx?: unknown): Promise<TInvoiceSelect | null>;
	/** Records a receipt; `capToOutstanding` caps it at what is still owed. */
	addReceipt(
		data: TReceiptData,
		options?: { tx?: unknown; capToOutstanding?: boolean },
	): Promise<TReceiptSelect | null>;
	/** Publishes `receipt.recorded` for an applied online payment. Call after the commit. */
	publishReceiptRecorded(receipt: TReceiptSelect, invoice: TInvoiceSelect): Promise<void>;
}
