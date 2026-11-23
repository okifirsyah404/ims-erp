import { DRIZZLE_TOKEN } from '@di/provider';
import type { TTx } from '@drizzle/types';
import {
	expenseClaimItems,
	expenseClaims,
	type TExpenseClaimItemSelect,
	type TExpenseClaimSelect,
} from '@drizzle/schemas/finance.schema';
import type { TPaginationResult } from '@ims-erp/common';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { and, asc, count, desc, eq, gte, ilike, isNull, lte } from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';
import { paginationResult } from '@utils/pagination.util';
import type {
	IExpenseClaimRepository,
	TExpenseClaimItemRow,
	TExpenseClaimPaginationRequest,
	TExpenseClaimRow,
} from '../contracts/expense-claim.repository.interface';

/** Whitelisted sort columns; user input never reaches `orderBy` raw. */
const SORT_COLUMNS = {
	code: expenseClaims.code,
	claimDate: expenseClaims.claimDate,
	totalAmount: expenseClaims.totalAmount,
	createdAt: expenseClaims.createdAt,
} as const;

/** Drizzle queries of `finance.expense_claims(._items)`. Tenant scoped, soft-delete aware. */
@injectable()
export class ExpenseClaimRepository implements IExpenseClaimRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	async insertExpenseClaim(
		row: TExpenseClaimRow,
		tx?: TTx,
	): Promise<TExpenseClaimSelect> {
		const db = tx ?? this.database;
		const now = new Date();
		const [created] = await db
			.insert(expenseClaims)
			.values({
				...row,
				submittedAt: row.submittedAt,
				approvedAt: row.approvedAt,
				createdAt: now,
				updatedAt: now,
			})
			.returning();
		return created;
	}

	async findExpenseClaimById(
		organizationId: string,
		id: string,
		tx?: TTx,
	): Promise<TExpenseClaimSelect | null> {
		const db = tx ?? this.database;
		const [row] = await db
			.select()
			.from(expenseClaims)
			.where(
				and(
					eq(expenseClaims.id, id),
					eq(expenseClaims.organizationId, organizationId),
					isNull(expenseClaims.deletedAt),
				),
			)
			.limit(1);
		return row ?? null;
	}

	async updateExpenseClaim(
		organizationId: string,
		id: string,
		patch: Record<string, unknown>,
		tx?: TTx,
	): Promise<TExpenseClaimSelect | null> {
		const db = tx ?? this.database;
		const [updated] = await db
			.update(expenseClaims)
			.set({ ...patch, updatedAt: new Date() })
			.where(
				and(
					eq(expenseClaims.id, id),
					eq(expenseClaims.organizationId, organizationId),
					isNull(expenseClaims.deletedAt),
				),
			)
			.returning();
		return updated ?? null;
	}

	async paginate(
		request: TExpenseClaimPaginationRequest,
	): Promise<TPaginationResult<TExpenseClaimSelect>> {
		const { organizationId, status, employeeId, from, to, search, page, limit } = request;
		const conditions = [
			eq(expenseClaims.organizationId, organizationId),
			isNull(expenseClaims.deletedAt),
		];
		if (status) conditions.push(eq(expenseClaims.status, status));
		if (employeeId) conditions.push(eq(expenseClaims.employeeId, employeeId));
		if (from) conditions.push(gte(expenseClaims.claimDate, from));
		if (to) conditions.push(lte(expenseClaims.claimDate, to));
		if (search) conditions.push(ilike(expenseClaims.code, `%${search}%`));
		const where = and(...conditions);
		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(expenseClaims)
			.where(where);
		const column = SORT_COLUMNS[request.sortBy ?? 'claimDate'];
		const direction = request.sortDir === 'asc' ? asc : desc;
		const data = await this.database
			.select()
			.from(expenseClaims)
			.where(where)
			.orderBy(direction(column), desc(expenseClaims.code))
			.limit(limit)
			.offset((page - 1) * limit);
		return paginationResult(request, total, data);
	}

	async insertExpenseClaimItems(
		rows: TExpenseClaimItemRow[],
		tx?: TTx,
	): Promise<TExpenseClaimItemSelect[]> {
		const db = tx ?? this.database;
		const now = new Date();
		return db
			.insert(expenseClaimItems)
			.values(rows.map((row) => ({ ...row, createdAt: now, updatedAt: now })))
			.returning();
	}

	async findExpenseClaimItems(
		organizationId: string,
		expenseClaimId: string,
		tx?: TTx,
	): Promise<TExpenseClaimItemSelect[]> {
		const db = tx ?? this.database;
		return db
			.select()
			.from(expenseClaimItems)
			.where(
				and(
					eq(expenseClaimItems.organizationId, organizationId),
					eq(expenseClaimItems.expenseClaimId, expenseClaimId),
					isNull(expenseClaimItems.deletedAt),
				),
			)
			.orderBy(asc(expenseClaimItems.createdAt));
	}

	/** Soft-deletes every live line: a draft's lines are replaced, never edited in place. */
	async deleteExpenseClaimItems(
		organizationId: string,
		expenseClaimId: string,
		tx?: TTx,
	): Promise<void> {
		const db = tx ?? this.database;
		await db
			.update(expenseClaimItems)
			.set({ deletedAt: new Date() })
			.where(
				and(
					eq(expenseClaimItems.organizationId, organizationId),
					eq(expenseClaimItems.expenseClaimId, expenseClaimId),
					isNull(expenseClaimItems.deletedAt),
				),
			);
	}
}
