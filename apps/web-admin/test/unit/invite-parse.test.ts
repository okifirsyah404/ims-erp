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
				organizationRoles: ['admin'],
			},
			{
				email: 'john@example.com',
				// Bare-email rows default the name to the local part.
				name: 'john',
				organizationId: 'org-1',
				organizationRoles: ['member'],
			},
		]);
	});

	test('a pipe-separated role cell resolves to multiple roles', () => {
		const { rows, rowErrors } = parseBulkInviteRows(
			'jane@example.com, Jane Doe, admin|finance',
			{ mode: 'org', organizationId: 'org-1', organizationRole: 'member' },
		);

		expect(rowErrors).toEqual([]);
		expect(rows[0]?.organizationRoles).toEqual(['admin', 'finance']);
	});

	test('an unknown role fails only that row', () => {
		const { rows, rowErrors } = parseBulkInviteRows(
			'jane@example.com, Jane Doe, boss',
			{ mode: 'org', organizationId: 'org-1', organizationRole: 'member' },
		);

		expect(rowErrors).toEqual(['Row 1: unknown role "boss"']);
		expect(rows).toHaveLength(0);
	});

	test('a role the caller may not assign fails only that row', () => {
		const { rows, rowErrors } = parseBulkInviteRows(
			'jane@example.com, Jane Doe, owner\njohn@example.com, John, member',
			{
				mode: 'org',
				organizationId: 'org-1',
				organizationRole: 'member',
				allowedRoles: ['member', 'finance'],
			},
		);

		expect(rows).toHaveLength(1);
		expect(rows[0]?.email).toBe('john@example.com');
		expect(rowErrors[0]).toContain('role not allowed');
	});

	test('the default role is checked against the allowed set too', () => {
		// A row with no role falls back to the dialog default; if that default
		// is not assignable the row must not silently go out.
		const { rows, rowErrors } = parseBulkInviteRows('jane@example.com, Jane Doe', {
			mode: 'org',
			organizationId: 'org-1',
			organizationRole: 'admin',
			allowedRoles: ['member', 'finance'],
		});

		expect(rows).toHaveLength(0);
		expect(rowErrors[0]).toContain('role not allowed');
	});

	test('the employment type from the dialog is applied to every row', () => {
		const { rows } = parseBulkInviteRows('jane@example.com, Jane Doe', {
			mode: 'org',
			organizationId: 'org-1',
			organizationRole: 'member',
			employmentType: 'contract',
		});

		expect(rows[0]?.employmentType).toBe('contract');
	});

	test('an application-level row keeps the employment type too', () => {
		// The invite pipeline creates a company-level employee for these rows,
		// so the permanent/temporary choice still applies.
		const { rows } = parseBulkInviteRows('jane@example.com, Jane Doe, , member', {
			mode: 'admin',
			resolveOrganizationCode: resolve,
			employmentType: 'contract',
		});

		expect(rows[0]?.organizationId).toBeUndefined();
		expect(rows[0]?.employmentType).toBe('contract');
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
				organizationRoles: ['admin'],
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
				organizationRoles: undefined,
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
