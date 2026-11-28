import type { TTx } from '@drizzle/types';
import type {
	PurchaseOrderStatus,
	PurchaseRequestStatus,
	TPurchaseRequestInsert,
	TPurchaseRequestItemInsert,
	TPurchaseRequestItemSelect,
	TPurchaseRequestSelect,
	TPurchaseOrderInsert,
	TPurchaseOrderItemInsert,
	TPurchaseOrderItemSelect,
	TPurchaseOrderSelect,
	TPurchaseTermTemplateSelect,
} from '@drizzle/schemas/procurement.schema';
import type { TPaginationResult } from '@ims-erp/common';
import type { IPurchaseOrderReceiving } from './goods-receipt.repository.interface';
import type { TPurchaseOrderListQuery } from './purchase-order.contract';
import type { TOpenLinesQuery, TPurchaseRequestListQuery } from './purchase-request.contract';

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
		| 'closedBy'
		| 'closedAt'
		| 'closedReason'
		| 'cancelledReason'
	>
>;

/** Result of a PO write that may claim purchase request lines. */
export type TPurchaseOrderWrite =
	| { ok: true; order: TPurchaseOrderSelect }
	| { ok: false; reason: 'notDraft' }
	| { ok: false; reason: 'requestLine'; line: number };

/** Persistence port for purchase orders and their items (live rows only). */
export interface IPurchaseOrderRepository extends IPurchaseOrderReceiving {
	paginate(query: TPurchaseOrderListQuery): Promise<TPaginationResult<TPurchaseOrderSelect>>;
	findById(id: string): Promise<TPurchaseOrderSelect | null>;
	findItems(purchaseOrderId: string): Promise<TPurchaseOrderItemSelect[]>;
	/** The purchase request each line orders (`null` for a line typed on the PO). */
	findItemRequests(purchaseOrderId: string): Promise<{ purchaseOrderItemId: string; purchaseRequestId: string; purchaseRequestCode: string | null }[]>;
	/**
	 * Creates a draft. Lines carrying `purchaseRequestItemId` claim that request
	 * line under a row lock: it must belong to an approved (or ordered) request
	 * and not be on another live PO; `{ ok: false, line }` otherwise. The
	 * requests' `approved` / `ordered` status follows in the same transaction.
	 */
	create(header: TPurchaseOrderHeaderData & { createdBy: string }, items: TPurchaseOrderItemData[]): Promise<TPurchaseOrderWrite>;
	/** Replaces header and items while the PO is a draft (`notDraft` otherwise), claiming request lines like `create`. */
	replaceDraft(id: string, header: TPurchaseOrderHeaderData, items: TPurchaseOrderItemData[]): Promise<TPurchaseOrderWrite>;
	/** Re-derives `approved` / `ordered` of the requests this PO's lines order (after a cancel). */
	syncRequestsOfOrder(id: string): Promise<void>;
	/** `from` → `to`; `null` when the status was not in `from` (race). `tx` joins the approval transaction (P7-5). */
	transition(
		id: string,
		from: readonly PurchaseOrderStatus[],
		to: PurchaseOrderStatus,
		patch: TPurchaseOrderTransitionPatch,
		tx?: TTx,
	): Promise<TPurchaseOrderSelect | null>;
	/** Whether anything was received on the PO. */
	hasReceipts(id: string): Promise<boolean>;
	/** Approved, sent and (partly) received orders of a project (ERP-0146). */
	/**
	 * Committed orders of a project (ERP-0146): approved, sent and (partly) received at
	 * their subtotal, closed ones (B-32) at the value actually received.
	 */
	listOpenForProject(projectId: string): Promise<Array<{ id: string; subtotal: number }>>;
}

/* --------------------------- purchase requests --------------------------- */

/** Header fields the service derives for a request. */
export type TPurchaseRequestHeaderData = Pick<
	TPurchaseRequestInsert,
	'subject' | 'justification' | 'projectName' | 'requestDate' | 'neededBy' | 'estimatedTotal'
>;

export type TPurchaseRequestItemData = Omit<
	TPurchaseRequestItemInsert,
	'id' | 'purchaseRequestId' | 'sortOrder' | 'createdAt' | 'updatedAt' | 'deletedAt'
