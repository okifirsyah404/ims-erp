import type { TTx } from '@drizzle/types';
import type { TJournalEntrySelect, TJournalLineSelect } from '@drizzle/schemas/accounting.schema';
import type { TPaginationResult } from '@ims-erp/common';

/** Aggregated journal activity of one account inside a date window. */
export type TAccountActivity = { accountId: string; debit: number; credit: number };

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
	listEntries(
		organizationId: string,
		pagination: { page: number; limit: number },
		filters?: { year?: number; month?: number; status?: string },
	): Promise<TPaginationResult<TJournalEntrySelect>>;
	insertEntry(
		row: {
			organizationId: string;
			code: string;
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
		},
		tx?: TTx,
	): Promise<TJournalEntrySelect>;
	insertLines(
		rows: Array<{
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
		}>,
		tx?: TTx,
	): Promise<TJournalLineSelect[]>;
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
}
