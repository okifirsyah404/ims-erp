import type { TPaginationResult } from '@ims-erp/common';
import type {
	TAssetConditionCheckSelect,
	TAssetDepreciationSelect,
	TAssetDisposalSelect,
	TAssetDocumentSelect,
	TAssetMaintenanceSelect,
	TAssetMovementSelect,
	TToolSetItemSelect,
	TToolSetSelect,
} from '@drizzle/schemas/asset.schema';
import type { TTx } from '@drizzle/types';

/**
 * Data-access contract over the asset operation tables (movements, condition
 * checks, maintenances, depreciations, disposals, documents, tool sets).
 *
 * @remarks
 * Grouped in one repository because they are all child ledgers of the
 * asset register; no service holds a Drizzle handle.
 */
export interface IAssetOperationsRepository {
	/* ------------------------------ custody ------------------------------ */

	/**
	 * The open borrowing line of an asset, if any — what `syncCustody` and
	 * `reconcileStatus` derive from (D7/D8).
	 */
	findOpenBorrowingLine(
		assetId: string,
		tx?: TTx,
	): Promise<{ issuedAt: Date | null } | null>;

	/** Whether the asset is on a maintenance that has not finished. */
	hasOpenMaintenance(assetId: string, tx?: TTx): Promise<boolean>;

	/* ----------------------------- movements ----------------------------- */

	createMovement(
		data: {
			organizationId: string;
			assetId: string;
			movementType: string;
			fromWarehouseId?: string | null;
			fromStorageId?: string | null;
			toWarehouseId?: string | null;
			toStorageId?: string | null;
			fromLocation?: string | null;
			toLocation?: string | null;
			movedAt: Date;
			movedByUserId?: string | null;
			condition?: string | null;
			notes?: string | null;
			createdAt: Date;
		},
		tx?: TTx,
	): Promise<TAssetMovementSelect>;

	listMovements(
		assetId: string,
		organizationId: string,
		page: number,
		limit: number,
	): Promise<TPaginationResult<TAssetMovementSelect>>;

	/* -------------------------- condition checks ------------------------- */

	createConditionCheck(
		data: {
			organizationId: string;
			assetId: string;
			checkDate: string;
			condition: string;
			findings?: string | null;
			checkedByUserId?: string | null;
			nextCheckDate?: string | null;
			status?: string;
			createdAt: Date;
		},
		tx?: TTx,
	): Promise<TAssetConditionCheckSelect>;

	listConditionChecks(
		assetId: string,
		organizationId: string,
		page: number,
		limit: number,
	): Promise<TPaginationResult<TAssetConditionCheckSelect>>;

	/* ---------------------------- maintenances --------------------------- */

	createMaintenance(
		data: {
			organizationId: string;
			code: string;
			assetId: string;
			maintenanceType?: string;
			scheduledDate?: string | null;
			performedDate?: string | null;
			performedByEmployeeId?: string | null;
			vendorName?: string | null;
			cost?: number;
			currencyCode?: string;
			description?: string | null;
			status?: string;
			nextServiceDate?: string | null;
			documentId?: string | null;
			createdAt: Date;
		},
		tx?: TTx,
	): Promise<TAssetMaintenanceSelect>;

	listMaintenances(
		assetId: string,
		organizationId: string,
		page: number,
		limit: number,
	): Promise<TPaginationResult<TAssetMaintenanceSelect>>;

	/* --------------------------- depreciations --------------------------- */

	/** Idempotency probe: one entry per asset per period. */
	findDepreciationPeriod(
		assetId: string,
		periodYear: number,
		periodMonth: number,
	): Promise<TAssetDepreciationSelect | null>;

	createDepreciation(
		data: {
			organizationId: string;
			assetId: string;
			periodYear: number;
			periodMonth: number;
			depreciationMethod: string;
			depreciationAmount: number;
			openingBookValue: number;
			closingBookValue: number;
			currencyCode: string;
			calculatedAt?: Date | null;
			createdAt: Date;
		},
		tx?: TTx,
	): Promise<TAssetDepreciationSelect>;

	listDepreciations(
		assetId: string,
		organizationId: string,
		page: number,
		limit: number,
	): Promise<TPaginationResult<TAssetDepreciationSelect>>;

	/* ------------------------------ disposals ---------------------------- */

	createDisposal(
		data: {
			organizationId: string;
			code: string;
			assetId: string;
			disposalDate?: string | null;
			disposalMethod?: string;
			proceedsAmount?: number;
			currencyCode?: string;
			buyerName?: string | null;
			status?: string;
			requestedBy?: string | null;
			createdAt: Date;
		},
		tx?: TTx,
	): Promise<TAssetDisposalSelect>;

	findDisposalById(
		id: string,
	): Promise<TAssetDisposalSelect | null>;

	listDisposals(
		organizationId: string,
		page: number,
		limit: number,
	): Promise<TPaginationResult<TAssetDisposalSelect>>;

	/** Applies a status change to a disposal; returns null when absent. */
	updateDisposal(
		id: string,
		data: Partial<TAssetDisposalSelect>,
		tx?: TTx,
	): Promise<TAssetDisposalSelect | null>;

	/**
	 * Atomically claims the disposal for execution: conditional
	 * `UPDATE … WHERE status = 'approved' AND executed_at IS NULL` — one
	 * concurrent execution wins (Phase I-4 lesson).
	 */
	claimForExecution(id: string, tx: TTx): Promise<TAssetDisposalSelect | null>;

	/* ------------------------------ documents ---------------------------- */

	createDocument(
		data: {
			organizationId: string;
			assetId: string;
			documentId: string;
			documentType: string;
			createdAt: Date;
		},
		tx?: TTx,
	): Promise<TAssetDocumentSelect>;

	listDocuments(
		assetId: string,
		organizationId: string,
	): Promise<TAssetDocumentSelect[]>;

	/* ------------------------------ tool sets ---------------------------- */

	createToolSet(
		data: {
			organizationId: string;
			code: string;
			name: string;
			description?: string | null;
			custodianEmployeeId?: string | null;
			status?: string;
			createdAt: Date;
		},
		tx?: TTx,
	): Promise<TToolSetSelect>;

	findToolSetById(id: string): Promise<TToolSetSelect | null>;

	listToolSets(
		organizationId: string,
		page: number,
		limit: number,
	): Promise<TPaginationResult<TToolSetSelect>>;

	updateToolSet(
		id: string,
		data: Partial<TToolSetSelect>,
		tx?: TTx,
	): Promise<TToolSetSelect | null>;

	archiveToolSet(id: string, tx?: TTx): Promise<TToolSetSelect | null>;

	listToolSetItems(toolSetId: string): Promise<TToolSetItemSelect[]>;

	addToolSetItem(
		data: {
			organizationId: string;
			toolSetId: string;
			assetId: string;
			quantity: string;
			createdAt: Date;
		},
		tx?: TTx,
	): Promise<TToolSetItemSelect>;

	/** Soft-deletes one alive line; returns whether a row matched. */
	removeToolSetItem(toolSetId: string, itemId: string, tx?: TTx): Promise<boolean>;
}
