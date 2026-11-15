import type { ErpContext } from '@authorization/elysia-auth';
import {
	type IPermissionResolver,
	PERMISSION_RESOLVER_TOKEN,
} from '@authorization/permission-resolver';
import { container } from 'tsyringe';
import { z } from 'zod';
import { domainPlugin } from '@http/plugin';
import { created, ok, okPaginated } from '@http/response';
import { PURCHASE_RETURN_SERVICE_TOKEN } from '../constants/di';
import {
	purchaseReturnBodySchema,
	purchaseReturnCancelSchema,
	purchaseReturnDecisionSchema,
	purchaseReturnListQuerySchema,
	purchaseReturnShipSchema,
} from '../contracts/purchase-return.contract';
import { idParamSchema } from '../contracts/supplier.contract';
import type { TPurchaseReturnDetail } from '../services/purchase-return.service';

/** Unit cost and totals are restricted to `product:read_cost` (owner, finance, purchasing). */
function withoutCost(detail: TPurchaseReturnDetail, canSeeCost: boolean): TPurchaseReturnDetail {
	if (canSeeCost) return detail;
	return {
		...detail,
		totalAmount: 0,
		items: detail.items.map((item) => ({ ...item, unitCost: 0, lineTotal: 0 })),
	};
}

/**
 * REST controller for purchase returns (`/purchase-returns`, ERP-0061).
 * HTTP concerns only; `purchase_return:*` is enforced by the `erp` guard and
 * every holder of `purchase_return:read` sees every return (company-wide).
 */
export class PurchaseReturnController {
	static plugin() {
		const service = container.resolve(PURCHASE_RETURN_SERVICE_TOKEN);
		const permissions = container.resolve<IPermissionResolver>(PERMISSION_RESOLVER_TOKEN);
		const canSeeCost = (erp: ErpContext) =>
			permissions.hasPermission(erp.organizationId, erp.member.role.split(',').map((role) => role.trim()), {
				product: ['read_cost'],
			});
		const id = (params: unknown) => idParamSchema.parse(params).id;

		return domainPlugin({ name: 'procurement-purchase-returns', prefix: '/purchase-returns', tags: ['Procurement'], guards: 'erp' })
			.get(
				'',
				async ({ query, erp }) => {
					const page = await service.list(purchaseReturnListQuerySchema.parse(query));
					if (await canSeeCost(erp)) return okPaginated(page);
					return okPaginated({ ...page, data: page.data.map((row) => ({ ...row, totalAmount: 0 })) });
				},
				{ erp: { permission: ['purchase_return:read'] }, detail: { description: 'Paginated purchase returns' } },
			)
			.get(
				'/returnable-receipts',
				async ({ query }) =>
					ok(await service.returnableReceipts(z.object({ search: z.string().trim().max(100).optional() }).parse(query).search)),
				{
					erp: { permission: ['purchase_return:create'] },
					detail: { description: 'Goods receipts with goods that can still be returned' },
				},
			)
			.get('/:id', async ({ params, erp }) => ok(withoutCost(await service.get(id(params)), await canSeeCost(erp))), {
				erp: { permission: ['purchase_return:read'] },
				detail: { description: 'One purchase return with its lines' },
			})
			.post(
				'',
				async ({ body, erp, status }) =>
					status(201, created(await service.create(erp.session.user.id, purchaseReturnBodySchema.parse(body)))),
				{ erp: { permission: ['purchase_return:create'] }, detail: { description: 'Creates a draft purchase return from a goods receipt' } },
			)
			.patch('/:id', async ({ params, body }) => ok(await service.update(id(params), purchaseReturnBodySchema.parse(body))), {
				erp: { permission: ['purchase_return:update'] },
				detail: { description: 'Replaces a draft purchase return' },
			})
			.post('/:id/submit', async ({ params, erp }) => ok(await service.submit(erp.session.user.id, id(params))), {
				erp: { permission: ['purchase_return:submit'] },
				detail: { description: 'Draft → submitted for approval' },
			})
			.post(
				'/:id/decision',
				async ({ params, body, erp }) =>
					ok(await service.decide(erp.session.user.id, id(params), purchaseReturnDecisionSchema.parse(body))),
				{ erp: { permission: ['purchase_return:approve'] }, detail: { description: 'Approves (numbers) or rejects to draft' } },
			)
			.post(
				'/:id/ship',
				async ({ params, body, erp }) =>
					ok(
						await service.ship(
							{ userId: erp.session.user.id, organizationId: erp.organizationId },
							id(params),
							purchaseReturnShipSchema.parse(body ?? {}).shipDate,
						),
					),
				{
					erp: { permission: ['purchase_return:ship'] },
					detail: { description: 'Approved → shipped: stock out, serial units returned, PO re-opened' },
				},
			)
			.post(
				'/:id/cancel',
				async ({ params, body, erp }) =>
					ok(await service.cancel(erp.session.user.id, id(params), purchaseReturnCancelSchema.parse(body).reason)),
				{ erp: { permission: ['purchase_return:cancel'] }, detail: { description: 'Cancels a return that was not shipped' } },
			);
	}
}
