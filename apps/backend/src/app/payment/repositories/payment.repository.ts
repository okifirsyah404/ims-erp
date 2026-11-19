import { DRIZZLE_TOKEN } from '@di/provider';
import {
	paymentAllocations,
	payments,
	type TPaymentAllocationSelect,
	type TPaymentInsert,
	type TPaymentSelect,
} from '@drizzle/schemas/payment.schema';
import type { TTx } from '@drizzle/types';
import type { TPaginationResult } from '@ims-erp/common';
import { and, count, desc, eq, gt, inArray, isNull } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type { IPaymentRepository, TPaymentData, TPaymentListFilters } from '../contracts/payment.repository.interface';

/**
 * Drizzle queries of `payment.payments` and `payment.payment_allocations`
 * (ADR-0024).
 *
 * @remarks
 * Owns every read/write of the ledger, manual payments and online checkouts
 * alike. The effects a *settled* payment has on other modules (AR/AP mirrors,
 * sale invoice totals, supplier bills, cash/bank transactions) are NOT here -
 * they go through Finance's and Sale's contracts, injected into the service.
 */
@injectable()
export class PaymentRepository implements IPaymentRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	private db(tx?: unknown): BunSQLDatabase | TTx {
		return (tx as TTx | undefined) ?? this.database;
	}

	async findById(organizationId: string, id: string, tx?: unknown): Promise<TPaymentSelect | null> {
		const [row] = await this.db(tx)
			.select()
			.from(payments)
			.where(and(eq(payments.id, id), eq(payments.organizationId, organizationId), isNull(payments.deletedAt)));
		return row ?? null;
	}

	async list(
		organizationId: string,
		filters: TPaymentListFilters,
		pagination: { page: number; limit: number },
	): Promise<TPaginationResult<TPaymentSelect>> {
		const conditions = [eq(payments.organizationId, organizationId), isNull(payments.deletedAt)];
		if (filters.status) conditions.push(eq(payments.status, filters.status));
		if (filters.paymentType) conditions.push(eq(payments.paymentType, filters.paymentType));
		const where = and(...conditions);
		const [{ value: total }] = await this.database.select({ value: count() }).from(payments).where(where);
		const data = await this.database
			.select()
			.from(payments)
			.where(where)
			.orderBy(desc(payments.createdAt))
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

	async countOpen(organizationId: string): Promise<number> {
		const [{ value }] = await this.database
			.select({ value: count() })
			.from(payments)
			.where(
				and(
					eq(payments.organizationId, organizationId),
					isNull(payments.deletedAt),
					inArray(payments.status, ['draft', 'submitted', 'approved']),
				),
			);
		return Number(value ?? 0);
	}

	async insert(row: TPaymentData, tx?: unknown): Promise<TPaymentSelect> {
		const now = new Date();
		const [created] = await this.db(tx)
			.insert(payments)
			.values({ ...row, createdAt: now, updatedAt: now })
			.returning();
		return created!;
	}

	async update(
		organizationId: string,
		id: string,
		patch: Partial<TPaymentInsert>,
		tx?: unknown,
	): Promise<TPaymentSelect | null> {
		const [updated] = await this.db(tx)
			.update(payments)
			.set({ ...patch, updatedAt: new Date() })
			.where(and(eq(payments.id, id), eq(payments.organizationId, organizationId), isNull(payments.deletedAt)))
			.returning();
		return updated ?? null;
	}

	async syncAllocations(
		organizationId: string,
		paymentId: string,
		rows: Array<{ payableType: string; payableId: string; amount: number }>,
		tx?: unknown,
	): Promise<TPaymentAllocationSelect[]> {
		const db = this.db(tx);
		const now = new Date();
		const existing = await db
			.select()
			.from(paymentAllocations)
			.where(and(eq(paymentAllocations.organizationId, organizationId), eq(paymentAllocations.paymentId, paymentId)));
		const keyOf = (type: string, id: string) => `${type}:${id}`;
		const byKey = new Map(existing.map((row) => [keyOf(row.payableType, row.payableId), row]));
		const wanted = new Set(rows.map((row) => keyOf(row.payableType, row.payableId)));

		for (const row of existing) {
			if (!row.deletedAt && !wanted.has(keyOf(row.payableType, row.payableId))) {
				await db
					.update(paymentAllocations)
					.set({ deletedAt: now, updatedAt: now })
					.where(eq(paymentAllocations.id, row.id));
			}
		}
		for (const row of rows) {
			const found = byKey.get(keyOf(row.payableType, row.payableId));
			if (found) {
				await db
					.update(paymentAllocations)
					.set({ amount: row.amount, deletedAt: null, updatedAt: now })
					.where(eq(paymentAllocations.id, found.id));
			} else {
				await db.insert(paymentAllocations).values({
					organizationId,
					paymentId,
					payableType: row.payableType,
					payableId: row.payableId,
					amount: row.amount,
					allocatedAt: now,
					createdAt: now,
					updatedAt: now,
				});
			}
		}
		return this.listAllocations(organizationId, paymentId, tx);
	}

	async listAllocations(organizationId: string, paymentId: string, tx?: unknown): Promise<TPaymentAllocationSelect[]> {
		return this.db(tx)
			.select()
			.from(paymentAllocations)
			.where(
				and(
					eq(paymentAllocations.organizationId, organizationId),
					eq(paymentAllocations.paymentId, paymentId),
					isNull(paymentAllocations.deletedAt),
				),
			);
	}

	private allocationsOf(payableType: string, payableId: string) {
		return this.database
			.select({ id: paymentAllocations.paymentId })
			.from(paymentAllocations)
			.where(
				and(
					eq(paymentAllocations.payableType, payableType),
					eq(paymentAllocations.payableId, payableId),
					isNull(paymentAllocations.deletedAt),
				),
			);
	}

	async listCheckoutsOf(organizationId: string, payableType: string, payableId: string): Promise<TPaymentSelect[]> {
		return this.database
			.select()
			.from(payments)
			.where(
				and(
					eq(payments.organizationId, organizationId),
					eq(payments.channel, 'gateway'),
					inArray(payments.id, this.allocationsOf(payableType, payableId)),
					isNull(payments.deletedAt),
				),
			)
			.orderBy(desc(payments.createdAt));
	}

	async findReusableCheckout(
		organizationId: string,
		payableType: string,
		payableId: string,
		provider: string,
		amount: number,
		openUntil: Date,
	): Promise<TPaymentSelect | null> {
		const [row] = await this.database
			.select()
			.from(payments)
			.where(
				and(
					eq(payments.organizationId, organizationId),
					eq(payments.channel, 'gateway'),
					eq(payments.provider, provider),
					eq(payments.amount, amount),
					eq(payments.status, 'pending'),
					gt(payments.expiresAt, openUntil),
					inArray(payments.id, this.allocationsOf(payableType, payableId)),
					isNull(payments.deletedAt),
				),
			)
			.orderBy(desc(payments.createdAt))
			.limit(1);
		return row?.paymentUrl ? row : null;
	}

	withLocked<T>(id: string, work: (row: TPaymentSelect, tx: unknown) => Promise<T>): Promise<T | null> {
		return this.database.transaction(async (tx) => {
			const [row] = await tx
				.select()
				.from(payments)
				.where(and(eq(payments.id, id), isNull(payments.deletedAt)))
				.for('update');
			return row ? work(row, tx) : null;
		});
	}
}
