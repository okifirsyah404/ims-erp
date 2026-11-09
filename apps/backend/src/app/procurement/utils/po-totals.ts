/**
 * Purchase order totals (pure). Integer IDR minor units (ADR-0002); products
 * and divisions use BigInt half-up.
 */
import { divHalfUp, quantityTimesPrice } from '@utils/money.util';
import type { PoVatMode } from '@drizzle/schemas/procurement.schema';

export const DEFAULT_PO_VAT_RATE_BPS = 1100;

export function poLineTotal(line: { quantity: string; unitPrice: number }): number {
	return quantityTimesPrice(line.quantity, line.unitPrice);
}

export type TPoTotals = {
	subtotal: number;
	/** VAT part: added on top (`added`) or contained in the total (`included`). */
	taxTotal: number;
	/** Tax base (DPP). */
	taxBase: number;
	grandTotal: number;
};

export function computePoTotals(lineTotals: number[], vatMode: PoVatMode, vatRateBps: number): TPoTotals {
	const subtotal = lineTotals.reduce((sum, value) => sum + BigInt(value), 0n);
	const rate = BigInt(vatRateBps);
	if (vatMode === 'none' || rate === 0n) {
		const value = Number(subtotal);
		return { subtotal: value, taxTotal: 0, taxBase: value, grandTotal: value };
	}
	if (vatMode === 'added') {
		const vat = divHalfUp(subtotal * rate, 10_000n);
		return { subtotal: Number(subtotal), taxTotal: Number(vat), taxBase: Number(subtotal), grandTotal: Number(subtotal + vat) };
	}
	// included: the subtotal already contains VAT.
	const taxBase = divHalfUp(subtotal * 10_000n, 10_000n + rate);
	return {
		subtotal: Number(subtotal),
		taxTotal: Number(subtotal - taxBase),
		taxBase: Number(taxBase),
		grandTotal: Number(subtotal),
	};
}
