import type {
	SalesReturnCondition,
	SalesReturnStatus,
	TSalesReturnInsert,
	TSalesReturnItemInsert,
	TSalesReturnItemSelect,
	TSalesReturnSelect,
} from '@drizzle/schemas/sales.schema';
import type { TTx } from '@drizzle/types';
import type { TPaginationResult } from '@ims-erp/common';
import type { TSalesReturnListQuery } from './sales-return.contract';

/** Header fields the service derives from the delivery note. */
export type TSalesReturnHeaderData = Pick<
	TSalesReturnInsert,
	'deliveryNoteId' | 'salesOrderId' | 'customerId' | 'warehouseId' | 'returnDate' | 'reason' | 'notes' | 'totalAmount'
>;

export type TSalesReturnItemData = Omit<
	TSalesReturnItemInsert,
	'id' | 'salesReturnId' | 'condition' | 'binId' | 'stockMovementId' | 'sortOrder' | 'createdAt' | 'updatedAt' | 'deletedAt'
>;

/** Columns a transition may set besides the status. */
export type TSalesReturnTransitionPatch = Partial<
	Pick<
		TSalesReturnSelect,
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
export type TSalesReturnRow = TSalesReturnSelect & {
	deliveryNoteCode: string;
	salesOrderCode: string;
	customerName: string;
};

/** What live returns (not cancelled) already take from one delivery line. */
export type TReturnedOnDeliveryLine = { quantityMilli: bigint; serialNumbers: string[] };

/** Persistence port for sales returns and their lines (live rows only). */
export interface ISalesReturnRepository {
	paginate(query: TSalesReturnListQuery): Promise<TPaginationResult<TSalesReturnRow>>;
	findById(id: string): Promise<TSalesReturnRow | null>;
	findItems(salesReturnId: string): Promise<TSalesReturnItemSelect[]>;
	create(header: TSalesReturnHeaderData & { createdBy: string }, items: TSalesReturnItemData[]): Promise<TSalesReturnSelect>;
	/** Replaces header and lines while the return is a draft; `null` otherwise. */
	replaceDraft(id: string, header: TSalesReturnHeaderData, items: TSalesReturnItemData[]): Promise<TSalesReturnSelect | null>;
	/** `from` → `to`; `null` when the status was not in `from` (race). */
	transition(
		id: string,
		from: readonly SalesReturnStatus[],
		to: SalesReturnStatus,
		patch: TSalesReturnTransitionPatch,
		tx?: TTx,
	): Promise<TSalesReturnSelect | null>;
	/**
	 * Per delivery line: quantity and serials on returns in `statuses`,
	 * leaving out `excludeReturnId`.
	 */
	returnedOnLines(
		deliveryNoteItemIds: string[],
		statuses: readonly SalesReturnStatus[],
		excludeReturnId?: string,
		tx?: TTx,
	): Promise<Map<string, TReturnedOnDeliveryLine>>;
	/**
	 * Locks the return when it is `approved` and its delivery note, so two
	 * receipts against the same note are serialized; `null` when not approved.
	 */
	claimForReceive(id: string, tx: TTx): Promise<TSalesReturnSelect | null>;
	/** Records how a line was received. */
	setReceived(
		salesReturnItemId: string,
		data: { condition: SalesReturnCondition; binId: string | null; stockMovementId: string | null },
		tx: TTx,
	): Promise<void>;
}
