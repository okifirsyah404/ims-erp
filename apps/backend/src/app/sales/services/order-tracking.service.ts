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
	/** The order's issued invoices (document links, ERP-0080). */
	invoiceIds: { id: string; code: string | null; issueDate: string | null }[];
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
		@inject(SALES_ORDER_SERVICE_TOKEN) private readonly orders: Pick<SalesOrderService, 'getForCustomer' | 'listForCustomer'>,
		@inject(INVOICE_REPOSITORY_TOKEN) private readonly invoices: Pick<TInvoiceRepository, 'listIssuedForCustomer'>,
		@inject(DELIVERY_NOTE_REPOSITORY_TOKEN) private readonly notes: Pick<IDeliveryNoteRepository, 'listForSalesOrder'>,
	) {}

	/** The order with this number, or `null` (unknown, or without a customer). */
	async findByNumber(orderNumber: string): Promise<TOrderTracking | null> {
		const row = await this.orderRows.findByCode(orderNumber.trim());
		if (!row?.customerId) return null;
		return this.track(row.customerId, row.id);
	}

	/**
	 * One order of a customer (the portal's order and tracking pages, ERP-0080).
	 *
	 * @throws {SalesOrderNotFoundError} another customer's order (from `getForCustomer`)
	 */
	forCustomer(customerId: string, orderId: string): Promise<TOrderTracking> {
		return this.track(customerId, orderId);
	}

	/** Every order of a customer with its progress, newest first (ERP-0080). */
	async listForCustomer(customerId: string): Promise<TOrderTracking[]> {
		const [rows, invoices] = await Promise.all([this.orders.listForCustomer(customerId), this.invoices.listIssuedForCustomer(customerId, 500)]);
		return Promise.all(rows.map((row) => this.track(customerId, row.id, invoices)));
	}

	private async track(customerId: string, orderId: string, issued?: Awaited<ReturnType<TInvoiceRepository['listIssuedForCustomer']>>): Promise<TOrderTracking> {
		const [order, invoices, deliveryNotes] = await Promise.all([
			this.orders.getForCustomer(customerId, orderId),
			issued ?? this.invoices.listIssuedForCustomer(customerId, 500),
			this.notes.listForSalesOrder(orderId),
		]);
		const own = invoices.filter((invoice) => invoice.salesOrderId === orderId);
		return {
			order,
			paidMinor: own.reduce((sum, invoice) => sum + invoice.paidTotal, 0),
			fullyPaid: own.length > 0 && own.every((invoice) => invoice.status === 'paid'),
			invoiceIds: own.map((invoice) => ({ id: invoice.id, code: invoice.code, issueDate: invoice.issueDate })),
			deliveryNotes,
		};
	}
}
