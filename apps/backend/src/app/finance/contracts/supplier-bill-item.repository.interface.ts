import type { TTx } from '@drizzle/types';
import type { TSupplierBillItemInsert, TSupplierBillItemSelect } from '@drizzle/schemas/finance.schema';

/** Queries of `finance.supplier_bill_items` (ERP-0012: bills made from a purchase order). */
export interface ISupplierBillItemRepository {
	insertSupplierBillItems(
		rows: Omit<TSupplierBillItemInsert, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>[],
		tx?: TTx,
	): Promise<TSupplierBillItemSelect[]>;
	findSupplierBillItems(
		organizationId: string,
		supplierBillId: string,
		tx?: TTx,
	): Promise<TSupplierBillItemSelect[]>;
	/** Quantity billed per purchase order line on live bills, in thousandths, across organizations. */
	billedQuantities(purchaseOrderItemIds: string[], tx?: TTx): Promise<Map<string, bigint>>;
	/** Transaction-scoped advisory lock serializing bills of one purchase order. */
	lockPurchaseOrderBilling(purchaseOrderId: string, tx: TTx): Promise<void>;
}
