import type {
	TPaymentAllocationSelect,
	TPaymentInsert,
	TPaymentInsertInput,
	TPaymentSelect,
} from '@drizzle/schemas/payment.schema';
import type { TPaginationResult } from '@ims-erp/common';

/** Filters of the payment list (`GET /payments`). */
export type TPaymentListFilters = { status?: string; paymentType?: string };

/**
 * The single payment ledger (`payment.payments`) and its allocations.
 *
 * @remarks
 * Owned by the `payment` module (ADR-0024). A settled payment changes other
 * modules through their contracts, never through this repository.
 */
export interface IPaymentRepository {
	findById(organizationId: string, id: string, tx?: unknown): Promise<TPaymentSelect | null>;
	list(
		organizationId: string,
		filters: TPaymentListFilters,
		pagination: { page: number; limit: number },
	): Promise<TPaginationResult<TPaymentSelect>>;
	/** Payments not yet executed: the month-end close checklist count (F7). */
	countOpen(organizationId: string): Promise<number>;
	insert(row: TPaymentInsertInput, tx?: unknown): Promise<TPaymentSelect>;
	update(
		organizationId: string,
		id: string,
		patch: Partial<TPaymentInsert>,
		tx?: unknown,
	): Promise<TPaymentSelect | null>;
	insertAllocations(
		rows: Array<{
			organizationId: string;
			paymentId: string;
			targetType: string;
			salesInvoiceId: string | null;
			supplierBillId: string | null;
			amount: number;
		}>,
		tx?: unknown,
	): Promise<TPaymentAllocationSelect[]>;
	listAllocations(
		organizationId: string,
		paymentId: string,
		tx?: unknown,
	): Promise<TPaymentAllocationSelect[]>;
	markAllocationExecuted(organizationId: string, allocationId: string, tx?: unknown): Promise<void>;
}
