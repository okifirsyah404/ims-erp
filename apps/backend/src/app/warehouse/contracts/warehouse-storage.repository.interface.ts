import type {
	TWarehouseStorageInsert,
	TWarehouseStorageSelect,
} from '@drizzle/schemas/warehouse.schema';

/**
 * Fields a client may set when creating a storage (bin).
 *
 * @remarks
 * `warehouseId` is required here (unlike the client-facing shape): the service
 * always resolves it from the route, and the repository must never guess.
 */
export type TWarehouseStorageCreateData = Omit<
	TWarehouseStorageInsert,
	'id' | 'createdAt' | 'updatedAt' | 'deletedAt'
> & { createdAt?: Date };

/**
 * Fields a client may change on an existing storage.
 *
 * @remarks
 * `code` is immutable for the same reason warehouse `code` is: it is the
 * human-facing identifier and is half of the
 * `UNIQUE(warehouse_id, code) WHERE deleted_at IS NULL` constraint.
 */
export type TWarehouseStorageUpdateData = Partial<
	Omit<
		TWarehouseStorageInsert,
		'id' | 'warehouseId' | 'code' | 'createdAt' | 'updatedAt'
	>
>;

/**
 * Warehouse storage (bin) persistence contract.
 *
 * @remarks
 * Storages are flat: there is no zone level (plan D14). Reads exclude
 * soft-deleted rows unless `includeArchived` is set. Uniqueness of
 * `(warehouse_id, code)` applies among alive rows only.
 */
export interface IWarehouseStorageRepository {
	/** Lists storages of a warehouse, ordered by code. */
	listByWarehouse(
		warehouseId: string,
		options?: { includeArchived?: boolean },
	): Promise<TWarehouseStorageSelect[]>;

	/** Fetches one alive storage by id. */
	findById(id: string): Promise<TWarehouseStorageSelect | null>;

	/** Fetches one alive storage by warehouse + code. */
	findByCode(
		warehouseId: string,
		code: string,
	): Promise<TWarehouseStorageSelect | null>;

	/** Inserts a storage. */
	create(data: TWarehouseStorageCreateData): Promise<TWarehouseStorageSelect>;

	/**
	 * Applies a partial update to an alive storage.
	 *
	 * @returns The updated row, or `null` when absent/deleted
	 */
	update(
		id: string,
		data: TWarehouseStorageUpdateData,
	): Promise<TWarehouseStorageSelect | null>;

	/** Soft-deletes an alive storage. */
	archive(id: string): Promise<TWarehouseStorageSelect | null>;
}
