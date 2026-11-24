/**
 * Builds the business-event lines of an issued sales invoice (ERP-0135,
 * ADR-0030 posting map). Pure: no I/O, so the accounting rules are unit-tested.
 *
 * Rules:
 * - Down payment: Dr receivable / Cr customer advance (tax base) + Cr VAT output.
 * - Settlement: the order's earlier DP tax base is released, Dr customer
 *   advance, and recognised as revenue together with this invoice's base.
 * - Installment and plain invoices: revenue per line; a line with a service
 *   period goes to deferred revenue and gets an amortisation schedule.
 * - Revenue lines carry the product's category as the posting-rule
 *   discriminator, so a rule can send software and hardware to different
 *   revenue accounts. Lines without a product use the default rule.
 * - The invoice-level discount is allocated across lines pro rata to their
 *   tax base (largest remainder), so the credits always equal the invoice.
 */

export type TPostingInvoice = {
	id: string;
	termKind: string | null;
	customerId: string | null;
	subtotal: number;
	discountTotal: number;
	taxTotal: number;
	grandTotal: number;
};

export type TPostingInvoiceItem = {
	id: string;
	productId: string | null;
	lineTotal: number;
	taxAmount: number;
	servicePeriodStart: string | null;
	servicePeriodEnd: string | null;
};

export type TInvoicePostingLine = {
	role: string;
	discriminatorType?: string | null;
	discriminatorValue?: string | null;
	debit: number;
	credit: number;
	partyType?: string | null;
	partyId?: string | null;
	productId?: string | null;
};

export type TDeferredScheduleDraft = {
	invoiceItemId: string;
	amount: number;
	startDate: string;
	endDate: string;
	discriminatorType: string;
	discriminatorValue: string;
};

/** Splits `total` across `weights` exactly (largest remainder, ties to the first). */
export function allocateProRata(total: number, weights: readonly number[]): number[] {
	const sum = weights.reduce((acc, weight) => acc + weight, 0);
	if (weights.length === 0) return [];
	if (sum <= 0) return weights.map((_, index) => (index === 0 ? total : 0));
	const raw = weights.map((weight) => (total * weight) / sum);
	const floors = raw.map((value) => Math.floor(value));
	let remainder = total - floors.reduce((acc, value) => acc + value, 0);
	const order = raw
		.map((value, index) => ({ index, fraction: value - Math.floor(value) }))
		.sort((a, b) => b.fraction - a.fraction || a.index - b.index);
	for (const { index } of order) {
		if (remainder <= 0) break;
		floors[index] += 1;
		remainder -= 1;
	}
	return floors;
}

export function buildInvoicePosting(input: {
	invoice: TPostingInvoice;
	items: readonly TPostingInvoiceItem[];
	/** Product id -> product category id (null when uncategorised). */
	productCategoryById: ReadonlyMap<string, string | null>;
	/** Tax base of the order's earlier, still-live DP invoices (settlement only). */
	advanceBase: number;
}): { lines: TInvoicePostingLine[]; schedules: TDeferredScheduleDraft[] } {
	const { invoice, items } = input;
	const party = { partyType: 'customer', partyId: invoice.customerId };
	const base = invoice.subtotal - invoice.discountTotal;
	const debits: TInvoicePostingLine[] = [
		{ role: 'receivable', debit: invoice.grandTotal, credit: 0, ...party },
	];
	const credits = new Map<string, TInvoicePostingLine>();
	const schedules: TDeferredScheduleDraft[] = [];

	const addCredit = (line: Omit<TInvoicePostingLine, 'debit'>) => {
		if (line.credit <= 0) return;
		const key = [line.role, line.discriminatorType ?? '', line.discriminatorValue ?? '', line.productId ?? ''].join('|');
		const existing = credits.get(key);
		if (existing) existing.credit += line.credit;
		else credits.set(key, { ...line, debit: 0 });
	};

	if (invoice.termKind === 'down_payment') {
		addCredit({ role: 'customer_advance', credit: base, ...party });
	} else {
		const amounts = allocateProRata(
			base,
			items.map((item) => Math.max(0, item.lineTotal - item.taxAmount)),
		);
		items.forEach((item, index) => {
			const amount = amounts[index] ?? 0;
			if (amount <= 0) return;
			const categoryId = item.productId ? (input.productCategoryById.get(item.productId) ?? null) : null;
			const discriminatorType = categoryId ? 'product_category' : '';
			const discriminatorValue = categoryId ?? '';
			if (item.servicePeriodStart && item.servicePeriodEnd) {
				addCredit({ role: 'deferred_revenue', credit: amount, productId: item.productId });
				schedules.push({
					invoiceItemId: item.id,
					amount,
					startDate: item.servicePeriodStart,
					endDate: item.servicePeriodEnd,
					discriminatorType,
					discriminatorValue,
				});
			} else {
				addCredit({
					role: 'revenue',
					discriminatorType: discriminatorType || null,
					discriminatorValue: discriminatorValue || null,
					credit: amount,
					productId: item.productId,
				});
			}
		});
		if (invoice.termKind === 'settlement' && input.advanceBase > 0) {
			debits.push({ role: 'customer_advance', debit: input.advanceBase, credit: 0, ...party });
			addCredit({ role: 'revenue', credit: input.advanceBase });
		}
	}
	addCredit({ role: 'vat_output', credit: invoice.taxTotal });
	return { lines: [...debits, ...credits.values()], schedules };
}
