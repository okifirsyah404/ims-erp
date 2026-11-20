import { DRIZZLE_TOKEN } from '@di/provider';
import {
	conditionChecks,
	type TConditionCheckInsert,
	type TConditionCheckSelect,
} from '@drizzle/schemas/inventory.schema';
import type { TTx } from '@drizzle/types';
import type { TPaginationResult } from '@ims-erp/common';
import { and, count, desc, eq, isNull } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type { IConditionCheckRepository } from '../contracts/item-operations.repository.interface';

/** Drizzle implementation of {@link IConditionCheckRepository} on `inventory.condition_checks`. */
@injectable()
export class ConditionCheckRepository implements IConditionCheckRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	async create(data: TConditionCheckInsert, tx?: TTx): Promise<TConditionCheckSelect> {
		const [row] = await (tx ?? this.database).insert(conditionChecks).values(data).returning();
		return row;
	}

	async listByItem(
		itemId: string,
		organizationId: string,
		page: number,
		limit: number,
	): Promise<TPaginationResult<TConditionCheckSelect>> {
		const where = and(
			eq(conditionChecks.itemId, itemId),
			eq(conditionChecks.organizationId, organizationId),
			isNull(conditionChecks.deletedAt),
		);
		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(conditionChecks)
			.where(where);
		const data = await this.database
			.select()
			.from(conditionChecks)
			.where(where)
			.orderBy(desc(conditionChecks.checkDate), desc(conditionChecks.id))
			.limit(limit)
			.offset((page - 1) * limit);
		return { meta: { page, limit, total, totalPages: Math.ceil(total / limit) }, data };
	}
}
