/**
 * `{{placeholders}}` in purchase order payment terms, purchase terms and
 * notes (ERP-0165).
 *
 * @remarks
 * Shared by the backend, which refuses unknown placeholders when an order or a
 * term template is saved, and the web admin, which resolves them when the
 * order is printed. Values come from the order itself, which is frozen once
 * approved, so a print always says the same thing.
 *
 * Syntax: `{{name}}`, or `{{name:N}}` for the percentage placeholders, where
 * `N` is a percentage above 0 and at most 100 with up to two decimals
 * (`{{grand_total_pct:50}}`, `{{grand_total_rest:30}}`).
 */

/** Placeholders without an argument. */
export const PO_PLACEHOLDERS = [
	'po_number',
	'order_date',
	'expected_delivery_date',
	'subject',
	'supplier_name',
	'supplier_quote_ref',
	'supplier_quote_date',
	'project_name',
	'buyer_pic',
	'company_name',
	'subtotal',
	'tax_total',
	'grand_total',
	'vat_rate',
] as const;

/** Placeholders that take a percentage: `{{grand_total_pct:50}}`. */
export const PO_PERCENT_PLACEHOLDERS = ['grand_total_pct', 'grand_total_rest'] as const;

export type TPoPlaceholder = (typeof PO_PLACEHOLDERS)[number];
export type TPoPercentPlaceholder = (typeof PO_PERCENT_PLACEHOLDERS)[number];

/** What the placeholders resolve from. Money is integer IDR minor units; dates are `YYYY-MM-DD`. */
export type TPoPlaceholderValues = {
	code: string | null;
	orderDate: string | null;
	expectedDeliveryDate: string | null;
	subject: string | null;
	supplierName: string | null;
	supplierQuoteRef: string | null;
	supplierQuoteDate: string | null;
	projectName: string | null;
	buyerPicName: string | null;
	companyName: string | null;
	subtotal: number;
	taxTotal: number;
	grandTotal: number;
	vatRateBps: number;
};

/** Anything between `{{` and `}}`, so a misspelt name is reported instead of ignored. */
const TOKEN = /\{\{\s*([^{}:]*?)\s*(?::\s*([^{}]*?))?\s*\}\}/g;
const MONTHS = [
	'Januari',
	'Februari',
	'Maret',
	'April',
	'Mei',
	'Juni',
	'Juli',
	'Agustus',
	'September',
	'Oktober',
	'November',
	'Desember',
];

/** Shown for a placeholder whose value is not set on the order. */
const EMPTY = '-';

/** Basis points of a `N` argument (`50` → 5000, `12.5` → 1250), or `null` when it is not a valid percentage. */
function percentBps(argument: string | undefined): number | null {
	if (!argument || !/^\d{1,3}([.,]\d{1,2})?$/.test(argument)) return null;
	const bps = Math.round(Number(argument.replace(',', '.')) * 100);
	return bps > 0 && bps <= 10_000 ? bps : null;
}

function isPlain(name: string): name is TPoPlaceholder {
	return (PO_PLACEHOLDERS as readonly string[]).includes(name);
}

function isPercent(name: string): name is TPoPercentPlaceholder {
	return (PO_PERCENT_PLACEHOLDERS as readonly string[]).includes(name);
}

/**
 * Every placeholder in `text` that is unknown or malformed, as written
 * (`{{dp}}`, `{{grand_total_pct}}`, `{{grand_total_pct:150}}`), without
 * duplicates. Empty when the text is valid.
 */
export function findInvalidPoPlaceholders(text: string | null | undefined): string[] {
	if (!text) return [];
	const invalid = new Set<string>();
	for (const match of text.matchAll(TOKEN)) {
		const [whole, name, argument] = match as unknown as [string, string, string | undefined];
		const valid = isPlain(name) ? argument === undefined : isPercent(name) ? percentBps(argument) !== null : false;
		if (!valid) invalid.add(whole);
	}
	return [...invalid];
}

/** `Rp1.900.000` (Indonesian grouping, decimals only when there are cents). */
export function formatPoRupiah(minor: number): string {
	const digits = minor % 100 === 0 ? 0 : 2;
	return `Rp${new Intl.NumberFormat('id-ID', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(minor / 100)}`;
}

/** `2026-10-28` → `28 Oktober 2026`; `null` and malformed dates print as `-`. */
export function formatPoDate(value: string | null): string {
	const match = value ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null;
	if (!match) return EMPTY;
	const month = MONTHS[Number(match[2]) - 1];
	return month ? `${Number(match[3])} ${month} ${match[1]}` : EMPTY;
}

/** `pct` of the grand total, rounded to whole minor units. */
function share(grandTotal: number, bps: number): number {
	return Math.round((grandTotal * bps) / 10_000);
}

function plain(value: string | null): string {
	return value?.trim() ? value.trim() : EMPTY;
}

/**
 * Replaces every valid placeholder in `text` with its value. Invalid ones are
 * left as written, so a mistake is visible on the print instead of silently
 * disappearing.
 *
 * @remarks
 * `{{grand_total_rest:N}}` is the grand total minus `{{grand_total_pct:N}}`,
 * so a down payment and its settlement always add up to the total exactly.
 */
export function renderPoPlaceholders(source: string, values: TPoPlaceholderValues): string {
	return source.replace(TOKEN, (whole, name: string, argument: string | undefined) => {
		if (isPercent(name)) {
			const bps = percentBps(argument);
			if (bps === null) return whole;
			const part = share(values.grandTotal, bps);
			return formatPoRupiah(name === 'grand_total_pct' ? part : values.grandTotal - part);
		}
		if (!isPlain(name) || argument !== undefined) return whole;
		switch (name) {
			case 'po_number':
				return plain(values.code);
			case 'order_date':
				return formatPoDate(values.orderDate);
			case 'expected_delivery_date':
				return formatPoDate(values.expectedDeliveryDate);
			case 'subject':
				return plain(values.subject);
			case 'supplier_name':
				return plain(values.supplierName);
			case 'supplier_quote_ref':
				return plain(values.supplierQuoteRef);
			case 'supplier_quote_date':
				return formatPoDate(values.supplierQuoteDate);
			case 'project_name':
				return plain(values.projectName);
			case 'buyer_pic':
				return plain(values.buyerPicName);
			case 'company_name':
				return plain(values.companyName);
			case 'subtotal':
				return formatPoRupiah(values.subtotal);
			case 'tax_total':
				return formatPoRupiah(values.taxTotal);
			case 'grand_total':
				return formatPoRupiah(values.grandTotal);
			case 'vat_rate':
				return `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(values.vatRateBps / 100)}%`;
		}
	});
}
