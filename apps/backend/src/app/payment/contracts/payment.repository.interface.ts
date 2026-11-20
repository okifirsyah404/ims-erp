import type { TPaymentAllocationSelect, TPaymentInsert, TPaymentSelect } from '@drizzle/schemas/payment.schema';
import type { TPaginationRequest, TPaginationResult } from '@ims-erp/common';

/** Filters of the payment list (`GET /payments`). */
export type TPaymentListFilters = { status?: string; paymentType?: string };

/**
 * Page settings plus the tenant and filters of `GET /payments`.
 *
 * @remarks
 * `organizationId` travels inside the request rather than as a leading
 * positional argument, matching every other paginated repository method.
 */
export type TPaymentPaginationRequest = TPaginationRequest &
	TPaymentListFilters & { organizationId: string };

/** A new payment row; ids and timestamps are the repository's. */
export type TPaymentData = Omit<TPaymentInsert, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>;

/** One allocation row to store: what the payment settles. */
export type TAllocationData = {
	organizationId: string;
	paymentId: string;
	payableType: string;
	payableId: string;
	amount: number;
};

/**
 * The single payment ledger (`payment.payments`) and its allocations.
 *
 * @remarks
 * Owned by the `payment` module (ADR-0024). A settled payment changes other
 * modules through their contracts, never through this repository. Online
 * checkouts are payment rows too (`channel = 'gateway'`).
 */
export interface IPaymentRepository {
	findById(organizationId: string, id: string, tx?: unknown): Promise<TPaymentSelect | null>;
	/** Fetches one filtered page of the tenant's payments, newest first. */
	paginate(request: TPaymentPaginationRequest): Promise<TPaginationResult<TPaymentSelect>>;
	/** Payments not yet executed: the month-end close checklist count (F7). */
	countOpen(organizationId: string): Promise<number>;
	insert(row: TPaymentData, tx?: unknown): Promise<TPaymentSelect>;
	update(
		organizationId: string,
		id: string,
		patch: Partial<TPaymentInsert>,
		tx?: unknown,
	): Promise<TPaymentSelect | null>;
	/**
	 * Makes the live allocation set of a payment equal to `rows`: existing
	 * (type, payable) pairs are updated, new ones inserted, and pairs that are no
	 * longer wanted are soft-deleted (a pair that returns is restored).
	 */
	syncAllocations(
		organizationId: string,
		paymentId: string,
		rows: Array<Pick<TAllocationData, 'payableType' | 'payableId' | 'amount'>>,
		tx?: unknown,
	): Promise<TPaymentAllocationSelect[]>;
	listAllocations(
		organizationId: string,
		paymentId: string,
		tx?: unknown,
	): Promise<TPaymentAllocationSelect[]>;
	/** Online checkouts that settle one payable, newest first. */
	listCheckoutsOf(
		organizationId: string,
		payableType: string,
		payableId: string,
	): Promise<TPaymentSelect[]>;
	/** A pending checkout of this payable, provider and amount still open after `openUntil`. */
	findReusableCheckout(
		organizationId: string,
		payableType: string,
		payableId: string,
		provider: string,
		amount: number,
		openUntil: Date,
	): Promise<TPaymentSelect | null>;
	/** Runs `work` with the payment row locked (`FOR UPDATE`) in one transaction; null when missing. */
	withLocked<T>(id: string, work: (row: TPaymentSelect, tx: unknown) => Promise<T>): Promise<T | null>;
}
