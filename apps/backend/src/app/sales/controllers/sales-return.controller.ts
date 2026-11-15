import type { ErpContext } from '@authorization/elysia-auth';
import {
	type IPermissionResolver,
	PERMISSION_RESOLVER_TOKEN,
} from '@authorization/permission-resolver';
import { container } from 'tsyringe';
import { z } from 'zod';
import { domainPlugin } from '@http/plugin';
import { created, ok, okPaginated } from '@http/response';
import { SALES_RETURN_SERVICE_TOKEN } from '../constants/di';
import {
	salesReturnBodySchema,
	salesReturnCancelSchema,
	salesReturnDecisionSchema,
	salesReturnListQuerySchema,
	salesReturnReceiveSchema,
} from '../contracts/sales-return.contract';
import type { TSalesReturnDetail } from '../services/sales-return.service';

/** The delivery cost booked back into stock is restricted to `product:read_cost`. */
function withoutCost(detail: TSalesReturnDetail, canSeeCost: boolean): TSalesReturnDetail {
	if (canSeeCost) return detail;
	return { ...detail, items: detail.items.map((item) => ({ ...item, unitCost: 0 })) };
}

/**
 * REST controller for sales returns (`/sales-returns`, ERP-0062). HTTP
 * concerns only; `sales_return:*` is enforced by the `erp` guard and every
 * holder of `sales_return:read` sees every return (company-wide, like
 * delivery notes).
 */
export class SalesReturnController {
	static plugin() {
		const service = container.resolve(SALES_RETURN_SERVICE_TOKEN);
		const permissions = container.resolve<IPermissionResolver>(PERMISSION_RESOLVER_TOKEN);
		const canSeeCost = (erp: ErpContext) =>
			permissions.hasPermission(erp.organizationId, erp.member.role.split(',').map((role) => role.trim()), {
				product: ['read_cost'],
			});
		const id = (params: unknown) => z.object({ id: z.uuid() }).parse(params).id;

		return domainPlugin({ name: 'sales-returns', prefix: '/sales-returns', tags: ['Sales'], guards: 'erp' })
			.get('', async ({ query }) => okPaginated(await service.list(salesReturnListQuerySchema.parse(query))), {
				erp: { permission: ['sales_return:read'] },
				detail: { description: 'Paginated sales returns' },
			})
			.get(
				'/returnable-deliveries',
				async ({ query }) =>
					ok(await service.returnableDeliveries(z.object({ search: z.string().trim().max(100).optional() }).parse(query).search)),
				{
					erp: { permission: ['sales_return:create'] },
					detail: { description: 'Shipped delivery notes with goods that can still come back' },
				},
			)
			.get('/:id', async ({ params, erp }) => ok(withoutCost(await service.get(id(params)), await canSeeCost(erp))), {
				erp: { permission: ['sales_return:read'] },
				detail: { description: 'One sales return with its lines' },
			})
			.post(
				'',
				async ({ body, erp, status }) =>
					status(201, created(await service.create(erp.session.user.id, salesReturnBodySchema.parse(body)))),
				{ erp: { permission: ['sales_return:create'] }, detail: { description: 'Creates a draft sales return from a delivery note' } },
			)
			.patch('/:id', async ({ params, body }) => ok(await service.update(id(params), salesReturnBodySchema.parse(body))), {
				erp: { permission: ['sales_return:update'] },
				detail: { description: 'Replaces a draft sales return' },
			})
			.post('/:id/submit', async ({ params, erp }) => ok(await service.submit(erp.session.user.id, id(params))), {
				erp: { permission: ['sales_return:submit'] },
				detail: { description: 'Draft → submitted for approval' },
			})
			.post(
				'/:id/decision',
				async ({ params, body, erp }) =>
					ok(await service.decide(erp.session.user.id, id(params), salesReturnDecisionSchema.parse(body))),
				{ erp: { permission: ['sales_return:approve'] }, detail: { description: 'Approves (numbers) or rejects to draft' } },
			)
			.post(
				'/:id/receive',
				async ({ params, body, erp }) =>
					ok(
						await service.receive(
							{ userId: erp.session.user.id, organizationId: erp.organizationId },
							id(params),
							salesReturnReceiveSchema.parse(body),
						),
					),
				{
					erp: { permission: ['sales_return:receive'] },
					detail: { description: 'Approved → received: stock in per condition, order re-opened for the replacement' },
				},
			)
			.post(
				'/:id/cancel',
				async ({ params, body, erp }) =>
					ok(await service.cancel(erp.session.user.id, id(params), salesReturnCancelSchema.parse(body).reason)),
				{ erp: { permission: ['sales_return:cancel'] }, detail: { description: 'Cancels a return that was not received' } },
			);
	}
}
