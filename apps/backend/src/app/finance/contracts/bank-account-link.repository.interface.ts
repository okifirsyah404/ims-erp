import type { TTx } from '@drizzle/types';
import type { TBankAccountLinkSelect } from '@drizzle/schemas/finance.schema';

export interface IBankAccountLinkRepository {
	findBankAccountLinkByCashAccount(
		organizationId: string,
		cashBankAccountId: string,
	): Promise<TBankAccountLinkSelect | null>;
	upsertBankAccountLink(
		row: {
			organizationId: string;
			cashBankAccountId: string;
			chartOfAccountId: string;
			isActive: boolean;
		},
		tx?: TTx,
	): Promise<TBankAccountLinkSelect>;
	deactivateBankAccountLink(organizationId: string, cashBankAccountId: string): Promise<void>;
}
