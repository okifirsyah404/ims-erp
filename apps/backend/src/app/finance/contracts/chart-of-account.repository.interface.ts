import type { TTx } from '@drizzle/types';
import type { TChartOfAccountSelect } from '@drizzle/schemas/finance.schema';
import type { TPaginationResult } from '@ims-erp/common';

export interface IChartOfAccountRepository {
	findAccountById(organizationId: string, id: string, tx?: TTx): Promise<TChartOfAccountSelect | null>;
	findAccountByCode(
		organizationId: string,
		code: string,
		tx?: TTx,
	): Promise<TChartOfAccountSelect | null>;
	findAccountsByCodes(
		organizationId: string,
		codes: string[],
		tx?: TTx,
	): Promise<Map<string, TChartOfAccountSelect>>;
	/** Id-keyed map for the report builders. */
	listAccountsMap(organizationId: string, tx?: TTx): Promise<Map<string, TChartOfAccountSelect>>;
	listAccounts(
		organizationId: string,
		pagination: { page: number; limit: number },
		filters?: { accountType?: string; isActive?: boolean },
	): Promise<TPaginationResult<TChartOfAccountSelect>>;
	insertAccount(
		row: {
			organizationId: string;
			code: string;
			name: string;
			accountType: string;
			normalBalance: string;
			parentAccountId: string | null;
			level: number;
			isPostable: boolean;
			isSystem: boolean;
			isActive: boolean;
			cashFlowCategory: string | null;
			description: string | null;
		},
		tx?: TTx,
	): Promise<TChartOfAccountSelect>;
	updateAccount(
		organizationId: string,
		id: string,
		patch: {
			name?: string;
			isPostable?: boolean;
			isActive?: boolean;
			cashFlowCategory?: string | null;
			description?: string | null;
		},
		tx?: TTx,
	): Promise<TChartOfAccountSelect | null>;
	/** True when at least one live journal line references the account. */
	accountHasJournalLines(organizationId: string, accountId: string): Promise<boolean>;
}
