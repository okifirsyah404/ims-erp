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
import type { ItemService } from '../services/item.service';
import type { WarehouseService } from '../services/warehouse.service';

export const ITEM_REPOSITORY_TOKEN: InjectionToken<IItemRepository> =
	Symbol('ITEM_REPOSITORY');
export const SERIAL_UNIT_REPOSITORY_TOKEN: InjectionToken<ISerialUnitRepository> =
	Symbol('SERIAL_UNIT_REPOSITORY');
export const ITEM_SERVICE_TOKEN: InjectionToken<ItemService> =
	Symbol('ITEM_SERVICE');

export const WAREHOUSE_REPOSITORY_TOKEN: InjectionToken<IWarehouseRepository> =
	Symbol('WAREHOUSE_REPOSITORY');
export const WAREHOUSE_ADDRESS_REPOSITORY_TOKEN: InjectionToken<IWarehouseAddressRepository> =
	Symbol('WAREHOUSE_ADDRESS_REPOSITORY');
export const WAREHOUSE_STORAGE_REPOSITORY_TOKEN: InjectionToken<IWarehouseStorageRepository> =
	Symbol('WAREHOUSE_STORAGE_REPOSITORY');
export const WAREHOUSE_SERVICE_TOKEN: InjectionToken<WarehouseService> =
	Symbol('WAREHOUSE_SERVICE');
