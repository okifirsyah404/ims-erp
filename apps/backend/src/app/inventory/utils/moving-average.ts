/**
 * Moving-average stock valuation (ADR-0011 §5), pure.
 *
 * @remarks
 * Money is integer IDR minor units, quantities `numeric(18,3)` strings;
 * products and divisions use BigInt half-up. Inbound movements add their
 * value at the given cost (or, without one, at the current average);
 * outbound movements leave at the average, and the movement that empties a
 * balance takes exactly the remaining value, so `total_value` never drifts
 * away from zero stock.
 */
import { divHalfUpToNumber, quantityTimesPrice, quantityToMilli } from '@utils/money.util';

export type TCostState = {
	/** `quantity_on_hand` before the movement. */
	quantity: string;
	averageCost: number;
	totalValue: number;
};

export type TCostResult = {
	/** The cost the movement is valued at (stored on the ledger row). */
	unitCost: number;
	averageCost: number;
	totalValue: number;
};

const milli = (quantity: string) => {
	const text = quantity.trim();
	return text.startsWith('-') ? -quantityToMilli(text.slice(1)) : quantityToMilli(text);
};

/**
 * Applies one movement to a balance's cost.
 *
 * @param state - The balance before the movement
 * @param movement - Direction, positive quantity, and the inbound cost (if any)
 */
export function applyMovementCost(
	state: TCostState,
	movement: { outbound: boolean; quantity: string; unitCost?: number | null },
): TCostResult {
	const before = milli(state.quantity);
	const moved = milli(movement.quantity);

	if (!movement.outbound) {
		const unitCost = movement.unitCost ?? state.averageCost;
		const totalValue = state.totalValue + quantityTimesPrice(movement.quantity, unitCost);
		const after = before + moved;
		const averageCost = after > 0n ? divHalfUpToNumber(BigInt(totalValue) * 1000n, after) : state.averageCost;
		return { unitCost, averageCost, totalValue };
	}

	const unitCost = movement.unitCost ?? state.averageCost;
	const after = before - moved;
	// The movement that empties the balance takes exactly what is left.
	const out = after <= 0n ? state.totalValue : Math.min(state.totalValue, quantityTimesPrice(movement.quantity, unitCost));
	const totalValue = state.totalValue - out;
	const averageCost = after > 0n ? divHalfUpToNumber(BigInt(totalValue) * 1000n, after) : state.averageCost;
	return { unitCost, averageCost, totalValue };
}

/**
 * Ex-VAT unit cost from a purchase price: VAT-included prices are reduced by
 * `rate`, half-up; other prices are already ex-VAT.
 */
export function exVatUnitCost(unitPrice: number, vatIncluded: boolean, vatRateBps: number): number {
	if (!vatIncluded || vatRateBps === 0) return unitPrice;
	return divHalfUpToNumber(BigInt(unitPrice) * 10_000n, BigInt(10_000 + vatRateBps));
}
