import { container } from 'tsyringe';
import { domainPlugin } from '@http/plugin';
import { created, ok, okPaginated } from '@http/response';
import { PURCHASE_ORDER_SERVICE_TOKEN } from '../constants/di';
import {
	purchaseOrderBodySchema,
	purchaseOrderCancelSchema,
	purchaseOrderCloseSchema,
	purchaseOrderDecisionSchema,
	purchaseOrderListQuerySchema,
} from '../contracts/purchase-order.contract';
import { idParamSchema } from '../contracts/params.schema';

/**
 * REST controller for purchase orders (`/purchase-orders`, ADR-0011 step
 * 4a). HTTP concerns only; `purchase_order:*` is enforced by the `erp` guard
 * and every holder of `purchase_order:read` sees every PO (company-wide).
 */
export class PurchaseOrderController {
	static plugin() {
		const service = container.resolve(PURCHASE_ORDER_SERVICE_TOKEN);
		const id = (params: unknown) => idParamSchema.parse(params).id;

		return domainPlugin({ name: 'procurement-purchase-orders', prefix: '/procurement/purchase-orders', tags: ['Procurement'], guards: 'erp' })
			.get('', async ({ query }) => okPaginated(await service.list(purchaseOrderListQuerySchema.parse(query))), {
				erp: { permission: ['purchase_order:read'] },
				detail: { description: 'Paginated purchase orders' },
			})
			.get('/:id', async ({ params }) => ok(await service.get(id(params))), {
				erp: { permission: ['purchase_order:read'] },
				detail: { description: 'One purchase order with its items' },
			})
			.post(
				'',
				async ({ body, erp, status }) =>
					status(201, created(await service.create(erp.session.user.id, purchaseOrderBodySchema.parse(body)))),
				{ erp: { permission: ['purchase_order:create'] }, detail: { description: 'Creates a draft purchase order' } },
			)
			.patch(
				'/:id',
				async ({ params, body }) => ok(await service.update(id(params), purchaseOrderBodySchema.parse(body))),
				{ erp: { permission: ['purchase_order:update'] }, detail: { description: 'Replaces a draft purchase order' } },
			)
			.post('/:id/submit', async ({ params, erp }) => ok(await service.submit(erp.session.user.id, id(params))), {
				erp: { permission: ['purchase_order:submit'] },
				detail: { description: 'Draft → submitted for approval' },
			})
			.post(
				'/:id/decision',
				async ({ params, body, erp }) =>
					ok(await service.decide(erp.session.user.id, id(params), purchaseOrderDecisionSchema.parse(body))),
				{ erp: { permission: ['purchase_order:approve'] }, detail: { description: 'Approves (numbers) or rejects to draft' } },
			)
			.post(
				'/:id/cancel',
				async ({ params, body, erp }) =>
					ok(await service.cancel(erp.session.user.id, id(params), purchaseOrderCancelSchema.parse(body).reason)),
				{ erp: { permission: ['purchase_order:cancel'] }, detail: { description: 'Cancels while nothing was received' } },
			)
			.post(
				'/:id/close',
				async ({ params, body, erp }) =>
					ok(await service.close(erp.session.user.id, id(params), purchaseOrderCloseSchema.parse(body).reason)),
				{
					// B-32: the same people who may cancel an order may close a short delivery.
					erp: { permission: ['purchase_order:cancel'] },
					detail: { description: 'Partially received → closed with a reason; the rest is no longer expected' },
				},
			);
	}
}
