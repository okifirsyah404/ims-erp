import type { TPaginationResult } from '@ims-erp/common';
import type {
	BorrowingStatus,
	TBorrowingEventInsert,
	TBorrowingEventSelect,
	TBorrowingInsert,
	TBorrowingLineInsert,
	TBorrowingLineSelect,
	TBorrowingSelect,
} from '@drizzle/schemas/asset.schema';
import type { TTx } from '@drizzle/types';

/**
 * Pagination + filters for the borrowing list.
 *
 * @remarks
 * `organizationId` is the caller's tenant and every query carries it
 * explicitly. A borrowing with `organization_id IS NULL` (global) is visible
 * to no tenant by default — borrowers are people, so a shared borrowing has no
 * meaning and the isolation test asserts it.
 */
export type TBorrowingPaginationRequest = {
	page: number;
	limit: number;
	organizationId: string;
	status?: BorrowingStatus;
	borrowerType?: 'user' | 'customer' | 'guest';
	/** Matches the code or a guest's name. */
	search?: string;
};

/**
 * Header fields the client supplies when raising a borrowing.
 *
 * @remarks
 * `createdAt` is optional here because the column has a database default; the
 * service never sets it, so requiring it at every call site would force a
 * meaningless `new Date()`.
 */
export type TBorrowingCreateData = TBorrowingInsert;

/** A line to insert, already resolved by the service. */
export type TBorrowingLineData = TBorrowingLineInsert;

/** One line the user asked to borrow, resolved to a concrete asset. */
export type TBorrowingLineInput = {
	assetId: string;
	/** Defaults to the header's `due_at`. */
	dueAt?: Date | null;
	siteAddressText?: string | null;
	projectId?: string | null;
	notes?: string | null;
};

/**
 * A line that is due but not yet returned, late, or lost.
 *
 * @remarks
 * Carries everything the late sweep and the retention sweep need without a
 * second query, so both can run as one pass.
 */
export type TDueBorrowingLine = {
	line: TBorrowingLineSelect;
	borrowingId: string;
	organizationId: string | null;
	borrowerType: string;
	guestName: string | null;
};

/**
 * Borrowing persistence contract.
 *
 * @remarks
 * Reads exclude soft-deleted documents. Every state change is applied with an
 * optimistic status predicate by the service inside a transaction, so an
 * illegal edge cannot be persisted even under concurrent calls.
 *
 * **Guest PII is returned as stored.** Redaction is a service projection
 * concern (see `BorrowingService`), never a repository filter — a repository
 * that silently nulled columns would make the audit trail lie.
 */
export interface IBorrowingRepository {
	/** Fetches one filtered page of borrowings. */
	paginate(
		request: TBorrowingPaginationRequest,
	): Promise<TPaginationResult<TBorrowingSelect>>;

	/**
	 * Resolves one display photo per borrowing — the first line's asset image.
	 *
	 * @remarks
	 * The list card shows a single picture, so the earliest line wins. Batched
	 * for the whole page rather than queried per row.
	 */
	listFirstAssetImages(
		borrowingIds: string[],
	): Promise<Array<{ borrowingId: string; imageUrl: string | null }>>;

	/**
	 * Counts unreturned borrowing lines originating in one warehouse for one
	 * organization (ERP-0031 unlink guard).
	 *
	 * @remarks
	 * "Open" = the header is `issued` or `partially_returned` (custody has
	 * left, not fully back) and the line has no `returned_at` / loss mark.
	 */
	countOpenByOriginWarehouse(
		warehouseId: string,
		organizationId: string,
	): Promise<number>;

	/** Fetches one alive borrowing by id, scoped to its tenant. */
	findById(
		id: string,
		organizationId: string,
	): Promise<TBorrowingSelect | null>;

	/** Fetches one alive borrowing by tenant + code. */
	findByCode(
		organizationId: string,
		code: string,
	): Promise<TBorrowingSelect | null>;

	/** Inserts a header, optionally inside a caller's transaction. */
	create(
		data: TBorrowingCreateData,
		tx?: TTx,
	): Promise<TBorrowingSelect>;

	/**
	 * Applies a partial update, but only if the stored status still matches
	 * `expectedStatus`.
	 *
	 * @returns The updated row, or `null` when the predicate did not match
	 * @remarks
	 * The predicate is what makes the state machine safe: two concurrent
	 * `issue` calls both read `approved`, but only the first update matches and
	 * the second gets `null` and is refused.
	 */
	update(
		id: string,
		data: Partial<TBorrowingInsert>,
		expectedStatus: BorrowingStatus,
		tx?: TTx,
	): Promise<TBorrowingSelect | null>;

	/** Lists the alive lines of a borrowing. */
	listLines(borrowingId: string): Promise<TBorrowingLineSelect[]>;

	/** Fetches one alive line scoped to its borrowing. */
	findLine(
		lineId: string,
		borrowingId: string,
	): Promise<TBorrowingLineSelect | null>;

	/** Inserts all lines in one statement. */
	createLines(
		lines: readonly TBorrowingLineData[],
		tx?: TTx,
	): Promise<TBorrowingLineSelect[]>;

	/** Applies a partial update to one line. */
	updateLine(
		lineId: string,
		data: Partial<TBorrowingLineInsert>,
		tx?: TTx,
	): Promise<TBorrowingLineSelect | null>;

	/** Appends a timeline event. The table is append-only. */
	appendEvent(
		event: TBorrowingEventInsert,
		tx?: TTx,
	): Promise<TBorrowingEventSelect>;

	/** Lists a borrowing's full timeline, oldest first. */
	listEvents(borrowingId: string): Promise<TBorrowingEventSelect[]>;

	/**
	 * Finds lines that are past due and not yet marked.
	 *
	 * @param now - The sweep's clock
	 * @param limit - Caps one pass so a backlog cannot stall the worker
	 * @remarks
	 * The predicate is `returned_at IS NULL AND marked_late_at IS NULL AND
	 * marked_lost_at IS NULL AND due_at < now`. Because `marked_late_at IS
	 * NULL` is part of the read **and** the conditional update, running the
	 * sweep twice produces one event.
	 */
	findDueLines(now: Date, limit: number): Promise<TDueBorrowingLine[]>;

	/** Marks one line late, but only if it is still unmarked. */
	markLineLate(lineId: string, at: Date): Promise<TBorrowingLineSelect | null>;

	/** Finds closed borrowings whose guest PII has passed its retention window. */
	findExpiredGuestBorrowings(
		cutoff: Date,
		limit: number,
	): Promise<TBorrowingSelect[]>;

	/**
	 * Nulls the guest PII columns on one borrowing.
	 *
	 * @returns The updated row, or `null` when there was nothing left to null
	 * @remarks
	 * Idempotent by construction: the `guest_name IS NOT NULL` predicate means a
	 * second run matches nothing.
	 */
	redactGuestPii(
		id: string,
	): Promise<TBorrowingSelect | null>;
}
