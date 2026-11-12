import Papa from 'papaparse';
import * as XLSX from 'xlsx';

/**
 * Shared spreadsheet parsing for bulk invitations (app + org scope).
 *
 * @remarks
 * Runs on BOTH sides: web-admin parses the uploaded CSV/XLSX for an inline
 * preview and sends plain JSON to the existing bulk endpoint, and the
 * template generator reuses the same header contract. Kept in
 * `packages/common` so the two sides cannot drift.
 */

/** Header contract: `email` and `name` required; the rest optional. */
export const INVITE_SHEET_HEADERS = [
	'email',
	'name',
	'organizationSlug',
	'role',
] as const;

export type TInviteSheetRow = {
	row: number;
	email: string;
	name: string;
	organizationSlug: string | null;
	role: string | null;
};

export type TInviteSheetError = { row: number; message: string };

export type TInviteSheetParseResult = {
	rows: TInviteSheetRow[];
	errors: TInviteSheetError[];
};

/** Mirror of the closed ERP role enum in `erp-permissions.ts`. */
const ERP_ROLES = [
	'owner', 'admin', 'member', 'operations_manager', 'sales_manager',
	'sales', 'project_manager', 'technician', 'freelancer', 'purchasing',
	'warehouse', 'finance', 'accountant', 'hr', 'customer_service',
	'marketing', 'investor', 'customer', 'auditor',
] as const;

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
 * Validates and normalizes raw sheet records (header-keyed objects) into
 * invite rows. Structural problems (missing/blank header, size, count) throw;
 * per-row problems are collected in `errors` so the rest of the file still runs.
 */
export function rowsToInviteSheet(
	records: Record<string, unknown>[],
	options: { maxRows?: number } = {},
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
		if (role && !(ERP_ROLES as readonly string[]).includes(role)) {
			errors.push({ row, message: `unknown role: ${role}` });
			return;
		}
		const organizationSlug = normalize(headerKey(record, 'organizationSlug')) || null;
		seen.set(email, row);
		rows.push({ row, email, name, organizationSlug, role });
	});
	return { rows, errors };
}

/** Parses a CSV buffer (UTF-8, BOM tolerated, comma or semicolon delimiter). */
export function parseInviteCsv(buffer: Uint8Array): TInviteSheetParseResult {
	const text = new TextDecoder('utf-8').decode(buffer).replace(/^\uFEFF/, '');
	const parsed = Papa.parse<Record<string, unknown>>(text, {
		header: true,
		skipEmptyLines: 'greedy',
		transformHeader: (header) => header.trim().toLowerCase(),
	});
	if (parsed.errors.length > 0 && !parsed.data.length) {
		throw new Error(`Unparseable CSV: ${parsed.errors[0]?.message ?? 'unknown'}`);
	}
	return rowsToInviteSheet(parsed.data);
}

/** Parses the first worksheet of an XLSX buffer. */
export function parseInviteXlsx(buffer: Uint8Array): TInviteSheetParseResult {
	const workbook = XLSX.read(buffer, { type: 'array' });
	const sheetName = workbook.SheetNames[0];
	if (!sheetName) throw new Error('The file has no worksheets');
	const sheet = workbook.Sheets[sheetName];
	if (!sheet) throw new Error('The first worksheet is empty');
	const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(
		sheet,
		{ defval: '', raw: false },
	);
	return rowsToInviteSheet(records);
}

/** Dispatches on the file extension (csv / xlsx / xls). */
export function parseInviteSheet(fileName: string, buffer: Uint8Array): TInviteSheetParseResult {
	const extension = fileName.toLowerCase().split('.').pop() ?? '';
	if (extension === 'csv') return parseInviteCsv(buffer);
	if (extension === 'xlsx' || extension === 'xls') return parseInviteXlsx(buffer);
	throw new Error(`Unsupported file type: .${extension || fileName} (use .csv or .xlsx)`);
}
