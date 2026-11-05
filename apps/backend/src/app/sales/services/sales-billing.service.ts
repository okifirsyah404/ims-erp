import type { TSalesOrderItemSelect, TSalesOrderSelect } from '@drizzle/schemas/sales.schema';
import { inject, injectable } from 'tsyringe';
import { SALES_ORDER_REPOSITORY_TOKEN } from '../constants/di';
import type { ISalesOrderRepository } from '../contracts/sales-order.repository.interface';

export type TBillableOrder = { order: TSalesOrderSelect; items: TSalesOrderItemSelect[] };

/**
 * Sales contract for the Finance module (ADR-0011 step 3d-2): the orders
 * invoices are issued against. Depends only on Sales repositories, so the
 * Finance module can use it while Sales asks Finance about invoices,
 * without a dependency cycle.
 *
 * @remarks
 * No caller visibility here: Finance authorizes its own routes
 * (`invoice:*`), and billing staff see every order.
 */
@injectable()
export class SalesBillingService {
	constructor(
		@inject(SALES_ORDER_REPOSITORY_TOKEN)
		private readonly orders: Pick<ISalesOrderRepository, 'findById' | 'findItems'>,
	) {}

	/** A live (not cancelled) order with its lines, or `null`. */
	async getOrderForBilling(id: string): Promise<TBillableOrder | null> {
		const order = await this.orders.findById(id);
		if (!order || order.status === 'cancelled') return null;
		return { order, items: await this.orders.findItems(id) };
	}

	/** Any order with its lines (cancelled included), for printing issued invoices. */
	async getOrderForPrint(id: string): Promise<TBillableOrder | null> {
		const order = await this.orders.findById(id);
		return order ? { order, items: await this.orders.findItems(id) } : null;
	}
}
