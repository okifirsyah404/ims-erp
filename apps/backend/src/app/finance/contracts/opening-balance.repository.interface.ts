import type { TTx } from '@drizzle/types';
import type { TOpeningBalanceSelect } from '@drizzle/schemas/finance.schema';

export interface IOpeningBalanceRepository {
	listOpeningBalances(organizationId: string): Promise<TOpeningBalanceSelect[]>;
	findOpeningBalanceByAccountAndDate(
		organizationId: string,
		accountId: string,
		asOfDate: string,
	): Promise<TOpeningBalanceSelect | null>;
	insertOpeningBalance(
		row: {
			organizationId: string;
			accountId: string;
			asOfDate: string;
			debitBalance: number;
			creditBalance: number;
			currencyCode: string;
			description: string | null;
		},
		tx?: TTx,
	): Promise<TOpeningBalanceSelect>;
	updateOpeningBalance(
		organizationId: string,
		id: string,
		patch: {
			debitBalance?: number;
			creditBalance?: number;
			description?: string | null;
		},
		tx?: TTx,
	): Promise<TOpeningBalanceSelect | null>;
	/** Stamps `posted_at` once a batch has been posted. */
	stampOpeningBalancePosted(organizationId: string, id: string, tx?: TTx): Promise<void>;
	/** Soft delete; false when the row was already gone. */
	deleteOpeningBalance(organizationId: string, id: string, tx?: TTx): Promise<boolean>;
}
