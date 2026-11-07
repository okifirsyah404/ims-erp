import type { TInvoiceSelect, TReceiptSelect } from '@drizzle/schemas/finance.schema';

/**
 * Event data sent to n8n for billing (M04 stage 2): enough for a WhatsApp or
 * email notice to the customer or to finance. Amounts are integer IDR minor
 * units, like everywhere in the ERP.
 */

function customerOf(invoice: TInvoiceSelect) {
	const { code, name, email, phone, whatsapp } = invoice.customerSnapshot;
	return { id: invoice.customerId, code, name, email, phone, whatsapp };
}

/** `invoice.issued`. */
export function invoiceIssuedEvent(invoice: TInvoiceSelect): Record<string, unknown> {
	return {
		invoiceId: invoice.id,
		code: invoice.code,
		title: invoice.title,
		customer: customerOf(invoice),
		salesOrderCode: invoice.salesOrderCode,
		issueDate: invoice.issueDate,
		dueDate: invoice.dueDate,
		grandTotal: invoice.grandTotal,
		outstandingTotal: invoice.outstandingTotal,
		currencyCode: invoice.currencyCode,
	};
}

/** `receipt.recorded`, with the invoice as it stands after the payment. */
export function receiptRecordedEvent(receipt: TReceiptSelect, invoice: TInvoiceSelect): Record<string, unknown> {
	return {
		receiptId: receipt.id,
		code: receipt.code,
		receivedDate: receipt.receivedDate,
		amount: receipt.amount,
		method: receipt.method,
		currencyCode: receipt.currencyCode,
		invoice: {
			id: invoice.id,
			code: invoice.code,
			status: invoice.status,
			grandTotal: invoice.grandTotal,
			paidTotal: invoice.paidTotal,
			outstandingTotal: invoice.outstandingTotal,
		},
		customer: customerOf(invoice),
	};
}
