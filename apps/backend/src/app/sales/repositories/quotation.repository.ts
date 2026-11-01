import { DRIZZLE_TOKEN, REDIS_TOKEN } from '@di/provider';
import {
	TQuotationInsert,
	TQuotationSelect,
	quotations,
	QUOTATION_STATUSES,
} from '@drizzle/schemas/sales.schema';
import { RedisClient } from 'bun';
import { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { and, asc, count, eq } from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';
import type {
	TApproveQuotationInput,
	TCreateQuotationInput,
	TQuotationRepository,
	TSubmitQuotationInput,
	TUpdateQuotationInput,
} from '../contracts/quotation.repository.interface';

/**
 * Drizzle implementation of the quotation repository.
 *
 * Tenant scoping: every query filters by organizationId. List/select
 * operations never run unscoped and filter afterwards.
 *
 * @remarks
 * Cache-aside with a 5-minute TTL on the hot read (`findById`), keyed per
 * tenant: `sales:quotation:{organizationId}:id:{id}`. Writes invalidate
 * explicitly. `list` is never cached. Keys are tenant-scoped because every
 * query is scoped by organizationId.
 */
@injectable()
export class QuotationRepository implements TQuotationRepository {
	constructor(
		@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase,
		@inject(REDIS_TOKEN) private readonly redisClient: RedisClient,
	) {}

	/** Tenant-scoped Redis key namespace for cached reads. */
	private readonly cachePrefix = 'sales:quotation';

	/** Cache-aside TTL applied to the cached `findById` read (5 minutes). */
	private readonly cacheTtlSeconds = 300;

	/**
	 * Creates a quotation pinned to `draft` status with server-set
	 * `id`/`createdAt`; the client never supplies status.
	 */
	async create(input: TCreateQuotationInput): Promise<TQuotationSelect> {
		const now = new Date();
		const row: TQuotationInsert = {
			id: crypto.randomUUID(),
			organizationId: input.organizationId,
			code: input.code,
			title: input.title,
			amount: input.amount,
			status: 'draft',
			createdBy: input.createdBy,
			createdAt: now,
		};
		const [created] = await this.database
			.insert(quotations)
			.values(row)
			.returning();
		return created;
	}

	/**
	 * Fetches one tenant-scoped quotation.
	 *
	 * @remarks
	 * Cache-aside with negative caching: an absent row is cached as the
	 * literal string `'null'` so repeated misses do not hit the database.
	 */
	async findById(
		organizationId: string,
		id: string,
	): Promise<TQuotationSelect | null> {
		const cacheKey = `${this.cachePrefix}:${organizationId}:id:${id}`;
		const cached = await this.redisClient.get(cacheKey);
		if (cached === 'null') return null;
		if (cached) return JSON.parse(cached) as TQuotationSelect;

		const [row] = await this.database
			.select()
			.from(quotations)
			.where(
				and(eq(quotations.id, id), eq(quotations.organizationId, organizationId)),
			)
			.limit(1);

		await this.redisClient.set(
			cacheKey,
			JSON.stringify(row ?? null),
			'EX',
			this.cacheTtlSeconds,
		);
		return row ?? null;
	}

	/**
	 * Evicts the tenant-scoped per-id cache entry.
	 */
	private async invalidate(organizationId: string, id: string): Promise<void> {
		await this.redisClient.del(`${this.cachePrefix}:${organizationId}:id:${id}`);
	}

	/**
	 * Lists one page of the tenant's quotations, oldest first. Never
	 * cached: pagination plus a live count offers little hit value.
	 */
	async list(
		organizationId: string,
		pagination: { page: number; limit: number },
	): Promise<{ data: TQuotationSelect[]; total: number }> {
		const where = eq(quotations.organizationId, organizationId);
		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(quotations)
			.where(where);
		const data = await this.database
			.select()
			.from(quotations)
			.where(where)
			.orderBy(asc(quotations.createdAt))
			.limit(pagination.limit)
			.offset((pagination.page - 1) * pagination.limit);
		return { data, total };
	}

	/**
	 * Applies a whitelisted partial update and invalidates the read cache.
	 */
	async update(
		organizationId: string,
		id: string,
		patch: TUpdateQuotationInput,
	): Promise<TQuotationSelect | null> {
		// Mass-assignment protection: only the whitelisted fields are taken
		// from the patch; organizationId/status/createdBy are never writable.
		const [row] = await this.database
			.update(quotations)
			.set({
				...(patch.title !== undefined ? { title: patch.title } : {}),
				...(patch.amount !== undefined ? { amount: patch.amount } : {}),
				updatedAt: new Date(),
			})
			.where(
				and(eq(quotations.id, id), eq(quotations.organizationId, organizationId)),
			)
			.returning();
		if (row) await this.invalidate(organizationId, id);
		return row ?? null;
	}

	/**
	 * Race-safe status transition: the update only lands when the row is
	 * still in `from` state.
	 *
	 * @returns The updated row, or `null` when absent, foreign, or the
	 * status no longer matches
	 */
	async transitionStatus(
		organizationId: string,
		id: string,
		from: TQuotationSelect['status'],
		to: TQuotationSelect['status'],
	): Promise<TQuotationSelect | null> {
		const [row] = await this.database
			.update(quotations)
			.set({ status: to, updatedAt: new Date() })
			.where(
				and(
					eq(quotations.id, id),
					eq(quotations.organizationId, organizationId),
					eq(quotations.status, from),
				),
			)
			.returning();
		if (row) await this.invalidate(organizationId, id);
		return row ?? null;
	}
}

// keep the input type referenced for contract completeness
export type { TSubmitQuotationInput, TApproveQuotationInput };

/**
 * Re-export of the quotation status enum for consumers that need the
 * allowed workflow states without importing the Drizzle schema directly.
 */
export const quotationStatuses = QUOTATION_STATUSES;
