import type { TTx } from '@drizzle/types';
import type { TCashBankAccountSelect, TCashBankTransactionSelect } from '@drizzle/schemas/finance.schema';
import type { TPaginationRequest, TPaginationResult } from '@ims-erp/common';

/** Page settings, tenant and the optional cash-account filter of the movement listing. */
export type TCashBankTransactionPaginationRequest = TPaginationRequest & {
	organizationId: string;
	/** Narrows the movements to one account; omit for all of the tenant's. */
	cashBankAccountId?: string;
};

export interface ICashBankRepository {
	findCashBankAccountByCode(
		organizationId: string,
		code: string,
		tx?: TTx,
	): Promise<TCashBankAccountSelect | null>;
	findCashBankAccountById(
		organizationId: string,
		id: string,
		tx?: TTx,
	): Promise<TCashBankAccountSelect | null>;
	listCashBankAccounts(organizationId: string): Promise<TCashBankAccountSelect[]>;
	insertCashBankAccount(
		row: {
			organizationId: string;
			code: string;
			name: string;
			accountType: string;
			bankName: string | null;
			accountNumber: string | null;
			accountHolder: string | null;
			openingBalance: number;
			currentBalance: number;
		},
		tx?: TTx,
	): Promise<TCashBankAccountSelect>;
	updateCashBankAccount(
		organizationId: string,
		id: string,
		patch: {
			name?: string;
			bankName?: string | null;
			accountNumber?: string | null;
			accountHolder?: string | null;
			isActive?: boolean;
			currentBalance?: number;
		},
		tx?: TTx,
	): Promise<TCashBankAccountSelect | null>;
	insertCashBankTransaction(
		row: {
			organizationId: string;
			code: string;
			cashBankAccountId: string;
			transactionDate: string;
			direction: string;
			amount: number;
			description: string | null;
			referenceNumber: string | null;
			status: string;
			balanceAfter: number;
			postedBy: string | null;
			postedAt: Date | null;
		},
		tx?: TTx,
	): Promise<TCashBankTransactionSelect>;
	/** Fetches one page of cash/bank movements, newest first. */
	paginateTransactions(
		request: TCashBankTransactionPaginationRequest,
	): Promise<TPaginationResult<TCashBankTransactionSelect>>;
	/** Balance recomputed from the posted movements (tests and ops). */
	cashBankAccountBalance(organizationId: string, id: string): Promise<number>;
}
