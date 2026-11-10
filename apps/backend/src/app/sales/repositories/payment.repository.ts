import { CACHE_CLIENT_TOKEN, DRIZZLE_TOKEN } from '@di/provider';
import {
	TPaymentInsert,
	TPaymentSelect,
	payments,
	PAYMENT_STATUSES,
} from '@drizzle/schemas/sales.schema';
import { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { and, eq } from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';
import type { ICacheClient } from '@cache/cache.client';
import type {
	TCreatePaymentInput,
	TPaymentRepository,
} from '../contracts/payment.repository.interface';

/**
 * Drizzle implementation of the payment repository.
 *
 * Approve/execute are conditional updates on the expected status so
 * concurrent callers cannot double-approve or double-execute.
 *
 * @remarks
 * Cache-aside with a 5-minute TTL on the hot read (`findById`), keyed per
 * tenant: `sales:payment:{organizationId}:id:{id}`. Writes invalidate
 * explicitly. Keys are tenant-scoped because every query is scoped by
 * organizationId.
 */
@injectable()
export class PaymentRepository implements TPaymentRepository {
	constructor(
		@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase,
		@inject(CACHE_CLIENT_TOKEN) private readonly cache: ICacheClient,
	) {}

	/** Tenant-scoped Redis key namespace for cached reads. */
	private readonly cachePrefix = 'sales:payment';

	/**
	 * Creates a payment pinned to `pending` status with server-set
	 * `id`/`createdAt`; the client never supplies status.
	 */
	async create(input: TCreatePaymentInput): Promise<TPaymentSelect> {
		const row: TPaymentInsert = {
			id: crypto.randomUUID(),
			organizationId: input.organizationId,
			quotationId: input.quotationId,
			amount: input.amount,
			status: 'pending',
			createdBy: input.createdBy,
			createdAt: new Date(),
		};
		const [created] = await this.database.insert(payments).values(row).returning();
		return created;
	}

	/**
	 * Fetches one tenant-scoped payment.
	 *
	 * @remarks
	 * Cache-aside with negative caching: an absent row is cached as the
	 * literal string `'null'` so repeated misses do not hit the database.
	 */
	async findById(
		organizationId: string,
		id: string,
	): Promise<TPaymentSelect | null> {
		return this.cache.remember(
			`${this.cachePrefix}:${organizationId}:id:${id}`,
			async () => {
				const [row] = await this.database
					.select()
					.from(payments)
					.where(
						and(eq(payments.id, id), eq(payments.organizationId, organizationId)),
					)
					.limit(1);
				return row ?? null;
			},
		);
	}

	/**
	 * Evicts the tenant-scoped per-id cache entry.
	 */
	private async invalidate(organizationId: string, id: string): Promise<void> {
		await this.cache.del(`${this.cachePrefix}:${organizationId}:id:${id}`);
	}

	/**
	 * Race-safe approval: the update only lands when the row is still
	 * `pending`, so concurrent approvals cannot double-fire.
	 *
	 * @returns The approved row, or `null` when absent, foreign, or not
	 * in `pending` state
	 */
	async approve(
		organizationId: string,
		id: string,
		actorUserId: string,
	): Promise<TPaymentSelect | null> {
		const [row] = await this.database
			.update(payments)
			.set({
				status: 'approved',
				approvedBy: actorUserId,
				approvedAt: new Date(),
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(payments.id, id),
					eq(payments.organizationId, organizationId),
					eq(payments.status, 'pending'),
				),
			)
			.returning();
		if (row) await this.invalidate(organizationId, id);
		return row ?? null;
	}

	/**
	 * Race-safe execution: the update only lands when the row is still
	 * `approved`, preventing duplicate execution under races.
	 *
	 * @returns The executed row, or `null` when absent, foreign, or not
	 * in `approved` state
	 */
	async execute(
		organizationId: string,
		id: string,
		actorUserId: string,
	): Promise<TPaymentSelect | null> {
		const [row] = await this.database
			.update(payments)
			.set({
				status: 'executed',
				executedBy: actorUserId,
				executedAt: new Date(),
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(payments.id, id),
					eq(payments.organizationId, organizationId),
					eq(payments.status, 'approved'),
				),
			)
			.returning();
		if (row) await this.invalidate(organizationId, id);
		return row ?? null;
	}
}

/**
 * Re-export of the payment status enum for consumers that need the
 * allowed workflow states without importing the Drizzle schema directly.
 */
export const paymentStatuses = PAYMENT_STATUSES;
