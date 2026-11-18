import { DRIZZLE_TOKEN } from '@di/provider';
import type { TTx } from '@drizzle/types';
import {
	paymentAllocations,
	payments,
	type TPaymentAllocationSelect,
	type TPaymentInsert,
	type TPaymentInsertInput,
	type TPaymentSelect,
} from '@drizzle/schemas/payment.schema';
import type { TPaginationResult } from '@ims-erp/common';
import { and, count, desc, eq, inArray, isNull } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type { IPaymentRepository, TPaymentListFilters } from '../contracts/payment.repository.interface';

/**
 * Drizzle queries of `payment.payments` and `payment.payment_allocations`
 * (ADR-0024).
 *
 * @remarks
 * Owns every read/write of the ledger. The effects a *settled* payment has on
 * other modules (AR/AP mirrors, sales invoice totals, supplier bills, cash/bank
 * transactions) are NOT here — they go through Finance's and Sales' contracts,
 * injected into the service.
 */
@injectable()
export class PaymentRepository implements IPaymentRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	async findById(organizationId: string, id: string, tx?: unknown): Promise<TPaymentSelect | null> {
		const db = (tx as TTx | undefined) ?? this.database;
		const [row] = await db
			.select()
			.from(payments)
			.where(
				and(
					eq(payments.id, id),
					eq(payments.organizationId, organizationId),
					isNull(payments.deletedAt),
				),
			);
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
		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(payments)
			.where(where);
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

	async insert(row: TPaymentInsertInput, tx?: unknown): Promise<TPaymentSelect> {
		const db = (tx as TTx | undefined) ?? this.database;
		const now = new Date();
		const [created] = await db
			.insert(payments)
			.values({ ...row, createdAt: row.createdAt ?? now, updatedAt: row.updatedAt ?? now })
			.returning();
		return created!;
	}

	async update(
		organizationId: string,
		id: string,
		patch: Partial<TPaymentInsert>,
		tx?: unknown,
	): Promise<TPaymentSelect | null> {
		const db = (tx as TTx | undefined) ?? this.database;
		const [updated] = await db
			.update(payments)
			.set({ ...patch, updatedAt: new Date() })
			.where(
				and(
					eq(payments.id, id),
					eq(payments.organizationId, organizationId),
					isNull(payments.deletedAt),
				),
			)
			.returning();
		return updated ?? null;
	}

	async insertAllocations(
		rows: Array<{
			organizationId: string;
			paymentId: string;
			targetType: string;
			salesInvoiceId: string | null;
			supplierBillId: string | null;
			amount: number;
		}>,
		tx?: unknown,
	): Promise<TPaymentAllocationSelect[]> {
		if (rows.length === 0) return [];
		const db = (tx as TTx | undefined) ?? this.database;
		const now = new Date();
		return db
			.insert(paymentAllocations)
			.values(rows.map((row) => ({ ...row, createdAt: now, updatedAt: now })))
			.returning();
	}

	async listAllocations(
		organizationId: string,
		paymentId: string,
		tx?: unknown,
	): Promise<TPaymentAllocationSelect[]> {
		const db = (tx as TTx | undefined) ?? this.database;
		return db
			.select()
			.from(paymentAllocations)
			.where(
				and(
					eq(paymentAllocations.organizationId, organizationId),
					eq(paymentAllocations.paymentId, paymentId),
				),
			);
	}

	async markAllocationExecuted(organizationId: string, allocationId: string, tx?: unknown): Promise<void> {
		const db = (tx as TTx | undefined) ?? this.database;
		await db
			.update(paymentAllocations)
			.set({ updatedAt: new Date() })
			.where(
				and(
					eq(paymentAllocations.id, allocationId),
					eq(paymentAllocations.organizationId, organizationId),
				),
			);
	}
}
