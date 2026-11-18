import type { TTx } from '@drizzle/types';
import type { TArOpenItemSelect } from '@drizzle/schemas/finance.schema';

export interface IArOpenItemRepository {
	insertArOpenItem(
		row: {
			organizationId: string;
			salesInvoiceId: string;
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
		salesInvoiceId: string,
		tx?: TTx,
	): Promise<TArOpenItemSelect | null>;
	updateArOpenItem(
		organizationId: string,
		salesInvoiceId: string,
		patch: { paidAmount?: number; outstandingAmount?: number; status?: string },
		tx?: TTx,
	): Promise<TArOpenItemSelect | null>;
	/** Aging source: open and partially paid items, optionally per customer. */
	listArOpenItemsForAging(
		organizationId: string,
		customerId?: string,
		tx?: TTx,
	): Promise<TArOpenItemSelect[]>;
}
