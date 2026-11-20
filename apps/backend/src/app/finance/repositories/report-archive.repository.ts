import { DRIZZLE_TOKEN } from '@di/provider';
import type { TTx } from '@drizzle/types';
import {
	reportArchives,
	type TReportArchiveSelect,
	type ReportArchiveType,
} from '@drizzle/schemas/finance.schema';
import type { TPaginationRequest, TPaginationResult } from '@ims-erp/common';
import { paginationResult } from '@utils/pagination.util';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { and, count, desc, eq, isNull } from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';

/** Page settings, tenant and the optional period filters of the archive listing. */
export type TReportArchivePaginationRequest = TPaginationRequest & {
	organizationId: string;
	periodYear?: number;
	periodMonth?: number;
};

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

	/**
	 * Fetches one page of archived reports, newest period first.
	 *
	 * @param request - Tenant, page settings and the optional period filters
	 */
	async paginate(
		request: TReportArchivePaginationRequest,
	): Promise<TPaginationResult<TReportArchiveSelect>> {
		const { organizationId, periodYear, periodMonth, page, limit } = request;
		const conditions = [
			eq(reportArchives.organizationId, organizationId),
			isNull(reportArchives.deletedAt),
		];
		if (periodYear != null) {
			conditions.push(eq(reportArchives.periodYear, periodYear));
		}
		if (periodMonth != null) {
			conditions.push(eq(reportArchives.periodMonth, periodMonth));
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
				.limit(limit)
				.offset((page - 1) * limit),
			this.database
				.select({ value: count() })
				.from(reportArchives)
				.where(where),
		]);

		return paginationResult(request, Number(total?.value ?? 0), rows);
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
