import type { TPaginationResult } from '@ims-erp/common';
import type { TStockSelect } from '@drizzle/schemas/inventory.schema';
import type { TTx } from '@drizzle/types';

/**
 * Pagination + filters for the balance list.
 *
 * @remarks
 * `scopeOrganizationId` follows the **warehouse** scope, not the caller's org:
 * a global warehouse's balance row carries `organization_id = NULL`, and every
 * organization sees that same row. `undefined` means "every scope" and is only
 * legitimate for an application admin.
 */
export type TStockPaginationRequest = {
	page: number;
	limit: number;
	/** `undefined` = all scopes (admin only), `null` = shared/global rows. */
	scopeOrganizationId?: string | null;
	warehouseId?: string;
	productId?: string;
	binId?: string;
	/** Only balances with `quantity_on_hand > 0`. */
	inStockOnly?: boolean;
};

/** The key that identifies one balance row. */
export type TStockKey = {
	/** `null` for a global (shared) warehouse. */
	scopeOrganizationId: string | null;
	productId: string;
	warehouseId: string;
	/** `null` when the stock is not assigned to a bin. */
	binId: string | null;
};

/** The signed delta applied to a balance. */
export type TStockDelta = {
	/** Signed decimal string, e.g. `'10.000'` or `'-3.000'`. */
	quantity: string;
	/** When the movement that caused this delta occurred. */
	occurredAt: Date;
};

/**
 * Balance persistence contract.
 *
 * @remarks
 * `applyDelta` is the ONLY way quantity changes, and it is **serialized per
 * balance row**: upsert-if-absent → `SELECT … FOR UPDATE` → conditional
 * `UPDATE … WHERE quantity_on_hand + delta >= 0`. Two concurrent posts against
 * the same `(scope, warehouse, item, bin)` cannot lose an update, and the
 * database itself refuses a delta that would drive the balance negative —
 * the service throws {@link InsufficientStockError} in that case. The CHECK
 * constraints on `stocks` are the last line of defense.
 *
 * `quantity_available` is maintained in the same statement (it is a CHECK
 * constraint: `available = on_hand - reserved`), and stays equal to
 * `quantity_on_hand` until reservations are built.
 */
export interface IStockRepository {
	/** Fetches one filtered page of balances. */
	paginate(
		request: TStockPaginationRequest,
	): Promise<TPaginationResult<TStockSelect>>;

	/** Fetches the balance for an exact key, if it exists. */
	findByKey(key: TStockKey): Promise<TStockSelect | null>;

	/** Lists every balance in one scope. Used by the recompute repair path. */
	listByScope(
		scopeOrganizationId: string | null,
	): Promise<TStockSelect[]>;

	/**
	 * Atomically adds a signed delta to a balance, creating it if absent.
	 *
	 * @param key - Which balance to touch
	 * @param delta - Signed quantity and the movement time
	 * @returns The row after the update
	 */
	applyDelta(
		key: TStockKey,
		delta: TStockDelta,
		tx?: TTx,
	): Promise<TStockSelect>;

	/**
	 * Sets a balance to an absolute quantity, creating it if absent.
	 *
	 * @remarks
	 * Only for `recomputeFromLedger`: the recompute derives the truth from the
	 * ledger, so it overwrites rather than accumulating — that is what makes it
	 * idempotent.
	 */
	setQuantity(
		key: TStockKey,
		quantity: string,
		lastMovementAt: Date | null,
		tx?: TTx,
	): Promise<TStockSelect>;

	/**
	 * Ensures the balance row exists and locks it (`FOR UPDATE`) for a cost
	 * update inside `tx`; returns the quantity and cost before the movement.
	 */
	lockForCost(
		key: TStockKey,
		tx: TTx,
	): Promise<{ quantityOnHand: string; averageCost: number; totalValue: number }>;

	/** Sets the moving-average cost and value of a balance (ADR-0011 §5). */
	setCost(key: TStockKey, cost: { averageCost: number; totalValue: number }, tx?: TTx): Promise<void>;

	/** Hard-deletes a balance row (recompute cleanup for empty keys). */
	remove(key: TStockKey): Promise<boolean>;

	/** Available quantity per item over every warehouse (website catalog, M04). */
	availableByProducts(productIds: string[]): Promise<{ productId: string; available: number }[]>;
}
