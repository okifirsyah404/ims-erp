import type { TWarehouseManagerSelect } from '@drizzle/schemas/inventory.schema';
import type { IWarehousePicResolver } from '@authorization/warehouse-pic-resolver';

/**
 * Person-in-charge assignment persistence contract (ADR-0017).
 *
 * @remarks
 * Extends {@link IWarehousePicResolver} so the same object satisfies the
 * `warehouseGuard` port without an adapter — one method name, two consumers
 * (the guard and `WarehouseManagerService.listMine`).
 *
 * Reads are always "alive only": a soft-deleted assignment grants nothing.
 */
export interface IWarehouseManagerRepository extends IWarehousePicResolver {
	/** The alive assignment for a pair, or `null`. */
	findActive(
		warehouseId: string,
		userId: string,
	): Promise<TWarehouseManagerSelect | null>;

	/** Alive assignments of one warehouse, oldest first (admin listing). */
	listByWarehouse(warehouseId: string): Promise<TWarehouseManagerSelect[]>;

	/**
	 * Creates an alive assignment, reviving a soft-deleted one for the pair.
	 *
	 * @remarks
	 * Revival mirrors `linkOrganization`: the partial unique index
	 * `warehouse_managers_uq` only constrains alive rows, so a fresh insert
	 * after an archive would leave the dead row behind for no reason.
	 */
	assign(input: {
		warehouseId: string;
		userId: string;
		/** The acting application admin; `null` for a system/seeder write. */
		assignedBy: string | null;
	}): Promise<TWarehouseManagerSelect>;

	/** Soft-deletes the alive assignment. `false` when none exists. */
	unassign(warehouseId: string, userId: string): Promise<boolean>;
}
