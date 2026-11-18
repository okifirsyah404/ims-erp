import { DRIZZLE_TOKEN } from '@di/provider';
import type { TTx } from '@drizzle/types';
import { bankAccountLinks, type TBankAccountLinkSelect } from '@drizzle/schemas/accounting.schema';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { and, eq, isNull } from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';
import type { IBankAccountLinkRepository } from '../contracts/bank-account-link.repository.interface';

/**
 * Drizzle queries of `accounting.bank_account_links` — the mapping between a
 * cash/bank account and its GL account, which is what makes a cash movement
 * postable.
 */
@injectable()
export class BankAccountLinkRepository implements IBankAccountLinkRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	async findBankAccountLinkByCashAccount(
		organizationId: string,
		cashBankAccountId: string,
	): Promise<TBankAccountLinkSelect | null> {
		const [row] = await this.database
			.select()
			.from(bankAccountLinks)
			.where(
				and(
					eq(bankAccountLinks.organizationId, organizationId),
					eq(bankAccountLinks.cashBankAccountId, cashBankAccountId),
					eq(bankAccountLinks.isActive, true),
					isNull(bankAccountLinks.deletedAt),
				),
			)
			.limit(1);
		return row ?? null;
	}

	async upsertBankAccountLink(
		row: {
			organizationId: string;
			cashBankAccountId: string;
			chartOfAccountId: string;
			isActive: boolean;
		},
		tx?: TTx,
	): Promise<TBankAccountLinkSelect> {
		const db = tx ?? this.database;
		const now = new Date();
		const [created] = await db
			.insert(bankAccountLinks)
			.values({ ...row, createdAt: now, updatedAt: now })
			.onConflictDoUpdate({
				target: bankAccountLinks.cashBankAccountId,
				set: {
					chartOfAccountId: row.chartOfAccountId,
					isActive: row.isActive,
					deletedAt: null,
					updatedAt: now,
				},
			})
			.returning();
		return created;
	}

	async deactivateBankAccountLink(organizationId: string, cashBankAccountId: string): Promise<void> {
		await this.database
			.update(bankAccountLinks)
			.set({ isActive: false, updatedAt: new Date() })
			.where(
				and(
					eq(bankAccountLinks.organizationId, organizationId),
					eq(bankAccountLinks.cashBankAccountId, cashBankAccountId),
				),
			);
	}
}
