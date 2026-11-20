import { inject, injectable } from 'tsyringe';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { and, count, eq, ilike, inArray, isNull, or } from 'drizzle-orm';
import type { TPaginationResult } from '@ims-erp/common';
import { paginationResult } from '@utils/pagination.util';
import { DRIZZLE_TOKEN } from '@di/provider';
import {
	borrowingItems,
	items,
	maintenances,
	type TItemInsert,
	type TItemSelect,
} from '@drizzle/schemas/inventory.schema';
import type { TTx } from '@drizzle/types';
import type {
	IItemRepository,
	TItemCreateData,
	TItemPaginationRequest,
	TItemUpdateData,
} from '../contracts/item.repository.interface';

/**
 * Persistence for `items.assets` (the register).
 *
 * @remarks
 * Owns every SQL statement against the table; the service layer holds no
 * Drizzle handle. Delete is soft-only — there is no hard-delete method, by
 * contract (financial master-data rule).
 */
@injectable()
export class ItemRepository implements IItemRepository {
	constructor(
		@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase,
	) {}

	async paginate(
		request: TItemPaginationRequest,
	): Promise<TPaginationResult<TItemSelect>> {
		const {
			page,
			limit,
			search,
			status,
			itemKind,
			itemCategoryId,
			organizationId,
			includeArchived,
		} = request;

		const filters = [
			eq(items.organizationId, organizationId),
			includeArchived ? undefined : isNull(items.deletedAt),
			status ? eq(items.status, status) : undefined,
			itemKind ? eq(items.itemKind, itemKind) : undefined,
			itemCategoryId ? eq(items.itemCategoryId, itemCategoryId) : undefined,
			search
				? or(
						ilike(items.code, `%${search}%`),
						ilike(items.name, `%${search}%`),
						ilike(items.serialNumber, `%${search}%`),
					)
				: undefined,
		].filter(Boolean);
		const where = and(...filters);

		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(items)
			.where(where);

		const data = await this.database
			.select()
			.from(items)
			.where(where)
			.orderBy(items.code)
			.limit(limit)
			.offset((page - 1) * limit);

		return paginationResult({ page, limit }, total, data);
	}

	async findById(id: string): Promise<TItemSelect | null> {
		const [row] = await this.database
			.select()
			.from(items)
			.where(and(eq(items.id, id), isNull(items.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	async findByCode(
		organizationId: string,
		code: string,
	): Promise<TItemSelect | null> {
		const [row] = await this.database
			.select()
			.from(items)
			.where(
				and(
					eq(items.organizationId, organizationId),
					eq(items.code, code),
					isNull(items.deletedAt),
				),
			)
			.limit(1);
		return row ?? null;
	}

	async create(data: TItemInsert, tx?: TTx): Promise<TItemSelect> {
		const db = tx ?? this.database;
		const [row] = await db.insert(items).values(data).returning();
		return row;
	}

	async update(
		id: string,
		data: TItemUpdateData & Partial<TItemInsert>,
		tx?: TTx,
	): Promise<TItemSelect | null> {
		const db = tx ?? this.database;
		const [row] = await db
			.update(items)
			.set({ ...data, updatedAt: new Date() })
			.where(and(eq(items.id, id), isNull(items.deletedAt)))
			.returning();
		return row ?? null;
	}

	async archive(id: string, tx?: TTx): Promise<TItemSelect | null> {
		const db = tx ?? this.database;
		const [row] = await db
			.update(items)
			.set({ deletedAt: new Date(), updatedAt: new Date() })
			.where(and(eq(items.id, id), isNull(items.deletedAt)))
			.returning();
		return row ?? null;
	}

	/**
	 * Counts alive references that must block a delete. Soft delete is the
	 * only path, so this is a defensive read used by the service to refuse
	 * deactivation-to-deletion shortcuts with a precise error.
	 */
	async countReferences(
		id: string,
	): Promise<{ borrowings: number; maintenances: number }> {
		const [borrowingRow] = await this.database
			.select({ value: count() })
			.from(borrowingItems)
			.where(
				and(
					eq(borrowingItems.itemId, id),
					isNull(borrowingItems.deletedAt),
				),
			);
		const [maintenanceRow] = await this.database
			.select({ value: count() })
			.from(maintenances)
			.where(
				and(
					eq(maintenances.itemId, id),
					isNull(maintenances.deletedAt),
				),
			);
		return {
			borrowings: borrowingRow.value,
			maintenances: maintenanceRow.value,
		};
	}

	/** @inheritdoc */
	async countByWarehouse(
		warehouseIds: string[],
		itemKind?: string,
	): Promise<Array<{ warehouseId: string | null; value: number }>> {
		if (warehouseIds.length === 0) return [];
		return this.database
			.select({
				warehouseId: items.warehouseId,
				value: count(),
			})
			.from(items)
			.where(
				and(
					itemKind ? eq(items.itemKind, itemKind) : undefined,
					isNull(items.deletedAt),
					inArray(items.warehouseId, warehouseIds),
				),
			)
			.groupBy(items.warehouseId);
	}
}

export type { TItemCreateData };
