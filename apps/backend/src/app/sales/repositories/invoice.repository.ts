import { DRIZZLE_TOKEN } from '@di/provider';
import type { TTx } from '@drizzle/types';
import {
	invoiceItems,
	invoices,
	receipts,
	type TInvoiceItemSelect,
	type TInvoiceSelect,
	type TReceiptSelect,
} from '@drizzle/schemas/sales.schema';
import {
	and,
	asc,
	count,
	desc,
	eq,
	ilike,
	isNull,
	ne,
	or,
	sql,
} from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import type { TPaginationResult } from '@ims-erp/common';
import { inject, injectable } from 'tsyringe';
import type { TInvoiceRepository } from '../contracts/invoice.repository.interface';
import type { TReceiptData } from '../contracts/invoice.repository.interface';
import type { TReceiptListQuery } from '../contracts/invoice.contract';
import { likePattern } from '@drizzle/search';
import { paymentStatus } from '../utils/payment-status';

/**
 * Drizzle implementation of the invoice repository (M09 F4).
 *
 * @remarks
 * Tenant-scoped on every query; items are replaced wholesale on draft edits
 * (delete + insert inside the caller's transaction).
 */
@injectable()
export class InvoiceRepository implements TInvoiceRepository {
	constructor(
		@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase,
	) {}

	async findById(
		organizationId: string,
		id: string,
		tx?: TTx,
	): Promise<TInvoiceSelect | null> {
		const db = (tx ?? this.database) as BunSQLDatabase;
		const [row] = await db
			.select()
			.from(invoices)
			.where(
				and(
					eq(invoices.id, id),
					eq(invoices.organizationId, organizationId),
					isNull(invoices.deletedAt),
				),
			)
			.limit(1);
		return row ?? null;
	}

	async findByCode(
		organizationId: string,
		code: string,
		tx?: TTx,
	): Promise<TInvoiceSelect | null> {
		const db = (tx ?? this.database) as BunSQLDatabase;
		const [row] = await db
			.select()
			.from(invoices)
			.where(
				and(
					eq(invoices.code, code),
					eq(invoices.organizationId, organizationId),
					isNull(invoices.deletedAt),
				),
			)
			.limit(1);
		return row ?? null;
	}

