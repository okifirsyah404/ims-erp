import type { DependencyContainer } from 'tsyringe';
import { AUDIT_SERVICE_TOKEN } from '@app/audit/constants/di';
import type { AuditService } from '@app/audit/services/audit.service';
import {
	WAREHOUSE_PIC_RESOLVER_TOKEN,
	type IWarehousePicResolver,
} from '@authorization/warehouse-pic-resolver';
import { AuditWriter } from '@shared/audit';
import {
	EXPORTED_WAREHOUSE_SERVICE_TOKEN,
	WAREHOUSE_ADDRESS_REPOSITORY_TOKEN,
	WAREHOUSE_CODE_NUMBERING_REPOSITORY_TOKEN,
	WAREHOUSE_IMAGE_SERVICE_TOKEN,
	WAREHOUSE_MANAGER_REPOSITORY_TOKEN,
	WAREHOUSE_MANAGER_SERVICE_TOKEN,
	WAREHOUSE_NUMBERING_SERVICE_TOKEN,
	WAREHOUSE_REPOSITORY_TOKEN,
	WAREHOUSE_SERVICE_TOKEN,
	WAREHOUSE_STORAGE_REPOSITORY_TOKEN,
} from './constants/di';
import { WarehouseAddressRepository } from './repositories/warehouse-address.repository';
import { WarehouseCodeNumberingRepository } from './repositories/code-numbering.repository';
import { WarehouseManagerRepository } from './repositories/warehouse-manager.repository';
import { WarehouseRepository } from './repositories/warehouse.repository';
import { WarehouseStorageRepository } from './repositories/warehouse-storage.repository';
import { ExportedWarehouseService } from './services/exported-warehouse.service';
import { WarehouseImageService } from './services/warehouse-image.service';
import { WarehouseManagerService } from './services/warehouse-manager.service';
import { WarehouseNumberingService } from './services/warehouse-numbering.service';
import { WarehouseService } from './services/warehouse.service';

export * from './constants/di';

/**
 * Registers the warehouse module's repositories and services.
 *
 * @remarks
 * Explicit `container.register` calls, matching every other domain in this
 * codebase — there is no decorator-based auto-registration.
 *
 * @param container - The tsyringe container to populate
 */
export function registerWarehouse(container: DependencyContainer): void {
	// Shared fire-and-forget audit adapter — each module owns its instance.
	container.registerInstance(
		AuditWriter,
		new AuditWriter(container.resolve<AuditService>(AUDIT_SERVICE_TOKEN)),
	);

	container.register(WAREHOUSE_CODE_NUMBERING_REPOSITORY_TOKEN, {
		useClass: WarehouseCodeNumberingRepository,
	});
	container.register(WAREHOUSE_NUMBERING_SERVICE_TOKEN, {
		useClass: WarehouseNumberingService,
	});
	container.register(WAREHOUSE_REPOSITORY_TOKEN, {
		useClass: WarehouseRepository,
	});
	container.register(WAREHOUSE_ADDRESS_REPOSITORY_TOKEN, {
		useClass: WarehouseAddressRepository,
	});
	container.register(WAREHOUSE_STORAGE_REPOSITORY_TOKEN, {
		useClass: WarehouseStorageRepository,
	});
	container.register(WAREHOUSE_SERVICE_TOKEN, {
		useClass: WarehouseService,
	});
	container.register(WAREHOUSE_IMAGE_SERVICE_TOKEN, {
		useClass: WarehouseImageService,
	});
	// ADR-0017: person-in-charge assignments. The repository doubles as the
	// `warehouseGuard` port (it implements `IWarehousePicResolver`), so the
	// guard never touches Drizzle.
	container.register(WAREHOUSE_MANAGER_REPOSITORY_TOKEN, {
		useClass: WarehouseManagerRepository,
	});
	container.register(WAREHOUSE_MANAGER_SERVICE_TOKEN, {
		useClass: WarehouseManagerService,
	});
	container.register(WAREHOUSE_PIC_RESOLVER_TOKEN, {
		useFactory: (c: DependencyContainer) =>
			c.resolve<IWarehousePicResolver>(
				WAREHOUSE_MANAGER_REPOSITORY_TOKEN,
			),
	});
	// Cross-module export facade — repository-only, safe for other modules.
	container.register(EXPORTED_WAREHOUSE_SERVICE_TOKEN, {
		useClass: ExportedWarehouseService,
	});
}
