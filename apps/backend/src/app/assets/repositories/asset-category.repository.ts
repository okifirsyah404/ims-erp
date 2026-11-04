import { inject, injectable } from 'tsyringe';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { and, count, eq, ilike, isNull, or } from 'drizzle-orm';
import type { TPaginationResult } from '@ims-erp/common';
import { DRIZZLE_TOKEN } from '@di/provider';
import {
	assetCategories,
	type TAssetCategorySelect,
} from '@drizzle/schemas/asset.schema';
import type { TTx } from '@drizzle/types';
import type {
	IAssetCategoryRepository,
	TAssetCategoryCreateData,
	TAssetCategoryPaginationRequest,
	TAssetCategoryUpdateData,
} from '../contracts/asset-category.repository.interface';

/**
 * Persistence for `assets.asset_categories`.
 *
 * @remarks
 * Owns every SQL statement against the table; the service layer holds no
 * Drizzle handle.
 */
@injectable()
export class AssetCategoryRepository implements IAssetCategoryRepository {
	constructor(
		@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase,
	) {}

	async paginate(
		request: TAssetCategoryPaginationRequest,
	): Promise<TPaginationResult<TAssetCategorySelect>> {
		const { page, limit, search, assetType, organizationId, includeArchived } =
			request;

		const filters = [
			eq(assetCategories.organizationId, organizationId),
			includeArchived ? undefined : isNull(assetCategories.deletedAt),
			assetType ? eq(assetCategories.assetType, assetType) : undefined,
			search
				? or(
						ilike(assetCategories.code, `%${search}%`),
						ilike(assetCategories.name, `%${search}%`),
					)
				: undefined,
		].filter(Boolean);
		const where = and(...filters);

		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(assetCategories)
			.where(where);

		const data = await this.database
			.select()
			.from(assetCategories)
			.where(where)
			.orderBy(assetCategories.code)
			.limit(limit)
			.offset((page - 1) * limit);

		return {
			meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
			data,
		};
	}

	async findById(id: string): Promise<TAssetCategorySelect | null> {
		const [row] = await this.database
			.select()
			.from(assetCategories)
			.where(
				and(eq(assetCategories.id, id), isNull(assetCategories.deletedAt)),
			)
			.limit(1);
		return row ?? null;
	}

	async findByCode(
		organizationId: string,
		code: string,
	): Promise<TAssetCategorySelect | null> {
		const [row] = await this.database
			.select()
			.from(assetCategories)
			.where(
				and(
					eq(assetCategories.organizationId, organizationId),
					eq(assetCategories.code, code),
					isNull(assetCategories.deletedAt),
				),
			)
			.limit(1);
		return row ?? null;
	}

	async create(
		data: TAssetCategoryCreateData & { createdAt: Date },
		tx?: TTx,
	): Promise<TAssetCategorySelect> {
		const db = tx ?? this.database;
		const [row] = await db.insert(assetCategories).values(data).returning();
		return row;
	}

	async update(
		id: string,
		data: TAssetCategoryUpdateData,
		tx?: TTx,
	): Promise<TAssetCategorySelect | null> {
		const db = tx ?? this.database;
		const [row] = await db
			.update(assetCategories)
			.set({ ...data, updatedAt: new Date() })
			.where(
				and(eq(assetCategories.id, id), isNull(assetCategories.deletedAt)),
			)
			.returning();
		return row ?? null;
	}

	async archive(id: string, tx?: TTx): Promise<TAssetCategorySelect | null> {
		const db = tx ?? this.database;
		const [row] = await db
			.update(assetCategories)
			.set({ deletedAt: new Date(), updatedAt: new Date() })
			.where(
				and(eq(assetCategories.id, id), isNull(assetCategories.deletedAt)),
			)
			.returning();
		return row ?? null;
	}
}
