/**
 * Public entry point of the assets module.
 *
 * @remarks
 * Exports the module's HTTP surface as a single Elysia factory
 * (`assetsModule()`) plus the composition-root registration, so
 * `src/app/app.ts` only mounts `.use(assetsModule())` and never lists
 * the module's controllers individually. Mirrors every other module
 * entry point.
 */
import Elysia from 'elysia';

import { AssetCategoryController } from './controllers/asset-category.controller';
import { AssetOperationsController } from './controllers/asset-operations.controller';
import { AssetController } from './controllers/asset.controller';
import { BorrowingController } from './controllers/borrowing.controller';

export { registerAssets } from './container';
export { AssetOperationsService } from './services/asset-operations.service';

/** Elysia instance mounting every assets controller, in route order. */
export function assetsModule() {
	return new Elysia({ name: 'assets' })
		.use(AssetController.plugin())
		.use(AssetCategoryController.plugin())
		.use(AssetOperationsController.plugin())
		.use(BorrowingController.plugin());
}
