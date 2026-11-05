import type {
	TInvoiceInsert,
	TInvoiceSelect,
	TReceiptInsert,
	TReceiptSelect,
} from '@drizzle/schemas/finance.schema';
import type { TPaginationResult } from '@ims-erp/common';
import type { TInvoiceListQuery, TReceiptListQuery } from './invoice.contract';
import type { TTermAmounts } from '../utils/invoice-terms';

/** Draft fields fixed before the term is computed. */
export type TInvoiceDraftData = Omit<
	TInvoiceInsert,
	| 'id'
	| 'code'
	| 'termKind'
	| 'description'
	| 'percentageBps'
	| 'subtotal'
	| 'discountTotal'
	| 'taxTotal'
	| 'grandTotal'
	| 'paidTotal'
	| 'outstandingTotal'
	| 'status'
	| 'createdAt'
	| 'updatedAt'
	| 'deletedAt'
>;

/** What the term computation decides, under the order lock. */
export type TComputedTerm = TTermAmounts & {
	termKind: TInvoiceSelect['termKind'];
	description: string;
	percentageBps: number | null;
};

export type TReceiptData = Omit<
	TReceiptInsert,
	'id' | 'status' | 'reversedBy' | 'reversedAt' | 'reversalReason' | 'createdAt' | 'updatedAt' | 'deletedAt'
>;

/**
 * Persistence port for `finance.invoices` and `finance.receipts` (live rows
 * only). Every amount rule that could race is applied again atomically here.
 */
export interface IInvoiceRepository {
	paginate(request: TInvoiceListQuery & { today: string }): Promise<TPaginationResult<TInvoiceSelect>>;

	findById(id: string): Promise<TInvoiceSelect | null>;

	/** Every invoice of an order (void included), oldest first. */
	listByOrder(salesOrderId: string): Promise<TInvoiceSelect[]>;

	/** Whether the order has any invoice that is not void. */
	hasLiveInvoices(salesOrderId: string): Promise<boolean>;

	/**
	 * Inserts a draft. `compute` runs under a per-order lock with the sum of
	 * the order's live (non-void) invoices and their count, so two requests
	 * never bill the same share twice.
	 */
	createDraftLocked(
		data: TInvoiceDraftData,
		compute: (billed: TTermAmounts, liveCount: number) => TComputedTerm,
	): Promise<TInvoiceSelect>;

	/** Draft → issued with its number; `null` when not a draft. */
	issue(id: string, patch: { code: string; issueDate: string; dueDate: string | null; issuedBy: string }): Promise<TInvoiceSelect | null>;

	/** Unpaid draft or issued → void; `null` otherwise. */
	void(id: string, actorUserId: string, reason: string): Promise<TInvoiceSelect | null>;

	findReceipt(id: string): Promise<TReceiptSelect | null>;

	listReceipts(invoiceId: string): Promise<TReceiptSelect[]>;

	paginateReceipts(request: TReceiptListQuery): Promise<TPaginationResult<TReceiptSelect & { invoiceCode: string | null; customerName: string }>>;

	/**
	 * Records a receipt and updates the invoice's paid / outstanding / status
	 * in one transaction; `null` when the invoice is not payable or the
	 * amount exceeds what is outstanding.
	 */
	addReceipt(data: TReceiptData): Promise<TReceiptSelect | null>;

	/** Posted → reversed and the invoice's payment undone; `null` when already reversed. */
	reverseReceipt(id: string, actorUserId: string, reason: string): Promise<TReceiptSelect | null>;
}
