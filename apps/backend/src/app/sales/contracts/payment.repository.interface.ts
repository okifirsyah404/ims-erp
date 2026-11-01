import type { TPaymentSelect } from '@drizzle/schemas/sales.schema';

/**
 * Tenant-scoped input for creating a payment. `organizationId` and
 * `createdBy` are supplied by the service from guard context, never by
 * the client.
 */
export type TCreatePaymentInput = {
	organizationId: string;
	quotationId: string;
	amount: number;
	createdBy: string;
};

/**
 * Data-access contract for payments within one tenant.
 *
 * @remarks
 * Every method takes `organizationId` explicitly — all queries are
 * tenant-scoped and none may run unscoped. State transitions
 * (`approve`, `execute`) are conditional updates on the expected status,
 * making them race-safe.
 */
export type TPaymentRepository = {
	/** Creates a payment in `pending` state. */
	create(input: TCreatePaymentInput): Promise<TPaymentSelect>;

	/**
	 * Fetches one payment, scoped to the tenant.
	 *
	 * @returns The payment, or `null` when absent or foreign
	 */
	findById(
		organizationId: string,
		id: string,
	): Promise<TPaymentSelect | null>;
	/**
	 * Approve atomically: only transitions when status = 'pending'.
	 * Returns the updated row or null when the status did not match.
	 */
	approve(
		organizationId: string,
		id: string,
		actorUserId: string,
	): Promise<TPaymentSelect | null>;
	/**
	 * Execute atomically: only transitions when status = 'approved'.
	 * The conditional update prevents duplicate execution under races.
	 * Returns the executed row or null when not approvable/executable.
	 */
	execute(
		organizationId: string,
		id: string,
		actorUserId: string,
	): Promise<TPaymentSelect | null>;
};
