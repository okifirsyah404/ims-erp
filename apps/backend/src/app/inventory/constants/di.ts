/**
 * DI tokens for the inventory module.
 *
 * @remarks
 * Every token carries the `InjectionToken<T>` annotation. Bare `Symbol(...)`
 * leaves `container.resolve()` returning `unknown`, which forces casts at
 * every call site.
 *
 * ADR-0026 split the product master (`product`) and the warehouse estate
 * (`warehouse`) out of this module: product- and warehouse-shaped tokens live
 * in their own modules now, and this module talks to them through
 * {@link EXPORTED_PRODUCT_SERVICE_TOKEN} / {@link EXPORTED_WAREHOUSE_SERVICE_TOKEN}
 * from `@app/product` and `@app/warehouse` instead of owning repositories.
 */
import type { InjectionToken } from 'tsyringe';
import type { IItemSerialRepository } from '../contracts/item-serial.repository.interface';
import type { IMovementRepository } from '../contracts/movement.repository.interface';
import type { IStockRepository } from '../contracts/stock.repository.interface';
import type { IAdjustmentRepository } from '../contracts/adjustment.repository.interface';
import type { ExportedInventoryService } from '../services/exported-inventory.service';
import type { SerialUnitService } from '../services/serial-unit.service';
import type { StockService } from '../services/stock.service';
import type { AdjustmentService } from '../services/adjustment.service';
import type {
	IBorrowingEventRepository,
	IBorrowingItemRepository,
	IBorrowingRepository,
	IBorrowingRequestEventRepository,
	IBorrowingRequestRepository,
} from '../contracts/borrowing.repository.interface';
import type { IItemMovementRepository } from '../contracts/item-movement.repository.interface';
import type {
	IConditionCheckRepository,
	IDisposalRepository,
	IInventoryDocumentRepository,
	IMaintenanceRepository,
	IToolSetItemRepository,
	IToolSetRepository,
} from '../contracts/item-operations.repository.interface';
import type { DisposalService } from '../services/disposal.service';
import type { ItemDocumentService } from '../services/item-document.service';
import type { MaintenanceService } from '../services/maintenance.service';
import type { ToolSetService } from '../services/tool-set.service';
import type { BorrowingRequestService } from '../services/borrowing-request.service';
import type { BorrowingService } from '../services/borrowing.service';
import type { ItemCustodyService } from '../services/item-custody.service';
import type { InventoryCodeNumberingRepository } from '../repositories/code-numbering.repository';
import type { IItemRepository } from '../contracts/item.repository.interface';
import type { IItemCategoryRepository } from '../contracts/item-category.repository.interface';
import type { ItemService } from '../services/item.service';
import type { ItemImageService } from '../services/item-image.service';
import type { ItemCategoryService } from '../services/item-category.service';
import type { InventoryNumberingService } from '../services/inventory-numbering.service';
import type { IStockValuationRepository } from '../contracts/stock-valuation.contract';
import type { StockValuationService } from '../services/stock-valuation.service';

/** `inventory.item_serials` — the physical instances of a serialized product. */
export const ITEM_SERIAL_REPOSITORY_TOKEN: InjectionToken<IItemSerialRepository> =
	Symbol('ITEM_SERIAL_REPOSITORY');
/** Serial-unit lifecycle: registration, status matrix, sell/receive/return. */
export const SERIAL_UNIT_SERVICE_TOKEN: InjectionToken<SerialUnitService> =
	Symbol('SERIAL_UNIT_SERVICE');
/** `inventory.items` (tool/asset units, was `assets.assets`). */
export const ITEM_REPOSITORY_TOKEN: InjectionToken<IItemRepository> = Symbol('ITEM_REPOSITORY');
export const ITEM_CATEGORY_REPOSITORY_TOKEN: InjectionToken<IItemCategoryRepository> =
	Symbol('ITEM_CATEGORY_REPOSITORY');
export const ITEM_SERVICE_TOKEN: InjectionToken<ItemService> = Symbol('ITEM_SERVICE');
/** The asset photo (object-storage key <-> signed URL). */
export const ITEM_IMAGE_SERVICE_TOKEN: InjectionToken<ItemImageService> = Symbol('ITEM_IMAGE_SERVICE');
export const ITEM_CATEGORY_SERVICE_TOKEN: InjectionToken<ItemCategoryService> =
	Symbol('ITEM_CATEGORY_SERVICE');
/** `inventory.code_numberings` (ADR-0024 Q6). */
export const INVENTORY_CODE_NUMBERING_REPOSITORY_TOKEN: InjectionToken<InventoryCodeNumberingRepository> =
	Symbol('INVENTORY_CODE_NUMBERING_REPOSITORY');
/** Issues movement, adjustment, maintenance, disposal, asset and tool-set codes. */
export const INVENTORY_NUMBERING_SERVICE_TOKEN: InjectionToken<InventoryNumberingService> =
	Symbol('INVENTORY_NUMBERING_SERVICE');
/**
 * Cross-module export facade over inventory reads (units, balances,
 * borrowings). Depends only on the module's own repositories, so consumers
 * (`product`, `warehouse`, `sale`, ...) cannot form a service-to-service cycle.
 */
