import { z } from 'zod';

/**
 * Bank statement CSV parsing and matching (ERP-0143). Pure functions over
 * integer IDR minor units and `YYYY-MM-DD` business dates.
 */

const column = z.number().int().min(1).max(50);

/** How one bank lays out its CSV export; stored on the cash/bank account. */
export const statementMappingSchema = z
	.object({
		delimiter: z.enum([',', ';', '\t']).default(','),
		/** Header and preamble rows before the first line. */
		skipRows: z.number().int().min(0).max(30).default(1),
		dateColumn: column,
		/** `DD/MM` takes the year of the reconciliation date (BCA-style exports). */
		dateFormat: z.enum(['YYYY-MM-DD', 'DD/MM/YYYY', 'DD-MM-YYYY', 'DD/MM/YY', 'DD/MM']),
		descriptionColumn: column,
		referenceColumn: column.nullable().default(null),
		/** signed: one column, negative = out; split: debit (out) and credit (in) columns; indicator: amount + DB/CR column. */
		amountMode: z.enum(['signed', 'split', 'indicator']),
		amountColumn: column.nullable().default(null),
		debitColumn: column.nullable().default(null),
		creditColumn: column.nullable().default(null),
		indicatorColumn: column.nullable().default(null),
		creditIndicator: z.string().trim().min(1).max(10).default('CR'),
		decimalSeparator: z.enum([',', '.']).default(','),
	})
	.superRefine((mapping, ctx) => {
		const need = (key: keyof typeof mapping) => {
			if (mapping[key] === null) ctx.addIssue({ code: 'custom', path: [key], message: `${key} is required for ${mapping.amountMode}` });
		};
		if (mapping.amountMode === 'signed') need('amountColumn');
		if (mapping.amountMode === 'split') {
			need('debitColumn');
			need('creditColumn');
		}
		if (mapping.amountMode === 'indicator') {
			need('amountColumn');
			need('indicatorColumn');
		}
	});

export type TStatementMapping = z.output<typeof statementMappingSchema>;

export type TStatementLine = {
	row: number;
	date: string;
	description: string;
	reference: string | null;
	direction: 'in' | 'out';
	amount: number;
};

export type TStatementError = { row: number; code: string; value: string };

function split(line: string, delimiter: string): string[] {
	const out: string[] = [];
	let current = '';
	let quoted = false;
	for (const char of line) {
		if (char === '"') quoted = !quoted;
		else if (char === delimiter && !quoted) {
			out.push(current.trim());
			current = '';
		} else current += char;
	}
	out.push(current.trim());
	return out;
}

/** A statement amount in minor units, sign kept; `null` when unreadable. */
export function statementAmount(value: string, decimalSeparator: ',' | '.'): number | null {
	let text = value.replace(/rp|idr|\s|cr|db|dr/gi, '');
	const negative = /^-|^\(.*\)$|-$/.test(text);
	text = text.replace(/[()-]/g, '');
	text = decimalSeparator === ',' ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, '');
	if (!/^\d{1,13}(\.\d{1,2})?$/.test(text)) return null;
	const minor = Math.round(Number(text) * 100);
	return negative ? -minor : minor;
}

function isoDate(value: string, format: TStatementMapping['dateFormat'], year: number): string | null {
	const text = value.trim();
	let y: number;
	let m: number;
	let d: number;
	if (format === 'YYYY-MM-DD') {
		const match = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
		if (!match) return null;
		[y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
	} else {
		const match = /^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?/.exec(text);
		if (!match) return null;
		d = Number(match[1]);
		m = Number(match[2]);
		if (format === 'DD/MM') y = year;
		else if (!match[3]) return null;
		else y = match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3]);
	}
	const date = new Date(Date.UTC(y, m - 1, d));
	if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
	return date.toISOString().slice(0, 10);
}

/**
 * Parses a statement export with the account's mapping. Rows whose date cell
 * is not a date (balances, footers) are skipped silently; a row with a date
 * but an unreadable amount is an error.
 */
