import type { DependencyContainer } from 'tsyringe';
import { WAREHOUSE_PIC_RESOLVER_TOKEN } from '@authorization/warehouse-pic-resolver';
import type { IWarehouseManagerRepository as IWarehouseManagerRepositoryPort } from './contracts/warehouse-manager.repository.interface';
import { ItemRepository } from './repositories/item.repository';
import { SerialUnitRepository } from './repositories/serial-unit.repository';
import { WarehouseRepository } from './repositories/warehouse.repository';
import { WarehouseManagerRepository } from './repositories/warehouse-manager.repository';
import { WarehouseAddressRepository } from './repositories/warehouse-address.repository';
import { WarehouseStorageRepository } from './repositories/warehouse-storage.repository';
import { MovementRepository } from './repositories/movement.repository';
import { BalanceRepository } from './repositories/balance.repository';
import { AdjustmentRepository } from './repositories/adjustment.repository';
import { InventoryAuditWriter } from './services/inventory-audit.writer';
import { NoopWarehouseBorrowingGuard } from './contracts/warehouse-borrowing-guard.port';
import { ItemImageService } from './services/item-image.service';
import { ItemService } from './services/item.service';
import { ItemCategoryRepository } from './repositories/item-category.repository';
import { ItemCategoryService } from './services/item-category.service';
import { AUDIT_SERVICE_TOKEN } from '../audit/constants/di';
import type { AuditService } from '../audit/services/audit.service';
import { WarehouseService } from './services/warehouse.service';
import { WarehouseManagerService } from './services/warehouse-manager.service';
import { ExportedWarehouseService } from './services/exported-warehouse.service';
import { StockService } from './services/stock.service';
import { AdjustmentService } from './services/adjustment.service';
import { StockValuationRepository } from './repositories/stock-valuation.repository';
import { StockValuationService } from './services/stock-valuation.service';
import { ItemCatalogService } from './services/item-catalog.service';
import {
	ADJUSTMENT_REPOSITORY_TOKEN,
	ADJUSTMENT_SERVICE_TOKEN,
	BALANCE_REPOSITORY_TOKEN,
	ITEM_CATEGORY_REPOSITORY_TOKEN,
	ITEM_CATEGORY_SERVICE_TOKEN,
	ITEM_REPOSITORY_TOKEN,
	ITEM_IMAGE_SERVICE_TOKEN,
	ITEM_SERVICE_TOKEN,
	MOVEMENT_REPOSITORY_TOKEN,
	SERIAL_UNIT_REPOSITORY_TOKEN,
	STOCK_SERVICE_TOKEN,
	WAREHOUSE_ADDRESS_REPOSITORY_TOKEN,
	WAREHOUSE_BORROWING_GUARD_TOKEN,
	WAREHOUSE_MANAGER_REPOSITORY_TOKEN,
	WAREHOUSE_MANAGER_SERVICE_TOKEN,
	WAREHOUSE_REPOSITORY_TOKEN,
	WAREHOUSE_SERVICE_TOKEN,
	WAREHOUSE_STORAGE_REPOSITORY_TOKEN,
	STOCK_VALUATION_REPOSITORY_TOKEN,
	STOCK_VALUATION_SERVICE_TOKEN,
	ITEM_CATALOG_SERVICE_TOKEN,
	EXPORTED_WAREHOUSE_SERVICE_TOKEN,
} from './constants/di';

export * from './constants/di';

/**
 * Registers the inventory module's repositories and services.
 *
 * @remarks
 * Explicit `container.register` calls, matching every other domain in this
 * codebase — there is no decorator-based auto-registration.
 *
 * @param container - The tsyringe container to populate
 */
export function registerInventory(container: DependencyContainer): void {
	// Shared fire-and-forget audit adapter over the audit module's
	// AuditService. Resolved eagerly here, which is safe: registerAudit runs
	// before registerInventory at the composition root, and both the writer
	// and the inner service are stateless.
	const auditWriter = new InventoryAuditWriter(
		container.resolve<AuditService>(AUDIT_SERVICE_TOKEN),
	);
	// One shared writer instance for every inventory service.
	container.registerInstance(InventoryAuditWriter, auditWriter);

	container.register(ITEM_REPOSITORY_TOKEN, { useClass: ItemRepository });
	container.register(SERIAL_UNIT_REPOSITORY_TOKEN, {
		useClass: SerialUnitRepository,
	});
	container.register(ITEM_SERVICE_TOKEN, { useClass: ItemService });
	container.register(ITEM_IMAGE_SERVICE_TOKEN, { useClass: ItemImageService });
	container.register(ITEM_CATEGORY_REPOSITORY_TOKEN, {
		useClass: ItemCategoryRepository,
	});
	container.register(ITEM_CATEGORY_SERVICE_TOKEN, {
		useClass: ItemCategoryService,
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
	// Noop default; registerAssets overrides with the real borrowing guard.
	// Keeps inventory resolvable when assets is not registered (tests).
	container.registerInstance(
		WAREHOUSE_BORROWING_GUARD_TOKEN,
		new NoopWarehouseBorrowingGuard(),
	);
	container.register(WAREHOUSE_SERVICE_TOKEN, {
		useClass: WarehouseService,
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
			c.resolve<IWarehouseManagerRepositoryPort>(
				WAREHOUSE_MANAGER_REPOSITORY_TOKEN,
			),
	});
	// Cross-module export facade — repository-only, safe for other modules.
	container.register(EXPORTED_WAREHOUSE_SERVICE_TOKEN, {
		useClass: ExportedWarehouseService,
	});

	container.register(MOVEMENT_REPOSITORY_TOKEN, {
		useClass: MovementRepository,
	});
	container.register(BALANCE_REPOSITORY_TOKEN, {
		useClass: BalanceRepository,
	});
	container.register(ADJUSTMENT_REPOSITORY_TOKEN, {
		useClass: AdjustmentRepository,
	});
	// StockService must be registered before AdjustmentService: the latter
	// injects it, and tsyringe resolves lazily but the token must already exist
	// for bootstrap to fail early rather than at first request.
	container.register(STOCK_SERVICE_TOKEN, { useClass: StockService });
	container.register(STOCK_VALUATION_REPOSITORY_TOKEN, { useClass: StockValuationRepository });
	container.register(STOCK_VALUATION_SERVICE_TOKEN, { useClass: StockValuationService });
	container.register(ITEM_CATALOG_SERVICE_TOKEN, { useClass: ItemCatalogService });
	container.register(ADJUSTMENT_SERVICE_TOKEN, {
		useClass: AdjustmentService,
	});
}
