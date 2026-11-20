import { DRIZZLE_TOKEN } from '@di/provider';
import type { TTx } from '@drizzle/types';
import {
	deliveryNotes,
	orders,
	returnItems,
	returns,
	type ReturnCondition,
	type ReturnStatus,
	type TReturnItemSelect,
	type TReturnSelect,
} from '@drizzle/schemas/sale.schema';
import { likePattern } from '@drizzle/search';
import type { TPaginationResult } from '@ims-erp/common';
import { paginationResult } from '@utils/pagination.util';
import { quantityToMilli } from '@utils/money.util';
import { and, asc, count, desc, eq, getTableColumns, ilike, inArray, isNull, ne, or, sql } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type { TSalesReturnListQuery } from '../contracts/sales-return.contract';
import type {
	ISalesReturnRepository,
	TReturnedOnDeliveryLine,
	TSalesReturnHeaderData,
	TSalesReturnItemData,
	TSalesReturnRow,
	TSalesReturnTransitionPatch,
} from '../contracts/sales-return.repository.interface';

/** Drizzle implementation of {@link ISalesReturnRepository}. */
@injectable()
export class SalesReturnRepository implements ISalesReturnRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	private live(id: string) {
		return and(eq(returns.id, id), isNull(returns.deletedAt));
	}

	private select() {
		return this.database
			.select({
				...getTableColumns(returns),
				deliveryNoteCode: deliveryNotes.code,
				orderCode: orders.code,
				customerName: sql<string>`${orders.customerSnapshot}->>'name'`,
			})
			.from(returns)
			.innerJoin(deliveryNotes, eq(deliveryNotes.id, returns.deliveryNoteId))
			.innerJoin(orders, eq(orders.id, returns.orderId));
	}

	private async insertItems(tx: TTx, returnId: string, items: TSalesReturnItemData[], now: Date) {
		await tx
			.insert(returnItems)
			.values(items.map((item, index) => ({ ...item, returnId, sortOrder: index, createdAt: now, updatedAt: now })));
	}

	async paginate(query: TSalesReturnListQuery): Promise<TPaginationResult<TSalesReturnRow>> {
		const { page, limit, search, status, deliveryNoteId } = query;
		const where = and(
			isNull(returns.deletedAt),
			status ? eq(returns.status, status) : undefined,
			deliveryNoteId ? eq(returns.deliveryNoteId, deliveryNoteId) : undefined,
			search
				? or(
						ilike(returns.code, likePattern(search)),
						ilike(returns.reason, likePattern(search)),
						ilike(deliveryNotes.code, likePattern(search)),
						ilike(orders.code, likePattern(search)),
						ilike(sql`${orders.customerSnapshot}->>'name'`, likePattern(search)),
					)
				: undefined,
		);
		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(returns)
			.innerJoin(deliveryNotes, eq(deliveryNotes.id, returns.deliveryNoteId))
			.innerJoin(orders, eq(orders.id, returns.orderId))
			.where(where);
		const data = await this.select()
			.where(where)
			.orderBy(desc(returns.createdAt), desc(returns.id))
			.limit(limit)
			.offset((page - 1) * limit);
		return paginationResult({ page, limit }, total, data);
	}

	async findById(id: string): Promise<TSalesReturnRow | null> {
		const [row] = await this.select().where(this.live(id)).limit(1);
		return row ?? null;
	}

	findItems(returnId: string): Promise<TReturnItemSelect[]> {
		return this.database
			.select()
			.from(returnItems)
			.where(and(eq(returnItems.returnId, returnId), isNull(returnItems.deletedAt)))
			.orderBy(asc(returnItems.sortOrder));
	}

	create(header: TSalesReturnHeaderData & { createdBy: string }, items: TSalesReturnItemData[]): Promise<TReturnSelect> {
		return this.database.transaction(async (tx) => {
			const now = new Date();
			const [row] = await tx
				.insert(returns)
				.values({ ...header, status: 'draft', createdAt: now, updatedAt: now })
				.returning();
			await this.insertItems(tx, row.id, items, now);
			return row;
		});
	}

	replaceDraft(id: string, header: TSalesReturnHeaderData, items: TSalesReturnItemData[]): Promise<TReturnSelect | null> {
		return this.database.transaction(async (tx) => {
			const now = new Date();
			const [row] = await tx
				.update(returns)
				.set({ ...header, updatedAt: now })
				.where(and(this.live(id), eq(returns.status, 'draft')))
				.returning();
			if (!row) return null;
			// Draft lines are replaced as a whole; nothing references them yet.
			await tx.delete(returnItems).where(eq(returnItems.returnId, id));
			await this.insertItems(tx, id, items, now);
			return row;
		});
	}

	async transition(
		id: string,
		from: readonly ReturnStatus[],
		to: ReturnStatus,
		patch: TSalesReturnTransitionPatch,
		tx?: TTx,
	): Promise<TReturnSelect | null> {
		const [row] = await (tx ?? this.database)
			.update(returns)
			.set({ ...patch, status: to, updatedAt: new Date() })
			.where(and(this.live(id), inArray(returns.status, [...from])))
			.returning();
		return row ?? null;
	}

	async returnedOnLines(
		deliveryNoteItemIds: string[],
		statuses: readonly ReturnStatus[],
		excludeReturnId?: string,
		tx?: TTx,
	): Promise<Map<string, TReturnedOnDeliveryLine>> {
		const result = new Map<string, TReturnedOnDeliveryLine>();
		if (deliveryNoteItemIds.length === 0) return result;
		const rows = await (tx ?? this.database)
			.select({
				deliveryNoteItemId: returnItems.deliveryNoteItemId,
				quantity: returnItems.quantity,
				serialNumbers: returnItems.serialNumbers,
			})
			.from(returnItems)
			.innerJoin(returns, eq(returns.id, returnItems.returnId))
			.where(
				and(
					inArray(returnItems.deliveryNoteItemId, deliveryNoteItemIds),
					inArray(returns.status, [...statuses]),
					isNull(returns.deletedAt),
					isNull(returnItems.deletedAt),
					excludeReturnId ? ne(returns.id, excludeReturnId) : undefined,
				),
			);
		for (const row of rows) {
			const current = result.get(row.deliveryNoteItemId) ?? { quantityMilli: 0n, serialNumbers: [] };
			current.quantityMilli += quantityToMilli(row.quantity);
			current.serialNumbers.push(...(row.serialNumbers ?? []));
			result.set(row.deliveryNoteItemId, current);
		}
		return result;
	}

	async claimForReceive(id: string, tx: TTx): Promise<TReturnSelect | null> {
		const [row] = await tx
			.select()
			.from(returns)
			.where(and(this.live(id), eq(returns.status, 'approved')))
			.for('update');
		if (!row) return null;
		await tx.select({ id: deliveryNotes.id }).from(deliveryNotes).where(eq(deliveryNotes.id, row.deliveryNoteId)).for('update');
		return row;
	}

	async setReceived(
		salesReturnItemId: string,
		data: { condition: ReturnCondition; binId: string | null; movementId: string | null },
		tx: TTx,
	): Promise<void> {
		await tx.update(returnItems).set(data).where(eq(returnItems.id, salesReturnItemId));
	}
}
