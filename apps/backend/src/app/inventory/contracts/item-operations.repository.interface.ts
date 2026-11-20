import type { TPaginationRequest, TPaginationResult } from '@ims-erp/common';
import type {
	TConditionCheckInsert,
	TConditionCheckSelect,
	TDisposalInsert,
	TDisposalSelect,
	TInventoryDocumentInsert,
	TInventoryDocumentSelect,
	TMaintenanceInsert,
	TMaintenanceSelect,
	ToolSetStatus,
	TToolSetInsert,
	TToolSetItemInsert,
	TToolSetItemSelect,
	TToolSetSelect,
} from '@drizzle/schemas/inventory.schema';
import type { TTx } from '@drizzle/types';

/**
 * Page settings for one item's history tab.
 *
 * @remarks
 * The item and its tenant both travel inside the request, so the three
 * history repositories (`maintenance`, `condition_check`, `item_movement`)
 * share one parameter shape.
 */
export type TItemHistoryPaginationRequest = TPaginationRequest & {
	itemId: string;
	organizationId: string;
};

/** Page settings and tenant of the disposal listing. */
export type TDisposalPaginationRequest = TPaginationRequest & {
	organizationId: string;
};

/** Page settings and tenant of the tool-set listing. */
export type TToolSetPaginationRequest = TPaginationRequest & {
	organizationId: string;
};

/** Persistence port for `inventory.maintenances`. */
export interface IMaintenanceRepository {
	/** Whether the unit has a scheduled or in-progress maintenance. */
	hasOpenForItem(itemId: string, tx?: TTx): Promise<boolean>;

	create(data: TMaintenanceInsert, tx?: TTx): Promise<TMaintenanceSelect>;

	/** Fetches one page of the unit's service history, newest first. */
	paginateByItem(
		request: TItemHistoryPaginationRequest,
	): Promise<TPaginationResult<TMaintenanceSelect>>;
}

/** Persistence port for `inventory.condition_checks`. */
export interface IConditionCheckRepository {
	create(data: TConditionCheckInsert, tx?: TTx): Promise<TConditionCheckSelect>;

	/** Fetches one page of the unit's condition-check history, newest first. */
	paginateByItem(
		request: TItemHistoryPaginationRequest,
	): Promise<TPaginationResult<TConditionCheckSelect>>;
}

/** Persistence port for `inventory.disposals`. */
export interface IDisposalRepository {
	create(data: TDisposalInsert, tx?: TTx): Promise<TDisposalSelect>;

	findById(id: string): Promise<TDisposalSelect | null>;

	/** Fetches one page of the tenant's disposal documents. */
	paginate(
		request: TDisposalPaginationRequest,
	): Promise<TPaginationResult<TDisposalSelect>>;

	update(
		id: string,
		data: Partial<TDisposalInsert>,
		tx?: TTx,
	): Promise<TDisposalSelect | null>;

	/**
	 * Atomically flips an `approved`, not yet executed disposal to `executed`
	 * and stamps the book value and gain/loss; `null` when another call won.
	 */
	claimForExecution(
		id: string,
		snapshot: { bookValueAtDisposal: number; gainLoss: number },
		tx: TTx,
	): Promise<TDisposalSelect | null>;
}

/** Persistence port for `inventory.documents` (files of a product or an item). */
export interface IInventoryDocumentRepository {
	create(data: TInventoryDocumentInsert, tx?: TTx): Promise<TInventoryDocumentSelect>;

	/** Live documents of one item, newest first, scoped to the tenant. */
	listByItem(itemId: string, organizationId: string): Promise<TInventoryDocumentSelect[]>;

	/** Live documents of one product, newest first. */
	listByProduct(productId: string): Promise<TInventoryDocumentSelect[]>;
}

/** Persistence port for `inventory.tool_sets`. */
export interface IToolSetRepository {
	findById(id: string): Promise<TToolSetSelect | null>;

	create(data: TToolSetInsert, tx?: TTx): Promise<TToolSetSelect>;

	/** Fetches one page of the tenant's tool sets. */
	paginate(
		request: TToolSetPaginationRequest,
	): Promise<TPaginationResult<TToolSetSelect>>;

	update(
		id: string,
		data: Partial<TToolSetInsert>,
		tx?: TTx,
	): Promise<TToolSetSelect | null>;

	setStatus(id: string, status: ToolSetStatus, tx?: TTx): Promise<TToolSetSelect | null>;

	/** Soft delete. */
	archive(id: string, tx?: TTx): Promise<TToolSetSelect | null>;
}

/** Persistence port for `inventory.tool_set_items`. */
export interface IToolSetItemRepository {
	/** Live rows of a tool set. */
	listByToolSet(toolSetId: string): Promise<TToolSetItemSelect[]>;

	/** Item ids composing a live tool set. */
	listItemIds(toolSetId: string): Promise<string[]>;

	add(data: TToolSetItemInsert, tx?: TTx): Promise<TToolSetItemSelect>;

	/** Soft-deletes one row of the set; `false` when it is not there. */
	remove(toolSetId: string, rowId: string, tx?: TTx): Promise<boolean>;
}
