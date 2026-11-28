import type { TTx } from '@drizzle/types';
import type { TPaginationResult } from '@ims-erp/common';
import type {
	TItemSerialSelect,
	SerialStatus,
} from '@drizzle/schemas/inventory.schema';

/** Pagination + status filter for a unit list. */
export type TUnitPaginationRequest = {
	page: number;
	limit: number;
	productId?: string;
	status?: SerialStatus;
	warehouseId?: string;
};

/** Fields required to insert a unit. */
export type TUnitCreateData = Pick<
	TItemSerialSelect,
	'organizationId' | 'productId' | 'serialNumber' | 'status'
> &
	Partial<
		Omit<
			TItemSerialSelect,
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
export interface IItemSerialRepository {
	/** Fetches one filtered page of units. */
	paginate(
		request: TUnitPaginationRequest,
	): Promise<TPaginationResult<TItemSerialSelect>>;

	/** Fetches one alive unit by id. */
	findById(id: string): Promise<TItemSerialSelect | null>;

	/** Fetches one alive unit by tenant + serial number. */
	findBySerial(
		organizationId: string | null,
		serialNumber: string,
	): Promise<TItemSerialSelect | null>;

	/** Inserts a unit. */
	create(data: TUnitCreateData, tx?: TTx): Promise<TItemSerialSelect>;

	/**
	 * Replaces a provisional serial with the real one, exactly once.
	 *
	 * @returns The updated unit, or `null` when the guard did not match
	 * (unit missing, already non-provisional, or no longer `pre_order`)
	 */
	replaceProvisionalSerial(
		id: string,
		serialNumber: string,
	): Promise<TItemSerialSelect | null>;

	/** Applies a status transition. */
	updateStatus(
		id: string,
		status: SerialStatus,
	): Promise<TItemSerialSelect | null>;

	/** Serial numbers of the item's units `in_stock` in one warehouse (ADR-0011 step 5a). */
	listInStockSerials(productId: string, warehouseId: string): Promise<string[]>;

	/**
	 * Marks the listed units sold to a customer, guarded on `status =
	 * 'in_stock'` and the warehouse inside the update; custody leaves the
	 * warehouse.
	 *
	 * @returns The serial numbers actually sold (fewer than asked = some were
	 * not in stock there)
	 */
	sell(
		productId: string,
		serialNumbers: readonly string[],
		data: { warehouseId: string; customerId: string | null; movementId: string | null },
		tx: TTx,
	): Promise<string[]>;

	/**
	 * B-29: takes `in_stock` units of one warehouse out on a manual issue
	 * (`issued`); custody leaves the warehouse.
	 *
	 * @returns The serial numbers actually issued
	 */
	issue(
		productId: string,
		serialNumbers: readonly string[],
		data: { warehouseId: string; movementId: string | null },
		tx: TTx,
	): Promise<string[]>;

	/**
	 * B-29: brings `issued` units back into a warehouse on a manual receipt.
	 *
	 * @returns The serial numbers actually brought back
	 */
	receiveIssued(
		productId: string,
		serialNumbers: readonly string[],
		data: { warehouseId: string; binId: string | null; movementId: string | null },
		tx: TTx,
	): Promise<string[]>;

	/** Serial numbers of the item's units in `statuses` in one warehouse. */
	listSerialsInStatuses(productId: string, warehouseId: string, statuses: readonly SerialStatus[]): Promise<string[]>;

	/**
	 * Takes sold units back from a customer (ERP-0065), guarded on
	 * `status = 'sold'`: custody returns to the warehouse, `in_stock` or
	 * `damaged`, and the customer link is cleared.
	 *
	 * @returns The serial numbers actually taken back
	 */
	receiveFromCustomer(
		productId: string,
		serialNumbers: readonly string[],
		data: { warehouseId: string; binId: string | null; status: 'in_stock' | 'damaged'; movementId: string | null },
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
		productId: string,
		serialNumbers: readonly string[],
		data: { warehouseId: string; movementId: string | null },
		tx: TTx,
	): Promise<string[]>;
	/**
	 * Live serialized units held in a warehouse `inventory` does not own.
	 *
	 * @remarks
	 * The unit table stayed in `inventory` when the warehouse estate moved to
	 * the `warehouse` module (ADR-0026), so counts are read here and published
	 * through `ExportedInventoryService`.
	 */
	countLiveUnits(warehouseId: string): Promise<number>;

	/** Live serialized units of one product, excluding `lost` (archive guard). */
	countLiveUnitsByProduct(productId: string): Promise<number>;

	/**
	 * Live serialized units per `(warehouse, product)`.
	 *
	 * @remarks
	 * Grouped by product, not by kind: the product kind is the `product`
	 * module's vocabulary, so the caller sums per kind through its facade.
	 */
	countByWarehouse(
		warehouseIds: string[],
	): Promise<Array<{ warehouseId: string | null; productId: string; value: number }>>;
}
