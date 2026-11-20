import { DRIZZLE_TOKEN } from '@di/provider';
import { movements } from '@drizzle/schemas/inventory.schema';
import type { TTx } from '@drizzle/types';
import type { TPaginationResult } from '@ims-erp/common';
import { and, count, desc, eq, isNotNull } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type {
	IItemMovementRepository,
	TItemMovementCreateData,
	TItemMovementSelect,
} from '../contracts/item-movement.repository.interface';

/** Drizzle implementation of {@link IItemMovementRepository} (item rows of `movements`). */
@injectable()
export class ItemMovementRepository implements IItemMovementRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	async create(data: TItemMovementCreateData, tx?: TTx): Promise<TItemMovementSelect> {
		const [row] = await (tx ?? this.database)
			.insert(movements)
			.values({
				...data,
				productId: null,
				// An item is one physical unit.
				quantity: '1',
				status: 'posted',
				createdAt: data.occurredAt,
			})
			.returning();
		return row as TItemMovementSelect;
	}

	async listByItem(
		itemId: string,
		organizationId: string,
		page: number,
		limit: number,
	): Promise<TPaginationResult<TItemMovementSelect>> {
		const where = and(
			eq(movements.itemId, itemId),
			isNotNull(movements.itemId),
			eq(movements.organizationId, organizationId),
		);
		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(movements)
			.where(where);
		const data = await this.database
			.select()
			.from(movements)
			.where(where)
			.orderBy(desc(movements.occurredAt), desc(movements.id))
			.limit(limit)
			.offset((page - 1) * limit);
		return {
			meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
			data: data as TItemMovementSelect[],
		};
	}
}
