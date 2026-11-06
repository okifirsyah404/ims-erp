/**
 * DI tokens for the inventory module.
 *
 * @remarks
 * Every token carries the `InjectionToken<T>` annotation. Bare `Symbol(...)`
 * leaves `container.resolve()` returning `unknown`, which forces casts at
 * every call site.
 */
import type { InjectionToken } from 'tsyringe';
import type { IItemRepository } from '../contracts/item.repository.interface';
import type { ISerialUnitRepository } from '../contracts/serial-unit.repository.interface';
import type { IWarehouseRepository } from '../contracts/warehouse.repository.interface';
import type { IWarehouseAddressRepository } from '../contracts/warehouse-address.repository.interface';
import type { IWarehouseStorageRepository } from '../contracts/warehouse-storage.repository.interface';
import type { IMovementRepository } from '../contracts/movement.repository.interface';
import type { IBalanceRepository } from '../contracts/balance.repository.interface';
import type { IAdjustmentRepository } from '../contracts/adjustment.repository.interface';
import type { IWarehouseBorrowingGuard } from '../contracts/warehouse-borrowing-guard.port';
import type { ItemService } from '../services/item.service';
import type { ItemImageService } from '../services/item-image.service';
import type { WarehouseService } from '../services/warehouse.service';
import type { ExportedWarehouseService } from '../services/exported-warehouse.service';
import type { StockService } from '../services/stock.service';
import type { AdjustmentService } from '../services/adjustment.service';
import type { IItemCategoryRepository } from '../contracts/item-category.repository.interface';
import type { ItemCategoryService } from '../services/item-category.service';
import type { IStockValuationRepository } from '../contracts/stock-valuation.contract';
import type { StockValuationService } from '../services/stock-valuation.service';

export const ITEM_REPOSITORY_TOKEN: InjectionToken<IItemRepository> =
	Symbol('ITEM_REPOSITORY');
export const SERIAL_UNIT_REPOSITORY_TOKEN: InjectionToken<ISerialUnitRepository> =
	Symbol('SERIAL_UNIT_REPOSITORY');
export const ITEM_SERVICE_TOKEN: InjectionToken<ItemService> =
	Symbol('ITEM_SERVICE');
export const ITEM_CATEGORY_REPOSITORY_TOKEN: InjectionToken<IItemCategoryRepository> =
	Symbol('ITEM_CATEGORY_REPOSITORY');
export const ITEM_CATEGORY_SERVICE_TOKEN: InjectionToken<ItemCategoryService> =
	Symbol('ITEM_CATEGORY_SERVICE');

export const WAREHOUSE_REPOSITORY_TOKEN: InjectionToken<IWarehouseRepository> =
	Symbol('WAREHOUSE_REPOSITORY');
export const WAREHOUSE_ADDRESS_REPOSITORY_TOKEN: InjectionToken<IWarehouseAddressRepository> =
	Symbol('WAREHOUSE_ADDRESS_REPOSITORY');
export const WAREHOUSE_STORAGE_REPOSITORY_TOKEN: InjectionToken<IWarehouseStorageRepository> =
	Symbol('WAREHOUSE_STORAGE_REPOSITORY');
export const WAREHOUSE_SERVICE_TOKEN: InjectionToken<WarehouseService> =
	Symbol('WAREHOUSE_SERVICE');
/**
 * Cross-module export facade over warehouse reads (name resolution for
 * storage-location display). Depends only on the warehouse repository, so
 * consumers (assets) cannot form a service-to-service cycle.
 */
export const EXPORTED_WAREHOUSE_SERVICE_TOKEN: InjectionToken<ExportedWarehouseService> =
	Symbol('EXPORTED_WAREHOUSE_SERVICE');
/**
 * Port to the asset module's open-borrowing state (ERP-0031). Implemented by
 * `registerAssets`; a noop fallback keeps inventory usable standalone.
 */
export const WAREHOUSE_BORROWING_GUARD_TOKEN: InjectionToken<IWarehouseBorrowingGuard> =
	Symbol('WAREHOUSE_BORROWING_GUARD');

export const MOVEMENT_REPOSITORY_TOKEN: InjectionToken<IMovementRepository> =
	Symbol('MOVEMENT_REPOSITORY');
export const BALANCE_REPOSITORY_TOKEN: InjectionToken<IBalanceRepository> =
	Symbol('BALANCE_REPOSITORY');
export const ADJUSTMENT_REPOSITORY_TOKEN: InjectionToken<IAdjustmentRepository> =
	Symbol('ADJUSTMENT_REPOSITORY');
export const STOCK_SERVICE_TOKEN: InjectionToken<StockService> =
	Symbol('STOCK_SERVICE');
export const ADJUSTMENT_SERVICE_TOKEN: InjectionToken<AdjustmentService> =
	Symbol('ADJUSTMENT_SERVICE');

/** Token resolving to the {@link ItemImageService} (document photo of an item). */
export const ITEM_IMAGE_SERVICE_TOKEN: InjectionToken<ItemImageService> = Symbol('ITEM_IMAGE_SERVICE_TOKEN');

/** Token resolving to the inventory value repository (ADR-0011 step 5b). */
export const STOCK_VALUATION_REPOSITORY_TOKEN: InjectionToken<IStockValuationRepository> = Symbol('STOCK_VALUATION_REPOSITORY_TOKEN');

/** Token resolving to the {@link StockValuationService}. */
export const STOCK_VALUATION_SERVICE_TOKEN: InjectionToken<StockValuationService> = Symbol('STOCK_VALUATION_SERVICE_TOKEN');
