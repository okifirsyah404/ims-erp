import type { TPaginationResult } from '@ims-erp/common';
import type {
	MovementType,
	TStockMovementInsert,
	TStockMovementSelect,
} from '@drizzle/schemas/inventory.schema';
import type { TTx } from '@drizzle/types';
/**
 * Pagination + filters for the movement ledger.
 *
 * @remarks
 * The ledger is append-only and never soft-deleted, so there is no
 * `includeArchived` here.
 *
 * `scopeOrganizationId` is the **balance scope**, not the caller's org: it is
 * `null` when the queried warehouse is global (shared stock) and the warehouse's
 * own organization otherwise. Callers that pass `undefined` mean "every scope"
 * and are only legitimate for an application admin — a tenant-scoped request
 * must always supply it.
 */
export type TMovementPaginationRequest = {
	page: number;
	limit: number;
	/** `undefined` = all scopes (admin only), `null` = shared/global rows. */
	scopeOrganizationId?: string | null;
	/** Exact warehouse filter. */
	warehouseId?: string;
	/** Exact item filter. */
	itemId?: string;
	/** Exact movement-type filter. */
	movementType?: MovementType;
	/** Exact posting-state filter. */
	status?: 'draft' | 'posted' | 'reversed';
	/** Inclusive lower bound on `occurredAt`. */
	occurredFrom?: Date;
	/** Inclusive upper bound on `occurredAt`. */
	occurredTo?: Date;
	/** Exact `referenceType` filter, e.g. `borrowing`. */
	referenceType?: string;
};

/** Fields the service supplies when appending a movement. */
export type TMovementCreateData = Omit<
	TStockMovementInsert,
	'id' | 'createdAt' | 'status'
> & {
	createdAt?: Date;
	status?: 'draft' | 'posted' | 'reversed';
};

/**
 * Movement persistence contract.
 *
 * @remarks
 * Append-only: there is deliberately **no `update` and no `archive`**. A
 * correction is a new opposing row, never an edit. The only mutation is
 * `claimForReversal`, which flips a `posted` row to `reversed` exactly once so
 * a movement cannot be reversed twice (and, being a conditional `UPDATE`, it is
 * also the concurrency guard).
 */
export interface IMovementRepository {
	/** Fetches one filtered page of the ledger, newest first. */
	paginate(
		request: TMovementPaginationRequest,
	): Promise<TPaginationResult<TStockMovementSelect>>;

	/** Fetches one movement by id. */
	findById(id: string): Promise<TStockMovementSelect | null>;

	/** Appends one movement row, optionally inside a caller's transaction. */
	create(
		data: TMovementCreateData,
		tx?: TTx,
	): Promise<TStockMovementSelect>;

	/**
	 * Finds the reversal row that already points at `movementId`, if any.
	 *
	 * @remarks
	 * Used to refuse a second reversal. Reversals point at their original via
	 * `referenceType = 'reversal'` and `referenceId = <original id>`.
	 */
	findReversalOf(movementId: string): Promise<TStockMovementSelect | null>;

	/**
	 * Atomically marks a `posted` movement as `reversed`.
	 *
	 * @returns The updated row, or `null` when it was not `posted` any more
	 * @remarks
	 * The `status = 'posted'` predicate lives in the `WHERE`, so two concurrent
	 * reversals cannot both succeed: the second matches zero rows.
	 */
	claimForReversal(
		id: string,
		tx?: TTx,
	): Promise<TStockMovementSelect | null>;

	/**
	 * Sums signed quantities per `(item, warehouse, bin)` scope.
	 *
	 * @remarks
	 * The ledger's own truth, used by `recomputeFromLedger`. Signed by
	 * direction: an increase is positive, a decrease negative, and a `reversed`
	 * movement is excluded because its reversal row already carries the
	 * opposite delta.
	 */
	ledgerTotals(
		scopeOrganizationId: string | null,
	): Promise<
		Array<{
			itemId: string;
			warehouseId: string;
			binId: string | null;
			quantity: string;
		}>
	>;
}
