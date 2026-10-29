import { DRIZZLE_TOKEN } from '@di/provider';
import {
	TPaymentInsert,
	TPaymentSelect,
	payments,
	PAYMENT_STATUSES,
} from '@drizzle/schemas/sales.schema';
import { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { and, eq } from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';
import type {
	TCreatePaymentInput,
	TPaymentRepository,
} from '../contracts/payment.repository.interface';

/**
 * Drizzle implementation of the payment repository.
 *
 * Approve/execute are conditional updates on the expected status so
 * concurrent callers cannot double-approve or double-execute.
 */
@injectable()
export class PaymentRepository implements TPaymentRepository {
	constructor(
		@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase,
	) {}

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

	async findById(
		organizationId: string,
		id: string,
	): Promise<TPaymentSelect | null> {
		const [row] = await this.database
			.select()
			.from(payments)
			.where(
				and(eq(payments.id, id), eq(payments.organizationId, organizationId)),
			)
			.limit(1);
		return row ?? null;
	}

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
		return row ?? null;
	}

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
		return row ?? null;
	}
}

export const paymentStatuses = PAYMENT_STATUSES;
