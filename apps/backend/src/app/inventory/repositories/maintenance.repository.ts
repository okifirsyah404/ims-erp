import { DRIZZLE_TOKEN } from '@di/provider';
import {
	maintenances,
	type TMaintenanceInsert,
	type TMaintenanceSelect,
} from '@drizzle/schemas/inventory.schema';
import type { TTx } from '@drizzle/types';
import type { TPaginationResult } from '@ims-erp/common';
import { and, count, desc, eq, inArray, isNull } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type { IMaintenanceRepository } from '../contracts/item-operations.repository.interface';

/** Drizzle implementation of {@link IMaintenanceRepository} on `inventory.maintenances`. */
@injectable()
export class MaintenanceRepository implements IMaintenanceRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	async hasOpenForItem(itemId: string, tx?: TTx): Promise<boolean> {
		const [row] = await (tx ?? this.database)
			.select({ value: count() })
			.from(maintenances)
			.where(
				and(
					eq(maintenances.itemId, itemId),
					isNull(maintenances.deletedAt),
					inArray(maintenances.status, ['scheduled', 'in_progress']),
				),
			);
		return row.value > 0;
	}

	async create(data: TMaintenanceInsert, tx?: TTx): Promise<TMaintenanceSelect> {
		const [row] = await (tx ?? this.database).insert(maintenances).values(data).returning();
		return row;
	}

	async listByItem(
		itemId: string,
		organizationId: string,
		page: number,
		limit: number,
	): Promise<TPaginationResult<TMaintenanceSelect>> {
		const where = and(
			eq(maintenances.itemId, itemId),
			eq(maintenances.organizationId, organizationId),
			isNull(maintenances.deletedAt),
		);
		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(maintenances)
			.where(where);
		const data = await this.database
			.select()
			.from(maintenances)
			.where(where)
			.orderBy(desc(maintenances.createdAt), desc(maintenances.id))
			.limit(limit)
			.offset((page - 1) * limit);
		return { meta: { page, limit, total, totalPages: Math.ceil(total / limit) }, data };
	}
}
