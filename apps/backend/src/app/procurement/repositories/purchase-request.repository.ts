import { DRIZZLE_TOKEN } from '@di/provider';
import type { TTx } from '@drizzle/types';
import {
	type PurchaseRequestStatus,
	purchaseOrderItems,
	purchaseOrders,
	purchaseRequestItems,
	purchaseRequests,
	type TPurchaseRequestSelect,
} from '@drizzle/schemas/procurement.schema';
import { likePattern } from '@drizzle/search';
import type { TPaginationResult } from '@ims-erp/common';
import { paginationResult } from '@utils/pagination.util';
import { and, asc, count, desc, eq, ilike, inArray, isNull, ne, not, or } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type {
	IPurchaseRequestRepository,
	TOpenRequestLine,
	TPurchaseRequestHeaderData,
	TPurchaseRequestItemData,
	TPurchaseRequestLineView,
	TPurchaseRequestTransitionPatch,
} from '../contracts/procurement.repository.interface';
import type { TOpenLinesQuery, TPurchaseRequestListQuery } from '../contracts/purchase-request.contract';
import { liveOrderLineExists } from './request-ordering';

/** Drizzle implementation of {@link IPurchaseRequestRepository}. */
@injectable()
export class PurchaseRequestRepository implements IPurchaseRequestRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	private live(id: string) {
		return and(eq(purchaseRequests.id, id), isNull(purchaseRequests.deletedAt));
	}

	private async insertItems(tx: TTx, purchaseRequestId: string, items: TPurchaseRequestItemData[], now: Date) {
		await tx
			.insert(purchaseRequestItems)
			.values(items.map((item, index) => ({ ...item, purchaseRequestId, sortOrder: index, createdAt: now, updatedAt: now })));
	}

	async paginate(query: TPurchaseRequestListQuery, actorUserId: string): Promise<TPaginationResult<TPurchaseRequestSelect>> {
		const { page, limit, search, status, mine } = query;
		const where = and(
			isNull(purchaseRequests.deletedAt),
			status ? eq(purchaseRequests.status, status) : undefined,
			mine ? eq(purchaseRequests.requestedBy, actorUserId) : undefined,
			search
				? or(
						ilike(purchaseRequests.code, likePattern(search)),
						ilike(purchaseRequests.subject, likePattern(search)),
						ilike(purchaseRequests.projectName, likePattern(search)),
						ilike(purchaseRequests.requestedByName, likePattern(search)),
					)
				: undefined,
		);
		const [{ value: total }] = await this.database.select({ value: count() }).from(purchaseRequests).where(where);
		const data = await this.database
			.select()
			.from(purchaseRequests)
			.where(where)
			.orderBy(desc(purchaseRequests.createdAt), desc(purchaseRequests.id))
			.limit(limit)
			.offset((page - 1) * limit);
		return paginationResult({ page, limit }, total, data);
	}

	async findById(id: string): Promise<TPurchaseRequestSelect | null> {
		const [row] = await this.database.select().from(purchaseRequests).where(this.live(id)).limit(1);
		return row ?? null;
	}

	async findLines(purchaseRequestId: string): Promise<TPurchaseRequestLineView[]> {
		const lines = await this.database
			.select()
			.from(purchaseRequestItems)
			.where(and(eq(purchaseRequestItems.purchaseRequestId, purchaseRequestId), isNull(purchaseRequestItems.deletedAt)))
			.orderBy(asc(purchaseRequestItems.sortOrder));
		const ids = lines.map((line) => line.id);
		const orders = ids.length
			? await this.database
					.select({
						requestItemId: purchaseOrderItems.purchaseRequestItemId,
						id: purchaseOrders.id,
						code: purchaseOrders.code,
						status: purchaseOrders.status,
					})
					.from(purchaseOrderItems)
					.innerJoin(purchaseOrders, eq(purchaseOrders.id, purchaseOrderItems.purchaseOrderId))
					.where(
						and(
							inArray(purchaseOrderItems.purchaseRequestItemId, ids),
							isNull(purchaseOrderItems.deletedAt),
							isNull(purchaseOrders.deletedAt),
							ne(purchaseOrders.status, 'cancelled'),
						),
					)
			: [];
		const byLine = new Map(orders.map((order) => [order.requestItemId, order]));
		return lines.map((line) => {
			const order = byLine.get(line.id);
			return {
				...line,
				purchaseOrderId: order?.id ?? null,
				purchaseOrderCode: order?.code ?? null,
				purchaseOrderStatus: order?.status ?? null,
			};
		});
	}

	create(
		header: TPurchaseRequestHeaderData & { organizationId: string | null; requestedBy: string; requestedByName: string | null },
		items: TPurchaseRequestItemData[],
	): Promise<TPurchaseRequestSelect> {
		return this.database.transaction(async (tx) => {
			const now = new Date();
			const [row] = await tx
				.insert(purchaseRequests)
				.values({ ...header, status: 'draft', createdAt: now, updatedAt: now })
				.returning();
			await this.insertItems(tx, row.id, items, now);
			return row;
		});
	}

	replaceDraft(id: string, header: TPurchaseRequestHeaderData, items: TPurchaseRequestItemData[]): Promise<TPurchaseRequestSelect | null> {
		return this.database.transaction(async (tx) => {
			const now = new Date();
			const [row] = await tx
				.update(purchaseRequests)
				.set({ ...header, updatedAt: now })
				.where(and(this.live(id), eq(purchaseRequests.status, 'draft')))
				.returning();
			if (!row) return null;
			// A draft was never approved, so no purchase order line references its lines.
			await tx.delete(purchaseRequestItems).where(eq(purchaseRequestItems.purchaseRequestId, id));
			await this.insertItems(tx, id, items, now);
			return row;
		});
	}

	async transition(
		id: string,
		from: readonly PurchaseRequestStatus[],
		to: PurchaseRequestStatus,
		patch: TPurchaseRequestTransitionPatch,
		tx?: TTx,
	): Promise<TPurchaseRequestSelect | null> {
		const [row] = await (tx ?? this.database)
			.update(purchaseRequests)
			.set({ ...patch, status: to, updatedAt: new Date() })
			.where(and(this.live(id), inArray(purchaseRequests.status, [...from])))
			.returning();
		return row ?? null;
	}

	async hasOrderedLines(id: string): Promise<boolean> {
		const [row] = await this.database
			.select({ id: purchaseRequestItems.id })
			.from(purchaseRequestItems)
			.where(
				and(
					eq(purchaseRequestItems.purchaseRequestId, id),
					isNull(purchaseRequestItems.deletedAt),
					liveOrderLineExists(purchaseRequestItems.id),
				),
			)
			.limit(1);
		return !!row;
	}

	cancelUnordered(
		id: string,
		from: readonly PurchaseRequestStatus[],
		patch: Pick<TPurchaseRequestTransitionPatch, 'cancelledBy' | 'cancelledAt' | 'cancelledReason'>,
	): Promise<TPurchaseRequestSelect | null | 'ordered'> {
		return this.database.transaction(async (tx) => {
			// The same row locks a purchase order takes when it claims lines.
			await tx
				.select({ id: purchaseRequestItems.id })
				.from(purchaseRequestItems)
				.where(eq(purchaseRequestItems.purchaseRequestId, id))
				.for('update');
			const [ordered] = await tx
				.select({ id: purchaseRequestItems.id })
				.from(purchaseRequestItems)
				.where(
					and(
						eq(purchaseRequestItems.purchaseRequestId, id),
						isNull(purchaseRequestItems.deletedAt),
						liveOrderLineExists(purchaseRequestItems.id),
					),
				)
				.limit(1);
			if (ordered) return 'ordered';
			const [row] = await tx
				.update(purchaseRequests)
				.set({ ...patch, status: 'cancelled', updatedAt: new Date() })
				.where(and(this.live(id), inArray(purchaseRequests.status, [...from])))
				.returning();
			return row ?? null;
		});
	}

	async openLines(query: TOpenLinesQuery): Promise<TOpenRequestLine[]> {
		const { search, purchaseRequestId, limit } = query;
		const rows = await this.database
			.select({
				line: purchaseRequestItems,
				purchaseRequestCode: purchaseRequests.code,
				purchaseRequestSubject: purchaseRequests.subject,
				projectName: purchaseRequests.projectName,
				neededBy: purchaseRequests.neededBy,
				requestedByName: purchaseRequests.requestedByName,
			})
			.from(purchaseRequestItems)
			.innerJoin(purchaseRequests, eq(purchaseRequests.id, purchaseRequestItems.purchaseRequestId))
			.where(
				and(
					isNull(purchaseRequestItems.deletedAt),
					isNull(purchaseRequests.deletedAt),
					inArray(purchaseRequests.status, ['approved', 'ordered']),
					not(liveOrderLineExists(purchaseRequestItems.id)),
					purchaseRequestId ? eq(purchaseRequests.id, purchaseRequestId) : undefined,
					search
						? or(
								ilike(purchaseRequests.code, likePattern(search)),
								ilike(purchaseRequests.subject, likePattern(search)),
								ilike(purchaseRequestItems.name, likePattern(search)),
								ilike(purchaseRequestItems.sku, likePattern(search)),
							)
						: undefined,
				),
			)
			.orderBy(asc(purchaseRequests.neededBy), asc(purchaseRequests.code), asc(purchaseRequestItems.sortOrder))
			.limit(limit);
		return rows.map(({ line, ...request }) => ({ ...line, ...request }));
	}
}
