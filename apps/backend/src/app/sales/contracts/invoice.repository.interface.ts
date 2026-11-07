import type { TInvoiceItemSelect, TInvoiceSelect } from '@drizzle/schemas/sales.schema';

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
