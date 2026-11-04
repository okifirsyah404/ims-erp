import { inject, injectable } from 'tsyringe';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { and, count, eq, ilike, isNull, or } from 'drizzle-orm';
import type { TPaginationResult } from '@ims-erp/common';
import { DRIZZLE_TOKEN } from '@di/provider';
import {
	assets,
	type TAssetInsert,
	type TAssetSelect,
} from '@drizzle/schemas/asset.schema';
import {
	assetMaintenances,
	assetAssignments,
} from '@drizzle/schemas/asset.schema';
import type { TTx } from '@drizzle/types';
import type {
	IAssetRepository,
	TAssetCreateData,
	TAssetPaginationRequest,
	TAssetUpdateData,
} from '../contracts/asset.repository.interface';

/**
 * Persistence for `assets.assets` (the register).
 *
 * @remarks
 * Owns every SQL statement against the table; the service layer holds no
 * Drizzle handle. Delete is soft-only — there is no hard-delete method, by
 * contract (financial master-data rule).
 */
@injectable()
export class AssetRepository implements IAssetRepository {
	constructor(
		@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase,
	) {}

	async paginate(
		request: TAssetPaginationRequest,
	): Promise<TPaginationResult<TAssetSelect>> {
		const {
			page,
			limit,
			search,
			status,
			assetType,
			categoryId,
			organizationId,
			includeArchived,
		} = request;

		const filters = [
			eq(assets.organizationId, organizationId),
			includeArchived ? undefined : isNull(assets.deletedAt),
			status ? eq(assets.status, status) : undefined,
			assetType ? eq(assets.assetType, assetType) : undefined,
			categoryId ? eq(assets.categoryId, categoryId) : undefined,
			search
				? or(
						ilike(assets.code, `%${search}%`),
						ilike(assets.name, `%${search}%`),
						ilike(assets.serialNumber, `%${search}%`),
					)
				: undefined,
		].filter(Boolean);
		const where = and(...filters);

		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(assets)
			.where(where);

		const data = await this.database
			.select()
			.from(assets)
			.where(where)
			.orderBy(assets.code)
			.limit(limit)
			.offset((page - 1) * limit);

		return {
			meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
			data,
		};
	}

	async findById(id: string): Promise<TAssetSelect | null> {
		const [row] = await this.database
			.select()
			.from(assets)
			.where(and(eq(assets.id, id), isNull(assets.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	async findByCode(
		organizationId: string,
		code: string,
	): Promise<TAssetSelect | null> {
		const [row] = await this.database
			.select()
			.from(assets)
			.where(
				and(
					eq(assets.organizationId, organizationId),
					eq(assets.code, code),
					isNull(assets.deletedAt),
				),
			)
			.limit(1);
		return row ?? null;
	}

	async create(data: TAssetInsert, tx?: TTx): Promise<TAssetSelect> {
		const db = tx ?? this.database;
		const [row] = await db.insert(assets).values(data).returning();
		return row;
	}

	async update(
		id: string,
		data: TAssetUpdateData & Partial<TAssetInsert>,
		tx?: TTx,
	): Promise<TAssetSelect | null> {
		const db = tx ?? this.database;
		const [row] = await db
			.update(assets)
			.set({ ...data, updatedAt: new Date() })
			.where(and(eq(assets.id, id), isNull(assets.deletedAt)))
			.returning();
		return row ?? null;
	}

	async archive(id: string, tx?: TTx): Promise<TAssetSelect | null> {
		const db = tx ?? this.database;
		const [row] = await db
			.update(assets)
			.set({ deletedAt: new Date(), updatedAt: new Date() })
			.where(and(eq(assets.id, id), isNull(assets.deletedAt)))
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
	): Promise<{ assignments: number; maintenances: number }> {
		const [assignmentRow] = await this.database
			.select({ value: count() })
			.from(assetAssignments)
			.where(
				and(
					eq(assetAssignments.assetId, id),
					isNull(assetAssignments.deletedAt),
				),
			);
		const [maintenanceRow] = await this.database
			.select({ value: count() })
			.from(assetMaintenances)
			.where(
				and(
					eq(assetMaintenances.assetId, id),
					isNull(assetMaintenances.deletedAt),
				),
			);
		return {
			assignments: assignmentRow.value,
			maintenances: maintenanceRow.value,
		};
	}
}

export type { TAssetCreateData };
