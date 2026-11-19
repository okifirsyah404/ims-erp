import { inject, injectable } from 'tsyringe';
import { INVOICE_REPOSITORY_TOKEN } from '../constants/ar-di';
import { DELIVERY_NOTE_REPOSITORY_TOKEN, SALES_ORDER_REPOSITORY_TOKEN, SALES_ORDER_SERVICE_TOKEN } from '../constants/di';
import type { IDeliveryNoteRepository, TDeliveryNoteRow } from '../contracts/delivery-note.repository.interface';
import type { TInvoiceRepository } from '../contracts/invoice.repository.interface';
import type { ISalesOrderRepository } from '../contracts/sales-order.repository.interface';
import type { SalesOrderService, TSalesOrderDetail } from './sales-order.service';

/** Everything public order tracking shows about one sales order (ERP-0073). */
export type TOrderTracking = {
	order: TSalesOrderDetail;
	/** Paid on the order's issued invoices, minor units. */
	paidMinor: number;
	/** The order has issued invoices and every one is paid. */
	fullyPaid: boolean;
	deliveryNotes: TDeliveryNoteRow[];
};

/**
 * Sales' contract for public order tracking (ERP-0073): one order by its
 * number with payment and delivery progress. The caller (the portal module)
 * decides who may see it; this service only reads.
 */
@injectable()
export class OrderTrackingService {
	constructor(
		@inject(SALES_ORDER_REPOSITORY_TOKEN) private readonly orderRows: Pick<ISalesOrderRepository, 'findByCode'>,
		@inject(SALES_ORDER_SERVICE_TOKEN) private readonly orders: Pick<SalesOrderService, 'getForCustomer'>,
		@inject(INVOICE_REPOSITORY_TOKEN) private readonly invoices: Pick<TInvoiceRepository, 'listIssuedForCustomer'>,
		@inject(DELIVERY_NOTE_REPOSITORY_TOKEN) private readonly notes: Pick<IDeliveryNoteRepository, 'listForSalesOrder'>,
	) {}

	/** The order with this number, or `null` (unknown, or without a customer). */
	async findByNumber(orderNumber: string): Promise<TOrderTracking | null> {
		const row = await this.orderRows.findByCode(orderNumber.trim());
		if (!row?.customerId) return null;
		const [order, invoices, deliveryNotes] = await Promise.all([
			this.orders.getForCustomer(row.customerId, row.id),
			this.invoices.listIssuedForCustomer(row.customerId, 500),
			this.notes.listForSalesOrder(row.id),
		]);
		const own = invoices.filter((invoice) => invoice.salesOrderId === row.id);
		return {
			order,
			paidMinor: own.reduce((sum, invoice) => sum + invoice.paidTotal, 0),
			fullyPaid: own.length > 0 && own.every((invoice) => invoice.status === 'paid'),
			deliveryNotes,
		};
	}
}
