import { DRIZZLE_TOKEN } from '@di/provider';
import {
	borrowingItems,
	borrowings,
	type TBorrowingItemInsert,
	type TBorrowingItemSelect,
} from '@drizzle/schemas/inventory.schema';
import type { TTx } from '@drizzle/types';
import { and, asc, eq, isNotNull, isNull, lt } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type {
	IBorrowingItemRepository,
	TDueBorrowingItem,
} from '../contracts/borrowing.repository.interface';

/**
 * Drizzle implementation of {@link IBorrowingItemRepository}.
 *
 * @remarks
 * Items carry no `organization_id` of their own beyond the copy the service
 * writes; reads are scoped through the request or the borrowing, never by `id`
 * alone.
 */
@injectable()
export class BorrowingItemRepository implements IBorrowingItemRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	listByRequest(requestId: string): Promise<TBorrowingItemSelect[]> {
		return this.database
			.select()
			.from(borrowingItems)
			.where(
				and(eq(borrowingItems.borrowingRequestId, requestId), isNull(borrowingItems.deletedAt)),
			)
			.orderBy(asc(borrowingItems.createdAt), asc(borrowingItems.id));
	}

	listByBorrowing(borrowingId: string): Promise<TBorrowingItemSelect[]> {
		return this.database
			.select()
			.from(borrowingItems)
			.where(and(eq(borrowingItems.borrowingId, borrowingId), isNull(borrowingItems.deletedAt)))
			.orderBy(asc(borrowingItems.createdAt), asc(borrowingItems.id));
	}

	async findInBorrowing(id: string, borrowingId: string): Promise<TBorrowingItemSelect | null> {
		const [row] = await this.database
			.select()
			.from(borrowingItems)
			.where(
				and(
					eq(borrowingItems.id, id),
					eq(borrowingItems.borrowingId, borrowingId),
					isNull(borrowingItems.deletedAt),
				),
			);
		return row ?? null;
	}

	async createMany(
		rows: readonly TBorrowingItemInsert[],
		tx?: TTx,
	): Promise<TBorrowingItemSelect[]> {
		if (rows.length === 0) return [];
		return (tx ?? this.database).insert(borrowingItems).values([...rows]).returning();
	}

	async update(
		id: string,
		data: Partial<TBorrowingItemInsert>,
		tx?: TTx,
	): Promise<TBorrowingItemSelect | null> {
		const [row] = await (tx ?? this.database)
			.update(borrowingItems)
			.set({ ...data, updatedAt: new Date() })
			.where(and(eq(borrowingItems.id, id), isNull(borrowingItems.deletedAt)))
			.returning();
		return row ?? null;
	}

	async findOpenForItem(itemId: string, tx?: TTx): Promise<{ issuedAt: Date | null } | null> {
		const [row] = await (tx ?? this.database)
			.select({ issuedAt: borrowingItems.issuedAt })
			.from(borrowingItems)
			.innerJoin(borrowings, eq(borrowingItems.borrowingId, borrowings.id))
			.where(
				and(
					eq(borrowingItems.itemId, itemId),
					isNotNull(borrowingItems.issuedAt),
					isNull(borrowingItems.returnedAt),
					isNull(borrowingItems.markedLostAt),
					isNull(borrowingItems.deletedAt),
					isNull(borrowings.deletedAt),
				),
			)
			.limit(1);
		return row ?? null;
	}

	/**
	 * `marked_late_at IS NULL` is part of the read **and** of {@link markLate}'s
	 * update, so two sweeps racing produce one event.
	 */
	async findDue(now: Date, limit: number): Promise<TDueBorrowingItem[]> {
		const rows = await this.database
			.select({
				item: borrowingItems,
				borrowingId: borrowings.id,
				organizationId: borrowings.organizationId,
			})
			.from(borrowingItems)
			.innerJoin(borrowings, eq(borrowingItems.borrowingId, borrowings.id))
			.where(
				and(
					isNull(borrowingItems.deletedAt),
					isNull(borrowings.deletedAt),
					isNull(borrowingItems.returnedAt),
					isNull(borrowingItems.markedLateAt),
					isNull(borrowingItems.markedLostAt),
					isNotNull(borrowingItems.issuedAt),
					isNotNull(borrowingItems.dueAt),
					lt(borrowingItems.dueAt, now),
				),
			)
			.orderBy(asc(borrowingItems.dueAt))
			.limit(limit);
		return rows;
	}

	async markLate(id: string, at: Date): Promise<TBorrowingItemSelect | null> {
		const [row] = await this.database
			.update(borrowingItems)
			.set({ markedLateAt: at, updatedAt: at })
			.where(
				and(
					eq(borrowingItems.id, id),
					isNull(borrowingItems.markedLateAt),
					isNull(borrowingItems.returnedAt),
					isNull(borrowingItems.markedLostAt),
				),
			)
			.returning();
		return row ?? null;
	}
}
