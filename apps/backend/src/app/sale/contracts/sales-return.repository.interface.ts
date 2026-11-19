import type {
	ReturnCondition,
	ReturnStatus,
	TReturnInsert,
	TReturnItemInsert,
	TReturnItemSelect,
	TReturnSelect,
} from '@drizzle/schemas/sale.schema';
import type { TTx } from '@drizzle/types';
import type { TPaginationResult } from '@ims-erp/common';
import type { TSalesReturnListQuery } from './sales-return.contract';

/** Header fields the service derives from the delivery note. */
export type TSalesReturnHeaderData = Pick<
	TReturnInsert,
	'deliveryNoteId' | 'orderId' | 'customerId' | 'warehouseId' | 'returnDate' | 'reason' | 'notes' | 'totalAmount'
>;

export type TSalesReturnItemData = Omit<
	TReturnItemInsert,
	'id' | 'returnId' | 'condition' | 'binId' | 'movementId' | 'sortOrder' | 'createdAt' | 'updatedAt' | 'deletedAt'
>;

/** Columns a transition may set besides the status. */
export type TSalesReturnTransitionPatch = Partial<
	Pick<
		TReturnSelect,
		| 'code'
		| 'rejectionReason'
		| 'submittedBy'
		| 'submittedAt'
		| 'approvedBy'
		| 'approvedAt'
		| 'receivedBy'
		| 'receivedAt'
		| 'cancelledBy'
		| 'cancelledAt'
		| 'cancelledReason'
	>
>;

/** A return as listed: with its delivery note, order number and customer. */
export type TSalesReturnRow = TReturnSelect & {
	deliveryNoteCode: string;
	orderCode: string;
	customerName: string;
};

/** What live returns (not cancelled) already take from one delivery line. */
export type TReturnedOnDeliveryLine = { quantityMilli: bigint; serialNumbers: string[] };

/** Persistence port for sales returns and their lines (live rows only). */
export interface ISalesReturnRepository {
	paginate(query: TSalesReturnListQuery): Promise<TPaginationResult<TSalesReturnRow>>;
	findById(id: string): Promise<TSalesReturnRow | null>;
	findItems(returnId: string): Promise<TReturnItemSelect[]>;
	create(header: TSalesReturnHeaderData & { createdBy: string }, items: TSalesReturnItemData[]): Promise<TReturnSelect>;
	/** Replaces header and lines while the return is a draft; `null` otherwise. */
	replaceDraft(id: string, header: TSalesReturnHeaderData, items: TSalesReturnItemData[]): Promise<TReturnSelect | null>;
	/** `from` → `to`; `null` when the status was not in `from` (race). */
	transition(
		id: string,
		from: readonly ReturnStatus[],
		to: ReturnStatus,
		patch: TSalesReturnTransitionPatch,
		tx?: TTx,
	): Promise<TReturnSelect | null>;
	/**
	 * Per delivery line: quantity and serials on returns in `statuses`,
	 * leaving out `excludeReturnId`.
	 */
	returnedOnLines(
		deliveryNoteItemIds: string[],
		statuses: readonly ReturnStatus[],
		excludeReturnId?: string,
		tx?: TTx,
	): Promise<Map<string, TReturnedOnDeliveryLine>>;
	/**
	 * Locks the return when it is `approved` and its delivery note, so two
	 * receipts against the same note are serialized; `null` when not approved.
	 */
	claimForReceive(id: string, tx: TTx): Promise<TReturnSelect | null>;
	/** Records how a line was received. */
	setReceived(
		salesReturnItemId: string,
		data: { condition: ReturnCondition; binId: string | null; movementId: string | null },
		tx: TTx,
	): Promise<void>;
}
