import type { TPaginationResult } from '@ims-erp/common';
import type {
	TSerialTrackedItemSelect,
	UnitStatus,
} from '@drizzle/schemas/inventory.schema';
import type { TTx } from '@drizzle/types';

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
 * Only the operations the item slice needs; stock and borrowing flows extend
 * this contract when they land.
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

	/**
	 * Moves a unit's custody to a borrower.
	 *
	 * @returns The updated unit, or `null` when it was not `in_stock`
	 */
	issueToBorrower(
		id: string,
		borrowingLineId: string,
		tx?: TTx,
	): Promise<TSerialTrackedItemSelect | null>;

	/**
	 * Restores a borrowed unit to a warehouse.
	 *
	 * @returns The updated unit, or `null` when it was not `borrowed`
	 */
	returnFromBorrower(
		id: string,
		warehouseId: string,
		binId: string | null,
		tx?: TTx,
	): Promise<TSerialTrackedItemSelect | null>;

	/**
	 * Marks a borrowed unit lost.
	 *
	 * @returns The updated unit, or `null` when it was not `borrowed`
	 */
	markLost(id: string, tx?: TTx): Promise<TSerialTrackedItemSelect | null>;
}
