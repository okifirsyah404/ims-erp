import { DRIZZLE_TOKEN } from '@di/provider';
import type { TTx } from '@drizzle/types';
import {
	invoiceItems,
	invoices,
	receipts,
	type TInvoiceItemSelect,
	type TInvoiceSelect,
	type TReceiptSelect,
} from '@drizzle/schemas/sale.schema';
import {
	and,
	asc,
	count,
	desc,
	eq,
	gte,
	ilike,
	inArray,
	isNotNull,
	isNull,
	lte,
	ne,
	or,
	sql,
} from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import type { TPaginationResult } from '@ims-erp/common';
import { inject, injectable } from 'tsyringe';
import type {
	TInvoiceListFilters,
	TInvoiceRepository,
	TInvoiceSummary,
} from '../contracts/invoice.repository.interface';
import { sumTerms, type TTermAmounts } from '../utils/invoice-terms';
import type { TReceiptData } from '../contracts/invoice.repository.interface';
import type { TReceiptListQuery } from '../contracts/invoice.contract';
import { likePattern } from '@drizzle/search';
import { paymentStatus } from '../utils/payment-status';
import { fillSummary } from '../utils/invoice-summary';
import { INVOICED_STATUSES } from '../contracts/invoice.repository.interface';

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
		filters: TInvoiceListFilters,
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
		if (filters.termKind) conditions.push(eq(invoices.termKind, filters.termKind));
		if (filters.search) {
			const pattern = likePattern(filters.search);
			conditions.push(
				or(
					ilike(invoices.code, pattern),
					ilike(invoices.title, pattern),
					ilike(invoices.orderCode, pattern),
					sql`${invoices.customerSnapshot}->>'name' ILIKE ${pattern}`,
				)!,
			);
		}
		if (filters.overdueOn) {
			conditions.push(
				or(eq(invoices.status, 'issued'), eq(invoices.status, 'partially_paid'))!,
				sql`${invoices.dueDate} < ${filters.overdueOn}`,
			);
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

	async countDraftsInWindow(
		organizationId: string,
		startDate: string,
		endDate: string,
	): Promise<number> {
		const [row] = await this.database
			.select({ value: count() })
			.from(invoices)
			.where(
				and(
					eq(invoices.organizationId, organizationId),
					isNull(invoices.deletedAt),
					eq(invoices.status, 'draft'),
					gte(invoices.createdAt, new Date(`${startDate}T00:00:00Z`)),
					lte(invoices.createdAt, new Date(`${endDate}T23:59:59Z`)),
				),
			);
		return Number(row?.value ?? 0);
	}

	async summary(
		organizationId: string,
		range: { from: string; to: string; groupBy: 'month' | 'day' },
	): Promise<TInvoiceSummary> {		// Bucket key straight from `issue_date` (`YYYY-MM-DD` as text): `YYYY-MM`
		// for months, the full date for days. No format parameter - PostgreSQL
		// does not treat `to_char(x, $1)` in the select and `to_char(x, $2)` in
		// the group by as the same expression.
		const period =
			range.groupBy === 'month'
				? sql<string>`left(${invoices.issueDate}::text, 7)`
				: sql<string>`${invoices.issueDate}::text`;
		const rows = await this.database
			.select({
				period,
				invoiced: sql<string>`coalesce(sum(${invoices.grandTotal}), 0)::bigint`,
				count: sql<string>`count(*)::int`,
			})
			.from(invoices)
			.where(
				and(
					eq(invoices.organizationId, organizationId),
					isNull(invoices.deletedAt),
					isNotNull(invoices.issueDate),
					gte(invoices.issueDate, range.from),
					lte(invoices.issueDate, range.to),
					inArray(invoices.status, [...INVOICED_STATUSES]),
				),
			)
			.groupBy(period)
			.orderBy(period);
		// bun-sql returns `bigint`/`int` aggregates as strings; money stays exact.
		return fillSummary(
			range,
			rows.map((row) => ({
				period: row.period,
				invoiced: Number(row.invoiced),
				count: Number(row.count),
			})),
		);
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

	listByOrder(orderId: string): Promise<TInvoiceSelect[]> {
		return this.database
			.select()
			.from(invoices)
			.where(and(eq(invoices.orderId, orderId), isNull(invoices.deletedAt)))
			.orderBy(asc(invoices.createdAt), asc(invoices.id));
	}

	async hasLiveInvoices(orderId: string): Promise<boolean> {
		const [row] = await this.database
			.select({ id: invoices.id })
			.from(invoices)
			.where(
				and(
					eq(invoices.orderId, orderId),
					isNull(invoices.deletedAt),
					ne(invoices.status, 'void'),
					ne(invoices.status, 'cancelled'),
				),
			)
			.limit(1);
		return !!row;
	}

	withLockedInvoice<T>(organizationId: string, id: string, work: (invoice: TInvoiceSelect, tx: unknown) => Promise<T>): Promise<T | null> {
		return this.database.transaction(async (tx) => {
			const [invoice] = await tx
				.select()
				.from(invoices)
				.where(and(eq(invoices.id, id), eq(invoices.organizationId, organizationId), isNull(invoices.deletedAt)))
				.for('update');
			return invoice ? work(invoice, tx) : null;
		});
	}

	createTermDraftLocked(
		orderId: string,
		build: (billed: TTermAmounts, liveCount: number, tx: unknown) => Promise<{ row: Record<string, unknown>; items: Array<Record<string, unknown>> }>,
	): Promise<TInvoiceSelect> {
		return this.database.transaction(async (tx) => {
			// One billing at a time per order: the term is chosen under this lock.
			await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`invoice:${orderId}`}))`);
			const live = await tx
				.select({ taxBase: invoices.subtotal, vatAmount: invoices.taxTotal, total: invoices.grandTotal })
				.from(invoices)
				.where(
					and(
						eq(invoices.orderId, orderId),
						isNull(invoices.deletedAt),
						ne(invoices.status, 'void'),
						ne(invoices.status, 'cancelled'),
					),
				);
			const { row, items } = await build(sumTerms(live), live.length, tx);
			const now = new Date();
			const [created] = await tx
				.insert(invoices)
				.values({ ...row, createdAt: now, updatedAt: now } as never)
				.returning();
			if (items.length > 0) {
				await tx
					.insert(invoiceItems)
					.values(items.map((item) => ({ ...item, invoiceId: created!.id, createdAt: now, updatedAt: now })) as never);
			}
			return created!;
		});
	}

	async findReceipt(
		organizationId: string,
		id: string,
	): Promise<TReceiptSelect | null> {
		const [row] = await this.database
			.select()
			.from(receipts)
			.where(
				and(
					eq(receipts.id, id),
					eq(receipts.organizationId, organizationId),
					isNull(receipts.deletedAt),
				),
			)
			.limit(1);
		return row ?? null;
	}

	listReceipts(
		organizationId: string,
		invoiceId: string,
	): Promise<TReceiptSelect[]> {
		return this.database
			.select()
			.from(receipts)
			.where(
				and(
					eq(receipts.organizationId, organizationId),
					eq(receipts.invoiceId, invoiceId),
					isNull(receipts.deletedAt),
				),
			)
			.orderBy(asc(receipts.receivedDate), asc(receipts.id));
	}

	async paginateReceipts(
		organizationId: string,
		request: TReceiptListQuery,
	): Promise<
		TPaginationResult<
			TReceiptSelect & { invoiceCode: string | null; customerName: string }
		>
	> {
		const { page, limit, search, status } = request;
		const where = and(
			eq(receipts.organizationId, organizationId),
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
			data: rows.map(({ receipt, invoiceCode, customerName }) => ({
				...receipt,
				invoiceCode,
				customerName,
			})),
		};
	}

	addReceipt(
		data: TReceiptData,
		options: { tx?: unknown; capToOutstanding?: boolean } = {},
	): Promise<TReceiptSelect | null> {
		const run = async (tx: TTx): Promise<TReceiptSelect | null> => {
			const [invoice] = await tx
				.select()
				.from(invoices)
				.where(
					and(
						eq(invoices.id, data.invoiceId),
						eq(invoices.organizationId, data.organizationId),
						isNull(invoices.deletedAt),
					),
				)
				.for('update');
			if (
				!invoice ||
				(invoice.status !== 'issued' && invoice.status !== 'partially_paid')
			)
				return null;
			const amount = options.capToOutstanding
				? Math.min(data.amount, invoice.outstandingTotal)
				: data.amount;
			if (amount <= 0 || amount > invoice.outstandingTotal) return null;
			const now = new Date();
			const [receipt] = await tx
				.insert(receipts)
				.values({ ...data, amount, status: 'posted', createdAt: now, updatedAt: now })
				.returning();
			const paid = invoice.paidTotal + amount;
			await tx
				.update(invoices)
				.set({
					paidTotal: paid,
					outstandingTotal: invoice.grandTotal - paid,
					status: paymentStatus(invoice.grandTotal, paid),
					updatedAt: now,
				})
				.where(eq(invoices.id, invoice.id));
			return receipt ?? null;
		};
		return options.tx
			? run(options.tx as TTx)
			: this.database.transaction((tx) => run(tx));
	}

	reverseReceipt(
		organizationId: string,
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
						eq(receipts.organizationId, organizationId),
						isNull(receipts.deletedAt),
						eq(receipts.status, 'posted'),
					),
				)
				.returning();
			if (!receipt) return null;
			const [invoice] = await tx
				.select()
				.from(invoices)
				.where(eq(invoices.id, receipt.invoiceId))
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
