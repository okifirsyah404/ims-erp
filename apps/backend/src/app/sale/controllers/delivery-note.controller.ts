import type { ErpContext } from '@authorization/elysia-auth';
import {
	type IPermissionResolver,
	PERMISSION_RESOLVER_TOKEN,
} from '@authorization/permission-resolver';
import type { ErpPermissionRequest } from '@ims-erp/common';
import { container } from 'tsyringe';
import { z } from 'zod';
import { domainPlugin } from '@http/plugin';
import { created, ok, okPaginated } from '@http/response';
import { DELIVERY_NOTE_SERVICE_TOKEN } from '../constants/di';
import {
	cancelDeliveryNoteSchema,
	createDeliveryNoteSchema,
	deliverDeliveryNoteSchema,
	deliveryNoteListQuerySchema,
} from '../contracts/delivery-note.contract';
import { DeliveryNoteReadForbiddenError } from '../errors/delivery-note.errors';
import type { TDeliveryNoteDetail } from '../services/delivery-note.service';

/** Line cost (COGS) is restricted to `product:read_cost`. */
function withoutCost(detail: TDeliveryNoteDetail, canSeeCost: boolean): TDeliveryNoteDetail {
	if (canSeeCost) return detail;
	return { ...detail, items: detail.items.map((item) => ({ ...item, unitCost: null })) };
}

/**
 * REST controller for delivery notes (`/delivery-notes`, ADR-0011 step 5a).
 *
 * @remarks
 * Preparing, shipping, confirming delivery and cancelling need
 * `stock:issue` (warehouse, owner). Reading needs `stock:read` **or**
 * `sales_order:read`, so sales staff can follow their orders' deliveries;
 * the `erp` guard requires all listed permissions, so the either-or check
 * is done here.
 */
export class DeliveryNoteController {
	static plugin() {
		const service = container.resolve(DELIVERY_NOTE_SERVICE_TOKEN);
		const permissions = container.resolve<IPermissionResolver>(PERMISSION_RESOLVER_TOKEN);
		const can = (erp: ErpContext, request: ErpPermissionRequest) =>
			permissions.hasPermission(erp.organizationId, erp.member.role.split(',').map((role) => role.trim()), request);
		const assertReadable = async (erp: ErpContext) => {
			const [stock, orders] = await Promise.all([can(erp, { stock: ['read'] }), can(erp, { sales_order: ['read'] })]);
			if (!stock && !orders) throw new DeliveryNoteReadForbiddenError();
		};
		const present = async (erp: ErpContext, detail: TDeliveryNoteDetail) =>
			withoutCost(detail, await can(erp, { product: ['read_cost'] }));
		const id = (params: unknown) => z.object({ id: z.uuid() }).parse(params).id;
		const actor = (erp: ErpContext) => ({ userId: erp.session.user.id, organizationId: erp.organizationId });

		return domainPlugin({ name: 'sales-delivery-notes', prefix: '/sales/delivery-notes', tags: ['Sales'], guards: 'erp' })
			.get(
				'',
				async ({ query, erp }) => {
					await assertReadable(erp);
					return okPaginated(await service.list(deliveryNoteListQuerySchema.parse(query)));
				},
				{ erp: {}, detail: { description: 'Paginated delivery notes' } },
			)
			.get('/warehouses', async () => ok(await service.shippingWarehouses()), {
				erp: { permission: ['stock:issue'] },
				detail: { description: 'Warehouses and storages goods can be shipped from' },
			})
			.get(
				'/deliverable-orders',
				async ({ query }) =>
					ok(await service.deliverableOrders(z.object({ search: z.string().trim().max(100).optional() }).parse(query).search)),
				{ erp: { permission: ['stock:issue'] }, detail: { description: 'Sales orders with something left to deliver' } },
			)
			.get(
				'/serials',
				async ({ query }) => {
					const { productId, warehouseId } = z.object({ productId: z.uuid(), warehouseId: z.uuid() }).parse(query);
					return ok(await service.inStockSerials(productId, warehouseId));
				},
				{ erp: { permission: ['stock:issue'] }, detail: { description: 'Serial numbers of an item in stock in a warehouse' } },
			)
			.get(
				'/:id',
				async ({ params, erp }) => {
					await assertReadable(erp);
					return ok(await present(erp, await service.get(id(params))));
				},
				{ erp: {}, detail: { description: 'One delivery note with its lines' } },
			)
			.post(
				'',
				async ({ body, erp, status }) =>
					status(
						201,
						created(await present(erp, await service.create(erp.session.user.id, createDeliveryNoteSchema.parse(body)))),
					),
				{ erp: { permission: ['stock:issue'] }, detail: { description: 'Prepares (and numbers) a delivery note' } },
			)
			.post('/:id/ship', async ({ params, erp }) => ok(await present(erp, await service.ship(actor(erp), id(params)))), {
				erp: { permission: ['stock:issue'] },
				detail: { description: 'Ships a prepared note: stock issue at average cost, serial units sold' },
			})
			.post(
				'/:id/deliver',
				async ({ params, body, erp }) =>
					ok(await present(erp, await service.deliver(id(params), deliverDeliveryNoteSchema.parse(body)))),
				{ erp: { permission: ['stock:issue'] }, detail: { description: 'Records who received a shipped note' } },
			)
			.post(
				'/:id/cancel',
				async ({ params, body, erp }) =>
					ok(
						await present(
							erp,
							await service.cancel(erp.session.user.id, id(params), cancelDeliveryNoteSchema.parse(body).reason),
						),
					),
				{ erp: { permission: ['stock:issue'] }, detail: { description: 'Cancels a prepared note' } },
			);
	}
}
