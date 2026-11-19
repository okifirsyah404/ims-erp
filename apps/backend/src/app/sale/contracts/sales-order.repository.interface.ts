import type {
	TOrderStatusHistorySelect,
	TOrderInsert,
	TOrderItemInsert,
	TOrderItemSelect,
	TOrderSelect,
} from '@drizzle/schemas/sale.schema';
import type { TTx } from '@drizzle/types';
import type { TPaginationResult } from '@ims-erp/common';
import type { TSalesOrderListQuery } from './sales-order.contract';

/** Header fields the service copies from the SPH and the request. */
export type TSalesOrderHeaderData = Omit<
	TOrderInsert,
	'id' | 'status' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'cancelledBy' | 'cancelledAt' | 'cancellationReason'
>;

export type TSalesOrderItemData = Omit<
	TOrderItemInsert,
	'id' | 'orderId' | 'sortOrder' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'quantityDelivered' | 'fulfillmentStatus'
>;

export type TSalesOrderPaginationRequest = TSalesOrderListQuery & {
	/** Only orders of this salesperson's SPHs. */
	salesPersonUserId?: string;
};

/**
 * Persistence port for `sales.sales_orders`, its items and status history
 * (live rows only). Creating and cancelling an order also move its SPH
 * (`won` / reopened) in the same transaction, so the two never disagree.
 */
export interface ISalesOrderRepository {
	paginate(request: TSalesOrderPaginationRequest): Promise<TPaginationResult<TOrderSelect>>;

	findById(id: string): Promise<TOrderSelect | null>;

	findItems(orderId: string): Promise<TOrderItemSelect[]>;

	/** Oldest first. */
	findHistory(orderId: string): Promise<TOrderStatusHistorySelect[]>;

	/** The live (not cancelled) order of an SPH, if any. */
	findLiveByQuotation(quotationId: string): Promise<TOrderSelect | null>;

	/**
	 * Inserts a `confirmed` order with its items and marks the SPH `won`
	 * (from `approved` or `sent`); `null` when the SPH was no longer there
	 * (race). A second live order for the same SPH violates the unique index.
	 */
	createFromQuotation(
		header: TSalesOrderHeaderData,
		items: TSalesOrderItemData[],
		actorUserId: string,
	): Promise<TOrderSelect | null>;

	/**
	 * `confirmed → cancelled` and reopens the SPH (`won → sent`, or
	 * `approved` when it was never sent); `null` when not `confirmed`.
	 */
	cancel(id: string, actorUserId: string, reason: string): Promise<TOrderSelect | null>;

	/**
	 * Adds (or, with `release`, gives back) delivery-note quantities on the
	 * order lines under row locks: the order must be `confirmed` or
	 * `in_progress` to allocate, and no line may go above its ordered quantity
	 * or below zero. Line fulfilment becomes `pending` / `partial` /
	 * `fulfilled`.
	 */
	allocateDelivery(
		orderId: string,
		lines: TDeliveryAllocation[],
		options: { release?: boolean },
		tx: TTx,
	): Promise<TAllocationResult>;

	/** `confirmed → in_progress` with a history row (first shipment); no-op otherwise. */
	markInProgress(orderId: string, actorUserId: string, note: string, tx: TTx): Promise<void>;

	/**
	 * Sales returns (ERP-0065): `delivered | completed → in_progress` with a
	 * history row, so the replacement can be delivered; no-op otherwise.
	 */
	reopenForReplacement(orderId: string, actorUserId: string, note: string, tx: TTx): Promise<void>;
}

/** What one delivery note takes from each order line. */
export type TDeliveryAllocation = { orderItemId: string; quantity: string };

export type TAllocationResult =
	| { ok: true }
	| { ok: false; reason: 'notDeliverable' | 'overDelivered'; line?: number };
