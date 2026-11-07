/**
 * Public entry point of the catalog module (M04 website catalog).
 * `src/app/app.ts` mounts `.use(catalogModule())`.
 */
import Elysia from 'elysia';

import { CatalogController } from './controllers/catalog.controller';
import { PublicCatalogController } from './controllers/public-catalog.controller';

export { registerCatalog } from './container';

/** Elysia instance mounting every catalog controller, in route order. */
export function catalogModule() {
	return new Elysia({ name: 'catalog' }).use(CatalogController.plugin()).use(PublicCatalogController.plugin());
}
