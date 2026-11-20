import type { TTx } from '@drizzle/types';
import type { TPaginationRequest, TPaginationResult } from '@ims-erp/common';

/** Filters of the reconciliation listing. */
export type TBankReconciliationFilters = {
	cashBankAccountId?: string;
	status?: string;
};

/** Page settings, tenant and filters of the reconciliation listing. */
export type TBankReconciliationPaginationRequest = TPaginationRequest &
	TBankReconciliationFilters & { organizationId: string };

export interface IBankReconciliationRepository {
	insertBankReconciliation(
		row: {
			organizationId: string;
			code: string;
			cashBankAccountId: string;
			reconciliationDate: string;
			statementBalance: number;
			bookBalance: number;
			difference: number;
			status: string;
			notes: string | null;
		},
		tx?: TTx,
	): Promise<unknown>;
	findBankReconciliationById(
		organizationId: string,
		id: string,
		tx?: TTx,
	): Promise<unknown | null>;
	/** Fetches one page of the tenant's reconciliations, newest first. */
	paginate(
		request: TBankReconciliationPaginationRequest,
	): Promise<TPaginationResult<unknown>>;
	updateBankReconciliation(
		organizationId: string,
		id: string,
		patch: Record<string, unknown>,
		tx?: TTx,
	): Promise<unknown | null>;
	insertBankReconciliationItems(
		rows: Array<{
			organizationId: string;
			bankReconciliationId: string;
			cashBankTransactionId: string | null;
			statementReference: string | null;
			statementAmount: number | null;
			isMatched: boolean;
			notes: string | null;
		}>,
		tx?: TTx,
	): Promise<unknown[]>;
	listBankReconciliationItems(
		organizationId: string,
		bankReconciliationId: string,
		tx?: TTx,
	): Promise<unknown[]>;
	updateBankReconciliationItem(
		organizationId: string,
		id: string,
		patch: Record<string, unknown>,
		tx?: TTx,
	): Promise<unknown | null>;
}