	async list(
		organizationId: string,
		filters: { status?: string; customerId?: string },
		pagination: { page: number; limit: number },
	): Promise<{
		data: TInvoiceSelect[];
		meta: { page: number; limit: number; total: number; totalPages: number };
	}> {
		const conditions = [
			eq(invoices.organizationId, organizationId),
			isNull(invoices.deletedAt),
		];
		if (filters.status) conditions.push(eq(invoices.status, filters.status));
		if (filters.customerId) {
			conditions.push(eq(invoices.customerId, filters.customerId));
		}
		const where = and(...conditions);
		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(invoices)
			.where(where);
		const data = await this.database
			.select()
			.from(invoices)
			.where(where)
			.orderBy(desc(invoices.createdAt))
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

	async insert(
		row: Record<string, unknown>,
		tx?: TTx,
	): Promise<TInvoiceSelect> {
		const db = (tx ?? this.database) as BunSQLDatabase;
		const now = new Date();
		const [created] = await db
			.insert(invoices)
			.values({ ...row, createdAt: now, updatedAt: now } as never)
			.returning();
		return created;
	}

	async update(
		organizationId: string,
		id: string,
		patch: Record<string, unknown>,
		tx?: TTx,
	): Promise<TInvoiceSelect | null> {
		const db = (tx ?? this.database) as BunSQLDatabase;
		const [updated] = await db
			.update(invoices)
			.set({ ...patch, updatedAt: new Date() } as never)
			.where(
				and(
					eq(invoices.id, id),
					eq(invoices.organizationId, organizationId),
					isNull(invoices.deletedAt),
				),
			)
			.returning();
		return updated ?? null;
	}

	async listItems(
		organizationId: string,
		invoiceId: string,
		tx?: TTx,
	): Promise<TInvoiceItemSelect[]> {
		const db = (tx ?? this.database) as BunSQLDatabase;
		return db
			.select()
			.from(invoiceItems)
			.where(
				and(
					eq(invoiceItems.invoiceId, invoiceId),
					eq(invoiceItems.organizationId, organizationId),
					isNull(invoiceItems.deletedAt),
				),
			)
			.orderBy(asc(invoiceItems.createdAt));
	}

	async replaceItems(
		organizationId: string,
		invoiceId: string,
		rows: Array<Record<string, unknown>>,
		tx?: TTx,
	): Promise<TInvoiceItemSelect[]> {
		const db = (tx ?? this.database) as BunSQLDatabase;
		const now = new Date();
		await db
			.update(invoiceItems)
			.set({ deletedAt: now, updatedAt: now })
			.where(
				and(
					eq(invoiceItems.invoiceId, invoiceId),
					eq(invoiceItems.organizationId, organizationId),
					isNull(invoiceItems.deletedAt),
				),
			);
		if (rows.length === 0) return [];
		return db
			.insert(invoiceItems)
			.values(
				rows.map((row) => ({ ...row, createdAt: now, updatedAt: now })) as never,
			)
			.returning() as unknown as TInvoiceItemSelect[];
	}

	listByOrder(salesOrderId: string): Promise<TInvoiceSelect[]> {
		return this.database
			.select()
			.from(invoices)
			.where(and(eq(invoices.salesOrderId, salesOrderId), isNull(invoices.deletedAt)))
			.orderBy(asc(invoices.createdAt), asc(invoices.id));
	}

	async hasLiveInvoices(salesOrderId: string): Promise<boolean> {
		const [row] = await this.database
			.select({ id: invoices.id })
			.from(invoices)
			.where(
				and(
					eq(invoices.salesOrderId, salesOrderId),
					isNull(invoices.deletedAt),
					ne(invoices.status, 'void'),
				),
			)
			.limit(1);
		return !!row;
	}

	async findReceipt(id: string): Promise<TReceiptSelect | null> {
		const [row] = await this.database
			.select()
			.from(receipts)
			.where(and(eq(receipts.id, id), isNull(receipts.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	listReceipts(invoiceId: string): Promise<TReceiptSelect[]> {
		return this.database
			.select()
			.from(receipts)
			.where(and(eq(receipts.salesInvoiceId, invoiceId), isNull(receipts.deletedAt)))
			.orderBy(asc(receipts.receivedDate), asc(receipts.id));
	}

	async paginateReceipts(
		request: TReceiptListQuery,
	): Promise<
		TPaginationResult<
			TReceiptSelect & { invoiceCode: string | null; customerName: string }
		>
	> {
		const { page, limit, search, status } = request;
		const where = and(
			isNull(receipts.deletedAt),
			status ? eq(receipts.status, status) : undefined,
			search
				? or(
						ilike(receipts.code, likePattern(search)),
						ilike(receipts.reference, likePattern(search)),
						ilike(invoices.code, likePattern(search)),
						ilike(sql`${invoices.customerSnapshot}->>'name'`, likePattern(search)),
					)
				: undefined,
		);
		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(receipts)
			.innerJoin(invoices, eq(invoices.id, receipts.salesInvoiceId))
			.where(where);
		const rows = await this.database
			.select({
				receipt: receipts,
				invoiceCode: invoices.code,
				customerName: sql<string>`${invoices.customerSnapshot}->>'name'`,
			})
			.from(receipts)
			.innerJoin(invoices, eq(invoices.id, receipts.salesInvoiceId))
			.where(where)
			.orderBy(desc(receipts.createdAt), desc(receipts.id))
			.limit(limit)
			.offset((page - 1) * limit);
		return {
			meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
			data: rows.map(({ receipt, invoiceCode, customerName }) => ({
				...receipt,
				invoiceCode,
				customerName,
			})),
		};
	}

	addReceipt(data: TReceiptData): Promise<TReceiptSelect | null> {
		return this.database.transaction(async (tx) => {
			const [invoice] = await tx
				.select()
				.from(invoices)
				.where(and(eq(invoices.id, data.salesInvoiceId), isNull(invoices.deletedAt)))
				.for('update');
			if (
				!invoice ||
				(invoice.status !== 'issued' && invoice.status !== 'partially_paid')
			)
				return null;
			if (data.amount > invoice.outstandingTotal) return null;
			const now = new Date();
			const [receipt] = await tx
				.insert(receipts)
				.values({ ...data, status: 'posted', createdAt: now, updatedAt: now })
				.returning();
			const paid = invoice.paidTotal + data.amount;
			await tx
				.update(invoices)
				.set({
					paidTotal: paid,
					outstandingTotal: invoice.grandTotal - paid,
					status: paymentStatus(invoice.grandTotal, paid),
					updatedAt: now,
				})
				.where(eq(invoices.id, invoice.id));
			return receipt;
		});
	}

	reverseReceipt(
		id: string,
		actorUserId: string,
		reason: string,
	): Promise<TReceiptSelect | null> {
		return this.database.transaction(async (tx) => {
			const now = new Date();
			const [receipt] = await tx
				.update(receipts)
				.set({
					status: 'reversed',
					reversedBy: actorUserId,
					reversedAt: now,
					reversalReason: reason,
					updatedAt: now,
				})
				.where(
					and(
						eq(receipts.id, id),
						isNull(receipts.deletedAt),
						eq(receipts.status, 'posted'),
					),
				)
				.returning();
			if (!receipt) return null;
			const [invoice] = await tx
				.select()
				.from(invoices)
				.where(eq(invoices.id, receipt.salesInvoiceId))
				.for('update');
			const paid = invoice.paidTotal - receipt.amount;
			await tx
				.update(invoices)
				.set({
					paidTotal: paid,
					outstandingTotal: invoice.grandTotal - paid,
					status: paymentStatus(invoice.grandTotal, paid),
					updatedAt: now,
				})
				.where(eq(invoices.id, invoice.id));
			return receipt;
		});
	}
}
