import { DRIZZLE_TOKEN } from '@di/provider';
import type { TTx } from '@drizzle/types';
import {
	cashBankAccounts,
	cashBankTransactions,
	type TCashBankAccountSelect,
	type TCashBankTransactionSelect,
} from '@drizzle/schemas/finance.schema';
import type { TPaginationResult } from '@ims-erp/common';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { and, asc, count, desc, eq, isNull, sql } from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';
import type { ICashBankRepository } from '../contracts/cash-bank.repository.interface';

/**
 * Drizzle queries of `finance.cash_bank_accounts` and
 * `finance.cash_bank_transactions`.
 *
 * @remarks
 * One repository for the account/movement aggregate: a movement never exists
 * without its account, and the balance recompute reads both. Tenant scoped,
 * soft-delete aware.
 */
@injectable()
export class CashBankRepository implements ICashBankRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	async findCashBankAccountByCode(
		organizationId: string,
		code: string,
		tx?: TTx,
	): Promise<TCashBankAccountSelect | null> {
		const db = tx ?? this.database;
		const [row] = await db
			.select()
			.from(cashBankAccounts)
			.where(
				and(
					eq(cashBankAccounts.code, code),
					eq(cashBankAccounts.organizationId, organizationId),
					isNull(cashBankAccounts.deletedAt),
				),
			)
			.limit(1);
		return row ?? null;
	}

	async findCashBankAccountById(
		organizationId: string,
		id: string,
		tx?: TTx,
	): Promise<TCashBankAccountSelect | null> {
		const db = tx ?? this.database;
		const [row] = await db
			.select()
			.from(cashBankAccounts)
			.where(
				and(
					eq(cashBankAccounts.id, id),
					eq(cashBankAccounts.organizationId, organizationId),
					isNull(cashBankAccounts.deletedAt),
				),
			)
			.limit(1);
		return row ?? null;
	}

	async listCashBankAccounts(organizationId: string): Promise<TCashBankAccountSelect[]> {
		return this.database
			.select()
			.from(cashBankAccounts)
			.where(
				and(
					eq(cashBankAccounts.organizationId, organizationId),
					isNull(cashBankAccounts.deletedAt),
				),
			)
			.orderBy(asc(cashBankAccounts.code));
	}

	async insertCashBankAccount(
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
	): Promise<TCashBankAccountSelect> {
		const db = tx ?? this.database;
		const now = new Date();
		const [created] = await db
			.insert(cashBankAccounts)
			.values({ ...row, createdAt: now, updatedAt: now })
			.returning();
		return created;
	}

	async updateCashBankAccount(
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
	): Promise<TCashBankAccountSelect | null> {
		const db = tx ?? this.database;
		const [updated] = await db
			.update(cashBankAccounts)
			.set({ ...patch, updatedAt: new Date() })
			.where(
				and(
					eq(cashBankAccounts.id, id),
					eq(cashBankAccounts.organizationId, organizationId),
					isNull(cashBankAccounts.deletedAt),
				),
			)
			.returning();
		return updated ?? null;
	}

	async insertCashBankTransaction(
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
	): Promise<TCashBankTransactionSelect> {
		const db = tx ?? this.database;
		const now = new Date();
		const [created] = await db
			.insert(cashBankTransactions)
			.values({ ...row, createdAt: now, updatedAt: now })
			.returning();
		return created;
	}

	async listCashBankTransactions(
		organizationId: string,
		cashBankAccountId: string | undefined,
		pagination: { page: number; limit: number },
	): Promise<TPaginationResult<TCashBankTransactionSelect>> {
		const conditions = [
			eq(cashBankTransactions.organizationId, organizationId),
			isNull(cashBankTransactions.deletedAt),
		];
		if (cashBankAccountId) {
			conditions.push(eq(cashBankTransactions.cashBankAccountId, cashBankAccountId));
		}
		const where = and(...conditions);
		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(cashBankTransactions)
			.where(where);
		const data = await this.database
			.select()
			.from(cashBankTransactions)
			.where(where)
			.orderBy(desc(cashBankTransactions.transactionDate), desc(cashBankTransactions.createdAt))
			.limit(pagination.limit)
			.offset((pagination.page - 1) * pagination.limit);
		return {
			data,
			meta: {
				page: pagination.page,
				limit: pagination.limit,
				total,
				totalPages: Math.ceil(total / pagination.limit) || 1,
			},
		};
	}

	async cashBankAccountBalance(organizationId: string, id: string): Promise<number> {
		const [row] = await this.database
			.select({
				sum: sql<number>`coalesce(sum(CASE WHEN ${cashBankTransactions.direction} = 'in' THEN ${cashBankTransactions.amount} ELSE -${cashBankTransactions.amount} END), 0)::bigint`.mapWith(Number),
			})
			.from(cashBankTransactions)
			.where(
				and(
					eq(cashBankTransactions.organizationId, organizationId),
					eq(cashBankTransactions.cashBankAccountId, id),
					eq(cashBankTransactions.status, 'posted'),
					isNull(cashBankTransactions.deletedAt),
				),
			);
		return Number(row.sum);
	}
}
