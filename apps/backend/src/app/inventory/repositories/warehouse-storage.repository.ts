import { DRIZZLE_TOKEN } from '@di/provider';
import { warehouseStorages } from '@drizzle/schemas/inventory.schema';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';
import type {
	IWarehouseStorageRepository,
	TWarehouseStorageCreateData,
	TWarehouseStorageUpdateData,
} from '../contracts/warehouse-storage.repository.interface';
import type { TWarehouseStorageSelect } from '@drizzle/schemas/inventory.schema';

/**
 * Drizzle implementation of {@link IWarehouseStorageRepository}.
 *
 * @remarks
 * Storages are flat — no zone level (plan D14). Code uniqueness is
 * `(warehouse_id, code) WHERE deleted_at IS NULL`, so a soft-deleted bin
 * releases its code for reuse; every read here therefore filters
 * `deleted_at IS NULL` unless explicitly told otherwise.
 */
@injectable()
export class WarehouseStorageRepository
	implements IWarehouseStorageRepository
{
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	/** Lists storages of a warehouse, ordered by code. */
	async listByWarehouse(
		warehouseId: string,
		options?: { includeArchived?: boolean },
	): Promise<TWarehouseStorageSelect[]> {
		return this.database
			.select()
			.from(warehouseStorages)
			.where(
				options?.includeArchived
					? eq(warehouseStorages.warehouseId, warehouseId)
					: and(
							eq(warehouseStorages.warehouseId, warehouseId),
							isNull(warehouseStorages.deletedAt),
						),
			)
			.orderBy(asc(warehouseStorages.code));
	}

	/** Fetches one alive storage by id. */
	async findById(id: string): Promise<TWarehouseStorageSelect | null> {
		const [row] = await this.database
			.select()
			.from(warehouseStorages)
			.where(
				and(
					eq(warehouseStorages.id, id),
					isNull(warehouseStorages.deletedAt),
				),
			)
			.limit(1);
		return row ?? null;
	}

	/** Fetches one alive storage by warehouse + code. */
	async findByCode(
		warehouseId: string,
		code: string,
	): Promise<TWarehouseStorageSelect | null> {
		const [row] = await this.database
			.select()
			.from(warehouseStorages)
			.where(
				and(
					eq(warehouseStorages.warehouseId, warehouseId),
					eq(warehouseStorages.code, code),
					isNull(warehouseStorages.deletedAt),
				),
			)
			.limit(1);
		return row ?? null;
	}

	/** Inserts a storage. */
	async create(
		data: TWarehouseStorageCreateData,
	): Promise<TWarehouseStorageSelect> {
		const [row] = await this.database
			.insert(warehouseStorages)
			.values({
				...data,
				createdAt: data.createdAt ?? new Date(),
			})
			.returning();
		return row;
	}

	/**
	 * Applies a partial update to an alive storage.
	 *
	 * @param id - Storage id
	 * @param data - Changed columns
	 * @returns The updated row, or `null` when absent/deleted
	 */
	async update(
		id: string,
		data: TWarehouseStorageUpdateData,
	): Promise<TWarehouseStorageSelect | null> {
		const [row] = await this.database
			.update(warehouseStorages)
			.set({ ...data, updatedAt: new Date() })
			.where(
				and(
					eq(warehouseStorages.id, id),
					isNull(warehouseStorages.deletedAt),
				),
			)
			.returning();
		return row ?? null;
	}

	/** Soft-deletes an alive storage. */
	async archive(id: string): Promise<TWarehouseStorageSelect | null> {
		const now = new Date();
		const [row] = await this.database
			.update(warehouseStorages)
			.set({ deletedAt: now, updatedAt: now })
			.where(
				and(
					eq(warehouseStorages.id, id),
					isNull(warehouseStorages.deletedAt),
				),
			)
			.returning();
		return row ?? null;
	}
}
