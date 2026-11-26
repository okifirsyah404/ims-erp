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
			statementDate?: string | null;
			description?: string | null;
			direction?: 'in' | 'out' | null;
			matchMethod?: 'auto' | 'manual' | 'created' | null;
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
	/**
	 * Posted movements of an account dated `from`..`to` that no live matched
	 * statement line uses yet (ERP-0143 auto-match).
	 */
	listMatchCandidates(
		organizationId: string,
		cashBankAccountId: string,
		from: string,
		to: string,
		tx?: TTx,
	): Promise<Array<{ id: string; code: string; transactionDate: string; direction: 'in' | 'out'; amount: number; referenceNumber: string | null }>>;
	/** Opening balance plus posted movements up to and including `date`. */
	balanceAsOf(organizationId: string, cashBankAccountId: string, date: string, tx?: TTx): Promise<number>;
}
