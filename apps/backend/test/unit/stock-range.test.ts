import { describe, expect, test } from 'bun:test';

import { stockRangePredicate } from '../../src/app/product/utils/stock-range';

const totals = [
	{ productId: 'a', available: 5 },
	{ productId: 'b', available: 50 },
	{ productId: 'c', available: 500 },
];

describe('stockRangePredicate', () => {
	test('no bounds means no filter', () => {
		expect(stockRangePredicate(totals, undefined, undefined)).toBeNull();
	});

	test('a range that excludes 0 is a plain IN over the rows inside it', () => {
		expect(stockRangePredicate(totals, 10, 100)).toEqual({ mode: 'in', ids: ['b'] });
		expect(stockRangePredicate(totals, 1, undefined)).toEqual({ mode: 'in', ids: ['a', 'b', 'c'] });
	});

	test('a range that includes 0 keeps products without a stock row (NOT IN the rows outside)', () => {
		expect(stockRangePredicate(totals, undefined, 50)).toEqual({ mode: 'notIn', ids: ['c'] });
		expect(stockRangePredicate(totals, 0, 5)).toEqual({ mode: 'notIn', ids: ['b', 'c'] });
	});

	test('"out of stock" (0..0) excludes every product that has stock', () => {
		expect(stockRangePredicate(totals, 0, 0)).toEqual({ mode: 'notIn', ids: ['a', 'b', 'c'] });
	});

	test('a range nobody satisfies yields an empty IN', () => {
		expect(stockRangePredicate(totals, 1000, 2000)).toEqual({ mode: 'in', ids: [] });
	});
});
