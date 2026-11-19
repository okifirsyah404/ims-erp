import type { DependencyContainer } from 'tsyringe';
import { WAREHOUSE_PIC_RESOLVER_TOKEN } from '@authorization/warehouse-pic-resolver';
import type { IWarehouseManagerRepository as IWarehouseManagerRepositoryPort } from './contracts/warehouse-manager.repository.interface';
import { ProductRepository } from './repositories/product.repository';
import { ItemSerialRepository } from './repositories/item-serial.repository';
import { InventoryCodeNumberingRepository } from './repositories/code-numbering.repository';
import { InventoryNumberingService } from './services/inventory-numbering.service';
import { WarehouseRepository } from './repositories/warehouse.repository';
import { WarehouseManagerRepository } from './repositories/warehouse-manager.repository';
import { WarehouseAddressRepository } from './repositories/warehouse-address.repository';
import { WarehouseStorageRepository } from './repositories/warehouse-storage.repository';
import { MovementRepository } from './repositories/movement.repository';
import { StockRepository } from './repositories/stock.repository';
import { AdjustmentRepository } from './repositories/adjustment.repository';
import { InventoryAuditWriter } from './services/inventory-audit.writer';
import { ProductImageService } from './services/product-image.service';
import { ProductService } from './services/product.service';
import { ConditionCheckRepository } from './repositories/condition-check.repository';
import { DisposalRepository } from './repositories/disposal.repository';
import { InventoryDocumentRepository } from './repositories/inventory-document.repository';
import { DisposalService } from './services/disposal.service';
import { ItemDocumentService } from './services/item-document.service';
import { MaintenanceService } from './services/maintenance.service';
import { ToolSetService } from './services/tool-set.service';
import { BorrowingEventRepository, BorrowingRequestEventRepository } from './repositories/borrowing-event.repository';
import { BorrowingItemRepository } from './repositories/borrowing-item.repository';
import { BorrowingRepository } from './repositories/borrowing.repository';
import { BorrowingRequestRepository } from './repositories/borrowing-request.repository';
import { ItemMovementRepository } from './repositories/item-movement.repository';
import { MaintenanceRepository } from './repositories/maintenance.repository';
import { ToolSetItemRepository, ToolSetRepository } from './repositories/tool-set.repository';
import { BorrowingRequestService } from './services/borrowing-request.service';
import { BorrowingService } from './services/borrowing.service';
import { ItemCustodyService } from './services/item-custody.service';
import { ItemRepository } from './repositories/item.repository';
import { ItemCategoryRepository } from './repositories/item-category.repository';
import { ItemService } from './services/item.service';
import { ItemCategoryService } from './services/item-category.service';
import { ProductCategoryRepository } from './repositories/product-category.repository';
import { ProductCategoryService } from './services/product-category.service';
import { AUDIT_SERVICE_TOKEN } from '../audit/constants/di';
import type { AuditService } from '../audit/services/audit.service';
import { WarehouseService } from './services/warehouse.service';
import { WarehouseManagerService } from './services/warehouse-manager.service';
import { ExportedInventoryService } from './services/exported-inventory.service';
import { StockService } from './services/stock.service';
import { AdjustmentService } from './services/adjustment.service';
import { StockValuationRepository } from './repositories/stock-valuation.repository';
import { StockValuationService } from './services/stock-valuation.service';
import { ProductListingService } from './services/product-listing.service';
import {
	ADJUSTMENT_REPOSITORY_TOKEN,
	ADJUSTMENT_SERVICE_TOKEN,
	STOCK_REPOSITORY_TOKEN,
	BORROWING_EVENT_REPOSITORY_TOKEN,
	BORROWING_ITEM_REPOSITORY_TOKEN,
	BORROWING_REPOSITORY_TOKEN,
	BORROWING_REQUEST_EVENT_REPOSITORY_TOKEN,
	BORROWING_REQUEST_REPOSITORY_TOKEN,
	BORROWING_REQUEST_SERVICE_TOKEN,
	BORROWING_SERVICE_TOKEN,
	ITEM_CUSTODY_SERVICE_TOKEN,
	ITEM_MOVEMENT_REPOSITORY_TOKEN,
	MAINTENANCE_REPOSITORY_TOKEN,
	TOOL_SET_ITEM_REPOSITORY_TOKEN,
	TOOL_SET_REPOSITORY_TOKEN,
	CONDITION_CHECK_REPOSITORY_TOKEN,
	DISPOSAL_REPOSITORY_TOKEN,
	DISPOSAL_SERVICE_TOKEN,
	INVENTORY_DOCUMENT_REPOSITORY_TOKEN,
	ITEM_DOCUMENT_SERVICE_TOKEN,
	MAINTENANCE_SERVICE_TOKEN,
	TOOL_SET_SERVICE_TOKEN,
	INVENTORY_CODE_NUMBERING_REPOSITORY_TOKEN,
	INVENTORY_NUMBERING_SERVICE_TOKEN,
	ITEM_CATEGORY_REPOSITORY_TOKEN,
	ITEM_CATEGORY_SERVICE_TOKEN,
	ITEM_REPOSITORY_TOKEN,
	ITEM_SERVICE_TOKEN,
	PRODUCT_CATEGORY_REPOSITORY_TOKEN,
	PRODUCT_CATEGORY_SERVICE_TOKEN,
	PRODUCT_REPOSITORY_TOKEN,
	PRODUCT_IMAGE_SERVICE_TOKEN,
	PRODUCT_SERVICE_TOKEN,
	MOVEMENT_REPOSITORY_TOKEN,
	ITEM_SERIAL_REPOSITORY_TOKEN,
	STOCK_SERVICE_TOKEN,
	WAREHOUSE_ADDRESS_REPOSITORY_TOKEN,
	WAREHOUSE_MANAGER_REPOSITORY_TOKEN,
	WAREHOUSE_MANAGER_SERVICE_TOKEN,
	WAREHOUSE_REPOSITORY_TOKEN,
	WAREHOUSE_SERVICE_TOKEN,
	WAREHOUSE_STORAGE_REPOSITORY_TOKEN,
	STOCK_VALUATION_REPOSITORY_TOKEN,
	STOCK_VALUATION_SERVICE_TOKEN,
	PRODUCT_LISTING_SERVICE_TOKEN,
	EXPORTED_INVENTORY_SERVICE_TOKEN,
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

	container.register(INVENTORY_CODE_NUMBERING_REPOSITORY_TOKEN, {
		useClass: InventoryCodeNumberingRepository,
	});
	container.register(INVENTORY_NUMBERING_SERVICE_TOKEN, {
		useClass: InventoryNumberingService,
	});
	container.register(PRODUCT_REPOSITORY_TOKEN, { useClass: ProductRepository });
	container.register(ITEM_SERIAL_REPOSITORY_TOKEN, {
		useClass: ItemSerialRepository,
	});
	container.register(PRODUCT_SERVICE_TOKEN, { useClass: ProductService });
	container.register(PRODUCT_IMAGE_SERVICE_TOKEN, { useClass: ProductImageService });
	container.register(PRODUCT_CATEGORY_REPOSITORY_TOKEN, {
		useClass: ProductCategoryRepository,
	});
	container.register(PRODUCT_CATEGORY_SERVICE_TOKEN, {
		useClass: ProductCategoryService,
	});
	container.register(ITEM_REPOSITORY_TOKEN, { useClass: ItemRepository });
	container.register(ITEM_CATEGORY_REPOSITORY_TOKEN, { useClass: ItemCategoryRepository });
	container.register(ITEM_SERVICE_TOKEN, { useClass: ItemService });
	container.register(ITEM_CATEGORY_SERVICE_TOKEN, { useClass: ItemCategoryService });

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
	container.register(EXPORTED_INVENTORY_SERVICE_TOKEN, {
		useClass: ExportedInventoryService,
	});

	container.register(ITEM_MOVEMENT_REPOSITORY_TOKEN, { useClass: ItemMovementRepository });
	container.register(MAINTENANCE_REPOSITORY_TOKEN, { useClass: MaintenanceRepository });
	container.register(TOOL_SET_REPOSITORY_TOKEN, { useClass: ToolSetRepository });
	container.register(TOOL_SET_ITEM_REPOSITORY_TOKEN, { useClass: ToolSetItemRepository });
	container.register(BORROWING_REQUEST_REPOSITORY_TOKEN, { useClass: BorrowingRequestRepository });
	container.register(BORROWING_REPOSITORY_TOKEN, { useClass: BorrowingRepository });
	container.register(BORROWING_ITEM_REPOSITORY_TOKEN, { useClass: BorrowingItemRepository });
	container.register(BORROWING_EVENT_REPOSITORY_TOKEN, { useClass: BorrowingEventRepository });
	container.register(BORROWING_REQUEST_EVENT_REPOSITORY_TOKEN, {
		useClass: BorrowingRequestEventRepository,
	});
	container.register(ITEM_CUSTODY_SERVICE_TOKEN, { useClass: ItemCustodyService });
	container.register(BORROWING_REQUEST_SERVICE_TOKEN, { useClass: BorrowingRequestService });
	container.register(BORROWING_SERVICE_TOKEN, { useClass: BorrowingService });
	container.register(CONDITION_CHECK_REPOSITORY_TOKEN, { useClass: ConditionCheckRepository });
	container.register(DISPOSAL_REPOSITORY_TOKEN, { useClass: DisposalRepository });
	container.register(INVENTORY_DOCUMENT_REPOSITORY_TOKEN, { useClass: InventoryDocumentRepository });
	container.register(MAINTENANCE_SERVICE_TOKEN, { useClass: MaintenanceService });
	container.register(DISPOSAL_SERVICE_TOKEN, { useClass: DisposalService });
	container.register(ITEM_DOCUMENT_SERVICE_TOKEN, { useClass: ItemDocumentService });
	container.register(TOOL_SET_SERVICE_TOKEN, { useClass: ToolSetService });
	container.register(MOVEMENT_REPOSITORY_TOKEN, {
		useClass: MovementRepository,
	});
	container.register(STOCK_REPOSITORY_TOKEN, {
		useClass: StockRepository,
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
	container.register(PRODUCT_LISTING_SERVICE_TOKEN, { useClass: ProductListingService });
	container.register(ADJUSTMENT_SERVICE_TOKEN, {
		useClass: AdjustmentService,
	});
}
