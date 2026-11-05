import { DRIZZLE_TOKEN } from '@di/provider';
import type { TTx } from '@drizzle/types';
import {
	type PurchaseOrderStatus,
	purchaseOrderItems,
	purchaseOrders,
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
} from '../contracts/procurement.repository.interface';
import type { TPurchaseOrderListQuery } from '../contracts/purchase-order.contract';

/** Drizzle implementation of {@link IPurchaseOrderRepository}. */
@injectable()
export class PurchaseOrderRepository implements IPurchaseOrderRepository {
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
		const { page, limit, search, status, supplierId } = query;
		const where = and(
			isNull(purchaseOrders.deletedAt),
			status ? eq(purchaseOrders.status, status) : undefined,
			supplierId ? eq(purchaseOrders.supplierId, supplierId) : undefined,
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

	create(header: TPurchaseOrderHeaderData & { createdBy: string }, items: TPurchaseOrderItemData[]): Promise<TPurchaseOrderSelect> {
		return this.database.transaction(async (tx) => {
			const now = new Date();
			const [row] = await tx
				.insert(purchaseOrders)
				.values({ ...header, status: 'draft', createdAt: now, updatedAt: now })
				.returning();
			await this.insertItems(tx, row.id, items, now);
			return row;
		});
	}

	replaceDraft(id: string, header: TPurchaseOrderHeaderData, items: TPurchaseOrderItemData[]): Promise<TPurchaseOrderSelect | null> {
		return this.database.transaction(async (tx) => {
			const now = new Date();
			const [row] = await tx
				.update(purchaseOrders)
				.set({ ...header, updatedAt: now })
				.where(and(this.live(id), eq(purchaseOrders.status, 'draft')))
				.returning();
			if (!row) return null;
			// Draft lines are replaced as a whole; nothing references them yet.
			await tx.delete(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, id));
			await this.insertItems(tx, id, items, now);
			return row;
		});
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

	async hasReceipts(id: string): Promise<boolean> {
		const [row] = await this.database
			.select({ id: purchaseOrderItems.id })
			.from(purchaseOrderItems)
			.where(and(eq(purchaseOrderItems.purchaseOrderId, id), gt(purchaseOrderItems.quantityReceived, '0')))
			.limit(1);
		return !!row;
	}
}
