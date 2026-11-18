import type { TTx } from '@drizzle/types';
import {
	purchaseOrderItems,
	purchaseOrders,
	purchaseRequestItems,
	purchaseRequests,
} from '@drizzle/schemas/procurement.schema';
import { and, eq, inArray, isNull, ne, sql, type SQL } from 'drizzle-orm';

/**
 * Shared queries of PR → PO ordering (same module, used by both
 * repositories). A request line is *ordered* while a line of a live purchase
 * order (not cancelled, not deleted) references it.
 */

/** `EXISTS` a live PO line ordering the request line `itemId`. */
export function liveOrderLineExists(itemId: SQL | typeof purchaseRequestItems.id): SQL {
	return sql`EXISTS (
		SELECT 1 FROM ${purchaseOrderItems}
		JOIN ${purchaseOrders} ON ${purchaseOrders.id} = ${purchaseOrderItems.purchaseOrderId}
		WHERE ${purchaseOrderItems.purchaseRequestItemId} = ${itemId}
			AND ${purchaseOrderItems.deletedAt} IS NULL
			AND ${purchaseOrders.deletedAt} IS NULL
			AND ${purchaseOrders.status} <> 'cancelled'
	)`;
}

/**
 * Locks the request lines a PO wants to order and checks they are open:
 * the request is approved (or already partly ordered), and no other live PO
 * line orders them. Returns the 1-based PO line that is not, or the ids of
 * the requests involved.
 */
export async function claimRequestLines(
	tx: TTx,
	purchaseOrderId: string | null,
	requestItemIds: readonly (string | null | undefined)[],
): Promise<{ ok: true; requestIds: string[] } | { ok: false; line: number }> {
	const ids = [...new Set(requestItemIds.filter((id): id is string => !!id))];
	if (ids.length === 0) return { ok: true, requestIds: [] };
	const rows = await tx
		.select({ id: purchaseRequestItems.id, requestId: purchaseRequests.id, status: purchaseRequests.status })
		.from(purchaseRequestItems)
		.innerJoin(purchaseRequests, eq(purchaseRequests.id, purchaseRequestItems.purchaseRequestId))
		.where(and(inArray(purchaseRequestItems.id, ids), isNull(purchaseRequestItems.deletedAt), isNull(purchaseRequests.deletedAt)))
		.for('update', { of: purchaseRequestItems });
	const taken = await tx
		.select({ id: purchaseOrderItems.purchaseRequestItemId })
		.from(purchaseOrderItems)
		.innerJoin(purchaseOrders, eq(purchaseOrders.id, purchaseOrderItems.purchaseOrderId))
		.where(
			and(
				inArray(purchaseOrderItems.purchaseRequestItemId, ids),
				isNull(purchaseOrderItems.deletedAt),
				isNull(purchaseOrders.deletedAt),
				ne(purchaseOrders.status, 'cancelled'),
				purchaseOrderId ? ne(purchaseOrders.id, purchaseOrderId) : undefined,
			),
		);
	const found = new Map(rows.map((row) => [row.id, row]));
	const takenIds = new Set(taken.map((row) => row.id));
	const seen = new Set<string>();
	for (const [index, id] of requestItemIds.entries()) {
		if (!id) continue;
		const row = found.get(id);
		if (!row || (row.status !== 'approved' && row.status !== 'ordered') || takenIds.has(id) || seen.has(id)) {
			return { ok: false, line: index + 1 };
		}
		seen.add(id);
	}
	return { ok: true, requestIds: [...new Set(rows.map((row) => row.requestId))] };
}

/** Request ids ordered by the lines of a PO. */
export async function requestIdsOfOrder(tx: TTx, purchaseOrderId: string): Promise<string[]> {
	const rows = await tx
		.selectDistinct({ id: purchaseRequestItems.purchaseRequestId })
		.from(purchaseOrderItems)
		.innerJoin(purchaseRequestItems, eq(purchaseRequestItems.id, purchaseOrderItems.purchaseRequestItemId))
		.where(eq(purchaseOrderItems.purchaseOrderId, purchaseOrderId));
	return rows.map((row) => row.id);
}

/**
 * Re-derives `approved` ↔ `ordered`: ordered while every live line of the
 * request is on a live PO. Other statuses are left alone.
 */
export async function syncRequestStatuses(tx: TTx, requestIds: readonly string[]): Promise<void> {
	if (requestIds.length === 0) return;
	const line = sql.raw('line');
	await tx
		.update(purchaseRequests)
		.set({
			status: sql`CASE WHEN EXISTS (
				SELECT 1 FROM ${purchaseRequestItems} AS ${line}
				WHERE ${line}.purchase_request_id = ${purchaseRequests.id}
					AND ${line}.deleted_at IS NULL
					AND NOT ${liveOrderLineExists(sql`${line}.id`)}
			) THEN 'approved' ELSE 'ordered' END`,
			updatedAt: new Date(),
		})
		.where(
			and(
				inArray(purchaseRequests.id, [...requestIds]),
				inArray(purchaseRequests.status, ['approved', 'ordered']),
				isNull(purchaseRequests.deletedAt),
			),
		);
}
