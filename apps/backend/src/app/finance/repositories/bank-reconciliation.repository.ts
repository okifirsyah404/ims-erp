import { DRIZZLE_TOKEN } from '@di/provider';
import type { TTx } from '@drizzle/types';
import {
	bankReconciliationItems,
	bankReconciliations,
} from '@drizzle/schemas/finance.schema';
import type { TPaginationResult } from '@ims-erp/common';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { and, count, desc, eq, isNull } from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';
import type { IBankReconciliationRepository } from '../contracts/bank-reconciliation.repository.interface';

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

	async listBankReconciliations(
		organizationId: string,
		filters: { cashBankAccountId?: string; status?: string },
		pagination: { page: number; limit: number },
	): Promise<TPaginationResult<unknown>> {
		const conditions = [
			eq(bankReconciliations.organizationId, organizationId),
			isNull(bankReconciliations.deletedAt),
		];
		if (filters.cashBankAccountId) {
			conditions.push(eq(bankReconciliations.cashBankAccountId, filters.cashBankAccountId));
		}
		if (filters.status) {
			conditions.push(eq(bankReconciliations.status, filters.status));
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
}
