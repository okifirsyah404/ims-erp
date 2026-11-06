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
	create(data: TUnitCreateData): Promise<TSerialTrackedItemSelect>;

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
}
