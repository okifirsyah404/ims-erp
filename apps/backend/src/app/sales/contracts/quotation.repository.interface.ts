import type {
	QuotationStatus,
	TQuotationInsert,
	TQuotationItemInsert,
	TQuotationItemSelect,
	TQuotationSelect,
	TQuotationStatusHistorySelect,
} from '@drizzle/schemas/sales.schema';
import type { TPaginationResult } from '@ims-erp/common';
import type { TQuotationListQuery } from './quotation.contract';

/** Header fields the service derives from a request (customer snapshot, totals). */
export type TQuotationHeaderData = Omit<
	TQuotationInsert,
	| 'id'
	| 'code'
	| 'baseCode'
	| 'revision'
	| 'previousRevisionId'
	| 'status'
	| 'createdBy'
	| 'createdAt'
	| 'updatedAt'
	| 'deletedAt'
	| 'submittedAt'
	| 'approvedBy'
	| 'approvedAt'
	| 'rejectedReason'
	| 'sentBy'
	| 'sentAt'
	| 'closedBy'
	| 'closedAt'
	| 'lostReason'
	| 'lostNote'
>;

/** A priced line, ready to store (`sortOrder` comes from its position). */
export type TQuotationItemData = Omit<
	TQuotationItemInsert,
	'id' | 'quotationId' | 'sortOrder' | 'createdAt' | 'updatedAt' | 'deletedAt'
>;

/** Columns a transition may set besides the status. */
export type TQuotationTransitionPatch = Partial<
	Pick<
		TQuotationSelect,
		| 'submittedAt'
		| 'approvedBy'
		| 'approvedAt'
		| 'rejectedReason'
		| 'sentBy'
		| 'sentAt'
		| 'closedBy'
		| 'closedAt'
		| 'lostReason'
		| 'lostNote'
	>
>;

export type TQuotationPaginationRequest = TQuotationListQuery & {
	/** Only quotations created by this user (plus `won` ones when `includeWon`). */
	createdBy?: string;
	includeWon?: boolean;
	/** One row per SPH: superseded revisions stay inside the detail page. */
	excludeSuperseded?: boolean;
};

/**
 * Persistence port for `sales.quotations`, its items and status history
 * (live rows only). Every status change is a conditional update on the
 * expected status plus a history row, in one transaction.
 */
export interface IQuotationRepository {
	paginate(request: TQuotationPaginationRequest): Promise<TPaginationResult<TQuotationSelect>>;

	findById(id: string): Promise<TQuotationSelect | null>;

	findItems(quotationId: string): Promise<TQuotationItemSelect[]>;

	/** Every revision sharing `baseCode`, oldest first. */
	findRevisions(baseCode: string): Promise<TQuotationSelect[]>;

	/** Oldest first. */
	findHistory(quotationId: string): Promise<TQuotationStatusHistorySelect[]>;

	/** Inserts a draft with its items and the first history row. */
	create(
		header: TQuotationHeaderData & { code: string; createdBy: string },
		items: TQuotationItemData[],
	): Promise<TQuotationSelect>;

	/** Replaces header and items while the quotation is a draft; `null` otherwise. */
	replaceDraft(id: string, header: TQuotationHeaderData, items: TQuotationItemData[]): Promise<TQuotationSelect | null>;

	/** `from` → `to` with a history row; `null` when the status was not in `from` (race). */
	transition(
		id: string,
		from: readonly QuotationStatus[],
		to: QuotationStatus,
		patch: TQuotationTransitionPatch,
		actor: { userId: string; note?: string | null },
	): Promise<TQuotationSelect | null>;

	/**
	 * Supersedes the quotation (from one of `from`) and inserts the next draft
	 * revision `<base>-R<n>` as a copy of it; `null` on a race.
	 */
	createRevision(
		id: string,
		from: readonly QuotationStatus[],
		actorUserId: string,
	): Promise<TQuotationSelect | null>;
}
