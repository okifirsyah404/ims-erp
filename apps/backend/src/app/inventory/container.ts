import type { DependencyContainer } from 'tsyringe';
import { ItemRepository } from './repositories/item.repository';
import { SerialUnitRepository } from './repositories/serial-unit.repository';
import { WarehouseRepository } from './repositories/warehouse.repository';
import { WarehouseAddressRepository } from './repositories/warehouse-address.repository';
import { WarehouseStorageRepository } from './repositories/warehouse-storage.repository';
import { MovementRepository } from './repositories/movement.repository';
import { BalanceRepository } from './repositories/balance.repository';
import { AdjustmentRepository } from './repositories/adjustment.repository';
import { BorrowingRepository } from './repositories/borrowing.repository';
import { InventoryAuditWriter } from './services/inventory-audit.writer';
import { ItemService } from './services/item.service';
import { AUDIT_SERVICE_TOKEN } from '../audit/constants/di';
import type { AuditService } from '../audit/services/audit.service';
import { WarehouseService } from './services/warehouse.service';
import { StockService } from './services/stock.service';
import { AdjustmentService } from './services/adjustment.service';
import { BorrowingService } from './services/borrowing.service';
import {
	ADJUSTMENT_REPOSITORY_TOKEN,
	ADJUSTMENT_SERVICE_TOKEN,
	BALANCE_REPOSITORY_TOKEN,
	BORROWING_REPOSITORY_TOKEN,
	BORROWING_SERVICE_TOKEN,
	ITEM_REPOSITORY_TOKEN,
	ITEM_SERVICE_TOKEN,
	MOVEMENT_REPOSITORY_TOKEN,
	SERIAL_UNIT_REPOSITORY_TOKEN,
	STOCK_SERVICE_TOKEN,
	WAREHOUSE_ADDRESS_REPOSITORY_TOKEN,
	WAREHOUSE_REPOSITORY_TOKEN,
	WAREHOUSE_SERVICE_TOKEN,
	WAREHOUSE_STORAGE_REPOSITORY_TOKEN,
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
	container.register(ADJUSTMENT_SERVICE_TOKEN, {
		useClass: AdjustmentService,
	});

	// Borrowing injects StockService (it posts movements inside its own
	// transaction), so STOCK_SERVICE_TOKEN must already be registered above.
	container.register(BORROWING_REPOSITORY_TOKEN, {
		useClass: BorrowingRepository,
	});
	container.register(BORROWING_SERVICE_TOKEN, {
		useClass: BorrowingService,
	});
}
