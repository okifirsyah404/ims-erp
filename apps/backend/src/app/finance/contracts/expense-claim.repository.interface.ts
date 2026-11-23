import type { TTx } from '@drizzle/types';
import type {
	TExpenseClaimItemSelect,
	TExpenseClaimSelect,
} from '@drizzle/schemas/finance.schema';
import type { TPaginationRequest, TPaginationResult } from '@ims-erp/common';
import type { EXPENSE_CLAIM_SORT_FIELDS } from './expense.contract';

/** Filters of the expense-claim listing. */
export type TExpenseClaimFilters = {
	status?: string;
	employeeId?: string;
	from?: string;
	to?: string;
	search?: string;
	sortBy?: (typeof EXPENSE_CLAIM_SORT_FIELDS)[number];
	sortDir?: 'asc' | 'desc';
};

/** Page settings, tenant and filters of the expense-claim listing. */
export type TExpenseClaimPaginationRequest = TPaginationRequest &
	TExpenseClaimFilters & { organizationId: string };

export type TExpenseClaimRow = {
	organizationId: string;
	code: string;
	employeeId: string | null;
	claimDate: string | null;
	totalAmount: number;
	currencyCode: string;
	status: string;
	submittedBy: string | null;
	submittedAt: Date | null;
	approvedBy: string | null;
	approvedAt: Date | null;
	paymentId: string | null;
	notes: string | null;
};

export type TExpenseClaimItemRow = {
	organizationId: string;
	expenseClaimId: string;
	expenseDate: string | null;
	categoryCode: string | null;
	description: string | null;
	amount: number;
	taxAmount: number;
	currencyCode: string;
	receiptDocumentId: string | null;
};

export interface IExpenseClaimRepository {
	insertExpenseClaim(row: TExpenseClaimRow, tx?: TTx): Promise<TExpenseClaimSelect>;
	findExpenseClaimById(
		organizationId: string,
		id: string,
		tx?: TTx,
	): Promise<TExpenseClaimSelect | null>;
	updateExpenseClaim(
		organizationId: string,
		id: string,
		patch: Record<string, unknown>,
		tx?: TTx,
	): Promise<TExpenseClaimSelect | null>;
	paginate(
		request: TExpenseClaimPaginationRequest,
	): Promise<TPaginationResult<TExpenseClaimSelect>>;
	insertExpenseClaimItems(
		rows: TExpenseClaimItemRow[],
		tx?: TTx,
	): Promise<TExpenseClaimItemSelect[]>;
	findExpenseClaimItems(
		organizationId: string,
		expenseClaimId: string,
		tx?: TTx,
	): Promise<TExpenseClaimItemSelect[]>;
	deleteExpenseClaimItems(
		organizationId: string,
		expenseClaimId: string,
		tx?: TTx,
	): Promise<void>;
}
