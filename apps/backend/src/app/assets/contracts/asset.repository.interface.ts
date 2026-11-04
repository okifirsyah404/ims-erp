import type { TPaginationResult } from '@ims-erp/common';
import type {
	AssetStatus,
	TAssetInsert,
	TAssetSelect,
} from '@drizzle/schemas/asset.schema';
import type { TTx } from '@drizzle/types';

/** Pagination + filters for the asset register endpoint. */
export type TAssetPaginationRequest = {
	page: number;
	limit: number;
	/** Case-insensitive partial match on `code`, `name` or `serialNumber`. */
	search?: string;
	/** Exact status filter. */
	status?: AssetStatus;
	/** Exact asset-type filter. */
	assetType?: string;
	/** Category filter. */
	categoryId?: string;
	organizationId: string;
	/** Include archived (soft-deleted) rows. */
	includeArchived?: boolean;
};

/** Fields a client may set when registering an asset. */
export type TAssetCreateData = Omit<
	TAssetInsert,
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
	| 'assignedAt'
	| 'organizationId'
> & {
	createdAt?: Date;
	organizationId: string;
	/** Overridden only by the disposal workflow. */
	status?: AssetStatus;
};

/** Fields a client may change on an existing asset. */
export type TAssetUpdateData = Partial<
	Pick<
		TAssetInsert,
		| 'name'
		| 'description'
		| 'categoryId'
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
		| 'supplierId'
		| 'purchaseOrderId'
		| 'documentId'
	>
>;

/**
 * Data-access contract over `assets.assets`.
 *
 * @remarks
 * No service holds a Drizzle handle; every SQL statement against the table
 * lives behind this interface.
 */
export interface IAssetRepository {
	paginate(
		request: TAssetPaginationRequest,
	): Promise<TPaginationResult<TAssetSelect>>;

	findById(id: string): Promise<TAssetSelect | null>;

	/** Uniqueness probe for `(organizationId, code)` among alive rows. */
	findByCode(
		organizationId: string,
		code: string,
	): Promise<TAssetSelect | null>;

	create(data: TAssetInsert, tx?: TTx): Promise<TAssetSelect>;

	update(
		id: string,
		data: TAssetUpdateData & Partial<TAssetInsert>,
		tx?: TTx,
	): Promise<TAssetSelect | null>;

	/** Soft delete — the only delete path (financial master-data rule). */
	archive(id: string, tx?: TTx): Promise<TAssetSelect | null>;

	/**
	 * Counts alive references that must block a hard delete. Currently
	 * assignments and maintenance records; the disposal FK is RESTRICT, so
	 * the database enforces that one itself.
	 */
	countReferences(id: string): Promise<{ assignments: number; maintenances: number }>;
}
