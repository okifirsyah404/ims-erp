import { describe, expect, test } from 'bun:test';
import { hasInternalRole } from '../../src/lib/internal-role';

describe('hasInternalRole', () => {
	test('investor or customer are not organization roles, so never internal', () => {
		expect(hasInternalRole('investor')).toBe(false);
		expect(hasInternalRole('customer')).toBe(false);
	});

	test('any organization role is internal, including freelancer and the base member', () => {
		expect(hasInternalRole('sales')).toBe(true);
		expect(hasInternalRole('freelancer')).toBe(true);
		expect(hasInternalRole('member')).toBe(true);
	});

	test('roles removed in P7-4 are not internal', () => {
		expect(hasInternalRole('auditor')).toBe(false);
		expect(hasInternalRole('accountant')).toBe(false);
	});

	test('split per role, trimmed; one internal role is enough', () => {
		expect(hasInternalRole('sales, finance')).toBe(true);
		expect(hasInternalRole(' sales ')).toBe(true);
	});

	test('empty role string is not internal', () => {
		expect(hasInternalRole('')).toBe(false);
	});
});
