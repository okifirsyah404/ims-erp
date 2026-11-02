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
import type { ItemService } from '../services/item.service';

export const ITEM_REPOSITORY_TOKEN: InjectionToken<IItemRepository> =
	Symbol('ITEM_REPOSITORY');
export const SERIAL_UNIT_REPOSITORY_TOKEN: InjectionToken<ISerialUnitRepository> =
	Symbol('SERIAL_UNIT_REPOSITORY');
export const ITEM_SERVICE_TOKEN: InjectionToken<ItemService> =
	Symbol('ITEM_SERVICE');
