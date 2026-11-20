import { PROJECT_PORTAL_SERVICE_TOKEN } from '@app/projects/constants/di';
import type { ProjectPortalService } from '@app/projects/services/project-portal.service';
import { ORDER_TRACKING_SERVICE_TOKEN } from '@app/sales/constants/di';
import type { OrderTrackingService } from '@app/sales/services/order-tracking.service';
import type { PortalContext } from '@authorization/portal-auth';
import { inject, injectable } from 'tsyringe';
import type { TTrackedOrder } from './public-tracking.service';

/**
 * The signed-in customer's orders with their real progress (ERP-0080): Sales gives
 * the order with payment and delivery notes (courier, waybill), Projects the
 * installation. The order and tracking pages read the same stages as the website's
 * public tracking.
 */
@injectable()
export class PortalOrderTrackingService {
	constructor(
		@inject(ORDER_TRACKING_SERVICE_TOKEN) private readonly orders: Pick<OrderTrackingService, 'forCustomer' | 'listForCustomer'>,
		@inject(PROJECT_PORTAL_SERVICE_TOKEN) private readonly projects: Pick<ProjectPortalService, 'findForSalesOrder'>,
	) {}

	async list(portal: PortalContext): Promise<TTrackedOrder[]> {
		const orders = await this.orders.listForCustomer(portal.customerId);
		return Promise.all(orders.map(async (tracking) => ({ ...tracking, project: await this.projects.findForSalesOrder(tracking.order.id) })));
	}

	/** @throws {SalesOrderNotFoundError} another customer's order */
	async get(portal: PortalContext, orderId: string): Promise<TTrackedOrder> {
		const tracking = await this.orders.forCustomer(portal.customerId, orderId);
		return { ...tracking, project: await this.projects.findForSalesOrder(tracking.order.id) };
	}
}