export const EXPORTED_INVENTORY_SERVICE_TOKEN: InjectionToken<ExportedInventoryService> =
	Symbol('EXPORTED_INVENTORY_SERVICE');
export const MOVEMENT_REPOSITORY_TOKEN: InjectionToken<IMovementRepository> =
	Symbol('MOVEMENT_REPOSITORY');
export const STOCK_REPOSITORY_TOKEN: InjectionToken<IStockRepository> =
	Symbol('BALANCE_REPOSITORY');
export const ADJUSTMENT_REPOSITORY_TOKEN: InjectionToken<IAdjustmentRepository> =
	Symbol('ADJUSTMENT_REPOSITORY');
export const STOCK_SERVICE_TOKEN: InjectionToken<StockService> =
	Symbol('STOCK_SERVICE');
export const ADJUSTMENT_SERVICE_TOKEN: InjectionToken<AdjustmentService> =
	Symbol('ADJUSTMENT_SERVICE');

/** Token resolving to the inventory value repository (ADR-0011 step 5b). */
export const STOCK_VALUATION_REPOSITORY_TOKEN: InjectionToken<IStockValuationRepository> = Symbol('STOCK_VALUATION_REPOSITORY_TOKEN');

/** Token resolving to the {@link StockValuationService}. */
export const STOCK_VALUATION_SERVICE_TOKEN: InjectionToken<StockValuationService> = Symbol('STOCK_VALUATION_SERVICE_TOKEN');

/* ------------------------------------------------------------------------ *
 * Items: custody, movements, borrowing (ADR-0024 Q14-Q26)
 * ------------------------------------------------------------------------ */

export const ITEM_MOVEMENT_REPOSITORY_TOKEN: InjectionToken<IItemMovementRepository> =
	Symbol('ITEM_MOVEMENT_REPOSITORY');
export const MAINTENANCE_REPOSITORY_TOKEN: InjectionToken<IMaintenanceRepository> =
	Symbol('MAINTENANCE_REPOSITORY');
export const TOOL_SET_REPOSITORY_TOKEN: InjectionToken<IToolSetRepository> =
	Symbol('TOOL_SET_REPOSITORY');
export const TOOL_SET_ITEM_REPOSITORY_TOKEN: InjectionToken<IToolSetItemRepository> =
	Symbol('TOOL_SET_ITEM_REPOSITORY');
export const BORROWING_REQUEST_REPOSITORY_TOKEN: InjectionToken<IBorrowingRequestRepository> =
	Symbol('BORROWING_REQUEST_REPOSITORY');
export const BORROWING_REPOSITORY_TOKEN: InjectionToken<IBorrowingRepository> =
	Symbol('BORROWING_REPOSITORY');
export const BORROWING_ITEM_REPOSITORY_TOKEN: InjectionToken<IBorrowingItemRepository> =
	Symbol('BORROWING_ITEM_REPOSITORY');
export const BORROWING_EVENT_REPOSITORY_TOKEN: InjectionToken<IBorrowingEventRepository> =
	Symbol('BORROWING_EVENT_REPOSITORY');
export const BORROWING_REQUEST_EVENT_REPOSITORY_TOKEN: InjectionToken<IBorrowingRequestEventRepository> =
	Symbol('BORROWING_REQUEST_EVENT_REPOSITORY');
/** Custody, location trail and status derivation of item units. */
export const ITEM_CUSTODY_SERVICE_TOKEN: InjectionToken<ItemCustodyService> =
	Symbol('ITEM_CUSTODY_SERVICE');
export const BORROWING_REQUEST_SERVICE_TOKEN: InjectionToken<BorrowingRequestService> =
	Symbol('BORROWING_REQUEST_SERVICE');
export const BORROWING_SERVICE_TOKEN: InjectionToken<BorrowingService> =
	Symbol('BORROWING_SERVICE');
export const CONDITION_CHECK_REPOSITORY_TOKEN: InjectionToken<IConditionCheckRepository> =
	Symbol('CONDITION_CHECK_REPOSITORY');
export const DISPOSAL_REPOSITORY_TOKEN: InjectionToken<IDisposalRepository> =
	Symbol('DISPOSAL_REPOSITORY');
export const INVENTORY_DOCUMENT_REPOSITORY_TOKEN: InjectionToken<IInventoryDocumentRepository> =
	Symbol('INVENTORY_DOCUMENT_REPOSITORY');
export const MAINTENANCE_SERVICE_TOKEN: InjectionToken<MaintenanceService> =
	Symbol('MAINTENANCE_SERVICE');
export const DISPOSAL_SERVICE_TOKEN: InjectionToken<DisposalService> = Symbol('DISPOSAL_SERVICE');
export const ITEM_DOCUMENT_SERVICE_TOKEN: InjectionToken<ItemDocumentService> =
	Symbol('ITEM_DOCUMENT_SERVICE');
export const TOOL_SET_SERVICE_TOKEN: InjectionToken<ToolSetService> = Symbol('TOOL_SET_SERVICE');
