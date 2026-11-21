import { describe, expect, test } from 'bun:test';

import {
	sanitizeQuantity,
	sliderStep,
	sliderValue,
	toDraft,
	toNumber,
} from '../../src/lib/item-filter-draft';

describe('drafts', () => {
	test('toDraft / toNumber round trip, empty is open-ended', () => {
		expect(toDraft(undefined)).toBe('');
		expect(toDraft(0)).toBe('0');
		expect(toNumber('')).toBeUndefined();
		expect(toNumber('.')).toBeUndefined();
		expect(toNumber('0')).toBe(0);
		expect(toNumber('12.5')).toBe(12.5);
		expect(toNumber('-3')).toBeUndefined();
	});

	test('sanitizeQuantity keeps digits and one decimal separator, three decimals max', () => {
		expect(sanitizeQuantity('abc')).toBe('');
		expect(sanitizeQuantity('007')).toBe('7');
		expect(sanitizeQuantity('12,5')).toBe('12.5');
		expect(sanitizeQuantity('1.2345')).toBe('1.234');
		expect(sanitizeQuantity('1.2.3')).toBe('1.23');
		expect(sanitizeQuantity(',5')).toBe('0.5');
	});
});

describe('slider helpers', () => {
	test('sliderStep gives about a hundred stops and never below 1', () => {
		expect(sliderStep(0)).toBe(1);
		expect(sliderStep(100)).toBe(1);
		expect(sliderStep(5000)).toBe(100);
		expect(sliderStep(50_000_000)).toBe(1_000_000);
	});

	test('sliderValue puts empty sides on the bounds and clamps', () => {
		expect(sliderValue('', '', 1000)).toEqual([0, 1000]);
		expect(sliderValue('200', '', 1000)).toEqual([200, 1000]);
		expect(sliderValue('', '300', 1000)).toEqual([0, 300]);
		expect(sliderValue('5000', '9000', 1000)).toEqual([1000, 1000]);
		expect(sliderValue('900', '100', 1000)).toEqual([100, 900]);
	});

	test('a zero bound still yields a valid pair', () => {
		expect(sliderValue('', '', 0)).toEqual([0, 1]);
	});
});
