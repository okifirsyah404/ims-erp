import { DRIZZLE_TOKEN } from '@di/provider';
import type { TTx } from '@drizzle/types';
import {
	accountBalances,
	accountingPeriods,
	bankAccountLinks,
	chartOfAccounts,
	journalEntries,
	journalLines,
	openingBalances,
	type TAccountingPeriodSelect,
	type TAccountBalanceSelect,
	type TBankAccountLinkSelect,
	type TChartOfAccountSelect,
	type TJournalEntrySelect,
	type TJournalLineSelect,
	type TOpeningBalanceSelect,
} from '@drizzle/schemas/accounting.schema';
import {
	cashBankAccounts,
	cashBankTransactions,
	type TCashBankAccountSelect,
	type TCashBankTransactionSelect,
} from '@drizzle/schemas/finance.schema';
import type { TPaginationResult } from '@ims-erp/common';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { and, asc, count, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';

/**
 * Drizzle implementation of the ledger repository (M09 F2).
 *
 * @remarks
 * Tenant scope on every query. Soft-deleted rows excluded. Every method takes
 * an optional transaction handle so the posting service can compose everything
 * inside the caller's transaction (architecture.md §Transactions ownership).
 */
@injectable()
export class LedgerRepository {
	constructor(
		@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase,
	) {}

	/* ----------------------------- chart of accounts ----------------------------- */

	async findAccountById(
		organizationId: string,
		id: string,
		tx?: TTx,
	): Promise<TChartOfAccountSelect | null> {
		const db = tx ?? this.database;
		const [row] = await db
			.select()
			.from(chartOfAccounts)
			.where(
				and(
					eq(chartOfAccounts.id, id),
					eq(chartOfAccounts.organizationId, organizationId),
					isNull(chartOfAccounts.deletedAt),
				),
			)
			.limit(1);
		return row ?? null;
	}

	async findAccountByCode(
		organizationId: string,
		code: string,
		tx?: TTx,
	): Promise<TChartOfAccountSelect | null> {
		const db = tx ?? this.database;
		const [row] = await db
			.select()
			.from(chartOfAccounts)
			.where(
				and(
					eq(chartOfAccounts.code, code),
					eq(chartOfAccounts.organizationId, organizationId),
					isNull(chartOfAccounts.deletedAt),
				),
			)
			.limit(1);
		return row ?? null;
	}

	async findAccountsByCodes(
		organizationId: string,
		codes: string[],
		tx?: TTx,
	): Promise<Map<string, TChartOfAccountSelect>> {
		const db = tx ?? this.database;
		const rows = await db
			.select()
			.from(chartOfAccounts)
			.where(
				and(
					eq(chartOfAccounts.organizationId, organizationId),
					inArray(chartOfAccounts.code, codes),
					isNull(chartOfAccounts.deletedAt),
				),
			);
		return new Map(rows.map((row) => [row.code, row]));
	}

	async listAccounts(
		organizationId: string,
		pagination: { page: number; limit: number },
		filters: { accountType?: string; isActive?: boolean } = {},
	): Promise<TPaginationResult<TChartOfAccountSelect>> {
		const conditions = [
			eq(chartOfAccounts.organizationId, organizationId),
			isNull(chartOfAccounts.deletedAt),
		];
		if (filters.accountType) {
			conditions.push(eq(chartOfAccounts.accountType, filters.accountType));
		}
		if (filters.isActive !== undefined) {
			conditions.push(eq(chartOfAccounts.isActive, filters.isActive));
		}
		const where = and(...conditions);
		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(chartOfAccounts)
			.where(where);
		const data = await this.database
			.select()
			.from(chartOfAccounts)
			.where(where)
			.orderBy(asc(chartOfAccounts.code))
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

	async insertAccount(
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
	): Promise<TChartOfAccountSelect> {
		const db = tx ?? this.database;
		const now = new Date();
		const [created] = await db
			.insert(chartOfAccounts)
			.values({ ...row, createdAt: now, updatedAt: now })
			.returning();
		return created;
	}

	async updateAccount(
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
	): Promise<TChartOfAccountSelect | null> {
		const db = tx ?? this.database;
		const [updated] = await db
			.update(chartOfAccounts)
			.set({ ...patch, updatedAt: new Date() })
			.where(
				and(
					eq(chartOfAccounts.id, id),
					eq(chartOfAccounts.organizationId, organizationId),
					isNull(chartOfAccounts.deletedAt),
				),
			)
			.returning();
		return updated ?? null;
	}

	/** True when at least one non-void journal line references the account. */
	async accountHasJournalLines(
		organizationId: string,
		accountId: string,
	): Promise<boolean> {
		const [row] = await this.database
			.select({ value: count() })
			.from(journalLines)
			.where(
				and(
					eq(journalLines.organizationId, organizationId),
					eq(journalLines.accountId, accountId),
					isNull(journalLines.deletedAt),
				),
			)
			.limit(1);
		return row.value > 0;
	}

	/* ----------------------------- accounting periods ----------------------------- */

	async findPeriodByMonth(
		organizationId: string,
		year: number,
		month: number,
		tx?: TTx,
	): Promise<TAccountingPeriodSelect | null> {
		const db = tx ?? this.database;
		const [row] = await db
			.select()
			.from(accountingPeriods)
			.where(
				and(
					eq(accountingPeriods.organizationId, organizationId),
					eq(accountingPeriods.periodYear, year),
					eq(accountingPeriods.periodMonth, month),
					isNull(accountingPeriods.deletedAt),
				),
			)
			.limit(1);
		return row ?? null;
	}

	async findPeriodById(
		organizationId: string,
		id: string,
	): Promise<TAccountingPeriodSelect | null> {
		const [row] = await this.database
			.select()
			.from(accountingPeriods)
			.where(
				and(
					eq(accountingPeriods.id, id),
					eq(accountingPeriods.organizationId, organizationId),
					isNull(accountingPeriods.deletedAt),
				),
			)
			.limit(1);
		return row ?? null;
	}

	async listPeriods(
		organizationId: string,
		pagination: { page: number; limit: number },
	): Promise<TPaginationResult<TAccountingPeriodSelect>> {
		const where = and(
			eq(accountingPeriods.organizationId, organizationId),
			isNull(accountingPeriods.deletedAt),
		);
		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(accountingPeriods)
			.where(where);
		const data = await this.database
			.select()
			.from(accountingPeriods)
			.where(where)
			.orderBy(desc(accountingPeriods.periodYear), desc(accountingPeriods.periodMonth))
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

	async insertPeriod(
		row: {
			organizationId: string;
			code: string;
			periodYear: number;
			periodMonth: number;
			startDate: string;
			endDate: string;
			status: string;
		},
		tx?: TTx,
	): Promise<TAccountingPeriodSelect> {
		const db = tx ?? this.database;
		const now = new Date();
		const [created] = await db
			.insert(accountingPeriods)
			.values({ ...row, createdAt: now, updatedAt: now })
			.returning();
		return created;
	}

	async updatePeriodStatus(
		organizationId: string,
		id: string,
		patch: {
			status?: string;
			closedBy?: string | null;
			closedAt?: Date | null;
			reopenedBy?: string | null;
			reopenedAt?: Date | null;
		},
		tx?: TTx,
	): Promise<TAccountingPeriodSelect | null> {
		const db = tx ?? this.database;
		const [updated] = await db
			.update(accountingPeriods)
			.set({ ...patch, updatedAt: new Date() })
			.where(
				and(
					eq(accountingPeriods.id, id),
					eq(accountingPeriods.organizationId, organizationId),
					isNull(accountingPeriods.deletedAt),
				),
			)
			.returning();
		return updated ?? null;
	}

	/* ----------------------------- journal entries ----------------------------- */

	async findEntryById(
		organizationId: string,
		id: string,
		tx?: TTx,
	): Promise<TJournalEntrySelect | null> {
		const db = tx ?? this.database;
		const [row] = await db
			.select()
			.from(journalEntries)
			.where(
				and(
					eq(journalEntries.id, id),
					eq(journalEntries.organizationId, organizationId),
					isNull(journalEntries.deletedAt),
				),
			)
			.limit(1);
		return row ?? null;
	}

	async findPostedEntryByIdempotencyKey(
		organizationId: string,
		idempotencyKey: string,
		tx?: TTx,
	): Promise<TJournalEntrySelect | null> {
		const db = tx ?? this.database;
		const [row] = await db
			.select()
			.from(journalEntries)
			.where(
				and(
					eq(journalEntries.organizationId, organizationId),
					eq(journalEntries.idempotencyKey, idempotencyKey),
					isNull(journalEntries.deletedAt),
				),
			)
			.limit(1);
		return row ?? null;
	}

	async listEntries(
		organizationId: string,
		pagination: { page: number; limit: number },
		filters: { year?: number; month?: number; status?: string } = {},
	): Promise<TPaginationResult<TJournalEntrySelect>> {
		const conditions = [
			eq(journalEntries.organizationId, organizationId),
			isNull(journalEntries.deletedAt),
		];
		if (filters.year && filters.month) {
			const start = `${filters.year}-${String(filters.month).padStart(2, '0')}-01`;
			const endDate = new Date(
				Date.UTC(filters.year, filters.month, 0),
			).toISOString().slice(0, 10);
			conditions.push(sql`${journalEntries.entryDate} >= ${start}`);
			conditions.push(sql`${journalEntries.entryDate} <= ${endDate}`);
		}
		if (filters.status) {
			conditions.push(eq(journalEntries.status, filters.status));
		}
		const where = and(...conditions);
		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(journalEntries)
			.where(where);
		const data = await this.database
			.select()
			.from(journalEntries)
			.where(where)
			.orderBy(desc(journalEntries.entryDate), desc(journalEntries.createdAt))
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

	async insertEntry(
		row: {
			organizationId: string;
			code: string;
			accountingPeriodId: string;
			entryDate: string;
			description: string | null;
			sourceType: string | null;
			sourceId: string | null;
			idempotencyKey: string | null;
			sourceModule: string;
			status: string;
			totalDebit: number;
			totalCredit: number;
			currencyCode: string;
			postedBy: string | null;
			postedAt: Date | null;
		},
		tx?: TTx,
	): Promise<TJournalEntrySelect> {
		const db = tx ?? this.database;
		const now = new Date();
		const [created] = await db
			.insert(journalEntries)
			.values({ ...row, preparedBy: row.postedBy, createdAt: now, updatedAt: now })
			.returning();
		return created;
	}

	async insertLines(
		rows: Array<{
			organizationId: string;
			journalEntryId: string;
			lineNo: number;
			accountId: string;
			debit: number;
			credit: number;
			currencyCode: string;
			description: string | null;
			costCenterId: string | null;
			projectId: string | null;
			partyType: string | null;
			partyId: string | null;
		}>,
		tx?: TTx,
	): Promise<TJournalLineSelect[]> {
		const db = tx ?? this.database;
		const now = new Date();
		return db
			.insert(journalLines)
			.values(rows.map((row) => ({ ...row, createdAt: now, updatedAt: now })))
			.returning();
	}

	async findLinesByEntryId(
		organizationId: string,
		entryId: string,
		tx?: TTx,
	): Promise<TJournalLineSelect[]> {
		const db = tx ?? this.database;
		return db
			.select()
			.from(journalLines)
			.where(
				and(
					eq(journalLines.journalEntryId, entryId),
					eq(journalLines.organizationId, organizationId),
					isNull(journalLines.deletedAt),
				),
			)
			.orderBy(asc(journalLines.lineNo));
	}

	/** Stamps `posted_by` on a manually-posted entry (HTTP actor). */
	async stampPostedBy(
		organizationId: string,
		entryId: string,
		postedBy: string,
		tx?: TTx,
	): Promise<void> {
		const db = tx ?? this.database;
		await db
			.update(journalEntries)
			.set({ postedBy, updatedAt: new Date() })
			.where(
				and(
					eq(journalEntries.id, entryId),
					eq(journalEntries.organizationId, organizationId),
				),
			);
	}

	/** Marks the entry `reversed` and stamps the mirrored entry. */	async markReversed(
		organizationId: string,
		entryId: string,
		reversedByEntryId: string,
		tx?: TTx,
	): Promise<void> {
		const db = tx ?? this.database;
		await db
			.update(journalEntries)
			.set({
				status: 'reversed',
				reversedByEntryId,
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(journalEntries.id, entryId),
					eq(journalEntries.organizationId, organizationId),
				),
			);
	}

	/* ----------------------------- opening balances ----------------------------- */

	async listOpeningBalances(
		organizationId: string,
	): Promise<TOpeningBalanceSelect[]> {
		return this.database
			.select()
			.from(openingBalances)
			.where(
				and(
					eq(openingBalances.organizationId, organizationId),
					isNull(openingBalances.deletedAt),
				),
			)
			.orderBy(asc(openingBalances.asOfDate));
	}

	async findOpeningBalanceByAccountAndDate(
		organizationId: string,
		accountId: string,
		asOfDate: string,
	): Promise<TOpeningBalanceSelect | null> {
		const [row] = await this.database
			.select()
			.from(openingBalances)
			.where(
				and(
					eq(openingBalances.organizationId, organizationId),
					eq(openingBalances.accountId, accountId),
					eq(openingBalances.asOfDate, asOfDate),
					isNull(openingBalances.deletedAt),
				),
			)
			.limit(1);
		return row ?? null;
	}

	async insertOpeningBalance(
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
	): Promise<TOpeningBalanceSelect> {
		const db = tx ?? this.database;
		const now = new Date();
		const [created] = await db
			.insert(openingBalances)
			.values({ ...row, createdAt: now, updatedAt: now })
			.returning();
		return created;
	}

	async updateOpeningBalance(
		organizationId: string,
		id: string,
		patch: {
			debitBalance?: number;
			creditBalance?: number;
			description?: string | null;
		},
		tx?: TTx,
	): Promise<TOpeningBalanceSelect | null> {
		const db = tx ?? this.database;
		const [updated] = await db
			.update(openingBalances)
			.set({ ...patch, updatedAt: new Date() })
			.where(
				and(
					eq(openingBalances.id, id),
					eq(openingBalances.organizationId, organizationId),
					isNull(openingBalances.deletedAt),
				),
			)
			.returning();
		return updated ?? null;
	}

	/** Stamps `posted_at` once an opening-balance batch has been posted. */
	async stampOpeningBalancePosted(
		organizationId: string,
		id: string,
		tx?: TTx,
	): Promise<void> {
		const db = tx ?? this.database;
		await db
			.update(openingBalances)
			.set({ postedAt: new Date(), updatedAt: new Date() })
			.where(
				and(
					eq(openingBalances.id, id),
					eq(openingBalances.organizationId, organizationId),
				),
			);
	}

	async deleteOpeningBalance(		organizationId: string,
		id: string,
		tx?: TTx,
	): Promise<boolean> {
		const db = tx ?? this.database;
		const [updated] = await db
			.update(openingBalances)
			.set({ deletedAt: new Date(), updatedAt: new Date() })
			.where(
				and(
					eq(openingBalances.id, id),
					eq(openingBalances.organizationId, organizationId),
					isNull(openingBalances.deletedAt),
				),
			)
			.returning();
		return Boolean(updated);
	}

	/* ----------------------------- bank account links ----------------------------- */

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

	async deactivateBankAccountLink(
		organizationId: string,
		cashBankAccountId: string,
	): Promise<void> {
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

	/* ----------------------------- cash/bank accounts & movements (F3) ----------------------------- */

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

	async findCashBankAccountById(		organizationId: string,
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

	async listCashBankAccounts(
		organizationId: string,
	): Promise<TCashBankAccountSelect[]> {
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
			conditions.push(
				eq(cashBankTransactions.cashBankAccountId, cashBankAccountId),
			);
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

	/** Runs a balance-recalculation sanity check (used by tests/ops). */
	async cashBankAccountBalance(
		organizationId: string,
		id: string,
	): Promise<number> {
		const [row] = await this.database
			.select({
				sum: sql<number>`coalesce(sum(CASE WHEN ${cashBankTransactions.direction} = 'in' THEN ${cashBankTransactions.amount} ELSE -${cashBankTransactions.amount} END), 0)::bigint`,
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

	/* ----------------------------- account balances (close snapshot) ----------------------------- */

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

	/** Per-account debit/credit totals of posted entries inside a period. */
	async accountTotalsForPeriod(
		organizationId: string,
		periodId: string,
	): Promise<Array<{ accountId: string; debit: number; credit: number }>> {
		return this.database
			.select({
				accountId: journalLines.accountId,
				debit: sql<number>`coalesce(sum(${journalLines.debit}), 0)::bigint`,
				credit: sql<number>`coalesce(sum(${journalLines.credit}), 0)::bigint`,
			})
			.from(journalLines)
			.innerJoin(
				journalEntries,
				eq(journalLines.journalEntryId, journalEntries.id),
			)
			.where(
				and(
					eq(journalLines.organizationId, organizationId),
					eq(journalEntries.accountingPeriodId, periodId),
					eq(journalEntries.status, 'posted'),
					isNull(journalLines.deletedAt),
					isNull(journalEntries.deletedAt),
				),
			)
			.groupBy(journalLines.accountId);
	}

	/** True when the period still has posted journal rows. */
	async periodHasPostedEntries(
		organizationId: string,
		periodId: string,
	): Promise<boolean> {
		const [row] = await this.database
			.select({ value: count() })
			.from(journalEntries)
			.where(
				and(
					eq(journalEntries.organizationId, organizationId),
					eq(journalEntries.accountingPeriodId, periodId),
					eq(journalEntries.status, 'posted'),
					isNull(journalEntries.deletedAt),
				),
			)
			.limit(1);
		return row.value > 0;
	}
}
