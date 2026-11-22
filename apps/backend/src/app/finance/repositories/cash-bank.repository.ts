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
import { and, asc, count, desc, eq, gte, isNull, lte, sql } from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';
import { paginationResult } from '@utils/pagination.util';
import type {
	ICashBankRepository,
	TCashBankTransactionPaginationRequest,
	TCashFlowSummaryBucket,
} from '../contracts/cash-bank.repository.interface';

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

	/**
	 * Fetches one page of cash/bank movements, newest first.
	 *
	 * @param request - Tenant, page settings and the optional account filter
	 */
	async paginateTransactions(
		request: TCashBankTransactionPaginationRequest,
	): Promise<TPaginationResult<TCashBankTransactionSelect>> {
		const { organizationId, cashBankAccountId, page, limit } = request;
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
			.limit(limit)
			.offset((page - 1) * limit);
		return paginationResult(request, total, data);
	}

	/**
	 * Posted cash in/out per period, one aggregate query.
	 *
	 * @remarks
	 * Bucket key straight from `transaction_date::text` (no `to_char` format
	 * parameter, which PostgreSQL would not match between select and group by).
	 * `source_type = 'opening_balance'` rows are excluded because a balance
	 * brought forward is not income; `IS DISTINCT FROM` keeps the NULL sources.
	 */
	async summarizeTransactions(
		organizationId: string,
		range: { from: string; to: string; groupBy: 'month' | 'day' },
	): Promise<TCashFlowSummaryBucket[]> {
		const period =
			range.groupBy === 'month'
				? sql<string>`left(${cashBankTransactions.transactionDate}::text, 7)`
				: sql<string>`${cashBankTransactions.transactionDate}::text`;
		const rows = await this.database
			.select({
				period,
				totalIn: sql<string>`coalesce(sum(${cashBankTransactions.amount}) filter (where ${cashBankTransactions.direction} = 'in'), 0)::bigint`,
				totalOut: sql<string>`coalesce(sum(${cashBankTransactions.amount}) filter (where ${cashBankTransactions.direction} = 'out'), 0)::bigint`,
			})
			.from(cashBankTransactions)
			.where(
				and(
					eq(cashBankTransactions.organizationId, organizationId),
					isNull(cashBankTransactions.deletedAt),
					eq(cashBankTransactions.status, 'posted'),
					gte(cashBankTransactions.transactionDate, range.from),
					lte(cashBankTransactions.transactionDate, range.to),
					sql`${cashBankTransactions.sourceType} is distinct from 'opening_balance'`,
				),
			)
			.groupBy(period)
			.orderBy(period);
		// bun-sql returns bigint aggregates as strings; money stays exact.
		return rows.map((row) => ({
			period: row.period,
			totalIn: Number(row.totalIn),
			totalOut: Number(row.totalOut),
		}));
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