>;

/** Columns a request transition may set besides the status. */
export type TPurchaseRequestTransitionPatch = Partial<
	Pick<
		TPurchaseRequestSelect,
		| 'code'
		| 'rejectionReason'
		| 'submittedAt'
		| 'approvedBy'
		| 'approvedAt'
		| 'cancelledBy'
		| 'cancelledAt'
		| 'cancelledReason'
	>
>;

/** A request line with the live purchase order that orders it, if any. */
export type TPurchaseRequestLineView = TPurchaseRequestItemSelect & {
	purchaseOrderId: string | null;
	purchaseOrderCode: string | null;
	purchaseOrderStatus: PurchaseOrderStatus | null;
};

/** An approved line not yet on a live purchase order, with its request. */
export type TOpenRequestLine = TPurchaseRequestItemSelect & {
	purchaseRequestCode: string | null;
	purchaseRequestSubject: string;
	projectName: string | null;
	neededBy: string | null;
	requestedByName: string | null;
};

/** Persistence port for purchase requests and their items (live rows only). */
export interface IPurchaseRequestRepository {
	paginate(query: TPurchaseRequestListQuery, actorUserId: string): Promise<TPaginationResult<TPurchaseRequestSelect>>;
	findById(id: string): Promise<TPurchaseRequestSelect | null>;
	findLines(purchaseRequestId: string): Promise<TPurchaseRequestLineView[]>;
	create(
		header: TPurchaseRequestHeaderData & {
			organizationId: string | null;
			requestedBy: string;
			requestedByName: string | null;
		},
		items: TPurchaseRequestItemData[],
	): Promise<TPurchaseRequestSelect>;
	/** Replaces header and items while the request is a draft; `null` otherwise. */
	replaceDraft(id: string, header: TPurchaseRequestHeaderData, items: TPurchaseRequestItemData[]): Promise<TPurchaseRequestSelect | null>;
	/** `from` → `to`; `null` when the status was not in `from` (race). */
	transition(
		id: string,
		from: readonly PurchaseRequestStatus[],
		to: PurchaseRequestStatus,
		patch: TPurchaseRequestTransitionPatch,
		tx?: TTx,
	): Promise<TPurchaseRequestSelect | null>;
	/** Whether any line is on a live (not cancelled) purchase order. */
	hasOrderedLines(id: string): Promise<boolean>;
	/**
	 * Cancels from `from` while no line is on a live PO, with the lines locked
	 * like a PO claiming them (so the two cannot interleave). `ordered` when a
	 * line is on a PO, `null` when the status was not in `from`.
	 */
	cancelUnordered(
		id: string,
		from: readonly PurchaseRequestStatus[],
		patch: Pick<TPurchaseRequestTransitionPatch, 'cancelledBy' | 'cancelledAt' | 'cancelledReason'>,
	): Promise<TPurchaseRequestSelect | null | 'ordered'>;
	openLines(query: TOpenLinesQuery): Promise<TOpenRequestLine[]>;
}

/** Persistence port for `procurement.purchase_term_templates` (ERP-0165). */
export interface IPurchaseTermTemplateRepository {
	/** Live templates, the default first, then by name. */
	findAll(): Promise<TPurchaseTermTemplateSelect[]>;
	/** A live template, or `null`. */
	findLive(id: string): Promise<TPurchaseTermTemplateSelect | null>;
	/** Inserts one; with `isDefault` the previous default stops being one, in the same transaction. */
	create(data: TPurchaseTermTemplateData & { createdBy: string }): Promise<TPurchaseTermTemplateSelect>;
	/** Replaces a live template (`null` when it is not live); `isDefault` moves the default in one transaction. */
	update(id: string, data: TPurchaseTermTemplateData): Promise<TPurchaseTermTemplateSelect | null>;
	/** Soft-deletes a live template; `false` when it is not live. */
	softDelete(id: string, updatedBy: string): Promise<boolean>;
}

/** The writable columns of a term template. */
export type TPurchaseTermTemplateData = Pick<
	TPurchaseTermTemplateSelect,
	'name' | 'paymentTerms' | 'terms' | 'notes' | 'isDefault' | 'updatedBy'
>;
