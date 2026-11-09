import type {
	TInvoiceItemSelect,
	TInvoiceSelect,
	TReceiptInsert,
	TReceiptSelect,
} from '@drizzle/schemas/sales.schema';
import type { TPaginationResult } from '@ims-erp/common';
import type { TReceiptListQuery } from './invoice.contract';

/** Server-computed totals for a draft invoice (client never sends them). */
export type TInvoiceTotals = {
	subtotal: number;
	discountTotal: number;
	taxTotal: number;
	grandTotal: number;
};

/** One invoice line as accepted from the client (draft only). */
export type TInvoiceItemInput = {
	itemId: string | null;
	description: string | null;
	quantity: number;
	unitPrice: number;
	discountAmount: number;
	taxAmount: number;
};

export type TCreateInvoiceInput = {
	invoiceType: 'sales' | 'proforma' | 'recurring';
	customerId: string | null;
	salesOrderId: string | null;
	paymentTermId: string | null;
	issueDate: string | null;
	dueDate: string | null;
	currencyCode: string;
	notes: string | null;
	items: TInvoiceItemInput[];
};

export type TUpdateInvoiceInput = {
	customerId?: string | null;
	paymentTermId?: string | null;
	issueDate?: string | null;
	dueDate?: string | null;
	notes?: string | null;
	items?: TInvoiceItemInput[];
};

/** Data access for `sales.invoices` / `sales.invoice_items` (F4). */
export type TInvoiceRepository = {
	findById(
		organizationId: string,
		id: string,
		tx?: unknown,
	): Promise<TInvoiceSelect | null>;
	findByCode(
		organizationId: string,
		code: string,
		tx?: unknown,
	): Promise<TInvoiceSelect | null>;
	list(
		organizationId: string,
		filters: { status?: string; customerId?: string },
		pagination: { page: number; limit: number },
	): Promise<{ data: TInvoiceSelect[]; meta: { page: number; limit: number; total: number; totalPages: number } }>;
	insert(
		row: Record<string, unknown>,
		tx?: unknown,
	): Promise<TInvoiceSelect>;
	update(
		organizationId: string,
		id: string,
		patch: Record<string, unknown>,
		tx?: unknown,
	): Promise<TInvoiceSelect | null>;
	listItems(
		organizationId: string,
		invoiceId: string,
		tx?: unknown,
	): Promise<TInvoiceItemSelect[]>;
	replaceItems(
		organizationId: string,
		invoiceId: string,
		rows: Array<Record<string, unknown>>,
		tx?: unknown,
	): Promise<TInvoiceItemSelect[]>;
	/** Every non-deleted invoice of a sales order, oldest first (includes void). */
	listByOrder(salesOrderId: string): Promise<TInvoiceSelect[]>;
	/** True when the order has any non-deleted invoice that is not void. */
	hasLiveInvoices(salesOrderId: string): Promise<boolean>;
	/** One live receipt of this organization by id. */
	findReceipt(organizationId: string, id: string): Promise<TReceiptSelect | null>;
	/** All live receipts of an invoice, oldest first. */
	listReceipts(
		organizationId: string,
		invoiceId: string,
	): Promise<TReceiptSelect[]>;
	/** Paginated receipts joined with their invoice code and customer name. */
	paginateReceipts(
		organizationId: string,
		request: TReceiptListQuery,
	): Promise<
		TPaginationResult<
			TReceiptSelect & { invoiceCode: string | null; customerName: string }
		>
	>;
	/**
	 * Records a receipt and updates the invoice's paid / outstanding / status
	 * in ONE transaction. The invoice must belong to the same organization as
	 * the receipt. Returns null when the invoice is not payable or the amount
	 * exceeds the outstanding total.
	 */
	addReceipt(data: TReceiptData): Promise<TReceiptSelect | null>;
	/**
	 * Reverses a posted receipt (status `posted` only) and restores the
	 * invoice's paid / outstanding / status in ONE transaction. Returns null
	 * when the receipt is missing, foreign, or already reversed.
	 */
	reverseReceipt(
		organizationId: string,
		id: string,
		actorUserId: string,
		reason: string,
	): Promise<TReceiptSelect | null>;
};

/** Receipt insert payload (status and audit stamps are server-computed). */
export type TReceiptData = Omit<
	TReceiptInsert,
	'id' | 'status' | 'createdAt' | 'updatedAt' | 'deletedAt'
> & {
	amount: number;
};

/** Computes totals from line inputs; pure, integer minor units (ADR-0002). */
export function computeInvoiceTotals(
	items: TInvoiceItemInput[],
): TInvoiceTotals {
	let subtotal = 0;
	let discountTotal = 0;
	let taxTotal = 0;
	for (const item of items) {
		const gross = item.quantity * item.unitPrice;
		subtotal += gross;
		discountTotal += item.discountAmount;
		taxTotal += item.taxAmount;
	}
	const grandTotal = subtotal - discountTotal + taxTotal;
	return { subtotal, discountTotal, taxTotal, grandTotal };
}
