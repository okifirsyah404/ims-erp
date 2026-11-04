import type { DependencyContainer } from 'tsyringe';
import { AssetCategoryRepository } from './repositories/asset-category.repository';
import { AssetRepository } from './repositories/asset.repository';
import { AssetCategoryService } from './services/asset-category.service';
import { AssetService } from './services/asset.service';
import {
	ASSET_CATEGORY_REPOSITORY_TOKEN,
	ASSET_CATEGORY_SERVICE_TOKEN,
	ASSET_REPOSITORY_TOKEN,
	ASSET_SERVICE_TOKEN,
} from './constants/di';

export * from './constants/di';
export { ASSET_DOC_TYPES } from './constants/doc-types';

/**
 * Registers the asset module's repositories and services (Phase A-2/A-3).
 *
 * @remarks
 * Requires `registerInventory` (which registers the shared
 * {@link InventoryAuditWriter} instance), `registerOrganization` (ERP-0009
 * numbering) and `registerAudit` to have run — all happen before this at
 * the composition root.
 *
 * @param container - The tsyringe container to populate
 */
export function registerAssets(container: DependencyContainer): void {
	container.register(ASSET_CATEGORY_REPOSITORY_TOKEN, {
		useClass: AssetCategoryRepository,
	});
	container.register(ASSET_REPOSITORY_TOKEN, { useClass: AssetRepository });

	container.register(ASSET_CATEGORY_SERVICE_TOKEN, {
		useClass: AssetCategoryService,
	});
	container.register(ASSET_SERVICE_TOKEN, { useClass: AssetService });
}
