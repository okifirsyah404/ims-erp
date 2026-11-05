import { DRIZZLE_TOKEN } from '@di/provider';
import {
	borrowingEvents,
	borrowingLines,
	borrowings,
} from '@drizzle/schemas/asset.schema';
import type { TPaginationResult } from '@ims-erp/common';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import {
	and,
	asc,
	count,
	desc,
	eq,
	ilike,
	isNotNull,
	isNull,
	lt,
	or,
} from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';
import type {
	IBorrowingRepository,
	TBorrowingCreateData,
	TBorrowingLineData,
	TBorrowingPaginationRequest,
	TDueBorrowingLine,
} from '../contracts/borrowing.repository.interface';
import type {
	BorrowingStatus,
	TBorrowingEventInsert,
	TBorrowingEventSelect,
	TBorrowingInsert,
	TBorrowingLineInsert,
	TBorrowingLineSelect,
	TBorrowingSelect,
} from '@drizzle/schemas/asset.schema';
import type { TTx } from '@drizzle/types';

/**
 * Drizzle implementation of {@link IBorrowingRepository}.
 *
 * @remarks
 * **Every borrowing read carries an explicit `organization_id` predicate.**
 * Those columns are nullable (ADR-0008), so a forgotten filter would leak
 * another tenant's rows or surface global ones; the isolation test asserts the
 * behaviour rather than trusting the URL to be right.
 *
 * Line and event reads are scoped through the parent borrowing, not by tenant
 * column — neither table has an `organization_id`, and a direct read by `id`
 * alone would be a cross-tenant hole.
 */
@injectable()
export class BorrowingRepository implements IBorrowingRepository {
	constructor(
		@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase,
	) {}

	/** Fetches one filtered page of borrowings. */
	async paginate(
		request: TBorrowingPaginationRequest,
	): Promise<TPaginationResult<TBorrowingSelect>> {
		const { page, limit, organizationId, status, borrowerType, search } =
			request;

		const where = and(
			isNull(borrowings.deletedAt),
			eq(borrowings.organizationId, organizationId),
			status ? eq(borrowings.status, status) : undefined,
			borrowerType ? eq(borrowings.borrowerType, borrowerType) : undefined,
			search
				? or(
						ilike(borrowings.code, `%${search}%`),
						ilike(borrowings.guestName, `%${search}%`),
					)
				: undefined,
		);

		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(borrowings)
			.where(where);

		const data = await this.database
			.select()
			.from(borrowings)
			.where(where)
			.orderBy(desc(borrowings.createdAt), desc(borrowings.id))
			.limit(limit)
			.offset((page - 1) * limit);

		return {
			meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
			data,
		};
	}

	/** Fetches one alive borrowing by id, scoped to its tenant. */
	async findById(
		id: string,
		organizationId: string,
	): Promise<TBorrowingSelect | null> {
		const [row] = await this.database
			.select()
			.from(borrowings)
			.where(
				and(
					eq(borrowings.id, id),
					eq(borrowings.organizationId, organizationId),
					isNull(borrowings.deletedAt),
				),
			);
		return row ?? null;
	}

	/** Fetches one alive borrowing by tenant + code. */
	async findByCode(
		organizationId: string,
		code: string,
	): Promise<TBorrowingSelect | null> {
		const [row] = await this.database
			.select()
			.from(borrowings)
			.where(
				and(
					eq(borrowings.organizationId, organizationId),
					eq(borrowings.code, code),
					isNull(borrowings.deletedAt),
				),
			);
		return row ?? null;
	}

	/** Inserts a header, optionally inside a caller's transaction. */
	async create(
		data: TBorrowingCreateData,
		tx?: TTx,
	): Promise<TBorrowingSelect> {
		const handle = tx ?? this.database;
		const [row] = await handle.insert(borrowings).values(data).returning();
		return row;
	}

	/** Applies a partial update, but only if the stored status still matches. */
	async update(
		id: string,
		data: Partial<TBorrowingInsert>,
		expectedStatus: BorrowingStatus,
		tx?: TTx,
	): Promise<TBorrowingSelect | null> {
		const handle = tx ?? this.database;
		const [row] = await handle
			.update(borrowings)
			.set({ ...data, updatedAt: new Date() })
			.where(
				and(
					eq(borrowings.id, id),
					// The optimistic predicate. Without it two concurrent calls
					// both pass the service's edge check and both persist.
					eq(borrowings.status, expectedStatus),
					isNull(borrowings.deletedAt),
				),
			)
			.returning();
		return row ?? null;
	}

	/** Lists the alive lines of a borrowing. */
	async listLines(borrowingId: string): Promise<TBorrowingLineSelect[]> {
		return this.database
			.select()
			.from(borrowingLines)
			.where(
				and(
					eq(borrowingLines.borrowingId, borrowingId),
					isNull(borrowingLines.deletedAt),
				),
			)
			.orderBy(asc(borrowingLines.createdAt), asc(borrowingLines.id));
	}

