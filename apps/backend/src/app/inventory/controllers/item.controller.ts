import { container } from 'tsyringe';
import type { ErpContext } from '@authorization/elysia-auth';
import { domainPlugin } from '@http/plugin';
import { created, noContent, ok, okPaginated } from '@http/response';
import {
	createItemSchema,
	itemDeactivateSchema,
	itemIdParamSchema,
	itemListQuerySchema,
	updateItemSchema,
} from '../contracts/item.contract';
import { ITEM_SERVICE_TOKEN } from '../constants/di';
import type { ItemService, TItemActor } from '../services/item.service';

/**
 * Audit actor derived from the guard-resolved session and request headers,
 * never from client input (house pattern — mirrors user-admin.controller).
 */
function auditActor(erp: ErpContext, request: Request): TItemActor {
	return {
		userId: erp.session.user.id,
		email: erp.session.user.email,
		ip: request.headers.get('x-forwarded-for'),
		userAgent: request.headers.get('user-agent'),
	};
}

/**
 * REST controller for items - physical tool/asset units (M06, ADR-0024 Q14).
 *
 * @remarks
 * HTTP concerns only. Authorization rides the existing `asset:*` permission
 * matrix (D16) — no new grants. Delete is soft-only; deactivation carries a
 * mandatory reason (D18).
 */
export class ItemController {
	/** Builds the Elysia plugin mounting `/inventory/items`. */
	static plugin() {
		const itemService = container.resolve<ItemService>(ITEM_SERVICE_TOKEN);

		return domainPlugin({
			name: 'inventory-items',
			prefix: '/inventory/items',
			tags: ['Inventory'],
			guards: 'erp',
		})
			.get(
				'',
				async ({ query, erp }) =>
					okPaginated(
						await itemService.paginate({
							...itemListQuerySchema.parse(query),
							organizationId: erp.organizationId,
						}),
					),
				{
					erp: { permission: ['asset:read'] },
					detail: { description: 'Paginated asset register' },
				},
			)
			.get(
				'/kinds',
				async () => ok(await itemService.listKinds()),
				{
					erp: { permission: ['asset:read'] },
					detail: { description: 'Item kinds for form and filter options' },
				},
			)
			.post(
				'',
				async ({ body, erp, request, status }) =>
					status(
						201,
						created(
							await itemService.registerItem(
								{
									...createItemSchema.parse(body),
									organizationId: erp.organizationId,
								},
								auditActor(erp, request),
							),
						),
					),
				{
					erp: { permission: ['asset:create'] },
					detail: {
						description:
							'Registers an asset; the code is sequence-allocated (ERP-0009)',
					},
				},
			)
			.patch(
				'/:id',
				async ({ params, body, erp, request }) =>
					ok(
						await itemService.updateItem(
							itemIdParamSchema.parse(params).id,
							updateItemSchema.parse(body),
							auditActor(erp, request),
						),
					),
				{
					erp: { permission: ['asset:update'] },
					detail: { description: 'Updates asset master data' },
				},
			)
			.post(
				'/:id/deactivate',
				async ({ params, body, erp, request }) => {
					const { reason } = itemDeactivateSchema.parse(body);
					return ok(
						await itemService.deactivateItem(
							itemIdParamSchema.parse(params).id,
							reason,
							auditActor(erp, request),
						),
					);
				},
				{
					erp: { permission: ['asset:update'] },
					detail: { description: 'Parks an asset with a mandatory reason (D18)' },
				},
			)
			.post(
				'/:id/reactivate',
				async ({ params, erp, request }) =>
					ok(
						await itemService.reactivateItem(
							itemIdParamSchema.parse(params).id,
							auditActor(erp, request),
						),
					),
				{
					erp: { permission: ['asset:update'] },
					detail: { description: 'Brings a parked asset back to in_stock' },
				},
			)
			.delete(
				'/:id',
				async ({ params, erp, request }) => {
					await itemService.archiveItem(
						itemIdParamSchema.parse(params).id,
						auditActor(erp, request),
					);
					return noContent();
				},
				{
					erp: { permission: ['asset:update'] },
					detail: {
						description:
							'Soft-deletes an asset (only path; history blocks it)',
					},
				},
			);
	}
}
