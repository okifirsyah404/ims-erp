import { DRIZZLE_TOKEN } from '@di/provider';
import {
	pph21Brackets,
	pph21Ptkp,
	pph21TerRates,
	type TPph21BracketSelect,
	type TPph21PtkpSelect,
	type TPph21TerRateSelect,
} from '@drizzle/schemas/tax.schema';
import type { TTx } from '@drizzle/types';
import { and, asc, count, desc, eq, inArray, isNull, lte } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type { IPph21Repository, TTerRateRow, TTerVersion } from '../contracts/pph21.contract';

/**
 * Drizzle implementation of the PPh 21 statutory tables (ERP-0138).
 *
 * @remarks
 * Global reference data, so no tenant filter. A version is the row set
 * sharing one effective_from; the version in force on a date is the latest
 * one on or before it.
 */
@injectable()
export class Pph21Repository implements IPph21Repository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	private async latestFrom(
		table: typeof pph21Ptkp | typeof pph21TerRates | typeof pph21Brackets,
		date: string,
	): Promise<string | null> {
		const [row] = await this.database
			.select({ effectiveFrom: table.effectiveFrom })
			.from(table)
			.where(and(isNull(table.deletedAt), lte(table.effectiveFrom, date)))
			.orderBy(desc(table.effectiveFrom))
			.limit(1);
		return row?.effectiveFrom ?? null;
	}

	async listPtkpInForce(date: string): Promise<TPph21PtkpSelect[]> {
		const from = await this.latestFrom(pph21Ptkp, date);
		if (!from) return [];
		return this.database
			.select()
			.from(pph21Ptkp)
			.where(and(isNull(pph21Ptkp.deletedAt), eq(pph21Ptkp.effectiveFrom, from)))
			.orderBy(asc(pph21Ptkp.statusCode));
	}

	async listTerInForce(date: string): Promise<TPph21TerRateSelect[]> {
		const from = await this.latestFrom(pph21TerRates, date);
		if (!from) return [];
		return this.database
			.select()
			.from(pph21TerRates)
			.where(and(isNull(pph21TerRates.deletedAt), eq(pph21TerRates.effectiveFrom, from)))
			.orderBy(asc(pph21TerRates.category), asc(pph21TerRates.lowerBound));
	}

	async listBracketsInForce(date: string): Promise<TPph21BracketSelect[]> {
		const from = await this.latestFrom(pph21Brackets, date);
		if (!from) return [];
		return this.database
			.select()
			.from(pph21Brackets)
			.where(and(isNull(pph21Brackets.deletedAt), eq(pph21Brackets.effectiveFrom, from)))
			.orderBy(asc(pph21Brackets.lowerBound));
	}

	async listTerVersions(): Promise<TTerVersion[]> {
		const rows = await this.database
			.select({ effectiveFrom: pph21TerRates.effectiveFrom, rows: count() })
			.from(pph21TerRates)
			.where(isNull(pph21TerRates.deletedAt))
			.groupBy(pph21TerRates.effectiveFrom)
			.orderBy(desc(pph21TerRates.effectiveFrom));
		return rows.map((row) => ({ effectiveFrom: row.effectiveFrom, rows: Number(row.rows) }));
	}

	async replaceTerRates(rows: TTerRateRow[], tx?: TTx): Promise<void> {
		const db = tx ?? this.database;
		const now = new Date();
		const dates = [...new Set(rows.map((row) => row.effectiveFrom))];
		if (dates.length === 0) return;
		await db
			.update(pph21TerRates)
			.set({ deletedAt: now, updatedAt: now })
			.where(and(isNull(pph21TerRates.deletedAt), inArray(pph21TerRates.effectiveFrom, dates)));
		await db.insert(pph21TerRates).values(rows.map((row) => ({ ...row, createdAt: now, updatedAt: now })));
	}
}
