/**
 * Pure quotation money rules. Amounts are integer IDR minor units
 * (ADR-0002); products and VAT use BigInt and round half-up, so large totals
 * never lose precision.
 */
import { bpsShare, quantityTimesPrice } from '@ims-erp/common';

/** Default VAT rate: 11% effective (12% × DPP 11/12), owner decision 2026-10-31. */
export const DEFAULT_VAT_RATE_BPS = 1100;

export type TLineAmounts = {
	/** Up to three decimals, e.g. `"12.5"`. */
	quantity: string;
	unitPrice: number;
	discountAmount: number;
};

export type TQuotationTotals = {
	subtotal: number;
	discountTotal: number;
	/** Tax base (DPP) = subtotal − discounts. */
	taxBase: number;
	taxTotal: number;
	grandTotal: number;
};

/** round(quantity × unitPrice): the line before its discount. */
export function lineGross(line: Pick<TLineAmounts, 'quantity' | 'unitPrice'>): number {
	return quantityTimesPrice(line.quantity, line.unitPrice);
}

/** lineGross − discountAmount. */
export function lineTotal(line: TLineAmounts): number {
	return lineGross(line) - line.discountAmount;
}

export function computeTotals(
	lines: TLineAmounts[],
	vat: { enabled: boolean; rateBps: number },
): TQuotationTotals {
	const subtotal = lines.reduce((sum, line) => sum + lineGross(line), 0);
	const discountTotal = lines.reduce((sum, line) => sum + line.discountAmount, 0);
	const taxBase = subtotal - discountTotal;
	const taxTotal = vat.enabled ? bpsShare(taxBase, vat.rateBps) : 0;
	return { subtotal, discountTotal, taxBase, taxTotal, grandTotal: taxBase + taxTotal };
}
