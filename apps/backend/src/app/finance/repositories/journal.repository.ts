import { DRIZZLE_TOKEN } from '@di/provider';
import type { TTx } from '@drizzle/types';
import {
	journalEntries,
	journalLines,
	type TJournalEntrySelect,
	type TJournalLineSelect,
} from '@drizzle/schemas/finance.schema';
import type { TPaginationResult } from '@ims-erp/common';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { and, asc, count, desc, eq, isNull, sql } from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';
import type { IJournalRepository, TAccountActivity } from '../contracts/journal.repository.interface';

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

	async listEntries(
		organizationId: string,
		pagination: { page: number; limit: number },
		filters: { year?: number; month?: number; status?: string } = {},
	): Promise<TPaginationResult<TJournalEntrySelect>> {
		const conditions = [
			eq(journalEntries.organizationId, organizationId),
			isNull(journalEntries.deletedAt),
		];
		if (filters.year && filters.month) {
			const start = `${filters.year}-${String(filters.month).padStart(2, '0')}-01`;
			const endDate = new Date(Date.UTC(filters.year, filters.month, 0))
				.toISOString()
				.slice(0, 10);
			conditions.push(sql`${journalEntries.entryDate} >= ${start}`);
			conditions.push(sql`${journalEntries.entryDate} <= ${endDate}`);
		}
		if (filters.status) {
			conditions.push(eq(journalEntries.status, filters.status));
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
			.limit(pagination.limit)
			.offset((pagination.page - 1) * pagination.limit);
		return {
			data,
			meta: {
				page: pagination.page,
				limit: pagination.limit,
				total,
				totalPages: Math.ceil(total / pagination.limit) || 1,
			},
		};
	}

	async insertEntry(
		row: {
			organizationId: string;
			code: string;
			accountingPeriodId: string;
			entryDate: string;
			description: string | null;
			sourceType: string | null;
			sourceId: string | null;
			idempotencyKey: string | null;
			sourceModule: string;
			status: string;
			totalDebit: number;
			totalCredit: number;
			currencyCode: string;
			postedBy: string | null;
			postedAt: Date | null;
		},
		tx?: TTx,
	): Promise<TJournalEntrySelect> {
		const db = tx ?? this.database;
		const now = new Date();
		const [created] = await db
			.insert(journalEntries)
			.values({ ...row, preparedBy: row.postedBy, createdAt: now, updatedAt: now })
			.returning();
		return created;
	}

	async insertLines(
		rows: Array<{
			organizationId: string;
			journalEntryId: string;
			lineNo: number;
			accountId: string;
			debit: number;
			credit: number;
			currencyCode: string;
			description: string | null;
			costCenterId: string | null;
			projectId: string | null;
			partyType: string | null;
			partyId: string | null;
		}>,
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
					eq(journalEntries.status, 'posted'),
					isNull(journalEntries.deletedAt),
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
					eq(journalEntries.status, 'posted'),
					isNull(journalLines.deletedAt),
					isNull(journalEntries.deletedAt),
				),
			)
			.groupBy(journalLines.accountId);
	}
}
