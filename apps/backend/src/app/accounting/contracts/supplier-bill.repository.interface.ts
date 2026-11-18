import type { TTx } from '@drizzle/types';
import type { TSupplierBillSelect } from '@drizzle/schemas/finance.schema';
import type { TPaginationResult } from '@ims-erp/common';

export interface ISupplierBillRepository {
	insertSupplierBill(
		row: {
			organizationId: string;
			code: string;
			supplierId: string;
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
	listSupplierBills(
		organizationId: string,
		filters: { status?: string; supplierId?: string },
		pagination: { page: number; limit: number },
	): Promise<TPaginationResult<TSupplierBillSelect>>;
}
