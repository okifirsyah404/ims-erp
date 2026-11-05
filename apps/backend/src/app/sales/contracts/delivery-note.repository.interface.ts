import type {
	TDeliveryNoteInsert,
	TDeliveryNoteItemInsert,
	TDeliveryNoteItemSelect,
	TDeliveryNoteSelect,
} from '@drizzle/schemas/sales.schema';
import type { TTx } from '@drizzle/types';
import type { TPaginationResult } from '@ims-erp/common';
import type { TDeliveryNoteListQuery } from './delivery-note.contract';

export type TDeliveryNoteHeaderData = Omit<
	TDeliveryNoteInsert,
	| 'id'
	| 'status'
	| 'createdAt'
	| 'updatedAt'
	| 'deletedAt'
	| 'shippedAt'
	| 'shippedBy'
	| 'receivedAt'
	| 'receiverName'
	| 'cancelledAt'
	| 'cancelledBy'
	| 'cancellationReason'
>;
export type TDeliveryNoteItemData = Omit<
	TDeliveryNoteItemInsert,
	'id' | 'deliveryNoteId' | 'unitCost' | 'stockMovementId' | 'createdAt' | 'updatedAt' | 'deletedAt'
>;

/** A note as listed: with its order number and customer. */
export type TDeliveryNoteRow = TDeliveryNoteSelect & {
	salesOrderCode: string;
	customerId: string;
	customerName: string;
};

/**
 * Persistence port for `sales.delivery_notes` and their lines (live rows
 * only). Writes join the caller's unit of work (`tx`): a note commits with
 * its order allocation, and a shipment with its stock movements and serial
 * units, or not at all. State changes are guarded on the current status
 * inside the update (`null` = the note was no longer in that state).
 */
export interface IDeliveryNoteRepository {
	paginate(query: TDeliveryNoteListQuery): Promise<TPaginationResult<TDeliveryNoteRow>>;
	findById(id: string): Promise<TDeliveryNoteRow | null>;
	findItems(deliveryNoteId: string): Promise<TDeliveryNoteItemSelect[]>;
	/** Whether the order has any prepared, shipped or delivered note. */
	hasLiveNotes(salesOrderId: string): Promise<boolean>;
	create(
		header: TDeliveryNoteHeaderData,
		items: TDeliveryNoteItemData[],
		tx: TTx,
	): Promise<{ note: TDeliveryNoteSelect; items: TDeliveryNoteItemSelect[] }>;
	/** `prepared → shipped`. */
	markShipped(id: string, actorUserId: string, tx: TTx): Promise<TDeliveryNoteSelect | null>;
	/** Records the issue movement and its cost on a line. */
	setLineIssue(lineId: string, data: { stockMovementId: string; unitCost: number }, tx: TTx): Promise<void>;
	/** `shipped → delivered`. */
	markDelivered(id: string, data: { receiverName: string; receivedAt: Date }): Promise<TDeliveryNoteSelect | null>;
	/** `prepared → cancelled`. */
	cancel(id: string, actorUserId: string, reason: string, tx: TTx): Promise<TDeliveryNoteSelect | null>;
}
