import { DRIZZLE_TOKEN } from '@di/provider';
import type { TTx } from '@drizzle/types';
import {
	accountingPeriods,
	journalEntries,
	type TAccountingPeriodSelect,
} from '@drizzle/schemas/finance.schema';
import type { TPaginationResult } from '@ims-erp/common';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { and, asc, count, desc, eq, gte, isNull } from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';
import { paginationResult } from '@utils/pagination.util';
import type { IAccountingPeriodRepository, TPeriodPaginationRequest } from '../contracts/accounting-period.repository.interface';

/**
 * Drizzle queries of `accounting.accounting_periods`.
 *
 * @remarks
 * Tenant scoped, soft-delete aware. `periodHasPostedEntries` counts rows of
 * `journal_entries` because the question is "does this period still hold posted
 * rows", which the period row cannot answer.
 */
@injectable()
export class AccountingPeriodRepository implements IAccountingPeriodRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	async findPeriodByMonth(
		organizationId: string,
		year: number,
		month: number,
		tx?: TTx,
	): Promise<TAccountingPeriodSelect | null> {
		const db = tx ?? this.database;
		const [row] = await db
			.select()
			.from(accountingPeriods)
			.where(
				and(
					eq(accountingPeriods.organizationId, organizationId),
					eq(accountingPeriods.periodYear, year),
					eq(accountingPeriods.periodMonth, month),
					isNull(accountingPeriods.deletedAt),
				),
			)
			.limit(1);
		return row ?? null;
	}

	async findPeriodById(organizationId: string, id: string): Promise<TAccountingPeriodSelect | null> {
		const [row] = await this.database
			.select()
			.from(accountingPeriods)
			.where(
				and(
					eq(accountingPeriods.id, id),
					eq(accountingPeriods.organizationId, organizationId),
					isNull(accountingPeriods.deletedAt),
				),
			)
			.limit(1);
		return row ?? null;
	}

	/**
	 * Fetches one page of the tenant's accounting periods, newest first.
	 *
	 * @param request - Tenant and page settings
	 */
	async paginate(
		request: TPeriodPaginationRequest,
	): Promise<TPaginationResult<TAccountingPeriodSelect>> {
		const { organizationId, page, limit } = request;
		const where = and(
			eq(accountingPeriods.organizationId, organizationId),
			isNull(accountingPeriods.deletedAt),
		);
		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(accountingPeriods)
			.where(where);
		const data = await this.database
			.select()
			.from(accountingPeriods)
			.where(where)
			.orderBy(desc(accountingPeriods.periodYear), desc(accountingPeriods.periodMonth))
			.limit(limit)
			.offset((page - 1) * limit);
		return paginationResult(request, total, data);
	}

	async insertPeriod(
		row: {
			organizationId: string;
			code: string;
			periodYear: number;
			periodMonth: number;
			startDate: string;
			endDate: string;
			status: string;
		},
		tx?: TTx,
	): Promise<TAccountingPeriodSelect> {
		const db = tx ?? this.database;
		const now = new Date();
		const [created] = await db
			.insert(accountingPeriods)
			.values({ ...row, createdAt: now, updatedAt: now })
			.returning();
		return created;
	}

	async updatePeriodStatus(
		organizationId: string,
		id: string,
		patch: {
			status?: string;
			closedBy?: string | null;
			closedAt?: Date | null;
			reopenedBy?: string | null;
			reopenedAt?: Date | null;
		},
		tx?: TTx,
	): Promise<TAccountingPeriodSelect | null> {
		const db = tx ?? this.database;
		const [updated] = await db
			.update(accountingPeriods)
			.set({ ...patch, updatedAt: new Date() })
			.where(
				and(
					eq(accountingPeriods.id, id),
					eq(accountingPeriods.organizationId, organizationId),
					isNull(accountingPeriods.deletedAt),
				),
			)
			.returning();
		return updated ?? null;
	}

	async periodHasPostedEntries(organizationId: string, periodId: string): Promise<boolean> {
		const [row] = await this.database
			.select({ value: count() })
			.from(journalEntries)
			.where(
				and(
					eq(journalEntries.organizationId, organizationId),
					eq(journalEntries.accountingPeriodId, periodId),
					eq(journalEntries.status, 'posted'),
					isNull(journalEntries.deletedAt),
				),
			)
			.limit(1);
		return row.value > 0;
	}

	async findFirstOpenPeriodFrom(
		organizationId: string,
		date: string,
		tx?: TTx,
	): Promise<TAccountingPeriodSelect | null> {
		const db = tx ?? this.database;
		const [row] = await db
			.select()
			.from(accountingPeriods)
			.where(
				and(
					eq(accountingPeriods.organizationId, organizationId),
					eq(accountingPeriods.status, 'open'),
					gte(accountingPeriods.endDate, date),
					isNull(accountingPeriods.deletedAt),
				),
			)
			.orderBy(asc(accountingPeriods.startDate))
			.limit(1);
		return row ?? null;
	}
}
