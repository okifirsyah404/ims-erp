import { describe, expect, test } from 'bun:test';
import {
	computeTaxAmountMinor,
	parseRateScaled,
	periodStartDate,
	pickEffectiveRow,
	windowsOverlap,
} from '../../src/app/accounting/utils/tax-math';

describe('tax-math', () => {
	test('parses rates to scaled integers', () => {
		expect(parseRateScaled('11')).toBe(110000n);
		expect(parseRateScaled('2.5')).toBe(25000n);
		expect(parseRateScaled('0.0001')).toBe(1n);
		expect(() => parseRateScaled('-1')).toThrow(RangeError);
		expect(() => parseRateScaled('1.23456')).toThrow(RangeError);
	});

	test('rounds tax half-up to whole rupiah (100 minor units)', () => {
		// 11% of 1,000,000 IDR = 110,000 IDR exactly
		expect(computeTaxAmountMinor(100_000_000, '11')).toBe(11_000_000);
		// 11% of 1,000 IDR = 110 IDR (exact)
		expect(computeTaxAmountMinor(100_000, '11')).toBe(11_000);
		// 2% of 1,249.99 IDR = 24.9998 IDR -> 25 IDR (half-up at >= 50 cents)
		expect(computeTaxAmountMinor(124_999, '2')).toBe(2_500);
		// 2% of 1,224.74 IDR = 24.4948 IDR -> 24 IDR
		expect(computeTaxAmountMinor(122_474, '2')).toBe(2_400);
		// exact half: 2% of 1,225.00 IDR = 24.50 IDR -> 25 IDR (half-up)
		expect(computeTaxAmountMinor(122_500, '2')).toBe(2_500);
		expect(computeTaxAmountMinor(0, '11')).toBe(0);
	});

	test('rejects non-integer or negative bases', () => {
		expect(() => computeTaxAmountMinor(1.5, '11')).toThrow(RangeError);
		expect(() => computeTaxAmountMinor(-1, '11')).toThrow(RangeError);
	});

	test('period start date is zero-padded', () => {
		expect(periodStartDate(2026, 3)).toBe('2026-03-01');
	});

	test('picks the latest effective row covering the date', () => {
		const rows = [
			{ effectiveFrom: '2025-04-01', effectiveTo: '2026-03-31', rate: '11' },
			{ effectiveFrom: '2026-04-01', effectiveTo: null, rate: '12' },
		];
		expect(pickEffectiveRow(rows, '2026-03-31')?.rate).toBe('11');
		expect(pickEffectiveRow(rows, '2026-04-01')?.rate).toBe('12');
		expect(pickEffectiveRow(rows, '2024-01-01')).toBeUndefined();
	});

	test('detects overlapping windows, including open-ended ones', () => {
		const a = { effectiveFrom: '2026-01-01', effectiveTo: '2026-06-30' };
		expect(
			windowsOverlap(a, { effectiveFrom: '2026-06-30', effectiveTo: null }),
		).toBe(true);
		expect(
			windowsOverlap(a, { effectiveFrom: '2026-07-01', effectiveTo: null }),
		).toBe(false);
		expect(
			windowsOverlap(
				{ effectiveFrom: '2026-07-01', effectiveTo: null },
				{ effectiveFrom: '2030-01-01', effectiveTo: '2030-02-01' },
			),
		).toBe(true);
	});
});
