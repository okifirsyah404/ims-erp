import { domainPlugin } from '@http/plugin';
import { created, ok } from '@http/response';
import { container } from 'tsyringe';
import { CATALOG_SERVICE_TOKEN } from '../constants/di';
import { idParamSchema, listingBodySchema, publishSchema } from '../contracts/catalog.contract';

/**
 * Admin controller of the website catalog (`/catalog/listings`, M04 stage
 * 1). Reading needs `catalog:read`; creating `:create`; editing `:update`;
 * publishing or hiding `:publish`; removing `:archive`.
 */
export class CatalogController {
	static plugin() {
		const service = container.resolve(CATALOG_SERVICE_TOKEN);
		const id = (params: unknown) => idParamSchema.parse(params).id;

		return domainPlugin({ name: 'catalog-listings', prefix: '/catalog/listings', tags: ['Catalog'], guards: 'erp' })
			.get('', async () => ok(await service.listListings()), {
				erp: { permission: ['catalog:read'] },
				detail: { description: 'Website listings with their items' },
			})
			.post(
				'',
				async ({ body, erp, status }) => status(201, created(await service.create(erp.session.user.id, listingBodySchema.parse(body)))),
				{ erp: { permission: ['catalog:create'] }, detail: { description: 'Lists an item for the website (unpublished)' } },
			)
			.put('/:id', async ({ params, body }) => ok(await service.update(id(params), listingBodySchema.parse(body))), {
				erp: { permission: ['catalog:update'] },
				detail: { description: 'Edits a listing' },
			})
			.post('/:id/publish', async ({ params, body }) => ok(await service.setPublished(id(params), publishSchema.parse(body).published)), {
				erp: { permission: ['catalog:publish'] },
				detail: { description: 'Shows or hides the listing on the website' },
			})
			.delete(
				'/:id',
				async ({ params }) => {
					await service.remove(id(params));
					return ok({ removed: true });
				},
				{ erp: { permission: ['catalog:archive'] }, detail: { description: 'Removes a listing (the item stays)' } },
			);
	}
}
