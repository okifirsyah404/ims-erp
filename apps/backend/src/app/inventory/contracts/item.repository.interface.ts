import type { TPaginationResult } from '@ims-erp/common';
import type {
	ItemStatus,
	TItemInsert,
	TItemSelect,
} from '@drizzle/schemas/inventory.schema';
import type { TTx } from '@drizzle/types';

/** Pagination + filters for the asset register endpoint. */
export type TItemPaginationRequest = {
	page: number;
	limit: number;
	/** Case-insensitive partial match on `code`, `name` or `serialNumber`. */
	search?: string;
	/** Exact status filter. */
	status?: ItemStatus;
	/** Exact asset-type filter. */
	itemKind?: string;
	/** Category filter. */
	itemCategoryId?: string;
	organizationId: string;
	/** Include archived (soft-deleted) rows. */
	includeArchived?: boolean;
};

/** Fields a client may set when registering an asset. */
export type TItemCreateData = Omit<
	TItemInsert,
	| 'id'
	| 'createdAt'
	| 'updatedAt'
	| 'deletedAt'
	// Server-owned columns: code via ERP-0009, book value derived.
	| 'code'
	| 'bookValue'
	| 'accumulatedDepreciation'
	| 'status'
	| 'deactivationReason'
	| 'borrowedSince'
	| 'organizationId'
> & {
	createdAt?: Date;
	organizationId: string;
	/** Overridden only by the disposal workflow. */
	status?: ItemStatus;
};

/** Fields a client may change on an existing asset. */
export type TItemUpdateData = Partial<
	Pick<
		TItemInsert,
		| 'name'
		| 'description'
		| 'itemCategoryId'
		| 'serialNumber'
		| 'barcode'
		| 'acquisitionDate'
		| 'acquisitionCost'
		| 'salvageValue'
		| 'currencyCode'
		| 'usefulLifeMonths'
		| 'depreciationMethod'
		| 'depreciationStartedOn'
		| 'locationDescription'
		| 'custodianEmployeeId'
		| 'supplierCompanyId'
		| 'purchaseOrderId'
		| 'documentId'
	>
>;

/**
 * Data-access contract over `items.assets`.
 *
 * @remarks
 * No service holds a Drizzle handle; every SQL statement against the table
 * lives behind this interface.
 */
export interface IItemRepository {
	paginate(
		request: TItemPaginationRequest,
	): Promise<TPaginationResult<TItemSelect>>;

	findById(id: string): Promise<TItemSelect | null>;

	/** Uniqueness probe for `(organizationId, code)` among alive rows. */
	findByCode(
		organizationId: string,
		code: string,
	): Promise<TItemSelect | null>;

	create(data: TItemInsert, tx?: TTx): Promise<TItemSelect>;

	update(
		id: string,
		data: TItemUpdateData & Partial<TItemInsert>,
		tx?: TTx,
	): Promise<TItemSelect | null>;

	/** Soft delete — the only delete path (financial master-data rule). */
	archive(id: string, tx?: TTx): Promise<TItemSelect | null>;

	/**
	 * Counts alive references that must block a hard delete. Currently
	 * assignments and maintenance records; the disposal FK is RESTRICT, so
	 * the database enforces that one itself.
	 */
	countReferences(id: string): Promise<{ borrowings: number; maintenances: number }>;

	/**
	 * Counts alive assets grouped by warehouse, optionally restricted to one
	 * asset type. Used by the inventory module (via {@link ItemService}) to
	 * decorate warehouses with equipment counts. Unallocated rows come back
	 * with `warehouseId: null` and are ignored by the caller.
	 */
	countByWarehouse(
		warehouseIds: string[],
		itemKind?: string,
	): Promise<Array<{ warehouseId: string | null; value: number }>>;
}
