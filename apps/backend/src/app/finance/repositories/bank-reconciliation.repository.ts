import { DRIZZLE_TOKEN } from '@di/provider';
import type { TTx } from '@drizzle/types';
import {
	bankReconciliationItems,
	bankReconciliations,
	cashBankAccounts,
	cashBankTransactions,
} from '@drizzle/schemas/finance.schema';
import type { TPaginationResult } from '@ims-erp/common';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { and, count, desc, eq, gte, isNull, lte, notExists, sql } from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';
import { paginationResult } from '@utils/pagination.util';
import type {
	IBankReconciliationRepository,
	TBankReconciliationPaginationRequest,
} from '../contracts/bank-reconciliation.repository.interface';

/**
 * Drizzle queries of `finance.bank_reconciliations` and
 * `finance.bank_reconciliation_items`.
 *
 * @remarks
 * One repository for the reconciliation aggregate: an item only exists inside a
 * reconciliation, and the service always loads them together. Tenant scoped,
 * soft-delete aware.
 */
@injectable()
export class BankReconciliationRepository implements IBankReconciliationRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	async insertBankReconciliation(
		row: {
			organizationId: string;
			code: string;
			cashBankAccountId: string;
			reconciliationDate: string;
			statementBalance: number;
			bookBalance: number;
			difference: number;
			status: string;
			notes: string | null;
		},
		tx?: TTx,
	): Promise<unknown> {
		const db = tx ?? this.database;
		const now = new Date();
		const [created] = await db
			.insert(bankReconciliations)
			.values({ ...row, createdAt: now, updatedAt: now })
			.returning();
		return created;
	}

	async findBankReconciliationById(
		organizationId: string,
		id: string,
		tx?: TTx,
	): Promise<unknown | null> {
		const db = tx ?? this.database;
		const [row] = await db
			.select()
			.from(bankReconciliations)
			.where(
				and(
					eq(bankReconciliations.id, id),
					eq(bankReconciliations.organizationId, organizationId),
					isNull(bankReconciliations.deletedAt),
				),
			)
			.limit(1);
		return row ?? null;
	}

	/**
	 * Fetches one page of the tenant's reconciliations, newest first.
	 *
	 * @param request - Tenant, page settings and the optional filters
	 */
	async paginate(
		request: TBankReconciliationPaginationRequest,
	): Promise<TPaginationResult<unknown>> {
		const { organizationId, cashBankAccountId, status, page, limit } = request;
		const conditions = [
			eq(bankReconciliations.organizationId, organizationId),
			isNull(bankReconciliations.deletedAt),
		];
		if (cashBankAccountId) {
			conditions.push(eq(bankReconciliations.cashBankAccountId, cashBankAccountId));
		}
		if (status) {
			conditions.push(eq(bankReconciliations.status, status));
		}
		const where = and(...conditions);
		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(bankReconciliations)
			.where(where);
		const data = await this.database
			.select()
			.from(bankReconciliations)
			.where(where)
			.orderBy(desc(bankReconciliations.reconciliationDate))
			.limit(limit)
			.offset((page - 1) * limit);
		return paginationResult(request, total, data);
	}

	async updateBankReconciliation(
		organizationId: string,
		id: string,
		patch: Record<string, unknown>,
		tx?: TTx,
	): Promise<unknown | null> {
		const db = tx ?? this.database;
		const [updated] = await db
			.update(bankReconciliations)
			.set({ ...patch, updatedAt: new Date() })
			.where(
				and(
					eq(bankReconciliations.id, id),
					eq(bankReconciliations.organizationId, organizationId),
					isNull(bankReconciliations.deletedAt),
				),
			)
			.returning();
		return updated ?? null;
	}

	async insertBankReconciliationItems(
		rows: Array<{
			organizationId: string;
			bankReconciliationId: string;
			cashBankTransactionId: string | null;
			statementReference: string | null;
			statementAmount: number | null;
			isMatched: boolean;
			notes: string | null;
			statementDate?: string | null;
			description?: string | null;
			direction?: 'in' | 'out' | null;
			matchMethod?: 'auto' | 'manual' | 'created' | null;
		}>,
		tx?: TTx,
	): Promise<unknown[]> {
		if (rows.length === 0) return [];
		const db = tx ?? this.database;
		const now = new Date();
		return db
			.insert(bankReconciliationItems)
			.values(rows.map((row) => ({ ...row, createdAt: now, updatedAt: now })))
			.returning();
	}

	async listBankReconciliationItems(
		organizationId: string,
		bankReconciliationId: string,
		tx?: TTx,
	): Promise<unknown[]> {
		const db = tx ?? this.database;
		return db
			.select()
			.from(bankReconciliationItems)
			.where(
				and(
					eq(bankReconciliationItems.organizationId, organizationId),
					eq(bankReconciliationItems.bankReconciliationId, bankReconciliationId),
					isNull(bankReconciliationItems.deletedAt),
				),
			);
	}

	async updateBankReconciliationItem(
		organizationId: string,
		id: string,
		patch: Record<string, unknown>,
		tx?: TTx,
	): Promise<unknown | null> {
		const db = tx ?? this.database;
		const [updated] = await db
			.update(bankReconciliationItems)
			.set({ ...patch, updatedAt: new Date() })
			.where(
				and(
					eq(bankReconciliationItems.id, id),
					eq(bankReconciliationItems.organizationId, organizationId),
				),
			)
			.returning();
		return updated ?? null;
	}

	listMatchCandidates(organizationId: string, cashBankAccountId: string, from: string, to: string, tx?: TTx) {
		const db = tx ?? this.database;
		return db
			.select({
				id: cashBankTransactions.id,
				code: cashBankTransactions.code,
				transactionDate: cashBankTransactions.transactionDate,
				direction: sql<'in' | 'out'>`${cashBankTransactions.direction}`,
				amount: cashBankTransactions.amount,
				referenceNumber: cashBankTransactions.referenceNumber,
			})
			.from(cashBankTransactions)
			.where(
				and(
					eq(cashBankTransactions.organizationId, organizationId),
					eq(cashBankTransactions.cashBankAccountId, cashBankAccountId),
					eq(cashBankTransactions.status, 'posted'),
					isNull(cashBankTransactions.deletedAt),
					gte(cashBankTransactions.transactionDate, from),
					lte(cashBankTransactions.transactionDate, to),
					notExists(
						db
							.select({ id: bankReconciliationItems.id })
							.from(bankReconciliationItems)
							.where(
								and(
									eq(bankReconciliationItems.cashBankTransactionId, cashBankTransactions.id),
									eq(bankReconciliationItems.isMatched, true),
									isNull(bankReconciliationItems.deletedAt),
								),
							),
					),
				),
			);
	}

	async balanceAsOf(organizationId: string, cashBankAccountId: string, date: string, tx?: TTx): Promise<number> {
		const db = tx ?? this.database;
		const [account] = await db
			.select({ opening: cashBankAccounts.openingBalance })
			.from(cashBankAccounts)
			.where(and(eq(cashBankAccounts.organizationId, organizationId), eq(cashBankAccounts.id, cashBankAccountId)))
			.limit(1);
		const [movement] = await db
			.select({
				net: sql<string>`coalesce(sum(case when ${cashBankTransactions.direction} = 'in' then ${cashBankTransactions.amount} else -${cashBankTransactions.amount} end), 0)`,
			})
			.from(cashBankTransactions)
			.where(
				and(
					eq(cashBankTransactions.organizationId, organizationId),
					eq(cashBankTransactions.cashBankAccountId, cashBankAccountId),
					eq(cashBankTransactions.status, 'posted'),
					isNull(cashBankTransactions.deletedAt),
					lte(cashBankTransactions.transactionDate, date),
				),
			);
		return (account?.opening ?? 0) + Number(movement?.net ?? 0);
	}
}
