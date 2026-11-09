/**
 * Moving-average stock valuation (ADR-0011 §5): inbound at cost, outbound at
 * the average, the last unit out takes the exact remainder, reversals undo
 * at the original cost, VAT-included purchase prices become ex-VAT costs.
 */
import { describe, expect, test } from 'bun:test';
import { applyMovementCost, exVatUnitCost, type TCostState } from '../../src/app/inventory/utils/moving-average';

const empty: TCostState = { quantity: '0', averageCost: 0, totalValue: 0 };
const next = (state: TCostState, delta: string, cost: ReturnType<typeof applyMovementCost>): TCostState => ({
	quantity: (Number(state.quantity) + Number(delta)).toFixed(3),
	averageCost: cost.averageCost,
	totalValue: cost.totalValue,
});

describe('moving average', () => {
	test('two receipts at different costs average by value', () => {
		const first = applyMovementCost(empty, { outbound: false, quantity: '10', unitCost: 1_000 });
		expect(first).toEqual({ unitCost: 1_000, averageCost: 1_000, totalValue: 10_000 });
		const second = applyMovementCost(next(empty, '10', first), { outbound: false, quantity: '5', unitCost: 1_300 });
		expect(second).toEqual({ unitCost: 1_300, averageCost: 1_100, totalValue: 16_500 });
	});

	test('issues leave at the average; the last unit takes exactly what is left', () => {
		let state: TCostState = { quantity: '3.000', averageCost: 333, totalValue: 1_000 };
		const one = applyMovementCost(state, { outbound: true, quantity: '1' });
		expect(one).toMatchObject({ unitCost: 333, totalValue: 667 });
		state = next(state, '-1', one);
		const two = applyMovementCost(state, { outbound: true, quantity: '1' });
		state = next(state, '-1', two);
		const last = applyMovementCost(state, { outbound: true, quantity: '1' });
		expect(last.totalValue).toBe(0);
		expect(one.totalValue - two.totalValue + two.totalValue - last.totalValue + (1_000 - one.totalValue)).toBe(1_000);
	});

	test('an inbound move without a cost takes the current average; fractional quantities round half-up', () => {
		const state: TCostState = { quantity: '4.000', averageCost: 2_500, totalValue: 10_000 };
		expect(applyMovementCost(state, { outbound: false, quantity: '1.5' })).toEqual({
			unitCost: 2_500,
			averageCost: 2_500,
			totalValue: 13_750,
		});
	});

	test('reversing a receipt at its own cost restores the earlier average', () => {
		const base: TCostState = { quantity: '10.000', averageCost: 1_000, totalValue: 10_000 };
		const received = applyMovementCost(base, { outbound: false, quantity: '10', unitCost: 2_000 });
		expect(received.averageCost).toBe(1_500);
		const reversed = applyMovementCost(next(base, '10', received), { outbound: true, quantity: '10', unitCost: 2_000 });
		expect(reversed).toMatchObject({ averageCost: 1_000, totalValue: 10_000 });
	});

	test('VAT-included purchase prices become ex-VAT costs', () => {
		expect(exVatUnitCost(111_000, true, 1_100)).toBe(100_000);
		expect(exVatUnitCost(111_000, false, 1_100)).toBe(111_000);
		expect(exVatUnitCost(190_000_000, true, 1_100)).toBe(171_171_171);
	});
});
