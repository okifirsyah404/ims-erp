import type { TCustomerNotice } from '@app/user/services/customer-portal-notifier.service';
import { rupiahLabel } from './rupiah';
import type { TInvoiceSelect, TReceiptSelect } from '@drizzle/schemas/sales.schema';

/**
 * Event data sent to n8n for billing (M04 stage 2): enough for a WhatsApp or
 * email notice to the customer or to finance. Amounts are integer IDR minor
 * units, like everywhere in the ERP.
 */

function customerOf(invoice: TInvoiceSelect) {
	const snapshot = invoice.customerSnapshot;
	return {
		id: invoice.customerId,
		code: snapshot?.code ?? null,
		name: snapshot?.name ?? null,
		email: snapshot?.email ?? null,
		phone: snapshot?.phone ?? null,
		whatsapp: snapshot?.whatsapp ?? null,
	};
}

/** `invoice.issued`. */
export function invoiceIssuedEvent(invoice: TInvoiceSelect): Record<string, unknown> {
	return {
		invoiceId: invoice.id,
		organizationId: invoice.organizationId,
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
		organizationId: receipt.organizationId,
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

/** ERP-0077: the customer's portal logins hear about an issued invoice. */
export function invoiceIssuedNotice(invoice: TInvoiceSelect): TCustomerNotice {
	return {
		customerId: invoice.customerId,
		templateCode: 'portal.invoice_issued',
		variables: { invoiceNumber: invoice.code ?? '', amount: rupiahLabel(invoice.grandTotal), dueDate: invoice.dueDate ?? '' },
		sourceType: 'invoice',
		sourceId: invoice.id,
		tags: invoice.code ? [invoice.code] : [],
	};
}

/** ERP-0077: … and about a payment recorded on it (staff receipt or online payment). */
export function paymentReceivedNotice(receipt: TReceiptSelect, invoice: TInvoiceSelect): TCustomerNotice {
	return {
		customerId: invoice.customerId,
		templateCode: 'portal.payment_received',
		variables: { invoiceNumber: invoice.code ?? '', amount: rupiahLabel(receipt.amount) },
		sourceType: 'invoice',
		sourceId: invoice.id,
		tags: invoice.code ? [invoice.code] : [],
	};
}
