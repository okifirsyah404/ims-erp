import { container } from 'tsyringe';
import { domainPlugin } from '@http/plugin';
import { created, ok } from '@http/response';
import { PRODUCT_CATEGORY_SERVICE_TOKEN } from '../constants/di';
import {
	createProductCategorySchema,
	productCategoryListQuerySchema,
	updateProductCategorySchema,
} from '../contracts/product-category.contract';
import { idParamSchema } from '../contracts/product.contract';

/**
 * REST controller for product categories (`/inventory/product-categories`).
 *
 * @remarks
 * HTTP concerns only. Categories ride the product master's permissions:
 * `product:read` to list, `product:create|update|archive` to manage.
 */
export class ProductCategoryController {
	static plugin() {
		const service = container.resolve(PRODUCT_CATEGORY_SERVICE_TOKEN);

		return domainPlugin({
			name: 'inventory-product-categories',
			prefix: '/inventory/product-categories',
			tags: ['Inventory'],
			guards: 'erp',
		})
			.get(
				'',
				async ({ query }) =>
					ok(await service.list(productCategoryListQuerySchema.parse(query).includeInactive)),
				{
					erp: { permission: ['product:read'] },
					detail: { description: 'Product categories ordered for pickers' },
				},
			)
			.post(
				'',
				async ({ body, status }) =>
					status(201, created(await service.create(createProductCategorySchema.parse(body)))),
				{
					erp: { permission: ['product:create'] },
					detail: { description: 'Creates a product category' },
				},
			)
			.patch(
				'/:id',
				async ({ params, body }) =>
					ok(await service.update(idParamSchema.parse(params).id, updateProductCategorySchema.parse(body))),
				{
					erp: { permission: ['product:update'] },
					detail: { description: 'Updates a product category (the slug is fixed)' },
				},
			)
			.delete(
				'/:id',
				async ({ params }) => ok(await service.archive(idParamSchema.parse(params).id)),
				{
					erp: { permission: ['product:archive'] },
					detail: { description: 'Archives a product category without live items' },
				},
			);
	}
}
