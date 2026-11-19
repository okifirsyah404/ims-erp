import type { TSupplierBillSelect } from '@drizzle/schemas/finance.schema';

/** Supplier contact as the events carry it (never the bank details). */
export type TBillEventSupplier = {
	id: string;
	code: string | null;
	name: string | null;
	phone: string | null;
	email: string | null;
	picName: string | null;
	picPhone: string | null;
};

/**
 * Data of the supplier bill events sent to n8n (ERP-0012):
 * `supplier_bill.recorded` (the payable is booked) and `supplier_bill.due`
 * (daily reminder). Amounts are integer IDR minor units.
 */
export function supplierBillEvent(
	bill: TSupplierBillSelect,
	supplier: TBillEventSupplier | null,
	extra: Record<string, unknown> = {},
): Record<string, unknown> {
	return {
		billId: bill.id,
		organizationId: bill.organizationId,
		code: bill.code,
		supplierInvoiceNumber: bill.supplierInvoiceNumber,
		purchaseOrderId: bill.purchaseOrderId,
		status: bill.status,
		billDate: bill.billDate,
		dueDate: bill.dueDate,
		grandTotal: bill.grandTotal,
		paidTotal: bill.paidTotal,
		outstandingTotal: bill.outstandingTotal,
		currencyCode: bill.currencyCode,
		supplier: supplier ?? { id: bill.supplierCompanyId, code: null, name: null, phone: null, email: null, picName: null, picPhone: null },
		...extra,
	};
}

/** Reminder threshold for a bill due `daysLeft` days from today: 7, 0 (due or overdue), or none. */
export function billDueThreshold(daysLeft: number): 7 | 0 | null {
	if (daysLeft <= 0) return 0;
	if (daysLeft <= 7) return 7;
	return null;
}
