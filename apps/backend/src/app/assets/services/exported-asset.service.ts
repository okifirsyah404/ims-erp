import { inject, injectable } from 'tsyringe';
import { ASSET_REPOSITORY_TOKEN } from '../constants/di';
import type { IAssetRepository } from '../contracts/asset.repository.interface';

/**
 * Cross-module export facade for the assets module.
 *
 * @remarks
 * Consumed by other modules (e.g. `WarehouseService` decorating warehouse
 * cards with equipment counts) through {@link EXPORTED_ASSET_SERVICE_TOKEN}.
 * It deliberately depends **only on the module's own repository** — never on
 * another module's service — so cross-module consumers cannot create a
 * service-to-service dependency cycle. Domain rules stay in `AssetService`;
 * this class only relays repository queries.
 */
@injectable()
export class ExportedAssetService {
	constructor(
		@inject(ASSET_REPOSITORY_TOKEN)
		private readonly assetRepository: IAssetRepository,
	) {}

	/**
	 * Counts alive assets grouped by warehouse, optionally filtered to one
	 * asset type (e.g. `equipment`). Unallocated rows return `warehouseId:
	 * null` and are ignored by the caller.
	 */
	countByWarehouse(
		warehouseIds: string[],
		assetType?: string,
	): ReturnType<IAssetRepository['countByWarehouse']> {
		return this.assetRepository.countByWarehouse(warehouseIds, assetType);
	}
}
