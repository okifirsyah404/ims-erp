import type { TPoSupplierSnapshot, TPurchaseReturnItemSelect } from '@drizzle/schemas/procurement.schema';
import type { TPurchaseReturnRow } from '../contracts/purchase-return.repository.interface';

/** What happened to the return in the `purchase_return.updated` event. */
export type PurchaseReturnChange = 'submitted' | 'approved' | 'rejected' | 'shipped' | 'cancelled';

/**
 * The `purchase_return.updated` event data sent to n8n (ERP-0068): enough
 * to ask the approver, tell the warehouse to ship, or tell the supplier's PIC
 * the goods are on their way. Amounts are integer IDR minor units.
 */
export function purchaseReturnUpdatedEvent(
	row: TPurchaseReturnRow,
	items: TPurchaseReturnItemSelect[],
	change: PurchaseReturnChange,
	supplier: TPoSupplierSnapshot | null,
	actorUserId: string,
): Record<string, unknown> {
	return {
		returnId: row.id,
		code: row.code,
		change,
		status: row.status,
		returnDate: row.returnDate,
		reason: row.reason,
		rejectionReason: row.rejectionReason,
		cancelledReason: row.cancelledReason,
		goodsReceiptCode: row.goodsReceiptCode,
		purchaseOrderCode: row.purchaseOrderCode,
		supplier: {
			id: row.supplierId,
			code: supplier?.code ?? null,
			name: supplier?.name ?? row.supplierName,
			phone: supplier?.phone ?? null,
			email: supplier?.email ?? null,
			picName: supplier?.picName ?? null,
			picPhone: supplier?.picPhone ?? null,
			picEmail: supplier?.picEmail ?? null,
		},
		lines: items.map((item) => ({
			sku: item.sku,
			name: item.name,
			unit: item.unit,
			quantity: item.quantity,
			serialNumbers: item.serialNumbers ?? [],
		})),
		totalAmount: row.totalAmount,
		currencyCode: row.currencyCode,
		actorUserId,
	};
}
