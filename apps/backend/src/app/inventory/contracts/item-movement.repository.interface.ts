import type { TPaginationResult } from '@ims-erp/common';
import type { MovementType, TMovementSelect } from '@drizzle/schemas/inventory.schema';
import type { TTx } from '@drizzle/types';
import type { TItemHistoryPaginationRequest } from './item-operations.repository.interface';

/** An item (asset) movement: `item_id` set, `product_id` null, quantity 1. */
export type TItemMovementSelect = TMovementSelect & { itemId: string };

/** Fields the custody service supplies when appending an item movement. */
export type TItemMovementCreateData = {
	organizationId: string | null;
	/** Allocated by `InventoryNumberingService` inside the caller's transaction. */
	code: string;
	itemId: string;
	movementType: MovementType;
	warehouseId?: string | null;
	binId?: string | null;
	targetWarehouseId?: string | null;
	targetBinId?: string | null;
	fromLocation?: string | null;
	toLocation?: string | null;
	referenceType?: string | null;
	referenceId?: string | null;
	occurredAt: Date;
	createdBy?: string | null;
	notes?: string | null;
};

/**
 * Persistence port for the item side of `inventory.movements`.
 *
 * @remarks
 * Append-only like the product ledger; the product side is `IMovementRepository`
 * and never reads these rows (Q24: exactly one of `product_id` / `item_id`).
 */
export interface IItemMovementRepository {
	create(data: TItemMovementCreateData, tx?: TTx): Promise<TItemMovementSelect>;

	/** Fetches one page of the unit's location trail, newest first. */
	paginateByItem(
		request: TItemHistoryPaginationRequest,
	): Promise<TPaginationResult<TItemMovementSelect>>;
}
