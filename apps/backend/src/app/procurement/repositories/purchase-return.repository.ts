import { DRIZZLE_TOKEN } from '@di/provider';
import type { TTx } from '@drizzle/types';
import {
	goodsReceipts,
	purchaseOrders,
	purchaseReturnItems,
	purchaseReturns,
	type PurchaseReturnStatus,
	type TPurchaseReturnItemSelect,
	type TPurchaseReturnSelect,
} from '@drizzle/schemas/procurement.schema';
import { likePattern } from '@drizzle/search';
import type { TPaginationResult } from '@ims-erp/common';
import { paginationResult } from '@utils/pagination.util';
import { quantityToMilli } from '@utils/money.util';
import { and, asc, count, desc, eq, getTableColumns, ilike, inArray, isNull, ne, or, sql } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type { TPurchaseReturnListQuery } from '../contracts/purchase-return.contract';
import type {
	IPurchaseReturnRepository,
	TPurchaseReturnHeaderData,
	TPurchaseReturnItemData,
	TPurchaseReturnRow,
	TPurchaseReturnTransitionPatch,
	TReturnedOnLine,
} from '../contracts/purchase-return.repository.interface';

/** Drizzle implementation of {@link IPurchaseReturnRepository}. */
@injectable()
export class PurchaseReturnRepository implements IPurchaseReturnRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	private live(id: string) {
		return and(eq(purchaseReturns.id, id), isNull(purchaseReturns.deletedAt));
	}

	private select() {
		return this.database
			.select({
				...getTableColumns(purchaseReturns),
				goodsReceiptCode: goodsReceipts.code,
				purchaseOrderCode: purchaseOrders.code,
				supplierName: sql<string>`${purchaseOrders.supplierSnapshot}->>'name'`,
			})
			.from(purchaseReturns)
			.innerJoin(goodsReceipts, eq(goodsReceipts.id, purchaseReturns.goodsReceiptId))
			.innerJoin(purchaseOrders, eq(purchaseOrders.id, purchaseReturns.purchaseOrderId));
	}

	private async insertItems(tx: TTx, purchaseReturnId: string, items: TPurchaseReturnItemData[], now: Date) {
		await tx
			.insert(purchaseReturnItems)
			.values(items.map((item, index) => ({ ...item, purchaseReturnId, sortOrder: index, createdAt: now, updatedAt: now })));
	}

	async paginate(query: TPurchaseReturnListQuery): Promise<TPaginationResult<TPurchaseReturnRow>> {
		const { page, limit, search, status, goodsReceiptId } = query;
		const where = and(
			isNull(purchaseReturns.deletedAt),
			status ? eq(purchaseReturns.status, status) : undefined,
			goodsReceiptId ? eq(purchaseReturns.goodsReceiptId, goodsReceiptId) : undefined,
			search
				? or(
						ilike(purchaseReturns.code, likePattern(search)),
						ilike(purchaseReturns.reason, likePattern(search)),
						ilike(goodsReceipts.code, likePattern(search)),
						ilike(purchaseOrders.code, likePattern(search)),
						ilike(sql`${purchaseOrders.supplierSnapshot}->>'name'`, likePattern(search)),
					)
				: undefined,
		);
		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(purchaseReturns)
			.innerJoin(goodsReceipts, eq(goodsReceipts.id, purchaseReturns.goodsReceiptId))
			.innerJoin(purchaseOrders, eq(purchaseOrders.id, purchaseReturns.purchaseOrderId))
			.where(where);
		const data = await this.select()
			.where(where)
			.orderBy(desc(purchaseReturns.createdAt), desc(purchaseReturns.id))
			.limit(limit)
			.offset((page - 1) * limit);
		return paginationResult({ page, limit }, total, data);
	}

	async findById(id: string): Promise<TPurchaseReturnRow | null> {
		const [row] = await this.select().where(this.live(id)).limit(1);
		return row ?? null;
	}

	findItems(purchaseReturnId: string): Promise<TPurchaseReturnItemSelect[]> {
		return this.database
			.select()
			.from(purchaseReturnItems)
			.where(and(eq(purchaseReturnItems.purchaseReturnId, purchaseReturnId), isNull(purchaseReturnItems.deletedAt)))
			.orderBy(asc(purchaseReturnItems.sortOrder));
	}

	create(header: TPurchaseReturnHeaderData & { createdBy: string }, items: TPurchaseReturnItemData[]): Promise<TPurchaseReturnSelect> {
		return this.database.transaction(async (tx) => {
			const now = new Date();
			const [row] = await tx
				.insert(purchaseReturns)
				.values({ ...header, status: 'draft', createdAt: now, updatedAt: now })
				.returning();
			await this.insertItems(tx, row.id, items, now);
			return row;
		});
	}

	replaceDraft(id: string, header: TPurchaseReturnHeaderData, items: TPurchaseReturnItemData[]): Promise<TPurchaseReturnSelect | null> {
		return this.database.transaction(async (tx) => {
			const now = new Date();
			const [row] = await tx
				.update(purchaseReturns)
				.set({ ...header, updatedAt: now })
				.where(and(this.live(id), eq(purchaseReturns.status, 'draft')))
				.returning();
			if (!row) return null;
			// Draft lines are replaced as a whole; nothing references them yet.
			await tx.delete(purchaseReturnItems).where(eq(purchaseReturnItems.purchaseReturnId, id));
			await this.insertItems(tx, id, items, now);
			return row;
		});
	}

	async transition(
		id: string,
		from: readonly PurchaseReturnStatus[],
		to: PurchaseReturnStatus,
		patch: TPurchaseReturnTransitionPatch,
		tx?: TTx,
	): Promise<TPurchaseReturnSelect | null> {
		const [row] = await (tx ?? this.database)
			.update(purchaseReturns)
			.set({ ...patch, status: to, updatedAt: new Date() })
			.where(and(this.live(id), inArray(purchaseReturns.status, [...from])))
			.returning();
		return row ?? null;
	}

	async returnedOnLines(
		goodsReceiptItemIds: string[],
		statuses: readonly PurchaseReturnStatus[],
		excludeReturnId?: string,
		tx?: TTx,
	): Promise<Map<string, TReturnedOnLine>> {
		const result = new Map<string, TReturnedOnLine>();
		if (goodsReceiptItemIds.length === 0) return result;
		const rows = await (tx ?? this.database)
			.select({
				goodsReceiptItemId: purchaseReturnItems.goodsReceiptItemId,
				quantity: purchaseReturnItems.quantity,
				serialNumbers: purchaseReturnItems.serialNumbers,
			})
			.from(purchaseReturnItems)
			.innerJoin(purchaseReturns, eq(purchaseReturns.id, purchaseReturnItems.purchaseReturnId))
			.where(
				and(
					inArray(purchaseReturnItems.goodsReceiptItemId, goodsReceiptItemIds),
					inArray(purchaseReturns.status, [...statuses]),
					isNull(purchaseReturns.deletedAt),
					isNull(purchaseReturnItems.deletedAt),
					excludeReturnId ? ne(purchaseReturns.id, excludeReturnId) : undefined,
				),
			);
		for (const row of rows) {
			const current = result.get(row.goodsReceiptItemId) ?? { quantityMilli: 0n, serialNumbers: [] };
			current.quantityMilli += quantityToMilli(row.quantity);
			current.serialNumbers.push(...(row.serialNumbers ?? []));
			result.set(row.goodsReceiptItemId, current);
		}
		return result;
	}

	async claimForShip(id: string, tx: TTx): Promise<TPurchaseReturnSelect | null> {
		const [row] = await tx
			.select()
			.from(purchaseReturns)
			.where(and(this.live(id), eq(purchaseReturns.status, 'approved')))
			.for('update');
		if (!row) return null;
		await tx.select({ id: goodsReceipts.id }).from(goodsReceipts).where(eq(goodsReceipts.id, row.goodsReceiptId)).for('update');
		return row;
	}

	async setMovement(purchaseReturnItemId: string, movementId: string, tx: TTx): Promise<void> {
		await tx.update(purchaseReturnItems).set({ movementId }).where(eq(purchaseReturnItems.id, purchaseReturnItemId));
	}
}
