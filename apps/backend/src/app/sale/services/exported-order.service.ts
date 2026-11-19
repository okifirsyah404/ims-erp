import { inject, injectable } from 'tsyringe';
import { SALES_ORDER_REPOSITORY_TOKEN } from '../constants/di';
import type { ISalesOrderRepository } from '../contracts/sales-order.repository.interface';

/** What other modules (project) need to know about an order. */
export type TOrderReference = {
	id: string;
	code: string | null;
	status: string;
	customerId: string | null;
	companyId: string | null;
	leadId: string | null;
};

/**
 * Cross-module export facade over sale orders.
 *
 * @remarks
 * `project` resolves `order_id` through this contract before it writes the
 * logical reference (ADR-0014). Repository-only on purpose: it must never
 * depend on a module that itself depends on `sale`.
 */
@injectable()
export class ExportedOrderService {
	constructor(
		@inject(SALES_ORDER_REPOSITORY_TOKEN)
		private readonly orders: Pick<ISalesOrderRepository, 'findById'>,
	) {}

	/** The live order, or `null`. */
	async findOrder(id: string): Promise<TOrderReference | null> {
		const order = await this.orders.findById(id);
		if (!order) return null;
		return {
			id: order.id,
			code: order.code,
			status: order.status,
			customerId: order.customerId,
			companyId: order.companyId,
			leadId: order.leadId,
		};
	}

	/** Whether a live, non-cancelled order exists. */
	async isOrderOpen(id: string): Promise<boolean> {
		const order = await this.findOrder(id);
		return !!order && order.status !== 'cancelled';
	}
}
