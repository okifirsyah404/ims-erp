import { DRIZZLE_TOKEN } from '@di/provider';
import type { TTx } from '@drizzle/types';
import {
	type PurchaseOrderStatus,
	purchaseOrderItems,
	purchaseOrders,
	purchaseRequestItems,
	purchaseRequests,
	type TPurchaseOrderItemSelect,
	type TPurchaseOrderSelect,
} from '@drizzle/schemas/procurement.schema';
import { likePattern } from '@drizzle/search';
import type { TPaginationResult } from '@ims-erp/common';
import { and, asc, count, desc, eq, gt, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type {
	IPurchaseOrderRepository,
	TPurchaseOrderHeaderData,
	TPurchaseOrderItemData,
	TPurchaseOrderTransitionPatch,
	TPurchaseOrderWrite,
} from '../contracts/procurement.repository.interface';
import { claimRequestLines, requestIdsOfOrder, syncRequestStatuses } from './request-ordering';
import type { TPurchaseOrderListQuery } from '../contracts/purchase-order.contract';
import type {
	IPurchaseOrderReceiving,
	TReceivedQuantity,
	TReceiveResult,
	TUnreceiveResult,
} from '../contracts/goods-receipt.repository.interface';
import { quantityToMilli } from '@utils/money.util';

/** Drizzle implementation of {@link IPurchaseOrderRepository}. */
@injectable()
export class PurchaseOrderRepository implements IPurchaseOrderRepository, IPurchaseOrderReceiving {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	private live(id: string) {
		return and(eq(purchaseOrders.id, id), isNull(purchaseOrders.deletedAt));
	}

	private async insertItems(tx: TTx, purchaseOrderId: string, items: TPurchaseOrderItemData[], now: Date) {
		await tx
			.insert(purchaseOrderItems)
			.values(items.map((item, index) => ({ ...item, purchaseOrderId, sortOrder: index, createdAt: now, updatedAt: now })));
	}

	async paginate(query: TPurchaseOrderListQuery): Promise<TPaginationResult<TPurchaseOrderSelect>> {
		const { page, limit, search, status, supplierCompanyId } = query;
		const where = and(
			isNull(purchaseOrders.deletedAt),
			status ? eq(purchaseOrders.status, status) : undefined,
			supplierCompanyId ? eq(purchaseOrders.supplierCompanyId, supplierCompanyId) : undefined,
			search
				? or(
						ilike(purchaseOrders.code, likePattern(search)),
						ilike(purchaseOrders.subject, likePattern(search)),
						ilike(purchaseOrders.supplierQuoteRef, likePattern(search)),
						ilike(sql`${purchaseOrders.supplierSnapshot}->>'name'`, likePattern(search)),
					)
				: undefined,
		);
		const [{ value: total }] = await this.database.select({ value: count() }).from(purchaseOrders).where(where);
		const data = await this.database
			.select()
			.from(purchaseOrders)
			.where(where)
			.orderBy(desc(purchaseOrders.createdAt), desc(purchaseOrders.id))
			.limit(limit)
			.offset((page - 1) * limit);
		return { meta: { page, limit, total, totalPages: Math.ceil(total / limit) }, data };
	}

	async findById(id: string): Promise<TPurchaseOrderSelect | null> {
		const [row] = await this.database.select().from(purchaseOrders).where(this.live(id)).limit(1);
		return row ?? null;
	}

	findItems(purchaseOrderId: string): Promise<TPurchaseOrderItemSelect[]> {
		return this.database
			.select()
			.from(purchaseOrderItems)
			.where(and(eq(purchaseOrderItems.purchaseOrderId, purchaseOrderId), isNull(purchaseOrderItems.deletedAt)))
			.orderBy(asc(purchaseOrderItems.sortOrder));
	}

	async findItemRequests(
		purchaseOrderId: string,
	): Promise<{ purchaseOrderItemId: string; purchaseRequestId: string; purchaseRequestCode: string | null }[]> {
		return this.database
			.select({
				purchaseOrderItemId: purchaseOrderItems.id,
				purchaseRequestId: purchaseRequests.id,
				purchaseRequestCode: purchaseRequests.code,
			})
			.from(purchaseOrderItems)
			.innerJoin(purchaseRequestItems, eq(purchaseRequestItems.id, purchaseOrderItems.purchaseRequestItemId))
			.innerJoin(purchaseRequests, eq(purchaseRequests.id, purchaseRequestItems.purchaseRequestId))
			.where(and(eq(purchaseOrderItems.purchaseOrderId, purchaseOrderId), isNull(purchaseOrderItems.deletedAt)));
	}

	create(header: TPurchaseOrderHeaderData & { createdBy: string }, items: TPurchaseOrderItemData[]): Promise<TPurchaseOrderWrite> {
		return this.database.transaction(async (tx) => {
			const claim = await claimRequestLines(tx, null, items.map((item) => item.purchaseRequestItemId));
			if (!claim.ok) return { ok: false, reason: 'requestLine', line: claim.line };
			const now = new Date();
			const [row] = await tx
				.insert(purchaseOrders)
				.values({ ...header, status: 'draft', createdAt: now, updatedAt: now })
				.returning();
			await this.insertItems(tx, row.id, items, now);
			await syncRequestStatuses(tx, claim.requestIds);
			return { ok: true, order: row };
		});
	}

	replaceDraft(id: string, header: TPurchaseOrderHeaderData, items: TPurchaseOrderItemData[]): Promise<TPurchaseOrderWrite> {
		return this.database.transaction(async (tx) => {
			const claim = await claimRequestLines(tx, id, items.map((item) => item.purchaseRequestItemId));
			if (!claim.ok) return { ok: false, reason: 'requestLine', line: claim.line };
			const now = new Date();
			const [row] = await tx
				.update(purchaseOrders)
				.set({ ...header, updatedAt: now })
				.where(and(this.live(id), eq(purchaseOrders.status, 'draft')))
				.returning();
			if (!row) return { ok: false, reason: 'notDraft' };
			// Requests the old lines ordered may fall back to `approved`.
			const before = await requestIdsOfOrder(tx, id);
			// Draft lines are replaced as a whole; nothing references them yet.
			await tx.delete(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, id));
			await this.insertItems(tx, id, items, now);
			await syncRequestStatuses(tx, [...new Set([...before, ...claim.requestIds])]);
			return { ok: true, order: row };
		});
	}

	syncRequestsOfOrder(id: string): Promise<void> {
		return this.database.transaction(async (tx) => syncRequestStatuses(tx, await requestIdsOfOrder(tx, id)));
	}

	async transition(
		id: string,
		from: readonly PurchaseOrderStatus[],
		to: PurchaseOrderStatus,
		patch: TPurchaseOrderTransitionPatch,
	): Promise<TPurchaseOrderSelect | null> {
		const [row] = await this.database
			.update(purchaseOrders)
			.set({ ...patch, status: to, updatedAt: new Date() })
			.where(and(this.live(id), inArray(purchaseOrders.status, [...from])))
			.returning();
		return row ?? null;
	}

	async receive(purchaseOrderId: string, lines: TReceivedQuantity[], tx: TTx): Promise<TReceiveResult> {
		const [order] = await tx
			.select()
			.from(purchaseOrders)
			.where(this.live(purchaseOrderId))
			.for('update');
		if (!order || (order.status !== 'sent' && order.status !== 'partially_received')) {
			return { ok: false, reason: 'notReceivable' };
		}
		const items = await tx
			.select()
			.from(purchaseOrderItems)
			.where(and(eq(purchaseOrderItems.purchaseOrderId, purchaseOrderId), isNull(purchaseOrderItems.deletedAt)))
			.for('update');
		const now = new Date();
		const received = new Map(items.map((item) => [item.id, quantityToMilli(item.quantityReceived)]));
		for (const [index, line] of lines.entries()) {
			const item = items.find((row) => row.id === line.purchaseOrderItemId);
			if (!item) return { ok: false, reason: 'notReceivable', line: index + 1 };
			const total = received.get(item.id)! + quantityToMilli(line.quantity);
			if (total > quantityToMilli(item.quantity)) return { ok: false, reason: 'overReceived', line: index + 1 };
			received.set(item.id, total);
		}
		for (const item of items) {
			const total = received.get(item.id)!;
			if (total === quantityToMilli(item.quantityReceived)) continue;
			await tx
				.update(purchaseOrderItems)
				.set({ quantityReceived: (Number(total) / 1000).toFixed(3), updatedAt: now })
				.where(eq(purchaseOrderItems.id, item.id));
		}
		const complete = items.every((item) => received.get(item.id)! >= quantityToMilli(item.quantity));
		const [updated] = await tx
			.update(purchaseOrders)
			.set({ status: complete ? 'received' : 'partially_received', updatedAt: now })
			.where(eq(purchaseOrders.id, purchaseOrderId))
			.returning();
		return { ok: true, order: updated };
	}

	async unreceive(purchaseOrderId: string, lines: TReceivedQuantity[], tx: TTx): Promise<TUnreceiveResult> {
		const [order] = await tx
			.select()
			.from(purchaseOrders)
			.where(this.live(purchaseOrderId))
			.for('update');
		if (!order || (order.status !== 'partially_received' && order.status !== 'received')) {
			return { ok: false, reason: 'notReturnable' };
		}
		const items = await tx
			.select()
			.from(purchaseOrderItems)
			.where(and(eq(purchaseOrderItems.purchaseOrderId, purchaseOrderId), isNull(purchaseOrderItems.deletedAt)))
			.for('update');
		const now = new Date();
		const received = new Map(items.map((item) => [item.id, quantityToMilli(item.quantityReceived)]));
		for (const [index, line] of lines.entries()) {
			const current = received.get(line.purchaseOrderItemId);
			if (current === undefined) return { ok: false, reason: 'notReturnable', line: index + 1 };
			const total = current - quantityToMilli(line.quantity);
			if (total < 0n) return { ok: false, reason: 'overReturned', line: index + 1 };
			received.set(line.purchaseOrderItemId, total);
		}
		for (const item of items) {
			const total = received.get(item.id)!;
			if (total === quantityToMilli(item.quantityReceived)) continue;
			await tx
				.update(purchaseOrderItems)
				.set({ quantityReceived: (Number(total) / 1000).toFixed(3), updatedAt: now })
				.where(eq(purchaseOrderItems.id, item.id));
		}
		const anyReceived = items.some((item) => received.get(item.id)! > 0n);
		const [updated] = await tx
			.update(purchaseOrders)
			.set({ status: anyReceived ? 'partially_received' : 'sent', updatedAt: now })
			.where(eq(purchaseOrders.id, purchaseOrderId))
			.returning();
		return { ok: true, order: updated };
	}

	async hasReceipts(id: string): Promise<boolean> {
		const [row] = await this.database
			.select({ id: purchaseOrderItems.id })
			.from(purchaseOrderItems)
			.where(and(eq(purchaseOrderItems.purchaseOrderId, id), gt(purchaseOrderItems.quantityReceived, '0')))
			.limit(1);
		return !!row;
	}
}
