import { DRIZZLE_TOKEN } from '@di/provider';
import type { TTx } from '@drizzle/types';
import {
	goodsReceiptItems,
	goodsReceipts,
	purchaseOrders,
	type TGoodsReceiptItemSelect,
} from '@drizzle/schemas/procurement.schema';
import { likePattern } from '@drizzle/search';
import type { TPaginationResult } from '@ims-erp/common';
import { and, asc, count, desc, eq, getTableColumns, ilike, isNull, or, sql } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type { TGoodsReceiptListQuery } from '../contracts/goods-receipt.contract';
import type {
	IGoodsReceiptRepository,
	TGoodsReceiptHeaderData,
	TGoodsReceiptItemData,
	TGoodsReceiptRow,
} from '../contracts/goods-receipt.repository.interface';

/** Drizzle implementation of {@link IGoodsReceiptRepository}. */
@injectable()
export class GoodsReceiptRepository implements IGoodsReceiptRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	private select() {
		return this.database
			.select({
				...getTableColumns(goodsReceipts),
				purchaseOrderCode: purchaseOrders.code,
				supplierName: sql<string>`${purchaseOrders.supplierSnapshot}->>'name'`,
			})
			.from(goodsReceipts)
			.innerJoin(purchaseOrders, eq(purchaseOrders.id, goodsReceipts.purchaseOrderId));
	}

	async paginate(query: TGoodsReceiptListQuery): Promise<TPaginationResult<TGoodsReceiptRow>> {
		const { page, limit, search, purchaseOrderId } = query;
		const where = and(
			isNull(goodsReceipts.deletedAt),
			purchaseOrderId ? eq(goodsReceipts.purchaseOrderId, purchaseOrderId) : undefined,
			search
				? or(
						ilike(goodsReceipts.code, likePattern(search)),
						ilike(goodsReceipts.supplierDeliveryRef, likePattern(search)),
						ilike(purchaseOrders.code, likePattern(search)),
						ilike(sql`${purchaseOrders.supplierSnapshot}->>'name'`, likePattern(search)),
					)
				: undefined,
		);
		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(goodsReceipts)
			.innerJoin(purchaseOrders, eq(purchaseOrders.id, goodsReceipts.purchaseOrderId))
			.where(where);
		const data = await this.select()
			.where(where)
			.orderBy(desc(goodsReceipts.createdAt), desc(goodsReceipts.id))
			.limit(limit)
			.offset((page - 1) * limit);
		return { meta: { page, limit, total, totalPages: Math.ceil(total / limit) }, data };
	}

	async findById(id: string): Promise<TGoodsReceiptRow | null> {
		const [row] = await this.select()
			.where(and(eq(goodsReceipts.id, id), isNull(goodsReceipts.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	findItems(goodsReceiptId: string): Promise<TGoodsReceiptItemSelect[]> {
		return this.database
			.select()
			.from(goodsReceiptItems)
			.where(and(eq(goodsReceiptItems.goodsReceiptId, goodsReceiptId), isNull(goodsReceiptItems.deletedAt)))
			.orderBy(asc(goodsReceiptItems.createdAt), asc(goodsReceiptItems.id));
	}

	async create(header: TGoodsReceiptHeaderData, items: TGoodsReceiptItemData[], tx: TTx) {
		const now = new Date();
		const [receipt] = await tx
			.insert(goodsReceipts)
			.values({ ...header, status: 'posted', createdAt: now, updatedAt: now })
			.returning();
		const rows = await tx
			.insert(goodsReceiptItems)
			.values(items.map((item) => ({ ...item, goodsReceiptId: receipt.id, createdAt: now, updatedAt: now })))
			.returning();
		return { receipt, items: rows };
	}

	async setMovement(goodsReceiptItemId: string, movementId: string, tx: TTx): Promise<void> {
		await tx.update(goodsReceiptItems).set({ movementId }).where(eq(goodsReceiptItems.id, goodsReceiptItemId));
	}
}
