import { DRIZZLE_TOKEN } from '@di/provider';
import type { TTx } from '@drizzle/types';
import {
	deliveryNoteItems,
	deliveryNotes,
	salesOrders,
	type TDeliveryNoteItemSelect,
} from '@drizzle/schemas/sales.schema';
import { likePattern } from '@drizzle/search';
import type { TPaginationResult } from '@ims-erp/common';
import { and, asc, count, desc, eq, getTableColumns, ilike, isNull, ne, or, sql } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type { TDeliveryNoteListQuery } from '../contracts/delivery-note.contract';
import type {
	IDeliveryNoteRepository,
	TDeliveryNoteHeaderData,
	TDeliveryNoteItemData,
	TDeliveryNoteRow,
} from '../contracts/delivery-note.repository.interface';

/** Drizzle implementation of {@link IDeliveryNoteRepository}. */
@injectable()
export class DeliveryNoteRepository implements IDeliveryNoteRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	private live(id: string) {
		return and(eq(deliveryNotes.id, id), isNull(deliveryNotes.deletedAt));
	}

	private select() {
		return this.database
			.select({
				...getTableColumns(deliveryNotes),
				salesOrderCode: salesOrders.code,
				customerId: salesOrders.customerId,
				customerName: sql<string>`${salesOrders.customerSnapshot}->>'name'`,
			})
			.from(deliveryNotes)
			.innerJoin(salesOrders, eq(salesOrders.id, deliveryNotes.salesOrderId));
	}

	async paginate(query: TDeliveryNoteListQuery): Promise<TPaginationResult<TDeliveryNoteRow>> {
		const { page, limit, search, salesOrderId, status } = query;
		const where = and(
			isNull(deliveryNotes.deletedAt),
			salesOrderId ? eq(deliveryNotes.salesOrderId, salesOrderId) : undefined,
			status ? eq(deliveryNotes.status, status) : undefined,
			search
				? or(
						ilike(deliveryNotes.code, likePattern(search)),
						ilike(deliveryNotes.recipientName, likePattern(search)),
						ilike(deliveryNotes.projectName, likePattern(search)),
						ilike(salesOrders.code, likePattern(search)),
					)
				: undefined,
		);
		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(deliveryNotes)
			.innerJoin(salesOrders, eq(salesOrders.id, deliveryNotes.salesOrderId))
			.where(where);
		const data = await this.select()
			.where(where)
			.orderBy(desc(deliveryNotes.createdAt), desc(deliveryNotes.id))
			.limit(limit)
			.offset((page - 1) * limit);
		return { meta: { page, limit, total, totalPages: Math.ceil(total / limit) }, data };
	}

	async findById(id: string): Promise<TDeliveryNoteRow | null> {
		const [row] = await this.select().where(this.live(id)).limit(1);
		return row ?? null;
	}

	findItems(deliveryNoteId: string): Promise<TDeliveryNoteItemSelect[]> {
		return this.database
			.select()
			.from(deliveryNoteItems)
			.where(and(eq(deliveryNoteItems.deliveryNoteId, deliveryNoteId), isNull(deliveryNoteItems.deletedAt)))
			.orderBy(asc(deliveryNoteItems.sortOrder), asc(deliveryNoteItems.id));
	}

	async hasLiveNotes(salesOrderId: string): Promise<boolean> {
		const [row] = await this.database
			.select({ id: deliveryNotes.id })
			.from(deliveryNotes)
			.where(
				and(
					eq(deliveryNotes.salesOrderId, salesOrderId),
					isNull(deliveryNotes.deletedAt),
					ne(deliveryNotes.status, 'cancelled'),
				),
			)
			.limit(1);
		return !!row;
	}

	async create(header: TDeliveryNoteHeaderData, items: TDeliveryNoteItemData[], tx: TTx) {
		const now = new Date();
		const [note] = await tx
			.insert(deliveryNotes)
			.values({ ...header, status: 'prepared', createdAt: now, updatedAt: now })
			.returning();
		const rows = await tx
			.insert(deliveryNoteItems)
			.values(items.map((item) => ({ ...item, deliveryNoteId: note.id, createdAt: now, updatedAt: now })))
			.returning();
		return { note, items: rows };
	}

	async markShipped(id: string, actorUserId: string, tx: TTx) {
		const now = new Date();
		const [note] = await tx
			.update(deliveryNotes)
			.set({ status: 'shipped', shippedAt: now, shippedBy: actorUserId, updatedAt: now })
			.where(and(this.live(id), eq(deliveryNotes.status, 'prepared')))
			.returning();
		return note ?? null;
	}

	async setLineIssue(lineId: string, data: { stockMovementId: string; unitCost: number }, tx: TTx): Promise<void> {
		await tx
			.update(deliveryNoteItems)
			.set({ ...data, updatedAt: new Date() })
			.where(eq(deliveryNoteItems.id, lineId));
	}

	async markDelivered(id: string, data: { receiverName: string; receivedAt: Date }) {
		const [note] = await this.database
			.update(deliveryNotes)
			.set({ status: 'delivered', ...data, updatedAt: new Date() })
			.where(and(this.live(id), eq(deliveryNotes.status, 'shipped')))
			.returning();
		return note ?? null;
	}

	async cancel(id: string, actorUserId: string, reason: string, tx: TTx) {
		const now = new Date();
		const [note] = await tx
			.update(deliveryNotes)
			.set({ status: 'cancelled', cancelledAt: now, cancelledBy: actorUserId, cancellationReason: reason, updatedAt: now })
			.where(and(this.live(id), eq(deliveryNotes.status, 'prepared')))
			.returning();
		return note ?? null;
	}
}
