import { inject, injectable } from 'tsyringe';
import { PURCHASE_ORDER_REPOSITORY_TOKEN } from '../constants/di';
import type { IPurchaseOrderRepository } from '../contracts/procurement.repository.interface';

/**
 * Repository-only purchase-order facade for finance (ERP-0146): the open
 * orders of a project, which finance turns into the budget commitment by
 * subtracting its own bills. Repository-only so finance can read it while
 * procurement asks finance's budget check on approval, without a cycle.
 */
@injectable()
export class ExportedPurchaseOrderService {
	constructor(@inject(PURCHASE_ORDER_REPOSITORY_TOKEN) private readonly orders: Pick<IPurchaseOrderRepository, 'listOpenForProject'>) {}

	/** Approved, sent or (partly) received orders of a project: id and subtotal. */
	openOrdersOfProject(projectId: string): Promise<Array<{ id: string; subtotal: number }>> {
		return this.orders.listOpenForProject(projectId);
	}
}
