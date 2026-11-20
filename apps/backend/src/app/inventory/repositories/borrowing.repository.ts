import { DRIZZLE_TOKEN } from '@di/provider';
import {
	type BorrowingStatus,
	borrowings,
	type TBorrowingInsert,
	type TBorrowingSelect,
} from '@drizzle/schemas/inventory.schema';
import type { TTx } from '@drizzle/types';
import type { TPaginationResult } from '@ims-erp/common';
import { and, count, desc, eq, ilike, isNull } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type {
	IBorrowingRepository,
	TBorrowingPaginationRequest,
} from '../contracts/borrowing.repository.interface';

/** Drizzle implementation of {@link IBorrowingRepository} on `inventory.borrowings`. */
@injectable()
export class BorrowingRepository implements IBorrowingRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	async paginate(
		request: TBorrowingPaginationRequest,
	): Promise<TPaginationResult<TBorrowingSelect>> {
		const { page, limit, organizationId, status, search } = request;
		const where = and(
			isNull(borrowings.deletedAt),
			eq(borrowings.organizationId, organizationId),
			status ? eq(borrowings.status, status) : undefined,
			search ? ilike(borrowings.code, `%${search}%`) : undefined,
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

	async findById(id: string, organizationId: string): Promise<TBorrowingSelect | null> {
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

	async findByRequestId(requestId: string): Promise<TBorrowingSelect | null> {
		const [row] = await this.database
			.select()
			.from(borrowings)
			.where(and(eq(borrowings.borrowingRequestId, requestId), isNull(borrowings.deletedAt)));
		return row ?? null;
	}

	async create(data: TBorrowingInsert, tx?: TTx): Promise<TBorrowingSelect> {
		const [row] = await (tx ?? this.database).insert(borrowings).values(data).returning();
		return row;
	}

	async update(
		id: string,
		data: Partial<TBorrowingInsert>,
		expectedStatus: BorrowingStatus,
		tx?: TTx,
	): Promise<TBorrowingSelect | null> {
		const [row] = await (tx ?? this.database)
			.update(borrowings)
			.set({ ...data, updatedAt: new Date() })
			.where(
				and(
					eq(borrowings.id, id),
					eq(borrowings.status, expectedStatus),
					isNull(borrowings.deletedAt),
				),
			)
			.returning();
		return row ?? null;
	}
}
