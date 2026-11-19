import type { TTx } from '@drizzle/types';
import type { TAccountBalanceSelect } from '@drizzle/schemas/finance.schema';

export interface IAccountBalanceRepository {
	upsertAccountBalance(
		row: {
			organizationId: string;
			accountId: string;
			accountingPeriodId: string;
			balanceDate: string;
			debitTotal: number;
			creditTotal: number;
			closingBalance: number;
			currencyCode: string;
			calculatedAt: Date;
		},
		tx?: TTx,
	): Promise<TAccountBalanceSelect>;
}
