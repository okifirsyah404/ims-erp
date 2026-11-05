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
import type { IBorrowingRepository } from '../contracts/borrowing.repository.interface';
import type { ItemService } from '../services/item.service';
import type { WarehouseService } from '../services/warehouse.service';
import type { StockService } from '../services/stock.service';
import type { AdjustmentService } from '../services/adjustment.service';
import type { BorrowingService } from '../services/borrowing.service';
import type { IItemCategoryRepository } from '../contracts/item-category.repository.interface';
import type { ItemCategoryService } from '../services/item-category.service';

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

export const BORROWING_REPOSITORY_TOKEN: InjectionToken<IBorrowingRepository> =
	Symbol('BORROWING_REPOSITORY');
export const BORROWING_SERVICE_TOKEN: InjectionToken<BorrowingService> =
	Symbol('BORROWING_SERVICE');
