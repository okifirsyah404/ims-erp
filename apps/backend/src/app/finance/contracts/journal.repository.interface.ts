import type { TTx } from '@drizzle/types';
import type { TJournalEntrySelect, TJournalLineSelect } from '@drizzle/schemas/finance.schema';
import type { TPaginationRequest, TPaginationResult } from '@ims-erp/common';

/** Aggregated journal activity of one account inside a date window. */
export type TAccountActivity = { accountId: string; debit: number; credit: number };

/** Row written by {@link IJournalRepository.insertEntry}. */
export type TJournalEntryInsertRow = {
	organizationId: string;
	/** Null for draft manual entries; assigned at posting. */
	code: string | null;
	accountingPeriodId: string;
	entryDate: string;
	description: string | null;
	sourceType: string | null;
	sourceId: string | null;
	idempotencyKey: string | null;
	sourceModule: string;
	status: string;
	totalDebit: number;
	totalCredit: number;
	currencyCode: string;
	postedBy: string | null;
	postedAt: Date | null;
	preparedBy?: string | null;
	eventType?: string | null;
	isAdjusting?: boolean;
	reversesEntryId?: string | null;
};

/** One line written by {@link IJournalRepository.insertLines}. */
export type TJournalLineInsertRow = {
	organizationId: string;
	journalEntryId: string;
	lineNo: number;
	accountId: string;
	debit: number;
	credit: number;
	currencyCode: string;
	description: string | null;
	costCenterId: string | null;
	projectId: string | null;
	partyType: string | null;
	partyId: string | null;
	productId?: string | null;
};

/** Columns a manual-journal transition may change. */
export type TJournalEntryPatch = Partial<{
	status: string;
	code: string | null;
	entryDate: string;
	accountingPeriodId: string;
	description: string | null;
	totalDebit: number;
	totalCredit: number;
	isAdjusting: boolean;
	submittedAt: Date | null;
	approvedBy: string | null;
	approvedAt: Date | null;
	postedBy: string | null;
	postedAt: Date | null;
}>;

/** One posted line of the general-ledger report, with its entry header. */
export type TLedgerLine = {
	lineId: string;
	entryId: string;
	entryCode: string | null;
	entryDate: string;
	sourceModule: string;
	sourceType: string | null;
	entryDescription: string | null;
	lineDescription: string | null;
	debit: number;
	credit: number;
	costCenterId: string | null;
	projectId: string | null;
};

/** Page settings, tenant and the optional filters of the journal listing. */
export type TJournalEntryPaginationRequest = TPaginationRequest & {
	organizationId: string;
	year?: number;
	month?: number;
	status?: string;
};

export interface IJournalRepository {
	findEntryById(organizationId: string, id: string, tx?: TTx): Promise<TJournalEntrySelect | null>;
	findPostedEntryByIdempotencyKey(
		organizationId: string,
		idempotencyKey: string,
		tx?: TTx,
	): Promise<TJournalEntrySelect | null>;
	/** Latest entry posted for a source document (F7 reversal lookup). */
	findEntryBySource(
		organizationId: string,
		sourceType: string,
		sourceId: string,
		tx?: TTx,
	): Promise<TJournalEntrySelect | null>;
	/** Fetches one page of the tenant's journal entries, newest first. */
	paginateEntries(
		request: TJournalEntryPaginationRequest,
	): Promise<TPaginationResult<TJournalEntrySelect>>;
	insertEntry(row: TJournalEntryInsertRow, tx?: TTx): Promise<TJournalEntrySelect>;
	insertLines(rows: TJournalLineInsertRow[], tx?: TTx): Promise<TJournalLineSelect[]>;
	findLinesByEntryId(
		organizationId: string,
		entryId: string,
		tx?: TTx,
	): Promise<TJournalLineSelect[]>;
	/** Stamps `posted_by` on a manually posted entry (HTTP actor). */
	stampPostedBy(
		organizationId: string,
		entryId: string,
		postedBy: string,
		tx?: TTx,
	): Promise<void>;
	/** Marks the entry `reversed` and points at the mirrored entry. */
	markReversed(
		organizationId: string,
		entryId: string,
		reversedByEntryId: string,
		tx?: TTx,
	): Promise<void>;
	/** Posted activity per account between two dates, inclusive (report base). */
	listAccountActivity(
		organizationId: string,
		startDate: string,
		endDate: string,
		tx?: TTx,
	): Promise<TAccountActivity[]>;
	/** Posted activity per account inside one accounting period (close snapshot). */
	accountTotalsForPeriod(
		organizationId: string,
		periodId: string,
	): Promise<TAccountActivity[]>;
	updateEntry(
		organizationId: string,
		entryId: string,
		patch: TJournalEntryPatch,
		tx?: TTx,
	): Promise<TJournalEntrySelect | null>;
	/** Every live entry produced by one source document, oldest first. */
	listEntriesBySource(
		organizationId: string,
		sourceType: string,
		sourceId: string,
		tx?: TTx,
	): Promise<TJournalEntrySelect[]>;
	/** Soft-deletes every live line of a draft before it is rewritten. */
	softDeleteLines(organizationId: string, entryId: string, tx?: TTx): Promise<void>;
	/** Draft, submitted or approved-but-unposted entries in a period (lock gate). */
	countUnpostedInPeriod(organizationId: string, periodId: string): Promise<number>;
	/** Ledger totals per account strictly before a date (trial balance opening). */
	accountTotalsBefore(organizationId: string, beforeDate: string): Promise<TAccountActivity[]>;
	/** Ledger lines of one account in a date range (general-ledger report). */
	listLedgerLines(
		organizationId: string,
		accountId: string,
		startDate: string,
		endDate: string,
	): Promise<TLedgerLine[]>;
}
