import { DRIZZLE_TOKEN } from '@di/provider';
import type { TTx } from '@drizzle/types';
import {
	reportArchives,
	type TReportArchiveSelect,
	type ReportArchiveType,
} from '@drizzle/schemas/accounting.schema';
import type { TPaginationResult } from '@ims-erp/common';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { and, count, desc, eq, isNull } from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';

export type TReportArchiveInsertInput = {
	organizationId: string;
	periodYear: number;
	periodMonth: number;
	reportType: ReportArchiveType;
	payload: unknown;
	generatedBy: string | null;
	generatedAt: Date;
};

/**
 * Persistence for `accounting.report_archives` (M12 T30).
 *
 * @remarks
 * Only three operations exist on purpose: insert (idempotent on the scope
 * index), list, find. There is no update and no delete - an archive is a
 * frozen statement, and the append-only rule is enforced by having no code
 * path that could rewrite one.
 */
@injectable()
export class ReportArchiveRepository {
	constructor(
		@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase,
	) {}

	/**
	 * Inserts one archive row, ignoring a duplicate scope.
	 *
	 * @returns The stored row, or `null` when the scope already existed.
	 */
	async insert(
		input: TReportArchiveInsertInput,
		tx?: TTx,
	): Promise<TReportArchiveSelect | null> {
		const [row] = await (tx ?? this.database)
			.insert(reportArchives)
			.values({
				organizationId: input.organizationId,
				periodYear: input.periodYear,
				periodMonth: input.periodMonth,
				reportType: input.reportType,
				payload: input.payload,
				generatedBy: input.generatedBy,
				generatedAt: input.generatedAt,
				createdAt: input.generatedAt,
				updatedAt: input.generatedAt,
			})
			.onConflictDoNothing({
				target: [
					reportArchives.organizationId,
					reportArchives.periodYear,
					reportArchives.periodMonth,
					reportArchives.reportType,
				],
			})
			.returning();
		return row ?? null;
	}

	async list(
		organizationId: string,
		pagination: { page: number; limit: number },
		filter: { periodYear?: number; periodMonth?: number } = {},
	): Promise<TPaginationResult<TReportArchiveSelect>> {
		const conditions = [
			eq(reportArchives.organizationId, organizationId),
			isNull(reportArchives.deletedAt),
		];
		if (filter.periodYear != null) {
			conditions.push(eq(reportArchives.periodYear, filter.periodYear));
		}
		if (filter.periodMonth != null) {
			conditions.push(eq(reportArchives.periodMonth, filter.periodMonth));
		}
		const where = and(...conditions);

		const [rows, [total]] = await Promise.all([
			this.database
				.select()
				.from(reportArchives)
				.where(where)
				.orderBy(
					desc(reportArchives.periodYear),
					desc(reportArchives.periodMonth),
					desc(reportArchives.reportType),
				)
				.limit(pagination.limit)
				.offset((pagination.page - 1) * pagination.limit),
			this.database
				.select({ value: count() })
				.from(reportArchives)
				.where(where),
		]);

		return {
			data: rows,
			meta: {
				page: pagination.page,
				limit: pagination.limit,
				total: Number(total?.value ?? 0),
				totalPages: Math.max(
					1,
					Math.ceil(Number(total?.value ?? 0) / pagination.limit),
				),
			},
		};
	}

	async findById(
		organizationId: string,
		id: string,
	): Promise<TReportArchiveSelect | null> {
		const [row] = await this.database
			.select()
			.from(reportArchives)
			.where(
				and(
					eq(reportArchives.organizationId, organizationId),
					eq(reportArchives.id, id),
					isNull(reportArchives.deletedAt),
				),
			)
			.limit(1);
		return row ?? null;
	}
}
