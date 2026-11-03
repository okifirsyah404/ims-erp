import { describe, expect, test } from 'bun:test';
import { humanizeIdentifier } from '../../src/lib/format';

describe('humanizeIdentifier', () => {
	test('converts snake_case to Title Case', () => {
		expect(humanizeIdentifier('customer_service')).toBe('Customer Service');
	});

	test('capitalizes single words', () => {
		expect(humanizeIdentifier('member')).toBe('Member');
	});

	test('converts kebab-case to Title Case', () => {
		expect(humanizeIdentifier('org-admin')).toBe('Org Admin');
	});

	test('handles multi-word snake_case', () => {
		expect(humanizeIdentifier('regional_manager_id')).toBe(
			'Regional Manager Id',
		);
	});

	test('collapses repeated separators and surrounding whitespace', () => {
		expect(humanizeIdentifier('  __weird--case__ ')).toBe('Weird Case');
	});

	test('passes already-humanized input through unchanged', () => {
		expect(humanizeIdentifier('Customer Service')).toBe('Customer Service');
	});

	test('falls back to a dash for empty, null and undefined', () => {
		expect(humanizeIdentifier('')).toBe('—');
		expect(humanizeIdentifier(null)).toBe('—');
		expect(humanizeIdentifier(undefined)).toBe('—');
	});
});
