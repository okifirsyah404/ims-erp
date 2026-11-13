import { describe, expect, test } from 'bun:test';
import { hasInternalRole } from '../../src/lib/internal-role';

describe('hasInternalRole', () => {
	test('investor or customer alone is not internal', () => {
		expect(hasInternalRole('investor')).toBe(false);
		expect(hasInternalRole('customer')).toBe(false);
		expect(hasInternalRole('investor,customer')).toBe(false);
	});

	test('any other role is internal, including freelancer and auditor', () => {
		expect(hasInternalRole('sales')).toBe(true);
		expect(hasInternalRole('freelancer')).toBe(true);
		expect(hasInternalRole('auditor')).toBe(true);
	});

	test('investor plus an internal role is internal (split per role, trimmed)', () => {
		expect(hasInternalRole('investor, sales')).toBe(true);
	});

	test('empty role string is not internal', () => {
		expect(hasInternalRole('')).toBe(false);
	});
});
