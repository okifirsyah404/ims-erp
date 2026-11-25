import { TER_CATEGORIES, type TTerCategory } from '@drizzle/schemas/tax.schema';
import { type ITransactionRunner, TRANSACTION_RUNNER_TOKEN } from '@providers/database/transaction-runner';
import { inject, injectable } from 'tsyringe';
import { PPH21_REPOSITORY_TOKEN } from '../constants/di';
import type {
	IPph21Repository,
	TTerImportError,
	TTerImportResult,
	TTerRateRow,
	TTerVersion,
} from '../contracts/pph21.contract';
import { TerImportFileError } from '../errors/tax.errors';
import type { TPph21Tables } from '../utils/pph21';

/** At most 1 MB and 2,000 rows: the official table has a few hundred. */
const MAX_BYTES = 1024 * 1024;
const MAX_ROWS = 2000;

/** Header and an illustrative first row of the TER import (amounts in rupiah). */
export const TER_TEMPLATE = 'kategori,penghasilan_bruto_dari,tarif_persen,berlaku_mulai\nA,0,0,2024-01-01\n';

/** `5.400.001` / `5,400,001` / `Rp 5400001` → minor units; whole rupiah only. */
function rupiahBound(value: string): number | null {
	const digits = value.replace(/rp/gi, '').replace(/[\s.,]/g, '');
	if (!/^\d{1,15}$/.test(digits)) return null;
	return Number(digits) * 100;
}

/** `0,25` / `0.25` / `0.25%` → `'0.2500'`; at most four decimals, 0..100. */
function percent(value: string): string | null {
	const normalized = value.replace('%', '').trim().replace(',', '.');
	if (!/^\d{1,3}(\.\d{1,4})?$/.test(normalized)) return null;
	const [whole = '0', fraction = ''] = normalized.split('.');
	if (Number(whole) > 100 || (Number(whole) === 100 && Number(fraction || '0') > 0)) return null;
	return `${Number(whole)}.${fraction.padEnd(4, '0')}`;
}

function isDate(value: string): boolean {
	return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

/**
 * Splits one CSV line on `,` (or `;` when the line has no unquoted comma).
 * Double quotes group a cell, so `"0,25"` stays one Indonesian decimal.
 */
function cells(line: string): string[] {
	const split = (separator: string) => {
		const out: string[] = [];
		let current = '';
		let quoted = false;
		for (const char of line) {
			if (char === '"') quoted = !quoted;
			else if (char === separator && !quoted) {
				out.push(current.trim());
				current = '';
			} else current += char;
		}
		out.push(current.trim());
		return out;
	};
	const byComma = split(',');
	return byComma.length === 1 ? split(';') : byComma;
}

/**
 * PPh 21 statutory tables (ERP-0138, owner proposal 4 of 2026-11-25).
 *
 * @remarks
 * PTKP and Pasal 17 rows are seeded; TER rows are never invented: finance
 * imports the official PP 58/2023 table as CSV. An import is all or nothing;
 * it replaces the rows of each effective date it carries, and every category
 * it carries must start at 0 so a lookup always finds a band.
 */
@injectable()
export class Pph21TableService {
	constructor(
		@inject(PPH21_REPOSITORY_TOKEN) private readonly repository: IPph21Repository,
		@inject(TRANSACTION_RUNNER_TOKEN) private readonly transactions: ITransactionRunner,
	) {}

	async tables(date: string): Promise<TPph21Tables> {
		const [ptkp, ter, brackets] = await Promise.all([
			this.repository.listPtkpInForce(date),
			this.repository.listTerInForce(date),
			this.repository.listBracketsInForce(date),
		]);
		return {
			ptkp: ptkp.map((row) => ({ statusCode: row.statusCode, annualAmount: row.annualAmount, terCategory: row.terCategory })),
			ptkpEffectiveFrom: ptkp[0]?.effectiveFrom ?? null,
			ter: ter.map((row) => ({ category: row.category, lowerBound: row.lowerBound, rate: row.rate })),
			terEffectiveFrom: ter[0]?.effectiveFrom ?? null,
			brackets: brackets.map((row) => ({ lowerBound: row.lowerBound, rate: row.rate })),
			bracketsEffectiveFrom: brackets[0]?.effectiveFrom ?? null,
		};
	}

	terVersions(): Promise<TTerVersion[]> {
		return this.repository.listTerVersions();
	}

	template(): string {
		return TER_TEMPLATE;
	}

	async importTer(file: unknown): Promise<TTerImportResult> {
		if (!(file instanceof File) || !file.name.toLowerCase().endsWith('.csv')) throw new TerImportFileError('type');
		if (file.size === 0) throw new TerImportFileError('empty');
		if (file.size > MAX_BYTES) throw new TerImportFileError('size');
		const lines = (await file.text())
			.replace(/^﻿/, '')
			.split(/\r?\n/)
			.map((line, index) => ({ row: index + 1, line: line.trim() }))
			.filter(({ line }) => line !== '');
		// A header is any first line whose amount column is not a number.
		if (lines[0] && rupiahBound(cells(lines[0].line)[1] ?? '') === null) lines.shift();
		if (lines.length === 0) throw new TerImportFileError('empty');
		if (lines.length > MAX_ROWS) throw new TerImportFileError('tooMany');

		const errors: TTerImportError[] = [];
		const rows: TTerRateRow[] = [];
		const seen = new Set<string>();
		for (const { row, line } of lines) {
			const [category = '', bound = '', rate = '', effectiveFrom = ''] = cells(line);
			const upper = category.toUpperCase();
			const lowerBound = rupiahBound(bound);
			const parsedRate = percent(rate);
			if (!(TER_CATEGORIES as readonly string[]).includes(upper)) errors.push({ row, code: 'terCategoryInvalid', value: category });
			if (lowerBound === null) errors.push({ row, code: 'amountInvalid', value: bound });
			if (parsedRate === null) errors.push({ row, code: 'rateInvalid', value: rate });
			if (!isDate(effectiveFrom)) errors.push({ row, code: 'dateInvalid', value: effectiveFrom });
			if (lowerBound === null || parsedRate === null || !isDate(effectiveFrom)) continue;
			if (!(TER_CATEGORIES as readonly string[]).includes(upper)) continue;
			const key = `${upper}|${lowerBound}|${effectiveFrom}`;
			if (seen.has(key)) errors.push({ row, code: 'duplicate', value: `${upper} ${bound}` });
			seen.add(key);
			rows.push({ category: upper as TTerCategory, lowerBound, rate: parsedRate, effectiveFrom });
		}
		const groups = new Set(rows.map((row) => `${row.category}|${row.effectiveFrom}`));
		for (const group of groups) {
			const [category, effectiveFrom] = group.split('|');
			if (!rows.some((row) => row.category === category && row.effectiveFrom === effectiveFrom && row.lowerBound === 0)) {
				errors.push({ row: 0, code: 'terStartMissing', value: `${category} ${effectiveFrom}` });
			}
		}
		const effectiveFromDates = [...new Set(rows.map((row) => row.effectiveFrom))].sort();
		if (errors.length > 0) return { imported: 0, effectiveFrom: effectiveFromDates, errors };
		await this.transactions.run((tx) => this.repository.replaceTerRates(rows, tx));
		return { imported: rows.length, effectiveFrom: effectiveFromDates, errors: [] };
	}
}
