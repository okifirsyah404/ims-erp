import { DRIZZLE_TOKEN } from '@di/provider';
import {
	borrowingEvents,
	borrowingRequestEvents,
	type TBorrowingEventInsert,
	type TBorrowingEventSelect,
	type TBorrowingRequestEventInsert,
	type TBorrowingRequestEventSelect,
} from '@drizzle/schemas/inventory.schema';
import type { TTx } from '@drizzle/types';
import { asc, eq } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type {
	IBorrowingEventRepository,
	IBorrowingRequestEventRepository,
} from '../contracts/borrowing.repository.interface';

/** Drizzle implementation of {@link IBorrowingEventRepository} (append-only). */
@injectable()
export class BorrowingEventRepository implements IBorrowingEventRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	async append(event: TBorrowingEventInsert, tx?: TTx): Promise<TBorrowingEventSelect> {
		const [row] = await (tx ?? this.database).insert(borrowingEvents).values(event).returning();
		return row;
	}

	listByBorrowing(borrowingId: string): Promise<TBorrowingEventSelect[]> {
		return this.database
			.select()
			.from(borrowingEvents)
			.where(eq(borrowingEvents.borrowingId, borrowingId))
			.orderBy(asc(borrowingEvents.occurredAt), asc(borrowingEvents.id));
	}
}

/** Drizzle implementation of {@link IBorrowingRequestEventRepository} (append-only). */
@injectable()
export class BorrowingRequestEventRepository implements IBorrowingRequestEventRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	async append(
		event: TBorrowingRequestEventInsert,
		tx?: TTx,
	): Promise<TBorrowingRequestEventSelect> {
		const [row] = await (tx ?? this.database)
			.insert(borrowingRequestEvents)
			.values(event)
			.returning();
		return row;
	}

	listByRequest(requestId: string): Promise<TBorrowingRequestEventSelect[]> {
		return this.database
			.select()
			.from(borrowingRequestEvents)
			.where(eq(borrowingRequestEvents.borrowingRequestId, requestId))
			.orderBy(asc(borrowingRequestEvents.occurredAt), asc(borrowingRequestEvents.id));
	}
}
