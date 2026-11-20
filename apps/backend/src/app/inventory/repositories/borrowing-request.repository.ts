import { DRIZZLE_TOKEN } from '@di/provider';
import {
	type BorrowingRequestStatus,
	borrowingItems,
	borrowingRequests,
	borrowings,
	items,
	type TBorrowingRequestInsert,
	type TBorrowingRequestSelect,
} from '@drizzle/schemas/inventory.schema';
import type { TTx } from '@drizzle/types';
import type { TPaginationResult } from '@ims-erp/common';
import { paginationResult } from '@utils/pagination.util';
import {
	and,
	asc,
	count,
	desc,
	eq,
	ilike,
	inArray,
	isNotNull,
	isNull,
	lt,
	or,
} from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type {
	IBorrowingRequestRepository,
	TBorrowingRequestPaginationRequest,
} from '../contracts/borrowing.repository.interface';

/**
 * Drizzle implementation of {@link IBorrowingRequestRepository}.
 *
 * @remarks
 * **Every read carries an explicit `organization_id` predicate**: the column is
 * nullable (ADR-0008), so a forgotten filter would leak another tenant's rows
 * or surface global ones.
 */
@injectable()
export class BorrowingRequestRepository implements IBorrowingRequestRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	async paginate(
		request: TBorrowingRequestPaginationRequest,
	): Promise<TPaginationResult<TBorrowingRequestSelect>> {
		const { page, limit, organizationId, status, borrowerType, search } = request;
		const where = and(
			isNull(borrowingRequests.deletedAt),
			eq(borrowingRequests.organizationId, organizationId),
			status ? eq(borrowingRequests.status, status) : undefined,
			borrowerType ? eq(borrowingRequests.borrowerType, borrowerType) : undefined,
			search
				? or(
						ilike(borrowingRequests.code, `%${search}%`),
						ilike(borrowingRequests.guestName, `%${search}%`),
					)
				: undefined,
		);
		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(borrowingRequests)
			.where(where);
		const data = await this.database
			.select()
			.from(borrowingRequests)
			.where(where)
			.orderBy(desc(borrowingRequests.createdAt), desc(borrowingRequests.id))
			.limit(limit)
			.offset((page - 1) * limit);
		return paginationResult({ page, limit }, total, data);
	}

	async findById(id: string, organizationId: string): Promise<TBorrowingRequestSelect | null> {
		const [row] = await this.database
			.select()
			.from(borrowingRequests)
			.where(
				and(
					eq(borrowingRequests.id, id),
					eq(borrowingRequests.organizationId, organizationId),
					isNull(borrowingRequests.deletedAt),
				),
			);
		return row ?? null;
	}

	async create(data: TBorrowingRequestInsert, tx?: TTx): Promise<TBorrowingRequestSelect> {
		const [row] = await (tx ?? this.database).insert(borrowingRequests).values(data).returning();
		return row;
	}

	async update(
		id: string,
		data: Partial<TBorrowingRequestInsert>,
		expectedStatus: BorrowingRequestStatus,
		tx?: TTx,
	): Promise<TBorrowingRequestSelect | null> {
		const [row] = await (tx ?? this.database)
			.update(borrowingRequests)
			.set({ ...data, updatedAt: new Date() })
			.where(
				and(
					eq(borrowingRequests.id, id),
					// The optimistic predicate: two concurrent calls both pass the
					// service's edge check, but only one update matches.
					eq(borrowingRequests.status, expectedStatus),
					isNull(borrowingRequests.deletedAt),
				),
			)
			.returning();
		return row ?? null;
	}

	/** One query for the whole page; "first" is stable (`created_at`, then id). */
	async listFirstItemImages(
		requestIds: string[],
	): Promise<Array<{ requestId: string; imageUrl: string | null }>> {
		if (requestIds.length === 0) return [];
		const rows = await this.database
			.select({ requestId: borrowingItems.borrowingRequestId, imageUrl: items.imageUrl })
			.from(borrowingItems)
			.innerJoin(items, eq(items.id, borrowingItems.itemId))
			.where(
				and(
					inArray(borrowingItems.borrowingRequestId, requestIds),
					isNull(borrowingItems.deletedAt),
				),
			)
			.orderBy(asc(borrowingItems.createdAt), asc(borrowingItems.id));
		const first = new Map<string, string | null>();
		for (const row of rows) {
			if (!first.has(row.requestId)) first.set(row.requestId, row.imageUrl);
		}
		return [...first].map(([requestId, imageUrl]) => ({ requestId, imageUrl }));
	}

	/**
	 * Joins the borrowing for the status filter instead of trusting the item:
	 * a `returned` borrowing with one late-marked item must not block.
	 */
	async countOpenByOriginWarehouse(warehouseId: string, organizationId: string): Promise<number> {
		const [row] = await this.database
			.select({ value: count() })
			.from(borrowingItems)
			.innerJoin(borrowings, eq(borrowingItems.borrowingId, borrowings.id))
			.where(
				and(
					isNull(borrowingItems.deletedAt),
					isNull(borrowings.deletedAt),
					eq(borrowings.organizationId, organizationId),
					eq(borrowingItems.originWarehouseId, warehouseId),
					inArray(borrowings.status, ['issued', 'partially_returned']),
					isNull(borrowingItems.returnedAt),
					isNull(borrowingItems.markedLostAt),
				),
			);
		return row?.value ?? 0;
	}

	/** Only guest requests with a surviving `guest_name` are candidates (re-runs are no-ops). */
	async findExpiredGuestRequests(cutoff: Date, limit: number): Promise<TBorrowingRequestSelect[]> {
		const rows = await this.database
			.select({ request: borrowingRequests })
			.from(borrowingRequests)
			.innerJoin(borrowings, eq(borrowings.borrowingRequestId, borrowingRequests.id))
			.where(
				and(
					eq(borrowingRequests.borrowerType, 'guest'),
					isNotNull(borrowingRequests.guestName),
					isNotNull(borrowings.closedAt),
					lt(borrowings.closedAt, cutoff),
				),
			)
			.orderBy(asc(borrowings.closedAt))
			.limit(limit);
		return rows.map((row) => row.request);
	}

	async redactGuestPii(id: string): Promise<TBorrowingRequestSelect | null> {
		const [row] = await this.database
			.update(borrowingRequests)
			.set({
				guestName: null,
				guestPhone: null,
				guestIdType: null,
				guestIdNumber: null,
				guestAddressText: null,
				guestIdDocumentRef: null,
				updatedAt: new Date(),
			})
			.where(and(eq(borrowingRequests.id, id), isNotNull(borrowingRequests.guestName)))
			.returning();
		return row ?? null;
	}
}
