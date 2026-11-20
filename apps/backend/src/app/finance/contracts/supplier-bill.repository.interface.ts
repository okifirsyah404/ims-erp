import type { TTx } from '@drizzle/types';
import type { TSupplierBillSelect } from '@drizzle/schemas/finance.schema';
import type { TPaginationRequest, TPaginationResult } from '@ims-erp/common';

/** Filters of the supplier-bill listing. */
export type TSupplierBillFilters = { status?: string; supplierCompanyId?: string };

/** Page settings, tenant and filters of the supplier-bill listing. */
export type TSupplierBillPaginationRequest = TPaginationRequest &
	TSupplierBillFilters & { organizationId: string };

export interface ISupplierBillRepository {
	insertSupplierBill(
		row: {
			organizationId: string;
			code: string;
			supplierCompanyId: string;
			purchaseOrderId: string | null;
			supplierInvoiceNumber?: string | null;
			billDate: string | null;
			dueDate: string | null;
			subtotal: number;
			taxTotal: number;
			grandTotal: number;
			paidTotal: number;
			outstandingTotal: number;
			currencyCode: string;
			status: string;
			approvedBy: string | null;
			approvedAt: Date | null;
		},
		tx?: TTx,
	): Promise<TSupplierBillSelect>;
	findSupplierBillById(
		organizationId: string,
		id: string,
		tx?: TTx,
	): Promise<TSupplierBillSelect | null>;
	updateSupplierBill(
		organizationId: string,
		id: string,
		patch: Record<string, unknown>,
		tx?: TTx,
	): Promise<TSupplierBillSelect | null>;
	listOpenBillsDueBy(date: string): Promise<TSupplierBillSelect[]>;
	/** Fetches one page of the tenant's supplier bills. */
	paginate(
		request: TSupplierBillPaginationRequest,
	): Promise<TPaginationResult<TSupplierBillSelect>>;
}
