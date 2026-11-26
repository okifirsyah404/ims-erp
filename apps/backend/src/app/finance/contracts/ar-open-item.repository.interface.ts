import type { TTx } from '@drizzle/types';
import type { TArOpenItemSelect } from '@drizzle/schemas/finance.schema';

/** Columns the settlement, credit-memo and write-off flows may change (ERP-0135). */
export type TArOpenItemPatch = Partial<{
	originalAmount: number;
	paidAmount: number;
	outstandingAmount: number;
	adjustedAmount: number;
	status: string;
	writeOffReason: string | null;
	writeOffRequestedBy: string | null;
	writeOffRequestedAt: Date | null;
	writtenOffBy: string | null;
	writtenOffAt: Date | null;
	writeOffEntryId: string | null;
}>;

export interface IArOpenItemRepository {
	insertArOpenItem(
		row: {
			organizationId: string;
			/** `null` for an opening item without an invoice (ERP-0142). */
			invoiceId: string | null;
			customerId: string | null;
			invoiceDate: string | null;
			dueDate: string | null;
			originalAmount: number;
			paidAmount: number;
			outstandingAmount: number;
			currencyCode: string;
			status: string;
		},
		tx?: TTx,
	): Promise<TArOpenItemSelect>;
	findArOpenItemByInvoice(
		organizationId: string,
		invoiceId: string,
		tx?: TTx,
	): Promise<TArOpenItemSelect | null>;
	updateArOpenItem(
		organizationId: string,
		invoiceId: string,
		patch: TArOpenItemPatch,
		tx?: TTx,
	): Promise<TArOpenItemSelect | null>;
	/** Aging source: open and partially paid items, optionally per customer. */
	/** Open items with a pending write-off request, oldest request first. */
	listWriteOffRequests(organizationId: string): Promise<TArOpenItemSelect[]>;
	listArOpenItemsForAging(
		organizationId: string,
		customerId?: string,
		tx?: TTx,
	): Promise<TArOpenItemSelect[]>;
}
