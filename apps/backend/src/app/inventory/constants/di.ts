/**
 * DI tokens for the inventory module.
 *
 * @remarks
 * Every token carries the `InjectionToken<T>` annotation. Bare `Symbol(...)`
 * leaves `container.resolve()` returning `unknown`, which forces casts at
 * every call site.
 */
import type { InjectionToken } from 'tsyringe';
import type { IProductRepository } from '../contracts/product.repository.interface';
import type { IItemSerialRepository } from '../contracts/item-serial.repository.interface';
import type { IWarehouseRepository } from '../contracts/warehouse.repository.interface';
import type { IWarehouseAddressRepository } from '../contracts/warehouse-address.repository.interface';
import type { IWarehouseStorageRepository } from '../contracts/warehouse-storage.repository.interface';
import type { IWarehouseManagerRepository } from '../contracts/warehouse-manager.repository.interface';
import type { IMovementRepository } from '../contracts/movement.repository.interface';
import type { IStockRepository } from '../contracts/stock.repository.interface';
import type { IAdjustmentRepository } from '../contracts/adjustment.repository.interface';
import type { ProductService } from '../services/product.service';
import type { ProductImageService } from '../services/product-image.service';
import type { WarehouseService } from '../services/warehouse.service';
import type { WarehouseManagerService } from '../services/warehouse-manager.service';
import type { ExportedInventoryService } from '../services/exported-inventory.service';
import type { StockService } from '../services/stock.service';
import type { AdjustmentService } from '../services/adjustment.service';
import type { IProductCategoryRepository } from '../contracts/product-category.repository.interface';
import type { ProductCategoryService } from '../services/product-category.service';
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
import type { ItemCategoryService } from '../services/item-category.service';
import type { InventoryNumberingService } from '../services/inventory-numbering.service';
import type { IStockValuationRepository } from '../contracts/stock-valuation.contract';
import type { StockValuationService } from '../services/stock-valuation.service';
import type { ProductListingService } from '../services/product-listing.service';

export const PRODUCT_REPOSITORY_TOKEN: InjectionToken<IProductRepository> =
	Symbol('PRODUCT_REPOSITORY');
export const ITEM_SERIAL_REPOSITORY_TOKEN: InjectionToken<IItemSerialRepository> =
	Symbol('ITEM_SERIAL_REPOSITORY');
export const PRODUCT_SERVICE_TOKEN: InjectionToken<ProductService> =
	Symbol('PRODUCT_SERVICE');
export const PRODUCT_CATEGORY_REPOSITORY_TOKEN: InjectionToken<IProductCategoryRepository> =
	Symbol('PRODUCT_CATEGORY_REPOSITORY');
export const PRODUCT_CATEGORY_SERVICE_TOKEN: InjectionToken<ProductCategoryService> =
	Symbol('PRODUCT_CATEGORY_SERVICE');
/** `inventory.items` (tool/asset units, was `assets.assets`). */
export const ITEM_REPOSITORY_TOKEN: InjectionToken<IItemRepository> = Symbol('ITEM_REPOSITORY');
export const ITEM_CATEGORY_REPOSITORY_TOKEN: InjectionToken<IItemCategoryRepository> = Symbol('ITEM_CATEGORY_REPOSITORY');
export const ITEM_SERVICE_TOKEN: InjectionToken<ItemService> = Symbol('ITEM_SERVICE');
export const ITEM_CATEGORY_SERVICE_TOKEN: InjectionToken<ItemCategoryService> = Symbol('ITEM_CATEGORY_SERVICE');
/** `inventory.code_numberings` (ADR-0024 Q6). */
export const INVENTORY_CODE_NUMBERING_REPOSITORY_TOKEN: InjectionToken<InventoryCodeNumberingRepository> =
	Symbol('INVENTORY_CODE_NUMBERING_REPOSITORY');
/** Issues product, movement, adjustment, warehouse and (later) item/borrowing codes. */
export const INVENTORY_NUMBERING_SERVICE_TOKEN: InjectionToken<InventoryNumberingService> =
	Symbol('INVENTORY_NUMBERING_SERVICE');
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
 * Cross-module export facade over warehouse reads (name resolution for
 * storage-location display). Depends only on the warehouse repository, so
 * consumers (assets) cannot form a service-to-service cycle.
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

/** Token resolving to the {@link ProductImageService} (document photo of an item). */
export const PRODUCT_IMAGE_SERVICE_TOKEN: InjectionToken<ProductImageService> = Symbol('PRODUCT_IMAGE_SERVICE_TOKEN');

/** Token resolving to the inventory value repository (ADR-0011 step 5b). */
export const STOCK_VALUATION_REPOSITORY_TOKEN: InjectionToken<IStockValuationRepository> = Symbol('STOCK_VALUATION_REPOSITORY_TOKEN');

/** Token resolving to the {@link StockValuationService}. */
export const STOCK_VALUATION_SERVICE_TOKEN: InjectionToken<StockValuationService> = Symbol('STOCK_VALUATION_SERVICE_TOKEN');

/** Token resolving to the {@link ProductCatalogService} — the Inventory contract of the website catalog (M04). */
export const PRODUCT_LISTING_SERVICE_TOKEN: InjectionToken<ProductListingService> = Symbol('PRODUCT_LISTING_SERVICE_TOKEN');


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