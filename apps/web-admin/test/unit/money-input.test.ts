import { describe, expect, test } from 'bun:test';

import { formatMoneyDisplay, sanitizeMoney } from '../../src/lib/money-input';

describe('sanitizeMoney', () => {
	test('empty and junk become empty', () => {
		expect(sanitizeMoney('')).toBe('');
		expect(sanitizeMoney('abc')).toBe('');
		expect(sanitizeMoney('Rp ')).toBe('');
	});

	test('digits pass through; leading zeros are dropped', () => {
		expect(sanitizeMoney('1500000')).toBe('1500000');
		expect(sanitizeMoney('0012')).toBe('12');
		expect(sanitizeMoney('0')).toBe('0');
		expect(sanitizeMoney('000')).toBe('0');
	});

	test('display format reads back to the canonical value', () => {
		expect(sanitizeMoney('1.500.000')).toBe('1500000');
		expect(sanitizeMoney('1.500.000,5')).toBe('1500000.5');
		expect(sanitizeMoney('1.500.000,55')).toBe('1500000.55');
	});

	test('decimals are capped at two and a typed comma is kept', () => {
		expect(sanitizeMoney('12,345')).toBe('12.34');
		expect(sanitizeMoney('12,')).toBe('12.');
		expect(sanitizeMoney(',5')).toBe('0.5');
	});

	test('a pasted canonical value keeps its decimal point', () => {
		expect(sanitizeMoney('1500000.5')).toBe('1500000.5');
		expect(sanitizeMoney('12.34')).toBe('12.34');
	});

	test('a dot group is grouping, not a decimal point', () => {
		expect(sanitizeMoney('1.500')).toBe('1500');
		expect(sanitizeMoney('12.345.678')).toBe('12345678');
	});

	test('currency prefix and spaces are ignored', () => {
		expect(sanitizeMoney('Rp 1.234,50')).toBe('1234.50');
		expect(sanitizeMoney('rp1.000')).toBe('1000');
	});

	test('minus only when allowed', () => {
		expect(sanitizeMoney('-5')).toBe('5');
		expect(sanitizeMoney('-5', true)).toBe('-5');
		expect(sanitizeMoney('-', true)).toBe('');
	});
});

describe('formatMoneyDisplay', () => {
	test('groups thousands and uses a decimal comma', () => {
		expect(formatMoneyDisplay('')).toBe('');
		expect(formatMoneyDisplay('0')).toBe('0');
		expect(formatMoneyDisplay('999')).toBe('999');
		expect(formatMoneyDisplay('1000')).toBe('1.000');
		expect(formatMoneyDisplay('1500000.5')).toBe('1.500.000,5');
		expect(formatMoneyDisplay('12.')).toBe('12,');
		expect(formatMoneyDisplay('-1234')).toBe('-1.234');
	});

	test('round-trips through sanitizeMoney', () => {
		for (const value of ['0', '7', '1000', '1500000.5', '1234567.89', '12.']) {
			expect(sanitizeMoney(formatMoneyDisplay(value))).toBe(value);
		}
	});
});
