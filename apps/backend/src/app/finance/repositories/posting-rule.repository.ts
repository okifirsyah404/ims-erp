import { DRIZZLE_TOKEN } from '@di/provider';
import type { TTx } from '@drizzle/types';
import {
	ANY_POSTING_EVENT,
	postingRules,
	type TPostingRuleSelect,
} from '@drizzle/schemas/finance.schema';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { and, asc, count, eq, inArray, isNull } from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';
import type {
	IPostingRuleRepository,
	TPostingRuleListFilter,
} from '../contracts/posting-rule.repository.interface';

/** Drizzle implementation of {@link IPostingRuleRepository} (ERP-0128). */
@injectable()
export class PostingRuleRepository implements IPostingRuleRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	async findCandidates(
		organizationId: string,
		role: string,
		eventType: string,
		tx?: TTx,
	): Promise<TPostingRuleSelect[]> {
		const db = tx ?? this.database;
		return db
			.select()
			.from(postingRules)
			.where(
				and(
					eq(postingRules.organizationId, organizationId),
					eq(postingRules.role, role),
					inArray(postingRules.eventType, [eventType, ANY_POSTING_EVENT]),
					eq(postingRules.isActive, true),
					isNull(postingRules.deletedAt),
				),
			);
	}

	async findById(organizationId: string, id: string): Promise<TPostingRuleSelect | null> {
		const [row] = await this.database
			.select()
			.from(postingRules)
			.where(
				and(
					eq(postingRules.id, id),
					eq(postingRules.organizationId, organizationId),
					isNull(postingRules.deletedAt),
				),
			)
			.limit(1);
		return row ?? null;
	}

	async findByScope(
		organizationId: string,
		scope: {
			eventType: string;
			role: string;
			discriminatorType: string;
			discriminatorValue: string;
		},
	): Promise<TPostingRuleSelect | null> {
		const [row] = await this.database
			.select()
			.from(postingRules)
			.where(
				and(
					eq(postingRules.organizationId, organizationId),
					eq(postingRules.eventType, scope.eventType),
					eq(postingRules.role, scope.role),
					eq(postingRules.discriminatorType, scope.discriminatorType),
					eq(postingRules.discriminatorValue, scope.discriminatorValue),
					isNull(postingRules.deletedAt),
				),
			)
			.limit(1);
		return row ?? null;
	}

	async list(filter: TPostingRuleListFilter): Promise<TPostingRuleSelect[]> {
		const conditions = [
			eq(postingRules.organizationId, filter.organizationId),
			isNull(postingRules.deletedAt),
		];
		if (filter.eventType) conditions.push(eq(postingRules.eventType, filter.eventType));
		if (filter.role) conditions.push(eq(postingRules.role, filter.role));
		if (!filter.includeInactive) conditions.push(eq(postingRules.isActive, true));
		return this.database
			.select()
			.from(postingRules)
			.where(and(...conditions))
			.orderBy(
				asc(postingRules.role),
				asc(postingRules.eventType),
				asc(postingRules.discriminatorType),
				asc(postingRules.discriminatorValue),
			);
	}

	async insert(row: {
		organizationId: string;
		eventType: string;
		role: string;
		discriminatorType: string;
		discriminatorValue: string;
		accountId: string;
		description: string | null;
	}): Promise<TPostingRuleSelect> {
		const now = new Date();
		const [created] = await this.database
			.insert(postingRules)
			.values({ ...row, isActive: true, createdAt: now, updatedAt: now })
			.returning();
		return created;
	}

	async update(
		organizationId: string,
		id: string,
		patch: { accountId?: string; isActive?: boolean; description?: string | null },
	): Promise<TPostingRuleSelect | null> {
		const [updated] = await this.database
			.update(postingRules)
			.set({ ...patch, updatedAt: new Date() })
			.where(
				and(
					eq(postingRules.id, id),
					eq(postingRules.organizationId, organizationId),
					isNull(postingRules.deletedAt),
				),
			)
			.returning();
		return updated ?? null;
	}

	async softDelete(organizationId: string, id: string): Promise<TPostingRuleSelect | null> {
		const now = new Date();
		const [updated] = await this.database
			.update(postingRules)
			.set({ deletedAt: now, isActive: false, updatedAt: now })
			.where(
				and(
					eq(postingRules.id, id),
					eq(postingRules.organizationId, organizationId),
					isNull(postingRules.deletedAt),
				),
			)
			.returning();
		return updated ?? null;
	}

	async isAccountReferenced(organizationId: string, accountId: string): Promise<boolean> {
		const [row] = await this.database
			.select({ value: count() })
			.from(postingRules)
			.where(
				and(
					eq(postingRules.organizationId, organizationId),
					eq(postingRules.accountId, accountId),
					eq(postingRules.isActive, true),
					isNull(postingRules.deletedAt),
				),
			);
		return row.value > 0;
	}
}
