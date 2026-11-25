import { DRIZZLE_TOKEN } from '@di/provider';
import {
	chartOfAccounts,
	journalEntries,
	journalLines,
	projectBudgetLines,
	projectBudgets,
	supplierBills,
	type TProjectBudgetLineSelect,
	type TProjectBudgetSelect,
} from '@drizzle/schemas/finance.schema';
import type { TTx } from '@drizzle/types';
import { and, desc, eq, inArray, isNull, notInArray, sql } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type { IProjectBudgetRepository } from '../contracts/project-budget.contract';

/** Drizzle implementation of {@link IProjectBudgetRepository} (ERP-0146). */
@injectable()
export class ProjectBudgetRepository implements IProjectBudgetRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	listVersions(organizationId: string, projectId: string) {
		return this.database
			.select()
			.from(projectBudgets)
			.where(and(eq(projectBudgets.organizationId, organizationId), eq(projectBudgets.projectId, projectId), isNull(projectBudgets.deletedAt)))
			.orderBy(desc(projectBudgets.version));
	}

	async findBudget(organizationId: string, id: string, tx?: TTx) {
		const [row] = await (tx ?? this.database)
			.select()
			.from(projectBudgets)
			.where(and(eq(projectBudgets.organizationId, organizationId), eq(projectBudgets.id, id), isNull(projectBudgets.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	async findActive(organizationId: string, projectId: string, tx?: TTx) {
		const [row] = await (tx ?? this.database)
			.select()
			.from(projectBudgets)
			.where(
				and(
					eq(projectBudgets.organizationId, organizationId),
					eq(projectBudgets.projectId, projectId),
					eq(projectBudgets.status, 'active'),
					isNull(projectBudgets.deletedAt),
				),
			)
			.limit(1);
		return row ?? null;
	}

	async findActiveByProject(projectId: string) {
		const [row] = await this.database
			.select()
			.from(projectBudgets)
			.where(and(eq(projectBudgets.projectId, projectId), eq(projectBudgets.status, 'active'), isNull(projectBudgets.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	listActiveBudgets(organizationId: string) {
		return this.database
			.select()
			.from(projectBudgets)
			.where(and(eq(projectBudgets.organizationId, organizationId), eq(projectBudgets.status, 'active'), isNull(projectBudgets.deletedAt)));
	}

	async insertBudget(row: Parameters<IProjectBudgetRepository['insertBudget']>[0], tx?: TTx) {
		const now = new Date();
		const [created] = await (tx ?? this.database).insert(projectBudgets).values({ ...row, createdAt: now, updatedAt: now }).returning();
		return created as TProjectBudgetSelect;
	}

	async updateBudget(organizationId: string, id: string, patch: Partial<TProjectBudgetSelect>, tx?: TTx) {
		const [updated] = await (tx ?? this.database)
			.update(projectBudgets)
			.set({ ...patch, updatedAt: new Date() })
			.where(and(eq(projectBudgets.organizationId, organizationId), eq(projectBudgets.id, id)))
			.returning();
		return updated ?? null;
	}

	listLines(organizationId: string, budgetId: string, tx?: TTx): Promise<TProjectBudgetLineSelect[]> {
		return (tx ?? this.database)
			.select()
			.from(projectBudgetLines)
			.where(
				and(
					eq(projectBudgetLines.organizationId, organizationId),
					eq(projectBudgetLines.projectBudgetId, budgetId),
					isNull(projectBudgetLines.deletedAt),
				),
			);
	}

	async replaceLines(organizationId: string, budgetId: string, rows: Array<{ accountId: string; period: string; amount: number }>, tx?: TTx) {
		const db = tx ?? this.database;
		const now = new Date();
		await db
			.update(projectBudgetLines)
			.set({ deletedAt: now, updatedAt: now })
			.where(and(eq(projectBudgetLines.projectBudgetId, budgetId), isNull(projectBudgetLines.deletedAt)));
		if (rows.length === 0) return;
		await db
			.insert(projectBudgetLines)
			.values(rows.map((row) => ({ ...row, organizationId, projectBudgetId: budgetId, createdAt: now, updatedAt: now })));
	}

	async actuals(organizationId: string, projectId: string, tx?: TTx) {
		const rows = await (tx ?? this.database)
			.select({
				accountId: journalLines.accountId,
				period: sql<string>`to_char(${journalEntries.entryDate}::date, 'YYYY-MM')`,
				amount: sql<string>`sum(${journalLines.debit} - ${journalLines.credit})`,
			})
			.from(journalLines)
			.innerJoin(journalEntries, eq(journalEntries.id, journalLines.journalEntryId))
			.innerJoin(chartOfAccounts, eq(chartOfAccounts.id, journalLines.accountId))
			.where(
				and(
					eq(journalEntries.organizationId, organizationId),
					eq(journalLines.projectId, projectId),
					inArray(journalEntries.status, ['posted', 'reversed']),
					eq(chartOfAccounts.accountType, 'expense'),
				),
			)
			.groupBy(journalLines.accountId, sql`to_char(${journalEntries.entryDate}::date, 'YYYY-MM')`);
		return rows.map((row) => ({ accountId: row.accountId, period: row.period, amount: Number(row.amount) }));
	}

	async billedByOrder(organizationId: string, orderIds: string[], tx?: TTx) {
		if (orderIds.length === 0) return new Map<string, number>();
		const rows = await (tx ?? this.database)
			.select({ orderId: supplierBills.purchaseOrderId, billed: sql<string>`sum(${supplierBills.subtotal})` })
			.from(supplierBills)
			.where(
				and(
					eq(supplierBills.organizationId, organizationId),
					inArray(supplierBills.purchaseOrderId, orderIds),
					notInArray(supplierBills.status, ['void', 'draft']),
					isNull(supplierBills.deletedAt),
				),
			)
			.groupBy(supplierBills.purchaseOrderId);
		return new Map(rows.map((row) => [row.orderId as string, Number(row.billed)]));
	}
}
