import type { TTx } from '@drizzle/types';
import type { TApOpenItemSelect } from '@drizzle/schemas/finance.schema';

export interface IApOpenItemRepository {
	insertApOpenItem(
		row: {
			organizationId: string;
			supplierBillId: string;
			supplierId: string | null;
			billDate: string | null;
			dueDate: string | null;
			originalAmount: number;
			paidAmount: number;
			outstandingAmount: number;
			currencyCode: string;
			status: string;
		},
		tx?: TTx,
	): Promise<TApOpenItemSelect>;
	findApOpenItemByBill(
		organizationId: string,
		supplierBillId: string,
		tx?: TTx,
	): Promise<TApOpenItemSelect | null>;
	updateApOpenItem(
		organizationId: string,
		supplierBillId: string,
		patch: { paidAmount?: number; outstandingAmount?: number; status?: string },
		tx?: TTx,
	): Promise<TApOpenItemSelect | null>;
	/** Aging source: open and partially paid items, optionally per supplier. */
	listApOpenItemsForAging(
		organizationId: string,
		supplierId?: string,
		tx?: TTx,
	): Promise<TApOpenItemSelect[]>;
}
