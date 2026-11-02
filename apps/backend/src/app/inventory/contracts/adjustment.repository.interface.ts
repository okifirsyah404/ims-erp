import type { TPaginationResult } from '@ims-erp/common';
import type {
	AdjustmentStatus,
	AdjustmentType,
	TStockAdjustmentInsert,
	TStockAdjustmentItemInsert,
	TStockAdjustmentItemSelect,
	TStockAdjustmentSelect,
} from '@drizzle/schemas/inventory.schema';
import type { TTx } from '@drizzle/types';

/**
 * Pagination + filters for the adjustment list.
 *
 * @remarks
 * `organizationId` here is a **plain tenant filter** (not the tri-state balance
 * scope): `stock_adjustments.organization_id` is NOT NULL, so there is no
 * global-adjustment case to express.
 */
export type TAdjustmentPaginationRequest = {
	page: number;
	limit: number;
	/** Exact tenant filter. Always supplied except for an application admin. */
	organizationId?: string;
	warehouseId?: string;
	status?: AdjustmentStatus;
	adjustmentType?: AdjustmentType;
	search?: string;
};

/** Fields a client supplies when raising an adjustment. */
export type TAdjustmentCreateData = {
	organizationId: string;
	warehouseId: string;
	adjustmentType: AdjustmentType;
	reasonCode?: string | null;
	notes?: string | null;
	requestedBy: string | null;
};

/** One requested line, as submitted by the client. */
export type TAdjustmentLineInput = {
	itemId: string;
	binId?: string | null;
	/**
	 * What the count says the quantity is.
	 *
	 * @remarks
	 * A **counted total**, not a delta. The service snapshots the current
	 * on-hand into `quantity_before` and derives the movement direction from
	 * `quantityAfter - quantityBefore`.
	 */
	quantityAfter: string;
	note?: string | null;
};

/** A line to insert, with its snapshot already resolved by the service. */
export type TAdjustmentLineData = Omit<
	TStockAdjustmentItemInsert,
	'id' | 'createdAt' | 'updatedAt' | 'deletedAt'
> & { createdAt?: Date };

/**
 * Stock adjustment persistence contract.
 *
 * @remarks
 * Reads exclude soft-deleted documents. Status changes go through `update`,
 * which is always paired with an optimistic predicate in the service (the
 * service reads the document, checks the edge, then writes — inside a
 * transaction) so an illegal transition cannot be persisted.
 */
export interface IAdjustmentRepository {
	/** Fetches one filtered page of adjustment documents. */
	paginate(
		request: TAdjustmentPaginationRequest,
	): Promise<TPaginationResult<TStockAdjustmentSelect>>;

	/** Fetches one alive document by id. */
	findById(id: string): Promise<TStockAdjustmentSelect | null>;

	/** Fetches one alive document by tenant + code. */
	findByCode(
		organizationId: string,
		code: string,
	): Promise<TStockAdjustmentSelect | null>;

	/** Inserts a document header, optionally inside a caller's transaction. */
	create(
		data: TStockAdjustmentInsert,
		tx?: TTx,
	): Promise<TStockAdjustmentSelect>;

	/** Applies a partial status change to an alive document. */
	update(
		id: string,
		data: Partial<TStockAdjustmentInsert>,
		tx?: TTx,
	): Promise<TStockAdjustmentSelect | null>;

	/** Lists the alive lines of a document. */
	listLines(adjustmentId: string): Promise<TStockAdjustmentItemSelect[]>;

	/** Inserts many lines in one statement, optionally in a caller's transaction. */
	createLines(
		lines: readonly TAdjustmentLineData[],
		tx?: TTx,
	): Promise<TStockAdjustmentItemSelect[]>;

	/** Replaces all lines of a document (only legal while `draft`). */
	replaceLines(
		adjustmentId: string,
		lines: readonly TAdjustmentLineData[],
		tx?: TTx,
	): Promise<TStockAdjustmentItemSelect[]>;
}
