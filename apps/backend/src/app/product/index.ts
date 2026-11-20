import Elysia from 'elysia';

import { ProductCategoryController } from './controllers/product-category.controller';
import { ProductController } from './controllers/product.controller';
import { ProductListingController } from './controllers/product-listing.controller';
import { PublicCatalogController } from './controllers/public-catalog.controller';

export { registerProduct } from './container';

/**
 * Elysia instance mounting every product controller.
 *
 * @remarks
 * Route order matters: `ProductController` owns `/products` and the static
 * `/products/public/...` server-to-server catalog path must be mounted before
 * any `/products/:id` handler can shadow it, so the public catalog comes
 * before the admin listing and CRUD routes.
 */
export function productModule() {
	return new Elysia({ name: 'product' })
		// Server-to-server website API (API-key guard, no session): the primary
		// URL at `/products/public/v1/catalog`.
		.use(PublicCatalogController.plugin())
		.use(ProductListingController.plugin())
		.use(ProductCategoryController.plugin())
		.use(ProductController.plugin());
}
