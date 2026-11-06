import type { TSalesOrderSelect } from '@drizzle/schemas/sales.schema';
import { inject, injectable } from 'tsyringe';
import { DELIVERY_NOTE_REPOSITORY_TOKEN, SALES_ORDER_REPOSITORY_TOKEN } from '../constants/di';
import type { IDeliveryNoteRepository, TShippedNoteValue } from '../contracts/delivery-note.repository.interface';
import type { ISalesOrderRepository } from '../contracts/sales-order.repository.interface';

/** Order states a project may run against (a live deal). */
const LIVE_STATUSES = ['confirmed', 'in_progress', 'delivered', 'completed'] as const;

/**
 * Sales contract for the Projects module (ADR-0011 step 6a): the deals
 * projects are created from, and the material value already shipped on
 * them. Depends only on Sales repositories, so Projects can use it while
 * Sales asks Projects whether an order has a live project, without a
 * dependency cycle.
 *
 * @remarks
 * No caller visibility here: Projects authorizes its own routes
 * (`project:*`) and project managers work every deal.
 */
@injectable()
export class SalesFulfilmentService {
	constructor(
		@inject(SALES_ORDER_REPOSITORY_TOKEN)
		private readonly orders: Pick<ISalesOrderRepository, 'findById' | 'paginate'>,
		@inject(DELIVERY_NOTE_REPOSITORY_TOKEN)
		private readonly notes: Pick<IDeliveryNoteRepository, 'shippedValues'>,
	) {}

	/** A live (not cancelled) order, or `null`. */
	async getLiveOrder(id: string): Promise<TSalesOrderSelect | null> {
		const order = await this.orders.findById(id);
		return order && order.status !== 'cancelled' ? order : null;
	}

	/** Live orders, newest first (the deal picker of a new project). */
	async listLiveOrders(search?: string): Promise<TSalesOrderSelect[]> {
		const pages = await Promise.all(
			LIVE_STATUSES.map((status) => this.orders.paginate({ page: 1, limit: 50, status, search })),
		);
		return pages
			.flatMap((page) => page.data)
			.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
	}

	/** Shipped / delivered notes of an order at their issue cost. */
	shippedMaterials(salesOrderId: string): Promise<TShippedNoteValue[]> {
		return this.notes.shippedValues(salesOrderId);
	}
}
