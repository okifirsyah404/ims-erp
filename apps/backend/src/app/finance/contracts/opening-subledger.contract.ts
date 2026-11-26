import type { TOpeningSubledgerItemSelect } from '@drizzle/schemas/finance.schema';
import type { TTx } from '@drizzle/types';

export type TSubledger = 'ar' | 'ap';

/** One validated import row (minor units, business dates). */
export type TOpeningSubledgerRow = {
	customerId: string | null;
	supplierCompanyId: string | null;
	partyCode: string;
	partyName: string;
	documentNumber: string;
	documentDate: string;
	dueDate: string | null;
	amount: number;
};

/** One problem in an imported CSV row; `code` is translated by the web admin. */
export type TOpeningSubledgerError = { row: number; code: string; value: string };

export type TOpeningSubledgerImportResult = { imported: number; total: number; errors: TOpeningSubledgerError[] };

/** A ledger's draft total against its control account's draft opening row. */
export type TSubledgerTie = {
	ledger: TSubledger;
	items: number;
	total: number;
	controlAccountId: string | null;
	control: number;
	tied: boolean;
	posted: number;
};

/** Persistence port of `finance.opening_subledger_items` (ERP-0142). */
export interface IOpeningSubledgerRepository {
	list(organizationId: string, ledger?: TSubledger): Promise<TOpeningSubledgerItemSelect[]>;
	/** Soft-deletes the unposted rows of the ledger and inserts `rows`. */
	replaceDrafts(
		organizationId: string,
		ledger: TSubledger,
		asOfDate: string,
		createdBy: string,
		rows: TOpeningSubledgerRow[],
		tx?: TTx,
	): Promise<void>;
	discardDrafts(organizationId: string, ledger: TSubledger): Promise<number>;
	markPosted(
		organizationId: string,
		id: string,
		links: { arOpenItemId?: string; supplierBillId?: string; apOpenItemId?: string },
		tx?: TTx,
	): Promise<void>;
}
