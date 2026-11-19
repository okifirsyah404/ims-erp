import { DRIZZLE_TOKEN } from '@di/provider';
import type { TTx } from '@drizzle/types';
import {
	type QuotationStatus,
	orderStatusHistory,
	quotations,
	quotationStatusHistory,
	orderItems,
	orders,
	type OrderStatus,
	type TOrderStatusHistorySelect,
	type TOrderItemSelect,
	type TOrderSelect,
} from '@drizzle/schemas/sale.schema';
import { likePattern } from '@drizzle/search';
import { quantityToMilli } from '@utils/money.util';
import type { TPaginationResult } from '@ims-erp/common';
import { and, asc, count, desc, eq, ilike, isNull, ne, or, sql } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type {
	ISalesOrderRepository,
	TAllocationResult,
	TDeliveryAllocation,
	TSalesOrderHeaderData,
	TSalesOrderItemData,
	TSalesOrderPaginationRequest,
} from '../contracts/sales-order.repository.interface';

/** Drizzle implementation of {@link ISalesOrderRepository}. */
@injectable()
export class SalesOrderRepository implements ISalesOrderRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	private live(id: string) {
		return and(eq(orders.id, id), isNull(orders.deletedAt));
	}

	private async logOrder(
		tx: TTx,
		orderId: string,
		fromStatus: OrderStatus | null,
		toStatus: OrderStatus,
		changedBy: string,
		now: Date,
		note: string | null = null,
	) {
		await tx.insert(orderStatusHistory).values({
			orderId,
			fromStatus,
			toStatus,
			changedBy,
			changedAt: now,
			note,
			createdAt: now,
			updatedAt: now,
		});
	}

	/** Moves the SPH between statuses with its own history row; `null` on a race. */
	private async moveQuotation(
		tx: TTx,
		quotationId: string,
		from: readonly QuotationStatus[],
		to: QuotationStatus,
		patch: { closedBy: string | null; closedAt: Date | null },
		actorUserId: string,
		now: Date,
		note: string,
	) {
		const [current] = await tx
			.select({ status: quotations.status })
			.from(quotations)
			.where(and(eq(quotations.id, quotationId), isNull(quotations.deletedAt)))
			.for('update');
		if (!current || !from.includes(current.status)) return false;
		await tx
			.update(quotations)
			.set({ ...patch, status: to, updatedAt: now })
			.where(eq(quotations.id, quotationId));
		await tx.insert(quotationStatusHistory).values({
			quotationId,
			fromStatus: current.status,
			toStatus: to,
			changedBy: actorUserId,
			changedAt: now,
			note,
			createdAt: now,
			updatedAt: now,
		});
		return true;
	}

	async paginate(request: TSalesOrderPaginationRequest): Promise<TPaginationResult<TOrderSelect>> {
		const { page, limit, search, status, customerId, salesPersonUserId } = request;
		const where = and(
			isNull(orders.deletedAt),
			status ? eq(orders.status, status) : undefined,
			customerId ? eq(orders.customerId, customerId) : undefined,
			salesPersonUserId ? eq(orders.salesPersonUserId, salesPersonUserId) : undefined,
			search
				? or(
						ilike(orders.code, likePattern(search)),
						ilike(orders.quotationCode, likePattern(search)),
						ilike(orders.title, likePattern(search)),
						ilike(orders.customerPoNumber, likePattern(search)),
						ilike(sql`${orders.customerSnapshot}->>'name'`, likePattern(search)),
					)
				: undefined,
		);
		const [{ value: total }] = await this.database.select({ value: count() }).from(orders).where(where);
		const data = await this.database
			.select()
			.from(orders)
			.where(where)
			.orderBy(desc(orders.createdAt), desc(orders.id))
			.limit(limit)
			.offset((page - 1) * limit);
		return { meta: { page, limit, total, totalPages: Math.ceil(total / limit) }, data };
	}

	async findById(id: string): Promise<TOrderSelect | null> {
		const [row] = await this.database.select().from(orders).where(this.live(id)).limit(1);
		return row ?? null;
	}

	findItems(orderId: string): Promise<TOrderItemSelect[]> {
		return this.database
			.select()
			.from(orderItems)
			.where(and(eq(orderItems.orderId, orderId), isNull(orderItems.deletedAt)))
			.orderBy(asc(orderItems.sortOrder));
	}

	findHistory(orderId: string): Promise<TOrderStatusHistorySelect[]> {
		return this.database
			.select()
			.from(orderStatusHistory)
			.where(eq(orderStatusHistory.orderId, orderId))
			.orderBy(asc(orderStatusHistory.changedAt), asc(orderStatusHistory.id));
	}

	async findLiveByQuotation(quotationId: string): Promise<TOrderSelect | null> {
		const [row] = await this.database
			.select()
			.from(orders)
			.where(and(eq(orders.quotationId, quotationId), isNull(orders.deletedAt), ne(orders.status, 'cancelled')))
			.limit(1);
		return row ?? null;
	}

	createFromQuotation(
		header: TSalesOrderHeaderData,
		items: TSalesOrderItemData[],
		actorUserId: string,
	): Promise<TOrderSelect | null> {
		return this.database.transaction(async (tx) => {
			const now = new Date();
			const won = await this.moveQuotation(
				tx,
				header.quotationId,
				['approved', 'sent'],
				'won',
				{ closedBy: actorUserId, closedAt: now },
				actorUserId,
				now,
				`sales order ${header.code}`,
			);
			if (!won) return null;
			const [order] = await tx
				.insert(orders)
				.values({ ...header, status: 'confirmed', createdAt: now, updatedAt: now })
				.returning();
			await tx.insert(orderItems).values(
				items.map((item, index) => ({ ...item, orderId: order.id, sortOrder: index, createdAt: now, updatedAt: now })),
			);
			await this.logOrder(tx, order.id, null, 'confirmed', actorUserId, now);
			return order;
		});
	}

	cancel(id: string, actorUserId: string, reason: string): Promise<TOrderSelect | null> {
		return this.database.transaction(async (tx) => {
			const now = new Date();
			const [order] = await tx
				.update(orders)
				.set({ status: 'cancelled', cancelledBy: actorUserId, cancelledAt: now, cancellationReason: reason, updatedAt: now })
				.where(and(this.live(id), eq(orders.status, 'confirmed')))
				.returning();
			if (!order) return null;
			await this.logOrder(tx, id, 'confirmed', 'cancelled', actorUserId, now, reason);
			// The deal is off: the SPH goes back to where it was before "Deal".
			const [quotation] = await tx
				.select({ sentAt: quotations.sentAt })
				.from(quotations)
				.where(eq(quotations.id, order.quotationId));
			await this.moveQuotation(
				tx,
				order.quotationId,
				['won'],
				quotation?.sentAt ? 'sent' : 'approved',
				{ closedBy: null, closedAt: null },
				actorUserId,
				now,
				`sales order ${order.code} cancelled`,
			);
			return order;
		});
	}

	async allocateDelivery(
		orderId: string,
		lines: TDeliveryAllocation[],
		options: { release?: boolean },
		tx: TTx,
	): Promise<TAllocationResult> {
		const [order] = await tx.select().from(orders).where(this.live(orderId)).for('update');
		if (!order) return { ok: false, reason: 'notDeliverable' };
		// Giving quantities back (a cancelled note) is allowed in any state.
		if (!options.release && order.status !== 'confirmed' && order.status !== 'in_progress') {
			return { ok: false, reason: 'notDeliverable' };
		}
		const items = await tx
			.select()
			.from(orderItems)
			.where(and(eq(orderItems.orderId, orderId), isNull(orderItems.deletedAt)))
			.for('update');
		const delivered = new Map(items.map((item) => [item.id, quantityToMilli(item.quantityDelivered)]));
		const sign = options.release ? -1n : 1n;
		for (const [index, line] of lines.entries()) {
			const item = items.find((row) => row.id === line.orderItemId);
			if (!item) return { ok: false, reason: 'notDeliverable', line: index + 1 };
			const total = delivered.get(item.id)! + sign * quantityToMilli(line.quantity);
			if (total > quantityToMilli(item.quantity)) return { ok: false, reason: 'overDelivered', line: index + 1 };
			delivered.set(item.id, total < 0n ? 0n : total);
		}
		const now = new Date();
		for (const item of items) {
			const total = delivered.get(item.id)!;
			if (total === quantityToMilli(item.quantityDelivered)) continue;
			await tx
				.update(orderItems)
				.set({
					quantityDelivered: (Number(total) / 1000).toFixed(3),
					fulfillmentStatus: total === 0n ? 'pending' : total >= quantityToMilli(item.quantity) ? 'fulfilled' : 'partial',
					updatedAt: now,
				})
				.where(eq(orderItems.id, item.id));
		}
		return { ok: true };
	}

	async reopenForReplacement(orderId: string, actorUserId: string, note: string, tx: TTx): Promise<void> {
		const [current] = await tx.select({ status: orders.status }).from(orders).where(this.live(orderId));
		if (!current || (current.status !== 'delivered' && current.status !== 'completed')) return;
		const now = new Date();
		await tx
			.update(orders)
			.set({ status: 'in_progress', updatedAt: now })
			.where(and(this.live(orderId), eq(orders.status, current.status)));
		await this.logOrder(tx, orderId, current.status, 'in_progress', actorUserId, now, note);
	}

	async markInProgress(orderId: string, actorUserId: string, note: string, tx: TTx): Promise<void> {
		const now = new Date();
		const [order] = await tx
			.update(orders)
			.set({ status: 'in_progress', updatedAt: now })
			.where(and(this.live(orderId), eq(orders.status, 'confirmed')))
			.returning({ id: orders.id });
		if (order) await this.logOrder(tx, orderId, 'confirmed', 'in_progress', actorUserId, now, note);
	}
}