export function parseStatement(text: string, mapping: TStatementMapping, year: number): { lines: TStatementLine[]; errors: TStatementError[] } {
	const rows = text.replace(/^﻿/, '').split(/\r?\n/);
	const lines: TStatementLine[] = [];
	const errors: TStatementError[] = [];
	const cell = (cells: string[], index: number | null) => (index === null ? '' : (cells[index - 1] ?? ''));
	rows.forEach((raw, index) => {
		const row = index + 1;
		if (row <= mapping.skipRows || raw.trim() === '') return;
		const cells = split(raw, mapping.delimiter);
		const date = isoDate(cell(cells, mapping.dateColumn), mapping.dateFormat, year);
		if (!date) return;
		let signed: number | null = null;
		if (mapping.amountMode === 'signed') {
			signed = statementAmount(cell(cells, mapping.amountColumn), mapping.decimalSeparator);
		} else if (mapping.amountMode === 'split') {
			const debit = cell(cells, mapping.debitColumn);
			const credit = cell(cells, mapping.creditColumn);
			const out = debit === '' ? 0 : statementAmount(debit, mapping.decimalSeparator);
			const inn = credit === '' ? 0 : statementAmount(credit, mapping.decimalSeparator);
			signed = out === null || inn === null ? null : Math.abs(inn) - Math.abs(out);
		} else {
			const amount = statementAmount(cell(cells, mapping.amountColumn), mapping.decimalSeparator);
			const indicator = cell(cells, mapping.indicatorColumn).toUpperCase();
			signed = amount === null ? null : indicator.includes(mapping.creditIndicator.toUpperCase()) ? Math.abs(amount) : -Math.abs(amount);
		}
		if (signed === null || signed === 0) {
			errors.push({ row, code: 'amountInvalid', value: raw.slice(0, 80) });
			return;
		}
		const reference = cell(cells, mapping.referenceColumn).trim();
		lines.push({
			row,
			date,
			description: cell(cells, mapping.descriptionColumn).trim(),
			reference: reference === '' ? null : reference,
			direction: signed > 0 ? 'in' : 'out',
			amount: Math.abs(signed),
		});
	});
	return { lines, errors };
}

export type TMatchLine = { id: string; date: string; direction: 'in' | 'out'; amount: number; text: string };
export type TMatchCandidate = { id: string; date: string; direction: 'in' | 'out'; amount: number; references: string[] };

const dayDiff = (a: string, b: string) => Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000;

/**
 * Auto-match (grill decision): same direction and amount, value date within
 * +-3 days; a book reference (code or reference number, 4+ characters) found
 * in the statement text wins, then the nearest date. Two equally good
 * candidates without a reference leave the line for manual matching. Each
 * book transaction is used once.
 */
export function matchStatement(lines: TMatchLine[], candidates: TMatchCandidate[]): Array<{ lineId: string; transactionId: string }> {
	const used = new Set<string>();
	const result: Array<{ lineId: string; transactionId: string }> = [];
	for (const line of [...lines].sort((a, b) => a.date.localeCompare(b.date))) {
		const text = line.text.toUpperCase();
		const scored = candidates
			.filter((c) => !used.has(c.id) && c.direction === line.direction && c.amount === line.amount && dayDiff(c.date, line.date) <= 3)
			.map((c) => ({
				c,
				reference: c.references.some((ref) => ref.length >= 4 && text.includes(ref.toUpperCase())) ? 0 : 1,
				days: dayDiff(c.date, line.date),
			}))
			.sort((a, b) => a.reference - b.reference || a.days - b.days);
		const [best, second] = scored;
		if (!best) continue;
		if (second && best.reference === 1 && second.reference === 1 && second.days === best.days) continue;
		used.add(best.c.id);
		result.push({ lineId: line.id, transactionId: best.c.id });
	}
	return result;
}
