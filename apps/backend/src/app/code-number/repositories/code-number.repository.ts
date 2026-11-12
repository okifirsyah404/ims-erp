import { DRIZZLE_TOKEN } from '@di/provider';
import {
	type CodeType,
	codeNumberSeries,
	type TCodeNumberSeriesSelect,
} from '@drizzle/schemas/code-number.schema';
import type { TTx } from '@drizzle/types';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type {
	ICodeNumberRepository,
	TCodeNumberSettings,
} from '../contracts/code-number.repository.interface';

/**
 * Drizzle implementation of {@link ICodeNumberRepository}.
 *
 * @remarks
 * Every write targets the live row of a code type through the partial unique
 * index `series_code_type_uq` (`WHERE deleted_at IS NULL`), so `ON CONFLICT`
 * names the same predicate.
 */
@injectable()
export class CodeNumberRepository implements ICodeNumberRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	findAll(): Promise<TCodeNumberSeriesSelect[]> {
		return this.database
			.select()
			.from(codeNumberSeries)
			.where(isNull(codeNumberSeries.deletedAt));
	}

	async findByType(codeType: CodeType, tx?: TTx): Promise<TCodeNumberSeriesSelect | null> {
		const [row] = await (tx ?? this.database)
			.select()
			.from(codeNumberSeries)
			.where(and(eq(codeNumberSeries.codeType, codeType), isNull(codeNumberSeries.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	async allocate(module: string, codeType: CodeType, periodKey: string, tx?: TTx): Promise<number> {
		const now = new Date();
		// `next_number` holds the number the NEXT caller gets; the issued
		// number is therefore the stored value minus one after the update.
		const [row] = await (tx ?? this.database)
			.insert(codeNumberSeries)
			.values({ module, codeType, periodKey, nextNumber: 2, createdAt: now, updatedAt: now })
			.onConflictDoUpdate({
				target: codeNumberSeries.codeType,
				targetWhere: sql`deleted_at IS NULL`,
				set: {
					nextNumber: sql`CASE WHEN ${codeNumberSeries.periodKey} = ${periodKey}
						THEN ${codeNumberSeries.nextNumber} + 1 ELSE 2 END`,
					periodKey,
					updatedAt: now,
				},
			})
			.returning({ nextNumber: codeNumberSeries.nextNumber });
		return row.nextNumber - 1;
	}

	async saveSettings(settings: TCodeNumberSettings, periodKey: string): Promise<TCodeNumberSeriesSelect> {
		const now = new Date();
		const [row] = await this.database
			.insert(codeNumberSeries)
			.values({ ...settings, periodKey, nextNumber: 1, createdAt: now, updatedAt: now })
			.onConflictDoUpdate({
				target: codeNumberSeries.codeType,
				targetWhere: sql`deleted_at IS NULL`,
				set: {
					pattern: settings.pattern,
					resetPolicy: settings.resetPolicy,
					updatedBy: settings.updatedBy,
					updatedAt: now,
				},
			})
			.returning();
		return row;
	}
}
