import { DRIZZLE_TOKEN } from '@di/provider';
import { warehouseAddresses } from '@drizzle/schemas/warehouse.schema';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { and, eq, isNull } from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';
import type {
	IWarehouseAddressRepository,
	TWarehouseAddressUpsertData,
} from '../contracts/warehouse-address.repository.interface';
import type { TWarehouseAddressSelect } from '@drizzle/schemas/warehouse.schema';

/**
 * Drizzle implementation of {@link IWarehouseAddressRepository}.
 *
 * @remarks
 * The 1:1 relationship is enforced by
 * `warehouse_addresses_warehouse_uq` (a plain unique index on `warehouse_id`,
 * not partial — a warehouse has at most one address, deleted or not). Because
 * a soft-deleted address still occupies that index slot, `upsert`
 * **revives** the existing row instead of inserting a second one; a naive
 * insert would fail with a unique violation on the second save.
 */
@injectable()
export class WarehouseAddressRepository
	implements IWarehouseAddressRepository
{
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	/** Fetches the alive address of a warehouse, if it has one. */
	async findByWarehouseId(
		warehouseId: string,
	): Promise<TWarehouseAddressSelect | null> {
		const [row] = await this.database
			.select()
			.from(warehouseAddresses)
			.where(
				and(
					eq(warehouseAddresses.warehouseId, warehouseId),
					isNull(warehouseAddresses.deletedAt),
				),
			)
			.limit(1);
		return row ?? null;
	}

	/**
	 * Creates, revives, or updates the warehouse's single address.
	 *
	 * @remarks
	 * Uses `ON CONFLICT (warehouse_id) DO UPDATE` so both "no address yet" and
	 * "address soft-deleted" converge on the same row. `deleted_at` is
	 * explicitly reset to `NULL`, which is what makes the revive work.
	 *
	 * @param warehouseId - Owning warehouse
	 * @param data - Address columns
	 */
	async upsert(
		warehouseId: string,
		data: TWarehouseAddressUpsertData,
	): Promise<TWarehouseAddressSelect> {
		const now = new Date();
		const [row] = await this.database
			.insert(warehouseAddresses)
			.values({ ...data, warehouseId, createdAt: now })
			.onConflictDoUpdate({
				target: warehouseAddresses.warehouseId,
				set: { ...data, updatedAt: now, deletedAt: null },
			})
			.returning();
		return row;
	}

	/** Removes a warehouse's address outright (real delete, 1:1 child). */
	async remove(warehouseId: string): Promise<boolean> {
		const rows = await this.database
			.delete(warehouseAddresses)
			.where(eq(warehouseAddresses.warehouseId, warehouseId))
			.returning({ id: warehouseAddresses.id });
		return rows.length > 0;
	}
}
