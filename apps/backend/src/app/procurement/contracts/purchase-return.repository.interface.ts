import type {
	PurchaseReturnStatus,
	TPurchaseReturnInsert,
	TPurchaseReturnItemInsert,
	TPurchaseReturnItemSelect,
	TPurchaseReturnSelect,
} from '@drizzle/schemas/procurement.schema';
import type { TTx } from '@drizzle/types';
import type { TPaginationResult } from '@ims-erp/common';
import type { TPurchaseReturnListQuery } from './purchase-return.contract';

/** Header fields the service derives from the goods receipt. */
export type TPurchaseReturnHeaderData = Pick<
	TPurchaseReturnInsert,
	'goodsReceiptId' | 'purchaseOrderId' | 'supplierId' | 'warehouseId' | 'binId' | 'returnDate' | 'reason' | 'notes' | 'totalAmount'
>;

export type TPurchaseReturnItemData = Omit<
	TPurchaseReturnItemInsert,
	'id' | 'purchaseReturnId' | 'stockMovementId' | 'sortOrder' | 'createdAt' | 'updatedAt' | 'deletedAt'
>;

/** Columns a transition may set besides the status. */
export type TPurchaseReturnTransitionPatch = Partial<
	Pick<
		TPurchaseReturnSelect,
		| 'code'
		| 'rejectionReason'
		| 'submittedBy'
		| 'submittedAt'
		| 'approvedBy'
		| 'approvedAt'
		| 'shippedBy'
		| 'shippedAt'
		| 'cancelledBy'
		| 'cancelledAt'
		| 'cancelledReason'
	>
>;

/** A return as listed: with its goods receipt, PO number and supplier. */
export type TPurchaseReturnRow = TPurchaseReturnSelect & {
	goodsReceiptCode: string;
	purchaseOrderCode: string | null;
	supplierName: string;
};

/** What live returns (not cancelled) already take from one goods receipt line. */
export type TReturnedOnLine = { quantityMilli: bigint; serialNumbers: string[] };

/** Persistence port for purchase returns and their lines (live rows only). */
export interface IPurchaseReturnRepository {
	paginate(query: TPurchaseReturnListQuery): Promise<TPaginationResult<TPurchaseReturnRow>>;
	findById(id: string): Promise<TPurchaseReturnRow | null>;
	findItems(purchaseReturnId: string): Promise<TPurchaseReturnItemSelect[]>;
	create(header: TPurchaseReturnHeaderData & { createdBy: string }, items: TPurchaseReturnItemData[]): Promise<TPurchaseReturnSelect>;
	/** Replaces header and lines while the return is a draft; `null` otherwise. */
	replaceDraft(id: string, header: TPurchaseReturnHeaderData, items: TPurchaseReturnItemData[]): Promise<TPurchaseReturnSelect | null>;
	/** `from` → `to`; `null` when the status was not in `from` (race). */
	transition(
		id: string,
		from: readonly PurchaseReturnStatus[],
		to: PurchaseReturnStatus,
		patch: TPurchaseReturnTransitionPatch,
		tx?: TTx,
	): Promise<TPurchaseReturnSelect | null>;
	/**
	 * Per goods receipt line: quantity and serials on returns in `statuses`,
	 * leaving out `excludeReturnId` (the return being edited or shipped).
	 */
	returnedOnLines(
		goodsReceiptItemIds: string[],
		statuses: readonly PurchaseReturnStatus[],
		excludeReturnId?: string,
		tx?: TTx,
	): Promise<Map<string, TReturnedOnLine>>;
	/**
	 * Locks the return when it is `approved` and its goods receipt, so two
	 * shipments of the same receipt are serialized; `null` when not approved.
	 */
	claimForShip(id: string, tx: TTx): Promise<TPurchaseReturnSelect | null>;
	/** Links a return line to the stock movement it posted. */
	setMovement(purchaseReturnItemId: string, stockMovementId: string, tx: TTx): Promise<void>;
}
