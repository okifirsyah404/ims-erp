import { describe, expect, test } from 'bun:test';
import { parseBulkInviteRows } from '../../src/lib/admin-api';
import { toE164 } from '../../src/lib/phone';

/**
 * Unit tests for the invite dialog's pure helpers: bulk row parsing (the
 * admin and organization column layouts) and phone normalization to E.164.
 */

const ORGS: Record<string, string> = { acme: 'org-acme', beta: 'org-beta' };
const resolve = (code: string) => ORGS[code] ?? null;

describe('parseBulkInviteRows — organization mode', () => {
	test('reads email, name, role and pins the organization', () => {
		const { rows, rowErrors, error } = parseBulkInviteRows(
			'jane@example.com, Jane Doe, admin\njohn@example.com',
			{ mode: 'org', organizationId: 'org-1', organizationRole: 'member' },
		);

		expect(error).toBeNull();
		expect(rowErrors).toEqual([]);
		expect(rows).toEqual([
			{
				email: 'jane@example.com',
				name: 'Jane Doe',
				organizationId: 'org-1',
				organizationRole: 'admin',
			},
			{
				email: 'john@example.com',
				// Bare-email rows default the name to the local part.
				name: 'john',
				organizationId: 'org-1',
				organizationRole: 'member',
			},
		]);
	});
});

describe('parseBulkInviteRows — admin mode', () => {
	test('reads the org-code column and resolves it', () => {
		const { rows, rowErrors } = parseBulkInviteRows(
			'jane@example.com, Jane Doe, acme, admin',
			{ mode: 'admin', resolveOrganizationCode: resolve },
		);

		expect(rowErrors).toEqual([]);
		expect(rows).toEqual([
			{
				email: 'jane@example.com',
				name: 'Jane Doe',
				organizationId: 'org-acme',
				organizationRole: 'admin',
			},
		]);
	});

	test('an empty org code means an application-level invite with no role', () => {
		const { rows, rowErrors } = parseBulkInviteRows(
			'jane@example.com, Jane Doe, , admin',
			{ mode: 'admin', resolveOrganizationCode: resolve },
		);

		expect(rowErrors).toEqual([]);
		expect(rows).toEqual([
			{
				email: 'jane@example.com',
				name: 'Jane Doe',
				organizationId: undefined,
				organizationRole: undefined,
			},
		]);
	});

	test('an unknown org code fails only that row', () => {
		const { rows, rowErrors } = parseBulkInviteRows(
			'jane@example.com, Jane, nope\njohn@example.com, John, beta',
			{ mode: 'admin', resolveOrganizationCode: resolve },
		);

		expect(rowErrors).toEqual(['Row 1: unknown organization code "nope"']);
		expect(rows).toHaveLength(1);
		expect(rows[0]?.email).toBe('john@example.com');
		expect(rows[0]?.organizationId).toBe('org-beta');
	});

	test('an invalid email fails only that row', () => {
		const { rows, rowErrors } = parseBulkInviteRows(
			'not-an-email\njohn@example.com, John',
			{ mode: 'admin', resolveOrganizationCode: resolve },
		);

		expect(rowErrors).toHaveLength(1);
		expect(rows).toHaveLength(1);
	});

	test('rejects an empty paste at the batch level', () => {
		const { rows, rowErrors, error } = parseBulkInviteRows('   \n  ', {
			mode: 'admin',
			resolveOrganizationCode: resolve,
		});

		expect(error).toBe('Paste at least one row');
		expect(rows).toEqual([]);
		expect(rowErrors).toEqual([]);
	});
});

describe('toE164', () => {
	test('normalizes a formatted national number', () => {
		expect(toE164('62', '812-3456-7890')).toBe('+6281234567890');
	});

	test('drops the trunk zero before the dial code', () => {
		expect(toE164('62', '08123456789')).toBe('+628123456789');
	});

	test('returns empty for an incomplete number', () => {
		expect(toE164('62', '')).toBe('');
		expect(toE164('62', '812')).toBe('');
	});

	test('returns empty for an impossibly long number', () => {
		expect(toE164('62', '0812345678901234567890')).toBe('');
	});
});
