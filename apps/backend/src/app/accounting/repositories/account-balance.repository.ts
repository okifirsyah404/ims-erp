import { DRIZZLE_TOKEN } from '@di/provider';
import type { TTx } from '@drizzle/types';
import { accountBalances, type TAccountBalanceSelect } from '@drizzle/schemas/accounting.schema';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type { IAccountBalanceRepository } from '../contracts/account-balance.repository.interface';

/**
 * Drizzle queries of `accounting.account_balances` — the per-period balance
 * snapshot a close writes.
 *
 * @remarks
 * Append-ish snapshot table keyed by (account, period): posting the same close
 * twice updates the same row instead of duplicating it.
 */
@injectable()
export class AccountBalanceRepository implements IAccountBalanceRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	async upsertAccountBalance(
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
	): Promise<TAccountBalanceSelect> {
		const db = tx ?? this.database;
		const now = new Date();
		const [snapshot] = await db
			.insert(accountBalances)
			.values({ ...row, createdAt: now, updatedAt: now })
			.onConflictDoUpdate({
				target: [accountBalances.accountId, accountBalances.accountingPeriodId],
				set: {
					debitTotal: row.debitTotal,
					creditTotal: row.creditTotal,
					closingBalance: row.closingBalance,
					calculatedAt: row.calculatedAt,
					updatedAt: now,
				},
			})
			.returning();
		return snapshot;
	}
}
