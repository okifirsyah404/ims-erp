import { DRIZZLE_TOKEN } from '@di/provider';
import {
	invoices,
	receipts,
	type TInvoiceSelect,
	type TReceiptSelect,
} from '@drizzle/schemas/finance.schema';
import { likePattern } from '@drizzle/search';
import type { TPaginationResult } from '@ims-erp/common';
import { and, asc, count, desc, eq, ilike, inArray, isNull, lt, ne, or, sql } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type { TInvoiceListQuery, TReceiptListQuery } from '../contracts/invoice.contract';
import type {
	IInvoiceRepository,
	TComputedTerm,
	TInvoiceDraftData,
	TReceiptData,
} from '../contracts/invoice.repository.interface';
import { paymentStatus, sumTerms, type TTermAmounts } from '../utils/invoice-terms';

/** Drizzle implementation of {@link IInvoiceRepository}. */
@injectable()
export class InvoiceRepository implements IInvoiceRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	private live(id: string) {
		return and(eq(invoices.id, id), isNull(invoices.deletedAt));
	}

	async paginate(request: TInvoiceListQuery & { today: string }): Promise<TPaginationResult<TInvoiceSelect>> {
		const { page, limit, search, status, termKind, salesOrderId, overdue, today } = request;
		const where = and(
			isNull(invoices.deletedAt),
			status ? eq(invoices.status, status) : undefined,
			termKind ? eq(invoices.termKind, termKind) : undefined,
			salesOrderId ? eq(invoices.salesOrderId, salesOrderId) : undefined,
			overdue ? and(inArray(invoices.status, ['issued', 'partially_paid']), lt(invoices.dueDate, today)) : undefined,
			search
				? or(
						ilike(invoices.code, likePattern(search)),
						ilike(invoices.salesOrderCode, likePattern(search)),
						ilike(invoices.quotationCode, likePattern(search)),
						ilike(invoices.title, likePattern(search)),
						ilike(sql`${invoices.customerSnapshot}->>'name'`, likePattern(search)),
					)
				: undefined,
		);
		const [{ value: total }] = await this.database.select({ value: count() }).from(invoices).where(where);
		const data = await this.database
			.select()
			.from(invoices)
			.where(where)
			.orderBy(desc(invoices.createdAt), desc(invoices.id))
			.limit(limit)
			.offset((page - 1) * limit);
		return { meta: { page, limit, total, totalPages: Math.ceil(total / limit) }, data };
	}

	async findById(id: string): Promise<TInvoiceSelect | null> {
		const [row] = await this.database.select().from(invoices).where(this.live(id)).limit(1);
		return row ?? null;
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
			.where(and(eq(invoices.salesOrderId, salesOrderId), isNull(invoices.deletedAt), ne(invoices.status, 'void')))
			.limit(1);
		return !!row;
	}

	createDraftLocked(
		data: TInvoiceDraftData,
		compute: (billed: TTermAmounts, liveCount: number) => TComputedTerm,
	): Promise<TInvoiceSelect> {
		return this.database.transaction(async (tx) => {
			// One billing at a time per order (the order lives in another module).
			await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`invoice:${data.salesOrderId}`}))`);
			const live = await tx
				.select({ taxBase: invoices.subtotal, vatAmount: invoices.taxTotal, total: invoices.grandTotal })
				.from(invoices)
				.where(and(eq(invoices.salesOrderId, data.salesOrderId), isNull(invoices.deletedAt), ne(invoices.status, 'void')));
			const term = compute(sumTerms(live), live.length);
			const now = new Date();
			const [row] = await tx
				.insert(invoices)
				.values({
					...data,
					termKind: term.termKind,
					description: term.description,
					percentageBps: term.percentageBps,
					subtotal: term.taxBase,
					discountTotal: 0,
					taxTotal: term.vatAmount,
					grandTotal: term.total,
					paidTotal: 0,
					outstandingTotal: term.total,
					status: 'draft',
					createdAt: now,
					updatedAt: now,
				})
				.returning();
			return row;
		});
	}

	async issue(
		id: string,
		patch: { code: string; issueDate: string; dueDate: string | null; issuedBy: string },
	): Promise<TInvoiceSelect | null> {
		const now = new Date();
		const [row] = await this.database
			.update(invoices)
			.set({ ...patch, issuedAt: now, status: 'issued', updatedAt: now })
			.where(and(this.live(id), eq(invoices.status, 'draft')))
			.returning();
		return row ?? null;
	}

	async void(id: string, actorUserId: string, reason: string): Promise<TInvoiceSelect | null> {
		const now = new Date();
		const [row] = await this.database
			.update(invoices)
			.set({ status: 'void', voidedBy: actorUserId, voidedAt: now, voidReason: reason, outstandingTotal: 0, updatedAt: now })
			.where(and(this.live(id), inArray(invoices.status, ['draft', 'issued']), eq(invoices.paidTotal, 0)))
			.returning();
		return row ?? null;
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
			.where(and(eq(receipts.invoiceId, invoiceId), isNull(receipts.deletedAt)))
			.orderBy(asc(receipts.receivedDate), asc(receipts.id));
	}

	async paginateReceipts(
		request: TReceiptListQuery,
	): Promise<TPaginationResult<TReceiptSelect & { invoiceCode: string | null; customerName: string }>> {
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
			.innerJoin(invoices, eq(invoices.id, receipts.invoiceId))
			.where(where);
		const rows = await this.database
			.select({
				receipt: receipts,
				invoiceCode: invoices.code,
				customerName: sql<string>`${invoices.customerSnapshot}->>'name'`,
			})
			.from(receipts)
			.innerJoin(invoices, eq(invoices.id, receipts.invoiceId))
			.where(where)
			.orderBy(desc(receipts.createdAt), desc(receipts.id))
			.limit(limit)
			.offset((page - 1) * limit);
		return {
			meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
			data: rows.map(({ receipt, invoiceCode, customerName }) => ({ ...receipt, invoiceCode, customerName })),
		};
	}

	addReceipt(data: TReceiptData): Promise<TReceiptSelect | null> {
		return this.database.transaction(async (tx) => {
			const [invoice] = await tx.select().from(invoices).where(this.live(data.invoiceId)).for('update');
			if (!invoice || (invoice.status !== 'issued' && invoice.status !== 'partially_paid')) return null;
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

	reverseReceipt(id: string, actorUserId: string, reason: string): Promise<TReceiptSelect | null> {
		return this.database.transaction(async (tx) => {
			const now = new Date();
			const [receipt] = await tx
				.update(receipts)
				.set({ status: 'reversed', reversedBy: actorUserId, reversedAt: now, reversalReason: reason, updatedAt: now })
				.where(and(eq(receipts.id, id), isNull(receipts.deletedAt), eq(receipts.status, 'posted')))
				.returning();
			if (!receipt) return null;
			const [invoice] = await tx.select().from(invoices).where(eq(invoices.id, receipt.invoiceId)).for('update');
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
