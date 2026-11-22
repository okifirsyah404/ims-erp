import type { DependencyContainer } from 'tsyringe';
import { AUDIT_SERVICE_TOKEN } from '../audit/constants/di';
import type { AuditService } from '../audit/services/audit.service';
import {
	EXPORTED_PRODUCT_SERVICE_TOKEN,
	PRODUCT_SERIAL_COUNTS_TOKEN,
} from '@app/product/constants/di';
import type { ExportedProductService } from '@app/product/services/exported-product.service';
import { ProductKindsPort } from './services/exported-inventory.service';
import { AuditWriter } from '@shared/audit';
import { MovementRepository } from './repositories/movement.repository';
import { StockRepository } from './repositories/stock.repository';
import { AdjustmentRepository } from './repositories/adjustment.repository';
import { ItemSerialRepository } from './repositories/item-serial.repository';
import { InventoryCodeNumberingRepository } from './repositories/code-numbering.repository';
import { InventoryNumberingService } from './services/inventory-numbering.service';
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
import { ItemImageRepository } from './repositories/item-image.repository';
import { ItemRepository } from './repositories/item.repository';
import { ItemCategoryRepository } from './repositories/item-category.repository';
import { ItemImageService } from './services/item-image.service';
import { ItemService } from './services/item.service';
import { ItemCategoryService } from './services/item-category.service';
import { ExportedInventoryService } from './services/exported-inventory.service';
import { SerialUnitService } from './services/serial-unit.service';
import { StockService } from './services/stock.service';
import { AdjustmentService } from './services/adjustment.service';
import { StockValuationRepository } from './repositories/stock-valuation.repository';
import { StockValuationService } from './services/stock-valuation.service';
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
	ITEM_IMAGE_REPOSITORY_TOKEN,
	ITEM_IMAGE_SERVICE_TOKEN,
	ITEM_SERVICE_TOKEN,
	MOVEMENT_REPOSITORY_TOKEN,
	ITEM_SERIAL_REPOSITORY_TOKEN,
	SERIAL_UNIT_SERVICE_TOKEN,
	STOCK_SERVICE_TOKEN,
	STOCK_VALUATION_REPOSITORY_TOKEN,
	STOCK_VALUATION_SERVICE_TOKEN,
	EXPORTED_INVENTORY_SERVICE_TOKEN,
} from './constants/di';

export * from './constants/di';

/**
 * Registers the inventory module's repositories and services.
 *
 * @remarks
 * Explicit `container.register` calls, matching every other domain in this
 * codebase — there is no decorator-based auto-registration. The product master
 * and the warehouse estate moved out (ADR-0026); this module consumes their
 * export facades through DI tokens instead of owning those repositories.
 *
 * @param container - The tsyringe container to populate
 */
export function registerInventory(container: DependencyContainer): void {
	// Shared fire-and-forget audit adapter over the audit module's
	// AuditService. Resolved eagerly here, which is safe: registerAudit runs
	// before registerInventory at the composition root, and both the writer
	// and the inner service are stateless.
	container.registerInstance(
		AuditWriter,
		new AuditWriter(container.resolve<AuditService>(AUDIT_SERVICE_TOKEN)),
	);

	container.register(INVENTORY_CODE_NUMBERING_REPOSITORY_TOKEN, {
		useClass: InventoryCodeNumberingRepository,
	});
	container.register(INVENTORY_NUMBERING_SERVICE_TOKEN, {
		useClass: InventoryNumberingService,
	});
	container.register(ITEM_SERIAL_REPOSITORY_TOKEN, {
		useClass: ItemSerialRepository,
	});
	container.register(ITEM_REPOSITORY_TOKEN, { useClass: ItemRepository });
	container.register(ITEM_CATEGORY_REPOSITORY_TOKEN, { useClass: ItemCategoryRepository });
	container.register(ITEM_SERVICE_TOKEN, { useClass: ItemService });
	container.register(ITEM_IMAGE_REPOSITORY_TOKEN, { useClass: ItemImageRepository });
	container.register(ITEM_IMAGE_SERVICE_TOKEN, { useClass: ItemImageService });
	container.register(ITEM_CATEGORY_SERVICE_TOKEN, { useClass: ItemCategoryService });
	container.register(SERIAL_UNIT_SERVICE_TOKEN, { useClass: SerialUnitService });

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
	// Cross-module export facade - repository-only, safe for other modules.
	// Registered after the stock/movement/borrowing repositories it composes.
	container.register(EXPORTED_INVENTORY_SERVICE_TOKEN, {
		useClass: ExportedInventoryService,
	});
	// Cycle breaker (ADR-0026): the product module reads its serial counts
	// through this port. Wiring it to the facade here (not in `registerProduct`)
	// is what keeps `ExportedInventoryService` <-> `ExportedProductService` a
	// DAG: the port is only resolved while inventory's graph is being built.
	container.register(PRODUCT_SERIAL_COUNTS_TOKEN, {
		useFactory: (c: DependencyContainer) =>
			c.resolve<ExportedInventoryService>(EXPORTED_INVENTORY_SERVICE_TOKEN),
	});
	// Cycle breaker (ADR-0026): the inventory facade reads product kinds through
	// `ProductKindsPort`, which resolves the product facade on first *call*, not
	// at construction, so the mutual reference never recurses in tsyringe. The
	// factory parameter is unannotated on purpose: an annotated arrow emits
	// `design:paramtypes` for the factory itself and tsyringe would follow the
	// very edge this avoids.
	container.register(ProductKindsPort, {
		useFactory: (c) =>
			new ProductKindsPort(() =>
				(c as DependencyContainer).resolve<ExportedProductService>(
					EXPORTED_PRODUCT_SERVICE_TOKEN,
				),
			),
	});
	// StockService must be registered before AdjustmentService: the latter
	// injects it, and tsyringe resolves lazily but the token must already exist
	// for bootstrap to fail early rather than at first request.
	container.register(STOCK_SERVICE_TOKEN, { useClass: StockService });
	container.register(STOCK_VALUATION_REPOSITORY_TOKEN, { useClass: StockValuationRepository });
	container.register(STOCK_VALUATION_SERVICE_TOKEN, { useClass: StockValuationService });
	container.register(ADJUSTMENT_SERVICE_TOKEN, {
		useClass: AdjustmentService,
	});
}
