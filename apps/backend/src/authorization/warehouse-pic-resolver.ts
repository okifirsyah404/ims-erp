/**
 * Seam between the `warehouseGuard` and the inventory module (ADR-0017).
 *
 * @remarks
 * The guard must not touch Drizzle: it resolves this port through
 * {@link WAREHOUSE_PIC_RESOLVER_TOKEN}, exactly like `erpGuard` resolves
 * {@link import('./permission-resolver').IPermissionResolver}. The inventory
 * module registers the implementation (its `WarehouseManagerRepository`), so
 * the dependency still points from authorization to a contract, not to a
 * domain repository.
 *
 * One call answers both questions the guard asks: "is the caller a PIC of
 * *this* warehouse?" and "is the caller a PIC of *any* warehouse?" — the
 * second decides 403 (no grant at all) versus 404 (grant elsewhere, so the
 * warehouse's existence must not be leaked).
 */
import type { InjectionToken } from 'tsyringe';

/** Person-in-charge lookup used by the warehouse guard. */
export interface IWarehousePicResolver {
	/**
	 * Live warehouses the user is an active person in charge of.
	 *
	 * @param userId - The authenticated caller
	 * @returns Warehouse ids; empty when the user holds no live grant
	 */
	listWarehouseIdsForUser(userId: string): Promise<string[]>;
}

export const WAREHOUSE_PIC_RESOLVER_TOKEN: InjectionToken<IWarehousePicResolver> =
	Symbol('WAREHOUSE_PIC_RESOLVER');
