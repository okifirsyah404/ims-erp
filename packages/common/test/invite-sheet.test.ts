import { describe, expect, test } from 'bun:test';
import * as XLSX from 'xlsx';
import {
	parseInviteCsv,
	parseInviteSheet,
	rowsToInviteSheet,
} from '../src/files/invite-sheet';

/** Pure unit tests for the shared bulk-invite spreadsheet parser. */

const goodCsv = [
	'email,name,role,organizationSlug',
	'Budi@Example.com ,Budi,member,org-1',
	'ani@example.com,Ani,',
].join('\n');

describe('rowsToInviteSheet', () => {
	test('normalizes email case and trims cells', () => {
		const result = rowsToInviteSheet([
			{ email: ' Budi@Example.com ', name: ' Budi ', role: 'MEMBER', organizationSlug: ' org-1 ' },
		]);
		expect(result.errors).toHaveLength(0);
		expect(result.rows[0]).toEqual({
			row: 2,
			email: 'budi@example.com',
			name: 'Budi',
			organizationSlug: 'org-1',
			role: 'member',
			employmentType: null,
		});
	});

	test('reads and validates the employmentType column', () => {
		const result = rowsToInviteSheet([
			{ email: 'a@b.co', name: 'A', employmentType: 'Contract' },
			{ email: 'c@d.co', name: 'C', employmentType: 'permanent' },
		]);
		expect(result.errors).toHaveLength(0);
		expect(result.rows.map((row) => row.employmentType)).toEqual([
			'contract',
			'permanent',
		]);
	});

	test('an unknown employmentType is a per-row error', () => {
		const result = rowsToInviteSheet([
			{ email: 'a@b.co', name: 'A', employmentType: 'freelance' },
			{ email: 'c@d.co', name: 'C', employmentType: 'contract' },
		]);
		expect(result.rows).toHaveLength(1);
		expect(result.errors[0]?.message).toContain('unknown employmentType');
	});

	test('per-row errors: missing email, bad email, missing name, bad role', () => {
		const result = rowsToInviteSheet([
			{ email: '', name: 'NoEmail' },
			{ email: 'not-an-email', name: 'BadEmail' },
			{ email: 'a@b.co', name: '' },
			{ email: 'c@d.co', name: 'BadRole', role: 'superadmin' },
		]);
		expect(result.rows).toHaveLength(0);
		expect(result.errors.map((e) => e.row)).toEqual([2, 3, 4, 5]);
	});

	test('roles come from the shared catalog: the removed app roles are rejected', () => {
		// `investor`/`customer` were organization roles before ADR-0018. The
		// parser used to keep a hand-copied list naming them, so a sheet using
		// them passed here and was rejected row-by-row by the API.
		const result = rowsToInviteSheet([
			{ email: 'a@b.co', name: 'A', role: 'investor' },
			{ email: 'c@d.co', name: 'C', role: 'customer' },
		]);
		expect(result.rows).toHaveLength(0);
		expect(result.errors).toHaveLength(2);
	});

	test('allowedRoles rejects a role the uploader may not assign', () => {
		const result = rowsToInviteSheet(
			[{ email: 'a@b.co', name: 'A', role: 'owner' }],
			{ allowedRoles: ['member', 'finance'] },
		);
		expect(result.rows).toHaveLength(0);
		expect(result.errors[0]?.message).toContain('role not allowed');
	});

	test('duplicate email in file is a per-row error', () => {
		const result = rowsToInviteSheet([
			{ email: 'a@b.co', name: 'A' },
			{ email: 'A@B.CO', name: 'Dup' },
		]);
		expect(result.rows).toHaveLength(1);
		expect(result.errors[0]).toMatchObject({ row: 3 });
		expect(result.errors[0]?.message).toContain('duplicate');
	});

	test('over max rows throws', () => {
		const many = Array.from({ length: 101 }, () => ({ email: 'a@b.co', name: 'A' }));
		expect(() => rowsToInviteSheet(many)).toThrow(/max 100/);
	});
});

describe('parseInviteCsv', () => {
	test('parses valid rows and skips empty lines', () => {
		const result = parseInviteCsv(new TextEncoder().encode(goodCsv));
		expect(result.errors).toHaveLength(0);
		expect(result.rows).toHaveLength(2);
		expect(result.rows[0]?.organizationSlug).toBe('org-1');
	});

	test('tolerates a BOM and semicolon delimiter', () => {
		const text = '\uFEFFemail;name\nbudi@example.com;Budi\n';
		const result = parseInviteCsv(new TextEncoder().encode(text));
		expect(result.rows[0]?.email).toBe('budi@example.com');
	});
});

describe('parseInviteSheet', () => {
	test('parses an xlsx buffer', () => {
		const sheet = XLSX.utils.aoa_to_sheet([
			['email', 'name', 'role'],
			['budi@example.com', 'Budi', 'member'],
			['', 'NoEmail', ''],
		]);
		const wb = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(wb, sheet, 'S');
		const bytes = new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer);
		const result = parseInviteSheet('invites.xlsx', bytes);
		expect(result.rows).toHaveLength(1);
		expect(result.errors[0]).toMatchObject({ row: 3, message: 'email is required' });
	});

	test('rejects unknown extensions', () => {
		expect(() => parseInviteSheet('invites.ods', new Uint8Array())).toThrow(/Unsupported file type/);
	});
});
