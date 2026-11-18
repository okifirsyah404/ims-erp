import type { TTx } from '@drizzle/types';
import type { TPaginationResult } from '@ims-erp/common';
import type {
	TSerialTrackedItemSelect,
	UnitStatus,
} from '@drizzle/schemas/inventory.schema';

/** Pagination + status filter for a unit list. */
export type TUnitPaginationRequest = {
	page: number;
	limit: number;
	itemId?: string;
	status?: UnitStatus;
	warehouseId?: string;
};

/** Fields required to insert a unit. */
export type TUnitCreateData = Pick<
	TSerialTrackedItemSelect,
	'organizationId' | 'itemId' | 'serialNumber' | 'status'
> &
	Partial<
		Omit<
			TSerialTrackedItemSelect,
			'id' | 'createdAt' | 'updatedAt' | 'deletedAt'
		>
	>;

/**
 * Serialized-unit persistence contract.
 *
 * @remarks
 * Only the operations the item slice needs; stock flows extend this contract
 * when they land. Borrowing moved to Assets in ERP-0036.
 */
export interface ISerialUnitRepository {
	/** Fetches one filtered page of units. */
	paginate(
		request: TUnitPaginationRequest,
	): Promise<TPaginationResult<TSerialTrackedItemSelect>>;

	/** Fetches one alive unit by id. */
	findById(id: string): Promise<TSerialTrackedItemSelect | null>;

	/** Fetches one alive unit by tenant + serial number. */
	findBySerial(
		organizationId: string | null,
		serialNumber: string,
	): Promise<TSerialTrackedItemSelect | null>;

	/** Inserts a unit. */
	create(data: TUnitCreateData, tx?: TTx): Promise<TSerialTrackedItemSelect>;

	/**
	 * Replaces a provisional serial with the real one, exactly once.
	 *
	 * @returns The updated unit, or `null` when the guard did not match
	 * (unit missing, already non-provisional, or no longer `pre_order`)
	 */
	replaceProvisionalSerial(
		id: string,
		serialNumber: string,
	): Promise<TSerialTrackedItemSelect | null>;

	/** Applies a status transition. */
	updateStatus(
		id: string,
		status: UnitStatus,
	): Promise<TSerialTrackedItemSelect | null>;

	/** Serial numbers of the item's units `in_stock` in one warehouse (ADR-0011 step 5a). */
	listInStockSerials(itemId: string, warehouseId: string): Promise<string[]>;

	/**
	 * Marks the listed units sold to a customer, guarded on `status =
	 * 'in_stock'` and the warehouse inside the update; custody leaves the
	 * warehouse.
	 *
	 * @returns The serial numbers actually sold (fewer than asked = some were
	 * not in stock there)
	 */
	sell(
		itemId: string,
		serialNumbers: readonly string[],
		data: { warehouseId: string; customerId: string | null; stockMovementId: string | null },
		tx: TTx,
	): Promise<string[]>;

	/** Serial numbers of the item's units in `statuses` in one warehouse. */
	listSerialsInStatuses(itemId: string, warehouseId: string, statuses: readonly UnitStatus[]): Promise<string[]>;

	/**
	 * Takes sold units back from a customer (ERP-0065), guarded on
	 * `status = 'sold'`: custody returns to the warehouse, `in_stock` or
	 * `damaged`, and the customer link is cleared.
	 *
	 * @returns The serial numbers actually taken back
	 */
	receiveFromCustomer(
		itemId: string,
		serialNumbers: readonly string[],
		data: { warehouseId: string; binId: string | null; status: 'in_stock' | 'damaged'; stockMovementId: string | null },
		tx: TTx,
	): Promise<string[]>;

	/**
	 * Marks the listed units returned to the supplier (ERP-0068), guarded on
	 * `status IN ('in_stock', 'damaged')` and the warehouse inside the
	 * update; custody leaves the warehouse.
	 *
	 * @returns The serial numbers actually returned
	 */
	returnToSupplier(
		itemId: string,
		serialNumbers: readonly string[],
		data: { warehouseId: string; stockMovementId: string | null },
		tx: TTx,
	): Promise<string[]>;
}
