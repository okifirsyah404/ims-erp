import type { TPaymentSelect } from '@drizzle/schemas/sales.schema';

export type TCreatePaymentInput = {
	organizationId: string;
	quotationId: string;
	amount: number;
	createdBy: string;
};

export type TPaymentRepository = {
	create(input: TCreatePaymentInput): Promise<TPaymentSelect>;
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
