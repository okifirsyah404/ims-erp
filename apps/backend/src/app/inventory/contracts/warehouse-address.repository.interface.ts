import type {
	TWarehouseAddressInsert,
	TWarehouseAddressSelect,
} from '@drizzle/schemas/inventory.schema';

/**
 * Fields a client may set on a warehouse address.
 *
 * @remarks
 * `warehouseId` is excluded: it is always the route parameter, never body
 * input. `deletedAt` is managed by the repository.
 */
export type TWarehouseAddressUpsertData = Omit<
	TWarehouseAddressInsert,
	'id' | 'warehouseId' | 'createdAt' | 'updatedAt' | 'deletedAt'
>;

/**
 * Warehouse address persistence contract.
 *
 * @remarks
 * Strictly 1:1 with `warehouses`. The `warehouse_addresses_warehouse_uq`
 * unique index is the enforcement; the service converts a violation into a
 * 409 rather than letting a raw driver error escape.
 */
export interface IWarehouseAddressRepository {
	/** Fetches the alive address of a warehouse, if it has one. */
	findByWarehouseId(
		warehouseId: string,
	): Promise<TWarehouseAddressSelect | null>;

	/**
	 * Creates or replaces a warehouse's address.
	 *
	 * @remarks
	 * Upsert rather than create-then-update: the 1:1 relationship means there
	 * is never a second address to distinguish, and a `PUT` endpoint maps onto
	 * it directly.
	 */
	upsert(
		warehouseId: string,
		data: TWarehouseAddressUpsertData,
	): Promise<TWarehouseAddressSelect>;

	/** Removes a warehouse's address outright (real delete, 1:1 child). */
	remove(warehouseId: string): Promise<boolean>;
}
