import type {
	PurchaseOrderStatus,
	SupplierStatus,
	TPurchaseOrderInsert,
	TPurchaseOrderItemInsert,
	TPurchaseOrderItemSelect,
	TPurchaseOrderSelect,
	TSupplierInsert,
	TSupplierSelect,
} from '@drizzle/schemas/procurement.schema';
import type { TPaginationResult } from '@ims-erp/common';
import type { TPurchaseOrderListQuery } from './purchase-order.contract';
import type { TSupplierListQuery, TUpdateSupplierInput } from './supplier.contract';

export type TSupplierCreateData = Omit<TSupplierInsert, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'deletedAt'>;

/** Persistence port for `procurement.suppliers` (live rows only). */
export interface ISupplierRepository {
	paginate(query: TSupplierListQuery): Promise<TPaginationResult<TSupplierSelect>>;
	findById(id: string): Promise<TSupplierSelect | null>;
	findByCode(code: string): Promise<TSupplierSelect | null>;
	create(data: TSupplierCreateData): Promise<TSupplierSelect>;
	update(id: string, patch: TUpdateSupplierInput): Promise<TSupplierSelect | null>;
	/** `from` → `to`; `null` when the supplier was not in `from`. */
	transitionStatus(id: string, from: SupplierStatus, to: SupplierStatus): Promise<TSupplierSelect | null>;
}

/** Header fields the service derives (supplier snapshot, totals). */
export type TPurchaseOrderHeaderData = Omit<
	TPurchaseOrderInsert,
	| 'id'
	| 'code'
	| 'status'
	| 'rejectionReason'
	| 'createdBy'
	| 'submittedBy'
	| 'submittedAt'
	| 'approvedBy'
	| 'approvedAt'
	| 'sentBy'
	| 'sentAt'
	| 'cancelledBy'
	| 'cancelledAt'
	| 'cancelledReason'
	| 'createdAt'
	| 'updatedAt'
	| 'deletedAt'
>;

export type TPurchaseOrderItemData = Omit<
	TPurchaseOrderItemInsert,
	'id' | 'purchaseOrderId' | 'sortOrder' | 'quantityReceived' | 'createdAt' | 'updatedAt' | 'deletedAt'
>;

/** Columns a transition may set besides the status. */
export type TPurchaseOrderTransitionPatch = Partial<
	Pick<
		TPurchaseOrderSelect,
		| 'code'
		| 'rejectionReason'
		| 'submittedBy'
		| 'submittedAt'
		| 'approvedBy'
		| 'approvedAt'
		| 'sentBy'
		| 'sentAt'
		| 'cancelledBy'
		| 'cancelledAt'
		| 'cancelledReason'
	>
>;

/** Persistence port for purchase orders and their items (live rows only). */
export interface IPurchaseOrderRepository {
	paginate(query: TPurchaseOrderListQuery): Promise<TPaginationResult<TPurchaseOrderSelect>>;
	findById(id: string): Promise<TPurchaseOrderSelect | null>;
	findItems(purchaseOrderId: string): Promise<TPurchaseOrderItemSelect[]>;
	create(header: TPurchaseOrderHeaderData & { createdBy: string }, items: TPurchaseOrderItemData[]): Promise<TPurchaseOrderSelect>;
	/** Replaces header and items while the PO is a draft; `null` otherwise. */
	replaceDraft(id: string, header: TPurchaseOrderHeaderData, items: TPurchaseOrderItemData[]): Promise<TPurchaseOrderSelect | null>;
	/** `from` → `to`; `null` when the status was not in `from` (race). */
	transition(
		id: string,
		from: readonly PurchaseOrderStatus[],
		to: PurchaseOrderStatus,
		patch: TPurchaseOrderTransitionPatch,
	): Promise<TPurchaseOrderSelect | null>;
	/** Whether anything was received on the PO. */
	hasReceipts(id: string): Promise<boolean>;
}
