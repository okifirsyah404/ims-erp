import { DRIZZLE_TOKEN } from '@di/provider';
import {
	employeeAdvances,
	expenseSettlementItems,
	expenseSettlements,
	type TEmployeeAdvanceSelect,
	type TExpenseSettlementSelect,
} from '@drizzle/schemas/finance.schema';
import type { TTx } from '@drizzle/types';
import { paginationResult } from '@utils/pagination.util';
import { and, asc, count, desc, eq, isNull } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type { IEmployeeAdvanceRepository, TAdvanceListQuery } from '../contracts/employee-advance.contract';

/** Drizzle implementation of {@link IEmployeeAdvanceRepository} (ERP-0144). */
@injectable()
export class EmployeeAdvanceRepository implements IEmployeeAdvanceRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	async paginateAdvances(organizationId: string, query: TAdvanceListQuery) {
		const where = and(
			eq(employeeAdvances.organizationId, organizationId),
			isNull(employeeAdvances.deletedAt),
			query.status ? eq(employeeAdvances.status, query.status) : undefined,
			query.employeeId ? eq(employeeAdvances.employeeId, query.employeeId) : undefined,
		);
		const [rows, [total]] = await Promise.all([
			this.database
				.select()
				.from(employeeAdvances)
				.where(where)
				.orderBy(desc(employeeAdvances.createdAt))
				.limit(query.limit)
				.offset((query.page - 1) * query.limit),
			this.database.select({ total: count() }).from(employeeAdvances).where(where),
		]);
		return paginationResult({ page: query.page, limit: query.limit }, Number(total?.total ?? 0), rows);
	}

	async findAdvance(organizationId: string, id: string, tx?: TTx) {
		const [row] = await (tx ?? this.database)
			.select()
			.from(employeeAdvances)
			.where(and(eq(employeeAdvances.organizationId, organizationId), eq(employeeAdvances.id, id), isNull(employeeAdvances.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	async insertAdvance(row: Parameters<IEmployeeAdvanceRepository['insertAdvance']>[0], tx?: TTx) {
		const now = new Date();
		const [created] = await (tx ?? this.database).insert(employeeAdvances).values({ ...row, createdAt: now, updatedAt: now }).returning();
		return created as TEmployeeAdvanceSelect;
	}

	async updateAdvance(organizationId: string, id: string, patch: Partial<TEmployeeAdvanceSelect>, tx?: TTx) {
		const [updated] = await (tx ?? this.database)
			.update(employeeAdvances)
			.set({ ...patch, updatedAt: new Date() })
			.where(and(eq(employeeAdvances.organizationId, organizationId), eq(employeeAdvances.id, id)))
			.returning();
		return updated ?? null;
	}

	async paginateSettlements(organizationId: string, query: TAdvanceListQuery) {
		const where = and(
			eq(expenseSettlements.organizationId, organizationId),
			isNull(expenseSettlements.deletedAt),
			query.status ? eq(expenseSettlements.status, query.status) : undefined,
			query.employeeId ? eq(expenseSettlements.employeeId, query.employeeId) : undefined,
		);
		const [rows, [total]] = await Promise.all([
			this.database
				.select()
				.from(expenseSettlements)
				.where(where)
				.orderBy(desc(expenseSettlements.createdAt))
				.limit(query.limit)
				.offset((query.page - 1) * query.limit),
			this.database.select({ total: count() }).from(expenseSettlements).where(where),
		]);
		return paginationResult({ page: query.page, limit: query.limit }, Number(total?.total ?? 0), rows);
	}

	async findSettlement(organizationId: string, id: string, tx?: TTx) {
		const [row] = await (tx ?? this.database)
			.select()
			.from(expenseSettlements)
			.where(and(eq(expenseSettlements.organizationId, organizationId), eq(expenseSettlements.id, id), isNull(expenseSettlements.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	listSettlementsForAdvance(organizationId: string, advanceId: string, tx?: TTx) {
		return (tx ?? this.database)
			.select()
			.from(expenseSettlements)
			.where(
				and(
					eq(expenseSettlements.organizationId, organizationId),
					eq(expenseSettlements.employeeAdvanceId, advanceId),
					isNull(expenseSettlements.deletedAt),
				),
			)
			.orderBy(asc(expenseSettlements.createdAt));
	}

	async insertSettlement(row: Parameters<IEmployeeAdvanceRepository['insertSettlement']>[0], tx?: TTx) {
		const now = new Date();
		const [created] = await (tx ?? this.database).insert(expenseSettlements).values({ ...row, createdAt: now, updatedAt: now }).returning();
		return created as TExpenseSettlementSelect;
	}

	async updateSettlement(organizationId: string, id: string, patch: Partial<TExpenseSettlementSelect>, tx?: TTx) {
		const [updated] = await (tx ?? this.database)
			.update(expenseSettlements)
			.set({ ...patch, updatedAt: new Date() })
			.where(and(eq(expenseSettlements.organizationId, organizationId), eq(expenseSettlements.id, id)))
			.returning();
		return updated ?? null;
	}

	listSettlementItems(organizationId: string, settlementId: string, tx?: TTx) {
		return (tx ?? this.database)
			.select()
			.from(expenseSettlementItems)
			.where(
				and(
					eq(expenseSettlementItems.organizationId, organizationId),
					eq(expenseSettlementItems.expenseSettlementId, settlementId),
					isNull(expenseSettlementItems.deletedAt),
				),
			)
			.orderBy(asc(expenseSettlementItems.expenseDate));
	}

	async insertSettlementItems(rows: Parameters<IEmployeeAdvanceRepository['insertSettlementItems']>[0], tx?: TTx) {
		if (rows.length === 0) return [];
		const now = new Date();
		return (tx ?? this.database)
			.insert(expenseSettlementItems)
			.values(rows.map((row) => ({ ...row, createdAt: now, updatedAt: now })))
			.returning();
	}
}
