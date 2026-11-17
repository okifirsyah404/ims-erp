import { DRIZZLE_TOKEN } from '@di/provider';
import type { TTx } from '@drizzle/types';
import {
	gatewayPayments,
	type TGatewayPaymentInsert,
	type TGatewayPaymentSelect,
	type TGatewayProvider,
} from '@drizzle/schemas/payment.schema';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type { IGatewayPaymentRepository, TGatewayPaymentData } from '../contracts/payment-gateway.contract';

/** Drizzle queries of `sales.gateway_payments` (ERP-0020). */
@injectable()
export class GatewayPaymentRepository implements IGatewayPaymentRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	listByInvoice(organizationId: string, invoiceId: string): Promise<TGatewayPaymentSelect[]> {
		return this.database
			.select()
			.from(gatewayPayments)
			.where(
				and(
					eq(gatewayPayments.organizationId, organizationId),
					eq(gatewayPayments.salesInvoiceId, invoiceId),
					isNull(gatewayPayments.deletedAt),
				),
			)
			.orderBy(desc(gatewayPayments.createdAt));
	}

	async findReusable(
		organizationId: string,
		invoiceId: string,
		provider: TGatewayProvider,
		amount: number,
		openUntil: Date,
	): Promise<TGatewayPaymentSelect | null> {
		const [row] = await this.database
			.select()
			.from(gatewayPayments)
			.where(
				and(
					eq(gatewayPayments.organizationId, organizationId),
					eq(gatewayPayments.salesInvoiceId, invoiceId),
					eq(gatewayPayments.provider, provider),
					eq(gatewayPayments.amount, amount),
					eq(gatewayPayments.status, 'pending'),
					gt(gatewayPayments.expiresAt, openUntil),
					isNull(gatewayPayments.deletedAt),
				),
			)
			.orderBy(desc(gatewayPayments.createdAt))
			.limit(1);
		return row?.paymentUrl ? row : null;
	}

	async insert(data: TGatewayPaymentData): Promise<TGatewayPaymentSelect> {
		const now = new Date();
		const [row] = await this.database
			.insert(gatewayPayments)
			.values({ ...data, status: 'pending', createdAt: now, updatedAt: now })
			.returning();
		return row!;
	}

	async update(id: string, patch: Partial<TGatewayPaymentInsert>, tx?: unknown): Promise<TGatewayPaymentSelect> {
		const db = (tx as TTx | undefined) ?? this.database;
		const [row] = await db
			.update(gatewayPayments)
			.set({ ...patch, updatedAt: new Date() })
			.where(eq(gatewayPayments.id, id))
			.returning();
		return row!;
	}

	withLocked<T>(id: string, work: (row: TGatewayPaymentSelect, tx: unknown) => Promise<T>): Promise<T | null> {
		return this.database.transaction(async (tx) => {
			const [row] = await tx
				.select()
				.from(gatewayPayments)
				.where(and(eq(gatewayPayments.id, id), isNull(gatewayPayments.deletedAt)))
				.for('update');
			return row ? work(row, tx) : null;
		});
	}
}
