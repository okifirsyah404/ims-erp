import type { TPaymentSelect } from '@drizzle/schemas/payment.schema';
import type { TPaginationResult } from '@ims-erp/common';

/** Who is acting: the tenant and the signed-in user. */
export type TPaymentActionContext = { organizationId: string; actorUserId: string };

export type TCreatePaymentInput = {
	paymentType: 'receipt' | 'disbursement';
	counterpartyType: 'customer' | 'supplier' | null;
	counterpartyId: string | null;
	amount: number;
	paymentMethod: 'bank_transfer' | 'cash' | 'card' | 'e_wallet' | 'cheque' | 'offset';
	paymentDate: string;
	cashBankAccountId: string | null;
	referenceNumber: string | null;
	notes: string | null;
};

/** What a payment settles: a payable document and the amount applied to it. */
export type TAllocationInput = {
	payableType: 'sale_invoice' | 'supplier_bill' | 'employee_advance' | 'expense_claim' | 'expense_settlement' | 'employee_salary_record';
	payableId: string;
	amount: number;
};

/**
 * Payment ledger application service (M09 F4, ADR-0024).
 *
 * @remarks
 * Single payment ledger: `draft → submitted → approved → executed`, one
 * approver. Executing is the ledger event — in ONE transaction it validates the
 * allocations (Σ = amount, each ≤ outstanding), applies them to the AR/AP
 * mirrors and document totals, and posts the cash movement, all through the
 * Accounting/Finance settlement port.
 *
 * Voiding an executed payment is deliberately out of scope (F4 decision 4a).
 */
export interface IPaymentService {
	get(organizationId: string, id: string): Promise<TPaymentSelect>;
	list(
		organizationId: string,
		filters: { status?: string; paymentType?: string },
		pagination: { page: number; limit: number },
	): Promise<TPaginationResult<TPaymentSelect>>;
	create(
		ctx: TPaymentActionContext,
		input: TCreatePaymentInput,
		allocations: TAllocationInput[],
	): Promise<TPaymentSelect>;
	setAllocations(
		ctx: TPaymentActionContext,
		id: string,
		allocations: TAllocationInput[],
	): Promise<TPaymentSelect>;
	submit(ctx: TPaymentActionContext, id: string): Promise<TPaymentSelect>;
	approve(ctx: TPaymentActionContext, id: string): Promise<TPaymentSelect>;
	void(ctx: TPaymentActionContext, id: string, reason: string): Promise<TPaymentSelect>;
	execute(ctx: TPaymentActionContext, id: string): Promise<TPaymentSelect>;
}
