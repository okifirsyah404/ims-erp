import type {
	TGoodsReceiptInsert,
	TGoodsReceiptItemInsert,
	TGoodsReceiptItemSelect,
	TGoodsReceiptSelect,
	TPurchaseOrderSelect,
} from '@drizzle/schemas/procurement.schema';
import type { TTx } from '@drizzle/types';
import type { TPaginationResult } from '@ims-erp/common';
import type { TGoodsReceiptListQuery } from './goods-receipt.contract';

export type TGoodsReceiptHeaderData = Omit<TGoodsReceiptInsert, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'deletedAt'>;
export type TGoodsReceiptItemData = Omit<
	TGoodsReceiptItemInsert,
	'id' | 'goodsReceiptId' | 'stockMovementId' | 'createdAt' | 'updatedAt' | 'deletedAt'
>;

/** A receipt as listed: with its PO number and supplier. */
export type TGoodsReceiptRow = TGoodsReceiptSelect & { purchaseOrderCode: string | null; supplierName: string };

/**
 * Persistence port for goods receipts (live rows only). Writes join the
 * caller's unit of work (`tx`): a receipt commits with its PO progress, its
 * stock movements and its serial units, or not at all.
 */
export interface IGoodsReceiptRepository {
	paginate(query: TGoodsReceiptListQuery): Promise<TPaginationResult<TGoodsReceiptRow>>;
	findById(id: string): Promise<TGoodsReceiptRow | null>;
	findItems(goodsReceiptId: string): Promise<TGoodsReceiptItemSelect[]>;
	create(header: TGoodsReceiptHeaderData, items: TGoodsReceiptItemData[], tx: TTx): Promise<{
		receipt: TGoodsReceiptSelect;
		items: TGoodsReceiptItemSelect[];
	}>;
	/** Links a receipt line to the stock movement it posted. */
	setMovement(goodsReceiptItemId: string, stockMovementId: string, tx: TTx): Promise<void>;
}

/** What one receipt adds to each PO line. */
export type TReceivedQuantity = { purchaseOrderItemId: string; quantity: string };

export type TReceiveResult =
	| { ok: true; order: TPurchaseOrderSelect }
	| { ok: false; reason: 'notReceivable' | 'overReceived'; line?: number };

/** Receiving on purchase orders (same module, joins the unit of work). */
export interface IPurchaseOrderReceiving {
	/**
	 * Locks the PO, checks it is `sent | partially_received` and that no line
	 * exceeds what is still open, adds the quantities and moves the PO to
	 * `partially_received` or `received`.
	 */
	receive(purchaseOrderId: string, lines: TReceivedQuantity[], tx: TTx): Promise<TReceiveResult>;
	/**
	 * Purchase returns (ERP-0061): locks the PO, takes the returned
	 * quantities off `quantity_received` and moves a `received` or
	 * `partially_received` PO back to `partially_received` (or `sent` when
	 * nothing stays received), so the replacement is received normally.
	 */
	unreceive(purchaseOrderId: string, lines: TReceivedQuantity[], tx: TTx): Promise<TUnreceiveResult>;
}

export type TUnreceiveResult =
	| { ok: true; order: TPurchaseOrderSelect }
	| { ok: false; reason: 'notReturnable' | 'overReturned'; line?: number };
