import { container } from 'tsyringe';
import { domainPlugin } from '@http/plugin';
import { created, ok } from '@http/response';
import { ITEM_CATEGORY_SERVICE_TOKEN } from '../constants/di';
import {
	createItemCategorySchema,
	itemCategoryListQuerySchema,
	updateItemCategorySchema,
} from '../contracts/item-category.contract';
import { idParamSchema } from '../contracts/item.contract';

/**
 * REST controller for item categories (`/item-categories`).
 *
 * @remarks
 * HTTP concerns only. Categories ride the item master's permissions:
 * `product:read` to list, `product:create|update|archive` to manage.
 */
export class ItemCategoryController {
	static plugin() {
		const service = container.resolve(ITEM_CATEGORY_SERVICE_TOKEN);

		return domainPlugin({
			name: 'inventory-item-categories',
			prefix: '/item-categories',
			tags: ['Inventory'],
			guards: 'erp',
		})
			.get(
				'',
				async ({ query }) =>
					ok(await service.list(itemCategoryListQuerySchema.parse(query).includeInactive)),
				{
					erp: { permission: ['product:read'] },
					detail: { description: 'Item categories ordered for pickers' },
				},
			)
			.post(
				'',
				async ({ body, status }) =>
					status(201, created(await service.create(createItemCategorySchema.parse(body)))),
				{
					erp: { permission: ['product:create'] },
					detail: { description: 'Creates an item category' },
				},
			)
			.patch(
				'/:id',
				async ({ params, body }) =>
					ok(await service.update(idParamSchema.parse(params).id, updateItemCategorySchema.parse(body))),
				{
					erp: { permission: ['product:update'] },
					detail: { description: 'Updates an item category (the slug is fixed)' },
				},
			)
			.delete(
				'/:id',
				async ({ params }) => ok(await service.archive(idParamSchema.parse(params).id)),
				{
					erp: { permission: ['product:archive'] },
					detail: { description: 'Archives an item category without live items' },
				},
			);
	}
}
