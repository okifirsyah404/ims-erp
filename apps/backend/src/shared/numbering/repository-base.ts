/**
 * Shared repository base for `<schema>.code_numberings`.
 *
 * @remarks
 * Not a module: no DI token, no schema of its own. Each module extends this with
 * its own table (rule "one repository per table") and allocates inside the same
 * transaction as the document insert. Extracted from
 * `code-number/repositories/code-number.repository.ts` when the shared
 * `code_number` schema was replaced per-schema (ADR-0024 Q6).
 */
import type { TTx } from '@drizzle/types';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';

import {
	type CodeType,
	type ResetPolicy,
	defaultPattern,
	defaultResetPolicy,
	periodKey as periodKeyOf,
	renderNumber,
	type TNumberContext,
} from './domain';
import type { createCodeNumberingTable } from './table';

/** Every `<schema>.code_numberings` table has this exact shape. */
type CodeNumberingTable = ReturnType<typeof createCodeNumberingTable>;

export type TCodeNumberSettings = {
	codeType: CodeType;
	pattern?: string | null;
	resetPolicy?: ResetPolicy | null;
	updatedBy?: string | null;
};

/**
 * Atomic counter allocation plus the settings read/write pair.
 *
 * @remarks
 * `next_number` holds the number the NEXT caller gets, so the issued sequence is
 * the stored value minus one after the update. The `ON CONFLICT` target names
 * the partial unique index (`WHERE deleted_at IS NULL`), so a soft-deleted row
 * never shadows the live one.
 */
export abstract class CodeNumberingRepositoryBase {
	protected abstract readonly table: CodeNumberingTable;

	constructor(protected readonly database: BunSQLDatabase) {}

	findAll(tx?: TTx) {
		return (tx ?? this.database)
			.select()
			.from(this.table)
			.where(isNull(this.table.deletedAt));
	}

	async findByType(codeType: CodeType, tx?: TTx) {
		const [row] = await (tx ?? this.database)
			.select()
			.from(this.table)
			.where(
				and(
					eq(this.table.codeType, codeType),
					isNull(this.table.deletedAt),
				),
			)
			.limit(1);
		return row ?? null;
	}

	/** Reserves the next sequence number for `codeType` in the current period. */
	async allocate(codeType: CodeType, key: string, tx?: TTx): Promise<number> {
		const now = new Date();
		const [row] = await (tx ?? this.database)
			.insert(this.table)
			.values({
				codeType,
				periodKey: key,
				nextNumber: 2,
				createdAt: now,
				updatedAt: now,
			})
			.onConflictDoUpdate({
				target: this.table.codeType,
				targetWhere: sql`deleted_at IS NULL`,
				set: {
					nextNumber: sql`CASE WHEN ${this.table.periodKey} = ${key}
						THEN ${this.table.nextNumber} + 1 ELSE 2 END`,
					periodKey: key,
					updatedAt: now,
				},
			})
			.returning({ nextNumber: this.table.nextNumber });
		return Number(row.nextNumber) - 1;
	}

	/**
	 * Allocates a number and renders it with the effective pattern.
	 *
	 * @param codeType - Code type to allocate
	 * @param companyCode - `{COMPANY}` token value from the company profile
	 * @param date - Business date the number belongs to
	 * @param tx - Transaction the allocation must join
	 * @param context - Values for the per-document tokens ({SUPPLIER}, ...)
	 */
	async next(
		codeType: CodeType,
		companyCode: string,
		date: Date,
		tx?: TTx,
		context?: TNumberContext,
	): Promise<string> {
		const row = await this.findByType(codeType, tx);
		const reset =
			(row?.resetPolicy as ResetPolicy | null) ??
			defaultResetPolicy(codeType);
		const pattern = row?.pattern ?? defaultPattern(codeType);
		const seq = await this.allocate(codeType, periodKeyOf(reset, date), tx);
		return renderNumber(pattern, {
			seq,
			typeCode: codeType,
			companyCode,
			date,
			context,
		});
	}

	async saveSettings(settings: TCodeNumberSettings, key: string, tx?: TTx) {
		const now = new Date();
		const [row] = await (tx ?? this.database)
			.insert(this.table)
			.values({
				codeType: settings.codeType,
				pattern: settings.pattern ?? null,
				resetPolicy: settings.resetPolicy ?? null,
				periodKey: key,
				nextNumber: 1,
				updatedBy: settings.updatedBy ?? null,
				createdAt: now,
				updatedAt: now,
			})
			.onConflictDoUpdate({
				target: this.table.codeType,
				targetWhere: sql`deleted_at IS NULL`,
				set: {
					pattern: settings.pattern ?? null,
					resetPolicy: settings.resetPolicy ?? null,
					updatedBy: settings.updatedBy ?? null,
					updatedAt: now,
				},
			})
			.returning();
		return row;
	}
}
