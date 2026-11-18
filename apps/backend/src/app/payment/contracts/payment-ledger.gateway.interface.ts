import type { TPaymentAllocationSelect, TPaymentInsert, TPaymentSelect } from '@drizzle/schemas/payment.schema';

/**
 * Payment module's published contract for other modules (ADR-0024).
 *
 * @remarks
 * Accounting's month-end close (F7) needs to look at a payment, count the ones
 * still open, list its allocations and void an executed one. Those rows are
 * `payment.*`, so the access goes through this gateway — never through
 * `payment`'s repository or tables (`elysia-module` rules 3.2–3.5).
 *
 * The methods are *operations*, not repository calls: each one enforces the
 * payment module's own rules and throws its own domain errors, so a consumer
 * never imports `payment`'s errors and never re-checks state.
 *
 * Dependency direction: this gateway depends only on the payment repository, so
 * Accounting can call it while `PaymentService` calls Accounting's settlement
 * port — the cycle is broken by having no shared service instance.
 */
export interface IPaymentLedgerGateway {
	/** Payments not yet executed: the month-end close checklist count. */
	countOpen(organizationId: string): Promise<number>;

	/** All allocations of a payment (F7 reversal rolls each one back). */
	listAllocations(organizationId: string, paymentId: string, tx?: unknown): Promise<TPaymentAllocationSelect[]>;

	/**
	 * Loads a payment that must already be executed, for the F7 reversal.
	 *
	 * @throws PaymentNotFoundError when the row is absent or soft-deleted.
	 * @throws PaymentInvalidTransitionError when its status is not `executed`.
	 */
	requireExecuted(organizationId: string, id: string, tx?: unknown): Promise<TPaymentSelect>;

	/** Stamps an executed payment as voided with its reason (F7). */
	markVoided(
		organizationId: string,
		id: string,
		reason: string,
		tx?: unknown,
	): Promise<TPaymentSelect>;

	/** Low-level patch kept for the reversal's own bookkeeping. */
	update(
		organizationId: string,
		id: string,
		patch: Partial<TPaymentInsert>,
		tx?: unknown,
	): Promise<TPaymentSelect | null>;
}
