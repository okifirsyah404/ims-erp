import type { TPaginationResult } from '@ims-erp/common';
import type {
	BorrowingRequestStatus,
	BorrowingStatus,
	TBorrowingEventInsert,
	TBorrowingEventSelect,
	TBorrowingInsert,
	TBorrowingItemInsert,
	TBorrowingItemSelect,
	TBorrowingRequestEventInsert,
	TBorrowingRequestEventSelect,
	TBorrowingRequestInsert,
	TBorrowingRequestSelect,
	TBorrowingSelect,
} from '@drizzle/schemas/inventory.schema';
import type { TTx } from '@drizzle/types';

/** One requested item, resolved by the service. */
export type TBorrowingItemInput = {
	itemId: string;
	/** Defaults to the request's `due_at`. */
	dueAt?: Date | null;
	siteAddressText?: string | null;
	projectId?: string | null;
	notes?: string | null;
};

/** Pagination and filters of the request list. */
export type TBorrowingRequestPaginationRequest = {
	page: number;
	limit: number;
	organizationId: string;
	status?: BorrowingRequestStatus;
	borrowerType?: 'user' | 'customer' | 'guest';
	/** Matches the code or a guest's name. */
	search?: string;
};

/** Pagination and filters of the borrowing (issue document) list. */
export type TBorrowingPaginationRequest = {
	page: number;
	limit: number;
	organizationId: string;
	status?: BorrowingStatus;
	search?: string;
};

/** An item that is due but not yet returned, late, or lost. */
export type TDueBorrowingItem = {
	item: TBorrowingItemSelect;
	borrowingId: string;
	organizationId: string | null;
};

/**
 * Persistence port for `inventory.borrowing_requests`.
 *
 * @remarks
 * Every read carries an explicit `organization_id` predicate (the column is
 * nullable, ADR-0008). **Guest PII is returned as stored**: redaction is a
 * service projection, never a repository filter, so the audit trail does not lie.
 */
export interface IBorrowingRequestRepository {
	paginate(
		request: TBorrowingRequestPaginationRequest,
	): Promise<TPaginationResult<TBorrowingRequestSelect>>;

	findById(id: string, organizationId: string): Promise<TBorrowingRequestSelect | null>;

	create(data: TBorrowingRequestInsert, tx?: TTx): Promise<TBorrowingRequestSelect>;

	/** Partial update guarded on the stored status (the state-machine guard). */
	update(
		id: string,
		data: Partial<TBorrowingRequestInsert>,
		expectedStatus: BorrowingRequestStatus,
		tx?: TTx,
	): Promise<TBorrowingRequestSelect | null>;

	/** Display photo per request: the first item's `image_url`, batched for a page. */
	listFirstItemImages(
		requestIds: string[],
	): Promise<Array<{ requestId: string; imageUrl: string | null }>>;

	/**
	 * Counts unreturned borrowed items that left one warehouse for one
	 * organization (unlink guard): the borrowing is `issued` or
	 * `partially_returned` and the item is neither returned nor lost.
	 */
	countOpenByOriginWarehouse(warehouseId: string, organizationId: string): Promise<number>;

	/** Guest requests whose borrowing closed before `cutoff` and still hold PII. */
	findExpiredGuestRequests(cutoff: Date, limit: number): Promise<TBorrowingRequestSelect[]>;

	/** Nulls the guest PII columns; `null` when there was nothing left to null. */
	redactGuestPii(id: string): Promise<TBorrowingRequestSelect | null>;
}

/** Persistence port for `inventory.borrowings` (the issue/return document). */
export interface IBorrowingRepository {
	paginate(
		request: TBorrowingPaginationRequest,
	): Promise<TPaginationResult<TBorrowingSelect>>;

	findById(id: string, organizationId: string): Promise<TBorrowingSelect | null>;

	/** The borrowing that fulfils a request (unique per request, Q26). */
	findByRequestId(requestId: string): Promise<TBorrowingSelect | null>;

	create(data: TBorrowingInsert, tx?: TTx): Promise<TBorrowingSelect>;

	update(
		id: string,
		data: Partial<TBorrowingInsert>,
		expectedStatus: BorrowingStatus,
		tx?: TTx,
	): Promise<TBorrowingSelect | null>;
}

/** Persistence port for `inventory.borrowing_items`. */
export interface IBorrowingItemRepository {
	listByRequest(requestId: string): Promise<TBorrowingItemSelect[]>;

	listByBorrowing(borrowingId: string): Promise<TBorrowingItemSelect[]>;

	/** One item of a borrowing, scoped to it. */
	findInBorrowing(id: string, borrowingId: string): Promise<TBorrowingItemSelect | null>;

	createMany(
		rows: readonly TBorrowingItemInsert[],
		tx?: TTx,
	): Promise<TBorrowingItemSelect[]>;

	update(
		id: string,
		data: Partial<TBorrowingItemInsert>,
		tx?: TTx,
	): Promise<TBorrowingItemSelect | null>;

	/** The open (issued, not returned, not lost) borrowing item of a unit, if any. */
	findOpenForItem(itemId: string, tx?: TTx): Promise<{ issuedAt: Date | null } | null>;

	/** Past-due, unmarked items, oldest first; one sweep pass. */
	findDue(now: Date, limit: number): Promise<TDueBorrowingItem[]>;

	/** Marks one item late, only while it is still unmarked. */
	markLate(id: string, at: Date): Promise<TBorrowingItemSelect | null>;
}

/** Persistence port for `inventory.borrowing_events` (append-only). */
export interface IBorrowingEventRepository {
	append(event: TBorrowingEventInsert, tx?: TTx): Promise<TBorrowingEventSelect>;

	/** A borrowing's timeline, oldest first. */
	listByBorrowing(borrowingId: string): Promise<TBorrowingEventSelect[]>;
}

/** Persistence port for `inventory.borrowing_request_events` (append-only). */
export interface IBorrowingRequestEventRepository {
	append(
		event: TBorrowingRequestEventInsert,
		tx?: TTx,
	): Promise<TBorrowingRequestEventSelect>;

	/** A request's pre-issue timeline, oldest first. */
	listByRequest(requestId: string): Promise<TBorrowingRequestEventSelect[]>;
}
