import type { TCustomerSnapshot, TReturnItemSelect } from '@drizzle/schemas/sale.schema';
import type { TSalesReturnRow } from '../contracts/sales-return.repository.interface';

/** What happened to the return in the `sales_return.updated` event. */
export type SalesReturnChange = 'submitted' | 'approved' | 'rejected' | 'received' | 'cancelled';

/**
 * The `sales_return.updated` event data sent to n8n (ERP-0065): enough to
 * ask the approver, tell the warehouse goods are coming, or tell the
 * customer the return was accepted / received. Amounts are integer IDR
 * minor units.
 */
export function salesReturnUpdatedEvent(
	row: TSalesReturnRow,
	items: TReturnItemSelect[],
	change: SalesReturnChange,
	customer: TCustomerSnapshot | null,
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
		deliveryNoteCode: row.deliveryNoteCode,
		orderCode: row.orderCode,
		customer: {
			id: row.customerId,
			code: customer?.code ?? null,
			name: customer?.name ?? row.customerName,
			email: customer?.email ?? null,
			phone: customer?.phone ?? null,
			whatsapp: customer?.phone ?? null,
		},
		lines: items.map((item) => ({
			sku: item.sku,
			name: item.name,
			unit: item.unit,
			quantity: item.quantity,
			serialNumbers: item.serialNumbers ?? [],
			condition: item.condition,
		})),
		totalAmount: row.totalAmount,
		currencyCode: row.currencyCode,
		actorUserId,
	};
}
