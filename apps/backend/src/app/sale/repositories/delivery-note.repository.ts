import { DRIZZLE_TOKEN } from '@di/provider';
import type { TTx } from '@drizzle/types';
import {
	deliveryNoteItems,
	deliveryNotes,
	orders,
	type TDeliveryNoteItemSelect,
} from '@drizzle/schemas/sale.schema';
import { likePattern } from '@drizzle/search';
import type { TPaginationResult } from '@ims-erp/common';
import { and, asc, count, desc, eq, getTableColumns, ilike, inArray, isNull, ne, or, sql } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type { TDeliveryNoteListQuery } from '../contracts/delivery-note.contract';
import type {
	IDeliveryNoteRepository,
	TDeliveryNoteHeaderData,
	TDeliveryNoteItemData,
	TDeliveryNoteRow,
	TSerialShipment,
	TShippedNoteValue,
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
				orderCode: orders.code,
				customerId: orders.customerId,
				customerName: sql<string>`${orders.customerSnapshot}->>'name'`,
			})
			.from(deliveryNotes)
			.innerJoin(orders, eq(orders.id, deliveryNotes.orderId));
	}

	async paginate(query: TDeliveryNoteListQuery): Promise<TPaginationResult<TDeliveryNoteRow>> {
		const { page, limit, search, orderId, status } = query;
		const where = and(
			isNull(deliveryNotes.deletedAt),
			orderId ? eq(deliveryNotes.orderId, orderId) : undefined,
			status ? eq(deliveryNotes.status, status) : undefined,
			search
				? or(
						ilike(deliveryNotes.code, likePattern(search)),
						ilike(deliveryNotes.recipientName, likePattern(search)),
						ilike(deliveryNotes.projectName, likePattern(search)),
						ilike(orders.code, likePattern(search)),
					)
				: undefined,
		);
		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(deliveryNotes)
			.innerJoin(orders, eq(orders.id, deliveryNotes.orderId))
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

	async hasLiveNotes(orderId: string): Promise<boolean> {
		const [row] = await this.database
			.select({ id: deliveryNotes.id })
			.from(deliveryNotes)
			.where(
				and(
					eq(deliveryNotes.orderId, orderId),
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

	async setLineIssue(lineId: string, data: { movementId: string; unitCost: number }, tx: TTx): Promise<void> {
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

	async shippedValues(orderId: string): Promise<TShippedNoteValue[]> {
		const rows = await this.database
			.select({
				id: deliveryNotes.id,
				code: deliveryNotes.code,
				shippedAt: deliveryNotes.shippedAt,
				// Each line at the cost its issue movement took, half-up per line.
				value: sql<string>`coalesce(sum(round(${deliveryNoteItems.quantity} * coalesce(${deliveryNoteItems.unitCost}, 0))), 0)`,
			})
			.from(deliveryNotes)
			.leftJoin(
				deliveryNoteItems,
				and(eq(deliveryNoteItems.deliveryNoteId, deliveryNotes.id), isNull(deliveryNoteItems.deletedAt)),
			)
			.where(
				and(
					eq(deliveryNotes.orderId, orderId),
					isNull(deliveryNotes.deletedAt),
					inArray(deliveryNotes.status, ['shipped', 'delivered']),
				),
			)
			.groupBy(deliveryNotes.id, deliveryNotes.code, deliveryNotes.shippedAt)
			.orderBy(asc(deliveryNotes.shippedAt));
		return rows.map((row) => ({ ...row, value: Number(row.value) }));
	}

	shippedLines(orderId: string): Promise<TDeliveryNoteItemSelect[]> {
		return this.database
			.select(getTableColumns(deliveryNoteItems))
			.from(deliveryNoteItems)
			.innerJoin(deliveryNotes, eq(deliveryNotes.id, deliveryNoteItems.deliveryNoteId))
			.where(
				and(
					eq(deliveryNotes.orderId, orderId),
					isNull(deliveryNotes.deletedAt),
					isNull(deliveryNoteItems.deletedAt),
					inArray(deliveryNotes.status, ['shipped', 'delivered']),
				),
			)
			.orderBy(asc(deliveryNotes.shippedAt), asc(deliveryNoteItems.sortOrder));
	}

	async findShipmentBySerial(serialNumber: string): Promise<TSerialShipment | null> {
		const [row] = await this.database
			.select({
				orderId: deliveryNotes.orderId,
				customerId: orders.customerId,
				description: deliveryNoteItems.name,
				deliveryNoteCode: deliveryNotes.code,
				shippedAt: deliveryNotes.shippedAt,
			})
			.from(deliveryNoteItems)
			.innerJoin(deliveryNotes, eq(deliveryNotes.id, deliveryNoteItems.deliveryNoteId))
			.innerJoin(orders, eq(orders.id, deliveryNotes.orderId))
			.where(
				and(
					sql`${deliveryNoteItems.serialNumbers} @> jsonb_build_array(${serialNumber}::text)`,
					isNull(deliveryNoteItems.deletedAt),
					isNull(deliveryNotes.deletedAt),
					inArray(deliveryNotes.status, ['shipped', 'delivered']),
				),
			)
			.orderBy(desc(deliveryNotes.shippedAt))
			.limit(1);
		return row ?? null;
	}
}
