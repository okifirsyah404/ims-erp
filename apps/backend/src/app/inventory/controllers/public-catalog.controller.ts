import { publicApiGuard } from '@authorization/public-api-auth';
import { domainPlugin } from '@http/plugin';
import { ok, okPaginated } from '@http/response';
import { container } from 'tsyringe';
import { PRODUCT_LISTING_SERVICE_TOKEN } from '../constants/di';
import {
	cartSchema,
	productQuerySchema,
	searchQuerySchema,
	slugParamSchema,
	slugsQuerySchema,
} from '../contracts/product-listing.contract';

/**
 * Public website catalog (`/inventory/public/v1/catalog` M04 stage 1): the website's
 * `CatalogSource` contract. Server-to-server with the website key
 * (`publicApi`), except the product photo, which the visitor's browser
 * loads: it only redirects to a short-lived URL of a published product's
 * photo. Money is whole rupiah.
 */
export class PublicCatalogController {
	/**
	 * @param prefix - The mount path: /inventory/public/v1/catalog.
	 */
	static plugin(prefix = '/inventory/public/v1/catalog') {
		const service = container.resolve(PRODUCT_LISTING_SERVICE_TOKEN);
		const slug = (params: unknown) => slugParamSchema.parse(params).slug;
		/** The query with repeated keys (`?slug=a&slug=b`) kept as arrays. */
		const query = (request: Request) => {
			const params = new URL(request.url).searchParams;
			const result: Record<string, string | string[]> = {};
			for (const key of new Set(params.keys())) {
				const values = params.getAll(key);
				result[key] = values.length > 1 ? values : values[0]!;
			}
			return result;
		};

		return domainPlugin({ name: `public-catalog:${prefix}`, prefix, tags: ['Public Website'] })
			.use(publicApiGuard())
			.get('/products', async ({ request }) => okPaginated(await service.listProducts(productQuerySchema.parse(query(request)))), {
				publicApi: true,
				detail: { description: 'listProducts: filter, sort and page published products' },
			})
			.get('/products/:slug', async ({ params }) => ok(await service.getProduct(slug(params))), {
				publicApi: true,
				detail: { description: 'getProduct: one published product (404 when hidden)' },
			})
			.get(
				'/products/:slug/image',
				async ({ params, redirect }) => redirect(await service.imageUrl(slug(params)), 302),
				{ detail: { description: 'Product photo: redirects to a short-lived URL (no key; browsers load it)' } },
			)
			.get('/categories', async () => ok(await service.listCategories()), {
				publicApi: true,
				detail: { description: 'listCategories: categories with published products' },
			})
			.get('/facets', async () => ok(await service.getFacets()), { publicApi: true, detail: { description: 'getFacets' } })
			.get('/stock', async ({ request }) => ok(await service.getStock(slugsQuerySchema.parse(query(request)).slug)), {
				publicApi: true,
				detail: { description: 'getStock: status per slug' },
			})
			.get('/pricing', async ({ request }) => ok(await service.getPricing(slugsQuerySchema.parse(query(request)).slug)), {
				publicApi: true,
				detail: { description: 'getPricing: whole-rupiah price per slug (null = quotation)' },
			})
			.get('/solutions', async () => ok(await service.listSolutions()), {
				publicApi: true,
				detail: { description: 'listSolutions: the company’s own software (M03)' },
			})
			.get('/search', async ({ query }) => {
				const { q, limit } = searchQuerySchema.parse(query);
				return ok(await service.search(q, limit));
			}, { publicApi: true, detail: { description: 'search: products, categories and solutions' } })
			.post('/cart/price', async ({ body }) => ok(await service.priceCart(cartSchema.parse(body).lines)), {
				publicApi: true,
				detail: { description: 'priceCart: server-side cart pricing' },
			});
	}
}
