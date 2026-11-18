import { container } from 'tsyringe';
import type { ErpContext } from '@authorization/elysia-auth';
import { domainPlugin } from '@http/plugin';
import { created, ok, okPaginated } from '@http/response';
import { PURCHASE_REQUEST_SERVICE_TOKEN } from '../constants/di';
import {
	openLinesQuerySchema,
	purchaseRequestBodySchema,
	purchaseRequestCancelSchema,
	purchaseRequestListQuerySchema,
	requestableItemsQuerySchema,
} from '../contracts/purchase-request.contract';
import { idParamSchema } from '../contracts/supplier.contract';

/**
 * REST controller for purchase requests (`/purchase-requests`, M05). HTTP
 * concerns only; `purchase_request:*` is enforced by the `erp` guard, every
 * holder of `purchase_request:read` sees every request (company-wide), and the
 * service checks the requester for edits, submits and cancels.
 */
export class PurchaseRequestController {
	static plugin() {
		const service = container.resolve(PURCHASE_REQUEST_SERVICE_TOKEN);
		const id = (params: unknown) => idParamSchema.parse(params).id;
		const actor = (erp: ErpContext) => ({
			userId: erp.session.user.id,
			name: erp.session.user.name ?? null,
			organizationId: erp.organizationId,
		});

		return domainPlugin({ name: 'procurement-purchase-requests', prefix: '/purchase-requests', tags: ['Procurement'], guards: 'erp' })
			.get(
				'',
				async ({ query, erp }) => okPaginated(await service.list(purchaseRequestListQuerySchema.parse(query), erp.session.user.id)),
				{
					erp: { permission: ['purchase_request:read'] },
					detail: { description: 'Paginated purchase requests (company-wide; mine=true for the caller own ones)' },
				},
			)
			.get('/items', async ({ query }) => ok(await service.searchItems(requestableItemsQuerySchema.parse(query).search)), {
				erp: { permission: ['purchase_request:create'] },
				detail: { description: 'Active items a requester may ask for (search by SKU or name)' },
			})
			.get('/open-lines', async ({ query }) => ok(await service.openLines(openLinesQuerySchema.parse(query))), {
				erp: { permission: ['purchase_request:read', 'purchase_order:create'] },
				detail: { description: 'Approved request lines not yet on a live purchase order' },
			})
			.get('/:id', async ({ params }) => ok(await service.get(id(params))), {
				erp: { permission: ['purchase_request:read'] },
				detail: { description: 'One purchase request with its lines and the POs ordering them' },
			})
			.post(
				'',
				async ({ body, erp, status }) => status(201, created(await service.create(actor(erp), purchaseRequestBodySchema.parse(body)))),
				{ erp: { permission: ['purchase_request:create'] }, detail: { description: 'Creates a draft purchase request' } },
			)
			.patch(
				'/:id',
				async ({ params, body, erp }) => ok(await service.update(erp.session.user.id, id(params), purchaseRequestBodySchema.parse(body))),
				{ erp: { permission: ['purchase_request:create'] }, detail: { description: 'Replaces the requester own draft' } },
			)
			.post('/:id/submit', async ({ params, erp }) => ok(await service.submit(erp.session.user.id, id(params))), {
				erp: { permission: ['purchase_request:submit'] },
				detail: { description: 'Draft to submitted (numbered on the first submit)' },
			})
			.post('/:id/approve', async ({ params, erp }) => ok(await service.approve(erp.session.user.id, id(params))), {
				erp: { permission: ['purchase_request:approve'] },
				detail: { description: 'Submitted to approved; never one own request' },
			})
			.post(
				'/:id/reject',
				async ({ params, body, erp }) =>
					ok(await service.reject(erp.session.user.id, id(params), purchaseRequestCancelSchema.parse(body).reason)),
				{ erp: { permission: ['purchase_request:reject'] }, detail: { description: 'Submitted back to draft with the reason' } },
			)
			.post(
				'/:id/cancel',
				async ({ params, body, erp }) =>
					ok(await service.cancel(erp.session.user.id, id(params), purchaseRequestCancelSchema.parse(body).reason)),
				{ erp: { permission: ['purchase_request:create'] }, detail: { description: 'The requester cancels while no line is ordered' } },
			);
	}
}
