import { DRIZZLE_TOKEN } from '@di/provider';
import type { TTx } from '@drizzle/types';
import { openingBalances, type TOpeningBalanceSelect } from '@drizzle/schemas/finance.schema';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';
import type { IOpeningBalanceRepository } from '../contracts/opening-balance.repository.interface';

/** Drizzle queries of `accounting.opening_balances`. Tenant scoped, soft-delete aware. */
@injectable()
export class OpeningBalanceRepository implements IOpeningBalanceRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	async listOpeningBalances(organizationId: string): Promise<TOpeningBalanceSelect[]> {
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

	async stampOpeningBalancePosted(organizationId: string, id: string, tx?: TTx): Promise<void> {
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

	async deleteOpeningBalance(organizationId: string, id: string, tx?: TTx): Promise<boolean> {
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
}
