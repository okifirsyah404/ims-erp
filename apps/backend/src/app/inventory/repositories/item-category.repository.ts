import { inject, injectable } from 'tsyringe';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { and, count, eq, ilike, isNull, or } from 'drizzle-orm';
import type { TPaginationResult } from '@ims-erp/common';
import { DRIZZLE_TOKEN } from '@di/provider';
import {
	itemCategories,
	type TItemCategorySelect,
} from '@drizzle/schemas/inventory.schema';
import type { TTx } from '@drizzle/types';
import type {
	IItemCategoryRepository,
	TItemCategoryCreateData,
	TItemCategoryPaginationRequest,
	TItemCategoryUpdateData,
} from '../contracts/item-category.repository.interface';

/**
 * Persistence for `items.asset_categories`.
 *
 * @remarks
 * Owns every SQL statement against the table; the service layer holds no
 * Drizzle handle.
 */
@injectable()
export class ItemCategoryRepository implements IItemCategoryRepository {
	constructor(
		@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase,
	) {}

	async paginate(
		request: TItemCategoryPaginationRequest,
	): Promise<TPaginationResult<TItemCategorySelect>> {
		const { page, limit, search, itemKind, organizationId, includeArchived } =
			request;

		const filters = [
			eq(itemCategories.organizationId, organizationId),
			includeArchived ? undefined : isNull(itemCategories.deletedAt),
			itemKind ? eq(itemCategories.itemKind, itemKind) : undefined,
			search
				? or(
						ilike(itemCategories.code, `%${search}%`),
						ilike(itemCategories.name, `%${search}%`),
					)
				: undefined,
		].filter(Boolean);
		const where = and(...filters);

		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(itemCategories)
			.where(where);

		const data = await this.database
			.select()
			.from(itemCategories)
			.where(where)
			.orderBy(itemCategories.code)
			.limit(limit)
			.offset((page - 1) * limit);

		return {
			meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
			data,
		};
	}

	async findById(id: string): Promise<TItemCategorySelect | null> {
		const [row] = await this.database
			.select()
			.from(itemCategories)
			.where(
				and(eq(itemCategories.id, id), isNull(itemCategories.deletedAt)),
			)
			.limit(1);
		return row ?? null;
	}

	async findByCode(
		organizationId: string,
		code: string,
	): Promise<TItemCategorySelect | null> {
		const [row] = await this.database
			.select()
			.from(itemCategories)
			.where(
				and(
					eq(itemCategories.organizationId, organizationId),
					eq(itemCategories.code, code),
					isNull(itemCategories.deletedAt),
				),
			)
			.limit(1);
		return row ?? null;
	}

	async create(
		data: TItemCategoryCreateData & { createdAt: Date },
		tx?: TTx,
	): Promise<TItemCategorySelect> {
		const db = tx ?? this.database;
		const [row] = await db.insert(itemCategories).values(data).returning();
		return row;
	}

	async update(
		id: string,
		data: TItemCategoryUpdateData,
		tx?: TTx,
	): Promise<TItemCategorySelect | null> {
		const db = tx ?? this.database;
		const [row] = await db
			.update(itemCategories)
			.set({ ...data, updatedAt: new Date() })
			.where(
				and(eq(itemCategories.id, id), isNull(itemCategories.deletedAt)),
			)
			.returning();
		return row ?? null;
	}

	async archive(id: string, tx?: TTx): Promise<TItemCategorySelect | null> {
		const db = tx ?? this.database;
		const [row] = await db
			.update(itemCategories)
			.set({ deletedAt: new Date(), updatedAt: new Date() })
			.where(
				and(eq(itemCategories.id, id), isNull(itemCategories.deletedAt)),
			)
			.returning();
		return row ?? null;
	}
}
