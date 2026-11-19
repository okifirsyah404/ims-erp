import type { ErpContext } from '@authorization/elysia-auth';
import {
	type IPermissionResolver,
	PERMISSION_RESOLVER_TOKEN,
} from '@authorization/permission-resolver';
import type { ErpPermissionRequest } from '@ims-erp/common';
import { container } from 'tsyringe';
import { domainPlugin } from '@http/plugin';
import { created, ok, okPaginated } from '@http/response';
import { SALES_ORDER_SERVICE_TOKEN } from '../constants/di';
import {
	cancelSalesOrderSchema,
	createSalesOrderSchema,
	salesOrderIdParamSchema,
	salesOrderListQuerySchema,
} from '../contracts/sales-order.contract';
import type { TSalesOrderContext } from '../services/sales-order.service';

/**
 * REST controller for sales orders (`/sales/orders`, ADR-0011 step 3d).
 *
 * @remarks
 * HTTP concerns only. Visibility flags come from the same dynamic
 * permission resolver the `erp` guard uses.
 */
export class SalesOrderController {
	static plugin() {
		const service = container.resolve(SALES_ORDER_SERVICE_TOKEN);
		const permissions = container.resolve<IPermissionResolver>(PERMISSION_RESOLVER_TOKEN);

		const context = async (erp: ErpContext): Promise<TSalesOrderContext> => {
			const roles = erp.member.role.split(',').map((role) => role.trim());
			const can = (request: ErpPermissionRequest) => permissions.hasPermission(erp.organizationId, roles, request);
			const [approve, exportAll, invoices, quotationApprove, quotationExport] = await Promise.all([
				can({ sales_order: ['approve'] }),
				can({ sales_order: ['export'] }),
				can({ invoice: ['read'] }),
				can({ quotation: ['approve'] }),
				can({ quotation: ['export'] }),
			]);
			return {
				actorUserId: erp.session.user.id,
				canViewAll: approve || exportAll || invoices,
				canUseAnyQuotation: quotationApprove || quotationExport,
			};
		};
		const id = (params: unknown) => salesOrderIdParamSchema.parse(params).id;

		return domainPlugin({ name: 'sales-orders', prefix: '/sales/orders', tags: ['Sales'], guards: 'erp' })
			.get(
				'',
				async ({ query, erp }) =>
					okPaginated(await service.list(await context(erp), salesOrderListQuerySchema.parse(query))),
				{ erp: { permission: ['sales_order:read'] }, detail: { description: 'Paginated sales orders visible to the caller' } },
			)
			.get('/:id', async ({ params, erp }) => ok(await service.get(await context(erp), id(params))), {
				erp: { permission: ['sales_order:read'] },
				detail: { description: 'One sales order with items and status history' },
			})
			.post(
				'',
				async ({ body, erp, status }) =>
					status(201, created(await service.create(await context(erp), createSalesOrderSchema.parse(body)))),
				{
					erp: { permission: ['sales_order:create'] },
					detail: { description: 'Creates a sales order from an approved or sent quotation (the quotation becomes Deal)' },
				},
			)
			.post(
				'/:id/cancel',
				async ({ params, body, erp }) =>
					ok(await service.cancel(await context(erp), id(params), cancelSalesOrderSchema.parse(body).reason)),
				{
					erp: { permission: ['sales_order:cancel'] },
					detail: { description: 'Cancels a confirmed order and reopens its quotation' },
				},
			);
	}
}
