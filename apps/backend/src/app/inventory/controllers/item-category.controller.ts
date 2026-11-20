import { container } from 'tsyringe';
import type { ErpContext } from '@authorization/elysia-auth';
import { domainPlugin } from '@http/plugin';
import { created, noContent, ok, okPaginated } from '@http/response';
import {
	itemCategoryCreateSchema,
	itemCategoryListQuerySchema,
	itemCategoryUpdateSchema,
	itemIdParamSchema,
} from '../contracts/item.contract';
import { ITEM_CATEGORY_SERVICE_TOKEN } from '../constants/di';
import type {
	ItemCategoryService,
} from '../services/item-category.service';
import type { TInventoryAuditActor } from '../constants/audit-actor';

/**
 * Audit actor derived from the guard-resolved session and request headers,
 * never from client input (house pattern).
 */
function auditActor(erp: ErpContext, request: Request): TInventoryAuditActor {
	return {
		userId: erp.session.user.id,
		email: erp.session.user.email,
		ip: request.headers.get('x-forwarded-for'),
		userAgent: request.headers.get('user-agent'),
	};
}

/**
 * REST controller for item (asset) categories.
 *
 * @remarks
 * Categories are master data gating asset creation, so writes need
 * `asset:create`/`asset:update` — reads need only `asset:read` (D16, no
 * new grants).
 */
export class ItemCategoryController {
	/** Builds the Elysia plugin mounting `/inventory/item-categories`. */
	static plugin() {
		const categoryService = container.resolve<ItemCategoryService>(
			ITEM_CATEGORY_SERVICE_TOKEN,
		);

		return domainPlugin({
			name: 'inventory-item-categories',
			prefix: '/inventory/item-categories',
			tags: ['Inventory'],
			guards: 'erp',
		})
			.get(
				'',
				async ({ query, erp }) =>
					okPaginated(
						await categoryService.paginate({
							...itemCategoryListQuerySchema.parse(query),
							organizationId: erp.organizationId,
						}),
					),
				{
					erp: { permission: ['asset:read'] },
					detail: { description: 'Paginated asset categories' },
				},
			)
			.get(
				'/:id',
				async ({ params }) =>
					ok(
						await categoryService.getCategory(
							itemIdParamSchema.parse(params).id,
						),
					),
				{
					erp: { permission: ['asset:read'] },
					detail: { description: 'One asset category' },
				},
			)
			.post(
				'',
				async ({ body, erp, request, status }) => {
					const parsed = itemCategoryCreateSchema.parse(body);
					return status(
						201,
						created(
							await categoryService.createCategory(
								{
									...parsed,
									organizationId: erp.organizationId,
								},
								auditActor(erp, request),
							),
						),
					);
				},
				{
					erp: { permission: ['asset:create'] },
					detail: { description: 'Creates an asset category' },
				},
			)
			.patch(
				'/:id',
				async ({ params, body, erp, request }) =>
					ok(
						await categoryService.updateCategory(
							itemIdParamSchema.parse(params).id,
							itemCategoryUpdateSchema.parse(body),
							auditActor(erp, request),
						),
					),
				{
					erp: { permission: ['asset:update'] },
					detail: { description: 'Updates an asset category' },
				},
			)
			.delete(
				'/:id',
				async ({ params, erp, request }) => {
					await categoryService.archiveCategory(
						itemIdParamSchema.parse(params).id,
						auditActor(erp, request),
					);
					return noContent();
				},
				{
					erp: { permission: ['asset:update'] },
					detail: { description: 'Soft-deletes an asset category' },
				},
			);
	}
}
