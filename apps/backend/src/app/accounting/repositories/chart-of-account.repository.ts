import { DRIZZLE_TOKEN } from '@di/provider';
import type { TTx } from '@drizzle/types';
import {
	chartOfAccounts,
	journalLines,
	type TChartOfAccountSelect,
} from '@drizzle/schemas/accounting.schema';
import type { TPaginationResult } from '@ims-erp/common';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { and, asc, count, eq, inArray, isNull } from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';
import type { IChartOfAccountRepository } from '../contracts/ledger.repositories';

/**
 * Drizzle queries of `accounting.chart_of_accounts`.
 *
 * @remarks
 * Tenant scoped, soft-delete aware. `accountHasJournalLines` counts rows of
 * `journal_lines` because the question is "is this account in use", which the
 * account row cannot answer.
 */
@injectable()
export class ChartOfAccountRepository implements IChartOfAccountRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

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

	async listAccountsMap(
		organizationId: string,
		tx?: TTx,
	): Promise<Map<string, TChartOfAccountSelect>> {
		const db = tx ?? this.database;
		const rows = await db
			.select()
			.from(chartOfAccounts)
			.where(
				and(
					eq(chartOfAccounts.organizationId, organizationId),
					isNull(chartOfAccounts.deletedAt),
				),
			);
		return new Map(rows.map((row) => [row.id, row]));
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

	async accountHasJournalLines(organizationId: string, accountId: string): Promise<boolean> {
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
}
