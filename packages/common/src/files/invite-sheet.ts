import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { erpRoleNames } from '../authorization/erp-permissions.js';
import {
	employmentTypeNames,
	isEmploymentTypeName,
} from '../hr/employment.js';

/**
 * Shared spreadsheet parsing for bulk invitations (app + org scope).
 *
 * @remarks
 * Runs on BOTH sides: web-admin parses the uploaded CSV/XLSX for an inline
 * preview and sends plain JSON to the existing bulk endpoint, and the
 * template generator reuses the same header contract. Kept in
 * `packages/common` so the two sides cannot drift.
 *
 * The role column validates against the same closed `erpRoleNames` catalog the
 * backend enforces. It used to carry a hand-copied list that still named the
 * removed app roles (`investor`, `customer`, ADR-0018), so a sheet using them
 * passed the client and was rejected row-by-row by the API.
 */

/** Header contract: `email` and `name` required; the rest optional. */
export const INVITE_SHEET_HEADERS = [
	'email',
	'name',
	'organizationSlug',
	'role',
	'employmentType',
] as const;

export type TInviteSheetRow = {
	row: number;
	email: string;
	name: string;
	organizationSlug: string | null;
	role: string | null;
	/** Employee employment type; `null` falls back to the dialog default. */
	employmentType: string | null;
};

export type TInviteSheetError = { row: number; message: string };

export type TInviteSheetParseResult = {
	rows: TInviteSheetRow[];
	errors: TInviteSheetError[];
};

export const MAX_INVITE_SHEET_ROWS = 100;
export const MAX_INVITE_SHEET_BYTES = 1024 * 1024;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalize(value: unknown): string {
	return typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();
}

/** Header keys are case-insensitive: `organizationCode` == `organizationcode`. */
function headerKey(record: Record<string, unknown>, name: string): unknown {
	const key = Object.keys(record).find(
		(k) => k.trim().toLowerCase() === name.toLowerCase(),
	);
	return key === undefined ? undefined : record[key];
}

/**
 * Options for {@link rowsToInviteSheet}.
 */
export type TInviteSheetParseOptions = {
	maxRows?: number;
	/**
	 * Roles the uploader may assign. Absent = the whole catalog. A role outside
	 * this list is a per-row error, matching the backend's own check (a
	 * non-owner may not invite an `owner`, an org admin may not invite `admin`,
	 * org HR may not invite `hr`).
	 */
	allowedRoles?: readonly string[];
};

/**
 * Validates and normalizes raw sheet records (header-keyed objects) into
 * invite rows. Structural problems (missing/blank header, size, count) throw;
 * per-row problems are collected in `errors` so the rest of the file still runs.
 */
export function rowsToInviteSheet(
	records: Record<string, unknown>[],
	options: TInviteSheetParseOptions = {},
): TInviteSheetParseResult {
	const maxRows = options.maxRows ?? MAX_INVITE_SHEET_ROWS;
	if (records.length > maxRows) {
		throw new Error(`Too many rows: ${records.length} (max ${maxRows})`);
	}
	const rows: TInviteSheetRow[] = [];
	const errors: TInviteSheetError[] = [];
	const seen = new Map<string, number>();
	// Data rows start at 2 (row 1 is the header).
	records.forEach((record, index) => {
		const row = index + 2;
		const email = normalize(headerKey(record, 'email')).toLowerCase();
		const name = normalize(headerKey(record, 'name'));
		if (!email) {
			errors.push({ row, message: 'email is required' });
			return;
		}
		if (!EMAIL_RE.test(email)) {
			errors.push({ row, message: `invalid email: ${email}` });
			return;
		}
		if (!name) {
			errors.push({ row, message: 'name is required' });
			return;
		}
		const duplicateAt = seen.get(email);
		if (duplicateAt !== undefined) {
			errors.push({ row, message: `duplicate email (also on row ${duplicateAt})` });
			return;
		}
		const role = normalize(headerKey(record, 'role')).toLowerCase() || null;
		if (role) {
			// Multi-role cells are pipe-separated ('admin|finance'); the comma
			// stays the CSV field separator (ERP-0041).
			const roles = role.split('|').map((r) => r.trim()).filter(Boolean);
			const unknown = roles.filter((r) => !(erpRoleNames as readonly string[]).includes(r));
			if (unknown.length > 0) {
				errors.push({ row, message: `unknown role: ${unknown.join(', ')}` });
				return;
			}
			const allowed = options.allowedRoles;
			if (allowed) {
				const forbidden = roles.filter((r) => !allowed.includes(r));
				if (forbidden.length > 0) {
					errors.push({
						row,
						message: `role not allowed for you: ${forbidden.join(', ')}`,
					});
					return;
				}
			}
		}
		const rawEmploymentType =
			normalize(headerKey(record, 'employmentType')).toLowerCase() || null;
		if (rawEmploymentType && !isEmploymentTypeName(rawEmploymentType)) {
			errors.push({
				row,
				message: `unknown employmentType: ${rawEmploymentType} (use ${employmentTypeNames.join(', ')})`,
			});
			return;
		}
		const organizationSlug = normalize(headerKey(record, 'organizationSlug')) || null;
		seen.set(email, row);
		rows.push({
			row,
			email,
			name,
			organizationSlug,
			role,
			employmentType: rawEmploymentType,
		});
	});
	return { rows, errors };
}

/** Parses a CSV buffer (UTF-8, BOM tolerated, comma or semicolon delimiter). */
export function parseInviteCsv(
	buffer: Uint8Array,
	options: TInviteSheetParseOptions = {},
): TInviteSheetParseResult {
	const text = new TextDecoder('utf-8').decode(buffer).replace(/^\uFEFF/, '');
	const parsed = Papa.parse<Record<string, unknown>>(text, {
		header: true,
		skipEmptyLines: 'greedy',
		transformHeader: (header) => header.trim().toLowerCase(),
	});
	if (parsed.errors.length > 0 && !parsed.data.length) {
		throw new Error(`Unparseable CSV: ${parsed.errors[0]?.message ?? 'unknown'}`);
	}
	return rowsToInviteSheet(parsed.data, options);
}

/** Parses the first worksheet of an XLSX buffer. */
export function parseInviteXlsx(
	buffer: Uint8Array,
	options: TInviteSheetParseOptions = {},
): TInviteSheetParseResult {
	const workbook = XLSX.read(buffer, { type: 'array' });
	const sheetName = workbook.SheetNames[0];
	if (!sheetName) throw new Error('The file has no worksheets');
	const sheet = workbook.Sheets[sheetName];
	if (!sheet) throw new Error('The first worksheet is empty');
	const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(
		sheet,
		{ defval: '', raw: false },
	);
	return rowsToInviteSheet(records, options);
}

/** Dispatches on the file extension (csv / xlsx / xls). */
export function parseInviteSheet(
	fileName: string,
	buffer: Uint8Array,
	options: TInviteSheetParseOptions = {},
): TInviteSheetParseResult {
	const extension = fileName.toLowerCase().split('.').pop() ?? '';
	if (extension === 'csv') return parseInviteCsv(buffer, options);
	if (extension === 'xlsx' || extension === 'xls') return parseInviteXlsx(buffer, options);
	throw new Error(`Unsupported file type: .${extension || fileName} (use .csv or .xlsx)`);
}
