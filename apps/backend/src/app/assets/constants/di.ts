/**
 * DI tokens for the asset module.
 *
 * @remarks
 * Every token carries the `InjectionToken<T>` annotation (house rule — bare
 * `Symbol(...)` leaves `container.resolve()` returning `unknown`).
 */
import type { InjectionToken } from 'tsyringe';
import type { IAssetCategoryRepository } from '../contracts/asset-category.repository.interface';
import type { IAssetRepository } from '../contracts/asset.repository.interface';
import type { AssetService } from '../services/asset.service';
import type { AssetCategoryService } from '../services/asset-category.service';
import type { IAssetOperationsRepository } from '../contracts/asset-operations.repository.interface';
import type { AssetOperationsService } from '../services/asset-operations.service';
import type { IBorrowingRepository } from '../contracts/borrowing.repository.interface';
import type { BorrowingService } from '../services/borrowing.service';

export const ASSET_CATEGORY_REPOSITORY_TOKEN: InjectionToken<IAssetCategoryRepository> =
	Symbol('ASSET_CATEGORY_REPOSITORY');
export const ASSET_REPOSITORY_TOKEN: InjectionToken<IAssetRepository> =
	Symbol('ASSET_REPOSITORY');
export const ASSET_CATEGORY_SERVICE_TOKEN: InjectionToken<AssetCategoryService> =
	Symbol('ASSET_CATEGORY_SERVICE');
export const ASSET_SERVICE_TOKEN: InjectionToken<AssetService> =
	Symbol('ASSET_SERVICE');
export const ASSET_OPERATIONS_REPOSITORY_TOKEN: InjectionToken<IAssetOperationsRepository> =
	Symbol('ASSET_OPERATIONS_REPOSITORY');
export const ASSET_OPERATIONS_SERVICE_TOKEN: InjectionToken<AssetOperationsService> =
	Symbol('ASSET_OPERATIONS_SERVICE');
export const BORROWING_REPOSITORY_TOKEN: InjectionToken<IBorrowingRepository> =
	Symbol('BORROWING_REPOSITORY');
export const BORROWING_SERVICE_TOKEN: InjectionToken<BorrowingService> =
	Symbol('BORROWING_SERVICE');
