import { DRIZZLE_TOKEN } from '@di/provider';
import type { TTx } from '@drizzle/types';
import {
	deliveryNotes,
	salesOrders,
	salesReturnItems,
	salesReturns,
	type SalesReturnCondition,
	type SalesReturnStatus,
	type TSalesReturnItemSelect,
	type TSalesReturnSelect,
} from '@drizzle/schemas/sales.schema';
import { likePattern } from '@drizzle/search';
import type { TPaginationResult } from '@ims-erp/common';
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
		return and(eq(salesReturns.id, id), isNull(salesReturns.deletedAt));
	}

	private select() {
		return this.database
			.select({
				...getTableColumns(salesReturns),
				deliveryNoteCode: deliveryNotes.code,
				salesOrderCode: salesOrders.code,
				customerName: sql<string>`${salesOrders.customerSnapshot}->>'name'`,
			})
			.from(salesReturns)
			.innerJoin(deliveryNotes, eq(deliveryNotes.id, salesReturns.deliveryNoteId))
			.innerJoin(salesOrders, eq(salesOrders.id, salesReturns.salesOrderId));
	}

	private async insertItems(tx: TTx, salesReturnId: string, items: TSalesReturnItemData[], now: Date) {
		await tx
			.insert(salesReturnItems)
			.values(items.map((item, index) => ({ ...item, salesReturnId, sortOrder: index, createdAt: now, updatedAt: now })));
	}

	async paginate(query: TSalesReturnListQuery): Promise<TPaginationResult<TSalesReturnRow>> {
		const { page, limit, search, status, deliveryNoteId } = query;
		const where = and(
			isNull(salesReturns.deletedAt),
			status ? eq(salesReturns.status, status) : undefined,
			deliveryNoteId ? eq(salesReturns.deliveryNoteId, deliveryNoteId) : undefined,
			search
				? or(
						ilike(salesReturns.code, likePattern(search)),
						ilike(salesReturns.reason, likePattern(search)),
						ilike(deliveryNotes.code, likePattern(search)),
						ilike(salesOrders.code, likePattern(search)),
						ilike(sql`${salesOrders.customerSnapshot}->>'name'`, likePattern(search)),
					)
				: undefined,
		);
		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(salesReturns)
			.innerJoin(deliveryNotes, eq(deliveryNotes.id, salesReturns.deliveryNoteId))
			.innerJoin(salesOrders, eq(salesOrders.id, salesReturns.salesOrderId))
			.where(where);
		const data = await this.select()
			.where(where)
			.orderBy(desc(salesReturns.createdAt), desc(salesReturns.id))
			.limit(limit)
			.offset((page - 1) * limit);
		return { meta: { page, limit, total, totalPages: Math.ceil(total / limit) }, data };
	}

	async findById(id: string): Promise<TSalesReturnRow | null> {
		const [row] = await this.select().where(this.live(id)).limit(1);
		return row ?? null;
	}

	findItems(salesReturnId: string): Promise<TSalesReturnItemSelect[]> {
		return this.database
			.select()
			.from(salesReturnItems)
			.where(and(eq(salesReturnItems.salesReturnId, salesReturnId), isNull(salesReturnItems.deletedAt)))
			.orderBy(asc(salesReturnItems.sortOrder));
	}

	create(header: TSalesReturnHeaderData & { createdBy: string }, items: TSalesReturnItemData[]): Promise<TSalesReturnSelect> {
		return this.database.transaction(async (tx) => {
			const now = new Date();
			const [row] = await tx
				.insert(salesReturns)
				.values({ ...header, status: 'draft', createdAt: now, updatedAt: now })
				.returning();
			await this.insertItems(tx, row.id, items, now);
			return row;
		});
	}

	replaceDraft(id: string, header: TSalesReturnHeaderData, items: TSalesReturnItemData[]): Promise<TSalesReturnSelect | null> {
		return this.database.transaction(async (tx) => {
			const now = new Date();
			const [row] = await tx
				.update(salesReturns)
				.set({ ...header, updatedAt: now })
				.where(and(this.live(id), eq(salesReturns.status, 'draft')))
				.returning();
			if (!row) return null;
			// Draft lines are replaced as a whole; nothing references them yet.
			await tx.delete(salesReturnItems).where(eq(salesReturnItems.salesReturnId, id));
			await this.insertItems(tx, id, items, now);
			return row;
		});
	}

	async transition(
		id: string,
		from: readonly SalesReturnStatus[],
		to: SalesReturnStatus,
		patch: TSalesReturnTransitionPatch,
		tx?: TTx,
	): Promise<TSalesReturnSelect | null> {
		const [row] = await (tx ?? this.database)
			.update(salesReturns)
			.set({ ...patch, status: to, updatedAt: new Date() })
			.where(and(this.live(id), inArray(salesReturns.status, [...from])))
			.returning();
		return row ?? null;
	}

	async returnedOnLines(
		deliveryNoteItemIds: string[],
		statuses: readonly SalesReturnStatus[],
		excludeReturnId?: string,
		tx?: TTx,
	): Promise<Map<string, TReturnedOnDeliveryLine>> {
		const result = new Map<string, TReturnedOnDeliveryLine>();
		if (deliveryNoteItemIds.length === 0) return result;
		const rows = await (tx ?? this.database)
			.select({
				deliveryNoteItemId: salesReturnItems.deliveryNoteItemId,
				quantity: salesReturnItems.quantity,
				serialNumbers: salesReturnItems.serialNumbers,
			})
			.from(salesReturnItems)
			.innerJoin(salesReturns, eq(salesReturns.id, salesReturnItems.salesReturnId))
			.where(
				and(
					inArray(salesReturnItems.deliveryNoteItemId, deliveryNoteItemIds),
					inArray(salesReturns.status, [...statuses]),
					isNull(salesReturns.deletedAt),
					isNull(salesReturnItems.deletedAt),
					excludeReturnId ? ne(salesReturns.id, excludeReturnId) : undefined,
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

	async claimForReceive(id: string, tx: TTx): Promise<TSalesReturnSelect | null> {
		const [row] = await tx
			.select()
			.from(salesReturns)
			.where(and(this.live(id), eq(salesReturns.status, 'approved')))
			.for('update');
		if (!row) return null;
		await tx.select({ id: deliveryNotes.id }).from(deliveryNotes).where(eq(deliveryNotes.id, row.deliveryNoteId)).for('update');
		return row;
	}

	async setReceived(
		salesReturnItemId: string,
		data: { condition: SalesReturnCondition; binId: string | null; stockMovementId: string | null },
		tx: TTx,
	): Promise<void> {
		await tx.update(salesReturnItems).set(data).where(eq(salesReturnItems.id, salesReturnItemId));
	}
}
