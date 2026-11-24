import { DRIZZLE_TOKEN } from '@di/provider';
import type { TTx } from '@drizzle/types';
import {
	journalEntries,
	journalLines,
	LEDGER_JOURNAL_STATUSES,
	UNPOSTED_JOURNAL_STATUSES,
	type TJournalEntrySelect,
	type TJournalLineSelect,
} from '@drizzle/schemas/finance.schema';
import type { TPaginationResult } from '@ims-erp/common';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { and, asc, count, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';
import { paginationResult } from '@utils/pagination.util';
import type {
	IJournalRepository,
	TAccountActivity,
	TJournalEntryInsertRow,
	TJournalEntryPatch,
	TJournalLineInsertRow,
	TLedgerLine,
	TJournalEntryPaginationRequest,
} from '../contracts/journal.repository.interface';

/**
 * Drizzle queries of `accounting.journal_entries` and `accounting.journal_lines`.
 *
 * @remarks
 * One repository for the header/lines aggregate: a line never exists without
 * its entry, and the report queries join the two. Tenant scoped, soft-delete
 * aware, optional caller transaction.
 */
@injectable()
export class JournalRepository implements IJournalRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	async findEntryById(
		organizationId: string,
		id: string,
		tx?: TTx,
	): Promise<TJournalEntrySelect | null> {
		const db = tx ?? this.database;
		const [row] = await db
			.select()
			.from(journalEntries)
			.where(
				and(
					eq(journalEntries.id, id),
					eq(journalEntries.organizationId, organizationId),
					isNull(journalEntries.deletedAt),
				),
			)
			.limit(1);
		return row ?? null;
	}

	async findPostedEntryByIdempotencyKey(
		organizationId: string,
		idempotencyKey: string,
		tx?: TTx,
	): Promise<TJournalEntrySelect | null> {
		const db = tx ?? this.database;
		const [row] = await db
			.select()
			.from(journalEntries)
			.where(
				and(
					eq(journalEntries.organizationId, organizationId),
					eq(journalEntries.idempotencyKey, idempotencyKey),
					isNull(journalEntries.deletedAt),
				),
			)
			.limit(1);
		return row ?? null;
	}

	async findEntryBySource(
		organizationId: string,
		sourceType: string,
		sourceId: string,
		tx?: TTx,
	): Promise<TJournalEntrySelect | null> {
		const db = tx ?? this.database;
		const [row] = await db
			.select()
			.from(journalEntries)
			.where(
				and(
					eq(journalEntries.organizationId, organizationId),
					eq(journalEntries.sourceType, sourceType),
					eq(journalEntries.sourceId, sourceId),
					isNull(journalEntries.deletedAt),
				),
			)
			.orderBy(desc(journalEntries.createdAt))
			.limit(1);
		return row ?? null;
	}

	/**
	 * Fetches one page of the tenant's journal entries, newest first.
	 *
	 * @param request - Tenant, page settings and the optional period/status filters
	 */
	async paginateEntries(
		request: TJournalEntryPaginationRequest,
	): Promise<TPaginationResult<TJournalEntrySelect>> {
		const { organizationId, year, month, status, page, limit } = request;
		const conditions = [
			eq(journalEntries.organizationId, organizationId),
			isNull(journalEntries.deletedAt),
		];
		if (year && month) {
			const start = `${year}-${String(month).padStart(2, '0')}-01`;
			const endDate = new Date(Date.UTC(year, month, 0))
				.toISOString()
				.slice(0, 10);
			conditions.push(sql`${journalEntries.entryDate} >= ${start}`);
			conditions.push(sql`${journalEntries.entryDate} <= ${endDate}`);
		}
		if (status) {
			conditions.push(eq(journalEntries.status, status));
		}
		const where = and(...conditions);
		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(journalEntries)
			.where(where);
		const data = await this.database
			.select()
			.from(journalEntries)
			.where(where)
			.orderBy(desc(journalEntries.entryDate), desc(journalEntries.createdAt))
			.limit(limit)
			.offset((page - 1) * limit);
		return paginationResult(request, total, data);
	}

	async insertEntry(
		row: TJournalEntryInsertRow,
		tx?: TTx,
	): Promise<TJournalEntrySelect> {
		const db = tx ?? this.database;
		const now = new Date();
		const [created] = await db
			.insert(journalEntries)
			.values({
				...row,
				preparedBy: row.preparedBy ?? row.postedBy,
				createdAt: now,
				updatedAt: now,
			})
			.returning();
		return created;
	}

	async insertLines(
		rows: TJournalLineInsertRow[],
		tx?: TTx,
	): Promise<TJournalLineSelect[]> {
		const db = tx ?? this.database;
		const now = new Date();
		return db
			.insert(journalLines)
			.values(rows.map((row) => ({ ...row, createdAt: now, updatedAt: now })))
			.returning();
	}

	async findLinesByEntryId(
		organizationId: string,
		entryId: string,
		tx?: TTx,
	): Promise<TJournalLineSelect[]> {
		const db = tx ?? this.database;
		return db
			.select()
			.from(journalLines)
			.where(
				and(
					eq(journalLines.journalEntryId, entryId),
					eq(journalLines.organizationId, organizationId),
					isNull(journalLines.deletedAt),
				),
			)
			.orderBy(asc(journalLines.lineNo));
	}

	async stampPostedBy(
		organizationId: string,
		entryId: string,
		postedBy: string,
		tx?: TTx,
	): Promise<void> {
		const db = tx ?? this.database;
		await db
			.update(journalEntries)
			.set({ postedBy, updatedAt: new Date() })
			.where(
				and(
					eq(journalEntries.id, entryId),
					eq(journalEntries.organizationId, organizationId),
				),
			);
	}

	async markReversed(
		organizationId: string,
		entryId: string,
		reversedByEntryId: string,
		tx?: TTx,
	): Promise<void> {
		const db = tx ?? this.database;
		await db
			.update(journalEntries)
			.set({ status: 'reversed', reversedByEntryId, updatedAt: new Date() })
			.where(
				and(
					eq(journalEntries.id, entryId),
					eq(journalEntries.organizationId, organizationId),
				),
			);
	}

	async listAccountActivity(
		organizationId: string,
		startDate: string,
		endDate: string,
		tx?: TTx,
	): Promise<TAccountActivity[]> {
		const db = tx ?? this.database;
		return db
			.select({
				accountId: journalLines.accountId,
				debit: sql<number>`coalesce(sum(${journalLines.debit}), 0)::bigint`.mapWith(Number),
				credit: sql<number>`coalesce(sum(${journalLines.credit}), 0)::bigint`.mapWith(Number),
			})
			.from(journalLines)
			.innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
			.where(
				and(
					eq(journalEntries.organizationId, organizationId),
					inArray(journalEntries.status, [...LEDGER_JOURNAL_STATUSES]),
					isNull(journalEntries.deletedAt),
					isNull(journalLines.deletedAt),
					sql`${journalEntries.entryDate} >= ${startDate}`,
					sql`${journalEntries.entryDate} <= ${endDate}`,
				),
			)
			.groupBy(journalLines.accountId);
	}

	async accountTotalsForPeriod(
		organizationId: string,
		periodId: string,
	): Promise<TAccountActivity[]> {
		return this.database
			.select({
				accountId: journalLines.accountId,
				debit: sql<number>`coalesce(sum(${journalLines.debit}), 0)::bigint`.mapWith(Number),
				credit: sql<number>`coalesce(sum(${journalLines.credit}), 0)::bigint`.mapWith(Number),
			})
			.from(journalLines)
			.innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
			.where(
				and(
					eq(journalLines.organizationId, organizationId),
					eq(journalEntries.accountingPeriodId, periodId),
					inArray(journalEntries.status, [...LEDGER_JOURNAL_STATUSES]),
					isNull(journalLines.deletedAt),
					isNull(journalEntries.deletedAt),
				),
			)
			.groupBy(journalLines.accountId);
	}

	async updateEntry(
		organizationId: string,
		entryId: string,
		patch: TJournalEntryPatch,
		tx?: TTx,
	): Promise<TJournalEntrySelect | null> {
		const db = tx ?? this.database;
		const [updated] = await db
			.update(journalEntries)
			.set({ ...patch, updatedAt: new Date() })
			.where(
				and(
					eq(journalEntries.id, entryId),
					eq(journalEntries.organizationId, organizationId),
					isNull(journalEntries.deletedAt),
				),
			)
			.returning();
		return updated ?? null;
	}

	async listEntriesBySource(
		organizationId: string,
		sourceType: string,
		sourceId: string,
		tx?: TTx,
	): Promise<TJournalEntrySelect[]> {
		const db = tx ?? this.database;
		return db
			.select()
			.from(journalEntries)
			.where(
				and(
					eq(journalEntries.organizationId, organizationId),
					eq(journalEntries.sourceType, sourceType),
					eq(journalEntries.sourceId, sourceId),
					isNull(journalEntries.deletedAt),
				),
			)
			.orderBy(asc(journalEntries.createdAt));
	}

	async softDeleteLines(organizationId: string, entryId: string, tx?: TTx): Promise<void> {
		const db = tx ?? this.database;
		const now = new Date();
		await db
			.update(journalLines)
			.set({ deletedAt: now, updatedAt: now })
			.where(
				and(
					eq(journalLines.journalEntryId, entryId),
					eq(journalLines.organizationId, organizationId),
					isNull(journalLines.deletedAt),
				),
			);
	}

	async countUnpostedInPeriod(organizationId: string, periodId: string): Promise<number> {
		const [row] = await this.database
			.select({ value: count() })
			.from(journalEntries)
			.where(
				and(
					eq(journalEntries.organizationId, organizationId),
					eq(journalEntries.accountingPeriodId, periodId),
					inArray(journalEntries.status, [...UNPOSTED_JOURNAL_STATUSES]),
					isNull(journalEntries.deletedAt),
				),
			);
		return row.value;
	}

	async accountTotalsBefore(
		organizationId: string,
		beforeDate: string,
	): Promise<TAccountActivity[]> {
		return this.database
			.select({
				accountId: journalLines.accountId,
				debit: sql<number>`coalesce(sum(${journalLines.debit}), 0)::bigint`.mapWith(Number),
				credit: sql<number>`coalesce(sum(${journalLines.credit}), 0)::bigint`.mapWith(Number),
			})
			.from(journalLines)
			.innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
			.where(
				and(
					eq(journalEntries.organizationId, organizationId),
					inArray(journalEntries.status, [...LEDGER_JOURNAL_STATUSES]),
					isNull(journalEntries.deletedAt),
					isNull(journalLines.deletedAt),
					sql`${journalEntries.entryDate} < ${beforeDate}`,
				),
			)
			.groupBy(journalLines.accountId);
	}

	async listLedgerLines(
		organizationId: string,
		accountId: string,
		startDate: string,
		endDate: string,
	): Promise<TLedgerLine[]> {
		return this.database
			.select({
				lineId: journalLines.id,
				entryId: journalEntries.id,
				entryCode: journalEntries.code,
				entryDate: journalEntries.entryDate,
				sourceModule: journalEntries.sourceModule,
				sourceType: journalEntries.sourceType,
				entryDescription: journalEntries.description,
				lineDescription: journalLines.description,
				debit: journalLines.debit,
				credit: journalLines.credit,
				costCenterId: journalLines.costCenterId,
				projectId: journalLines.projectId,
			})
			.from(journalLines)
			.innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
			.where(
				and(
					eq(journalEntries.organizationId, organizationId),
					eq(journalLines.accountId, accountId),
					inArray(journalEntries.status, [...LEDGER_JOURNAL_STATUSES]),
					isNull(journalEntries.deletedAt),
					isNull(journalLines.deletedAt),
					sql`${journalEntries.entryDate} >= ${startDate}`,
					sql`${journalEntries.entryDate} <= ${endDate}`,
				),
			)
			.orderBy(asc(journalEntries.entryDate), asc(journalEntries.postedAt), asc(journalLines.lineNo));
	}
}