	/** Fetches one alive line scoped to its borrowing. */
	async findLine(
		lineId: string,
		borrowingId: string,
	): Promise<TBorrowingLineSelect | null> {
		const [row] = await this.database
			.select()
			.from(borrowingLines)
			.where(
				and(
					eq(borrowingLines.id, lineId),
					eq(borrowingLines.borrowingId, borrowingId),
					isNull(borrowingLines.deletedAt),
				),
			);
		return row ?? null;
	}

	/** Inserts all lines in one statement. */
	async createLines(
		lines: readonly TBorrowingLineData[],
		tx?: TTx,
	): Promise<TBorrowingLineSelect[]> {
		if (lines.length === 0) return [];
		const handle = tx ?? this.database;
		return handle.insert(borrowingLines).values([...lines]).returning();
	}

	/** Applies a partial update to one line. */
	async updateLine(
		lineId: string,
		data: Partial<TBorrowingLineInsert>,
		tx?: TTx,
	): Promise<TBorrowingLineSelect | null> {
		const handle = tx ?? this.database;
		const [row] = await handle
			.update(borrowingLines)
			.set({ ...data, updatedAt: new Date() })
			.where(
				and(
					eq(borrowingLines.id, lineId),
					isNull(borrowingLines.deletedAt),
				),
			)
			.returning();
		return row ?? null;
	}

	/** Appends a timeline event. The table is append-only. */
	async appendEvent(
		event: TBorrowingEventInsert,
		tx?: TTx,
	): Promise<TBorrowingEventSelect> {
		const handle = tx ?? this.database;
		const [row] = await handle
			.insert(borrowingEvents)
			.values(event)
			.returning();
		return row;
	}

	/** Lists a borrowing's full timeline, oldest first. */
	async listEvents(borrowingId: string): Promise<TBorrowingEventSelect[]> {
		return this.database
			.select()
			.from(borrowingEvents)
			.where(eq(borrowingEvents.borrowingId, borrowingId))
			.orderBy(asc(borrowingEvents.occurredAt), asc(borrowingEvents.id));
	}

	/**
	 * Finds lines that are past due and not yet marked.
	 *
	 * @remarks
	 * The `marked_late_at IS NULL` predicate appears here **and** in
	 * {@link markLineLate}'s update, so the sweep is idempotent under
	 * concurrency: two workers may both read a line, but only one update
	 * matches.
	 */
	async findDueLines(now: Date, limit: number): Promise<TDueBorrowingLine[]> {
		const rows = await this.database
			.select({
				line: borrowingLines,
				borrowingId: borrowings.id,
				organizationId: borrowings.organizationId,
				borrowerType: borrowings.borrowerType,
				guestName: borrowings.guestName,
			})
			.from(borrowingLines)
			.innerJoin(borrowings, eq(borrowingLines.borrowingId, borrowings.id))
			.where(
				and(
					isNull(borrowingLines.deletedAt),
					isNull(borrowings.deletedAt),
					isNull(borrowingLines.returnedAt),
					isNull(borrowingLines.markedLateAt),
					isNull(borrowingLines.markedLostAt),
					isNotNull(borrowingLines.dueAt),
					lt(borrowingLines.dueAt, now),
				),
			)
			.orderBy(asc(borrowingLines.dueAt))
			.limit(limit);
		return rows;
	}

	/** Marks one line late, but only if it is still unmarked. */
	async markLineLate(
		lineId: string,
		at: Date,
	): Promise<TBorrowingLineSelect | null> {
		const [row] = await this.database
			.update(borrowingLines)
			.set({ markedLateAt: at, updatedAt: at })
			.where(
				and(
					eq(borrowingLines.id, lineId),
					isNull(borrowingLines.markedLateAt),
					isNull(borrowingLines.returnedAt),
					isNull(borrowingLines.markedLostAt),
				),
			)
			.returning();
		return row ?? null;
	}

	/**
	 * Finds closed borrowings whose guest PII has passed its retention window.
	 *
	 * @remarks
	 * Only guest borrowings with a surviving `guest_name` are candidates; the
	 * `guest_name IS NOT NULL` predicate is what makes a re-run a no-op.
	 * Non-guest borrowers hold no PII on this row.
	 */
	async findExpiredGuestBorrowings(
		cutoff: Date,
		limit: number,
	): Promise<TBorrowingSelect[]> {
		return this.database
			.select()
			.from(borrowings)
			.where(
				and(
					eq(borrowings.borrowerType, 'guest'),
					isNotNull(borrowings.guestName),
					isNotNull(borrowings.closedAt),
					lt(borrowings.closedAt, cutoff),
				),
			)
			.orderBy(asc(borrowings.closedAt))
			.limit(limit);
	}

	/** Nulls the guest PII columns on one borrowing, idempotently. */
	async redactGuestPii(id: string): Promise<TBorrowingSelect | null> {
		const [row] = await this.database
			.update(borrowings)
			.set({
				guestName: null,
				guestPhone: null,
				guestIdType: null,
				guestIdNumber: null,
				guestAddressText: null,
				guestIdDocumentRef: null,
				updatedAt: new Date(),
			})
			.where(
				and(eq(borrowings.id, id), isNotNull(borrowings.guestName)),
			)
			.returning();
		return row ?? null;
	}
}
