/**
 * DI tokens for the warehouse module.
 *
 * @remarks
 * Every token carries the `InjectionToken<T>` annotation. Bare `Symbol(...)`
 * leaves `container.resolve()` returning `unknown`, which forces casts at
 * every call site.
 */
import type { InjectionToken } from 'tsyringe';
import type { IWarehouseRepository } from '../contracts/warehouse.repository.interface';
import type { IWarehouseAddressRepository } from '../contracts/warehouse-address.repository.interface';
import type { IWarehouseStorageRepository } from '../contracts/warehouse-storage.repository.interface';
import type { IWarehouseManagerRepository } from '../contracts/warehouse-manager.repository.interface';
import type { WarehouseService } from '../services/warehouse.service';
import type { WarehouseManagerService } from '../services/warehouse-manager.service';
import type { WarehouseCodeNumberingRepository } from '../repositories/code-numbering.repository';
import type { WarehouseNumberingService } from '../services/warehouse-numbering.service';
import type { ExportedWarehouseService } from '../services/exported-warehouse.service';

export const WAREHOUSE_REPOSITORY_TOKEN: InjectionToken<IWarehouseRepository> =
	Symbol('WAREHOUSE_REPOSITORY');
export const WAREHOUSE_ADDRESS_REPOSITORY_TOKEN: InjectionToken<IWarehouseAddressRepository> =
	Symbol('WAREHOUSE_ADDRESS_REPOSITORY');
export const WAREHOUSE_STORAGE_REPOSITORY_TOKEN: InjectionToken<IWarehouseStorageRepository> =
	Symbol('WAREHOUSE_STORAGE_REPOSITORY');
export const WAREHOUSE_SERVICE_TOKEN: InjectionToken<WarehouseService> =
	Symbol('WAREHOUSE_SERVICE');
/** Person-in-charge assignments (ADR-0017). */
export const WAREHOUSE_MANAGER_REPOSITORY_TOKEN: InjectionToken<IWarehouseManagerRepository> =
	Symbol('WAREHOUSE_MANAGER_REPOSITORY');
export const WAREHOUSE_MANAGER_SERVICE_TOKEN: InjectionToken<WarehouseManagerService> =
	Symbol('WAREHOUSE_MANAGER_SERVICE');
/**
 * `warehouse.code_numberings` (ADR-0024 Q6).
 *
 * @remarks
 * The PIC-resolver seam the `warehouseGuard` resolves lives in
 * `@authorization/warehouse-pic-resolver` (ADR-0017) and is registered by this
 * module's container against that token — not re-declared here, or the guard
 * would look up a different `Symbol` and fail at boot.
 */
export const WAREHOUSE_CODE_NUMBERING_REPOSITORY_TOKEN: InjectionToken<WarehouseCodeNumberingRepository> =
	Symbol('WAREHOUSE_CODE_NUMBERING_REPOSITORY');
/** Issues the `warehouse` code. */
export const WAREHOUSE_NUMBERING_SERVICE_TOKEN: InjectionToken<WarehouseNumberingService> =
	Symbol('WAREHOUSE_NUMBERING_SERVICE');
/**
 * Cross-module export facade over warehouse reads. Depends only on the
 * module's own repositories, so consumers cannot form a service-to-service
 * cycle.
 */
export const EXPORTED_WAREHOUSE_SERVICE_TOKEN: InjectionToken<ExportedWarehouseService> =
	Symbol('EXPORTED_WAREHOUSE_SERVICE');

