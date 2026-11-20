import { domainPlugin } from '@http/plugin';
import { noContent, ok } from '@http/response';
import { container } from 'tsyringe';
import { PRODUCT_LISTING_SERVICE_TOKEN } from '../constants/di';
import { listingBodySchema, publishSchema } from '../contracts/product-listing.contract';
import { idParamSchema } from '../contracts/product.contract';

/**
 * Admin controller of the website catalog (`/inventory/product-listings`, M04
 * stage 1). A listing is the listing columns of one product, addressed by the
 * product id. Reading needs `catalog:read`; saving `catalog:create|update`;
 * publishing or hiding `catalog:publish`; removing `catalog:archive`.
 */
export class ProductListingController {
	static plugin() {
		const service = container.resolve(PRODUCT_LISTING_SERVICE_TOKEN);
		const id = (params: unknown) => idParamSchema.parse(params).id;

		return domainPlugin({
			name: 'inventory-product-listings',
			prefix: '/inventory/product-listings',
			tags: ['Catalog'],
			guards: 'erp',
		})
			.get('', async () => ok(await service.listListings()), {
				erp: { permission: ['catalog:read'] },
				detail: { description: 'Products that have a website listing' },
			})
			.put(
				'/:id',
				async ({ params, body }) => ok(await service.saveListing(id(params), listingBodySchema.parse(body))),
				{
					erp: { permission: ['catalog:update'] },
					detail: { description: 'Creates or edits the listing of a product (a first save is unpublished)' },
				},
			)
			.post(
				'/:id/publish',
				async ({ params, body }) => ok(await service.setPublished(id(params), publishSchema.parse(body).published)),
				{
					erp: { permission: ['catalog:publish'] },
					detail: { description: 'Shows or hides the listing on the website' },
				},
			)
			.delete(
				'/:id',
				async ({ params }) => {
					await service.removeListing(id(params));
					return noContent();
				},
				{
					erp: { permission: ['catalog:archive'] },
					detail: { description: 'Removes the listing (the product stays)' },
				},
			);
	}
}
