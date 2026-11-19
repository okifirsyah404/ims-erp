import { inject, injectable } from 'tsyringe';
import {
	ITEM_REPOSITORY_TOKEN,
	ITEM_SERIAL_REPOSITORY_TOKEN,
	PRODUCT_REPOSITORY_TOKEN,
	WAREHOUSE_REPOSITORY_TOKEN,
	WAREHOUSE_STORAGE_REPOSITORY_TOKEN,
} from '../constants/di';
import type { IItemRepository } from '../contracts/item.repository.interface';
import type { IItemSerialRepository } from '../contracts/item-serial.repository.interface';
import type { IProductRepository } from '../contracts/product.repository.interface';
import type { IWarehouseStorageRepository } from '../contracts/warehouse-storage.repository.interface';
import type { IWarehouseRepository } from '../contracts/warehouse.repository.interface';

/**
 * Cross-module export facade of the inventory module (warehouses, products,
 * serials and item units).
 *
 * @remarks
 * Replaces the former warehouse and asset facades (ADR-0024 Q14). Consumed by
 * other modules through {@link EXPORTED_INVENTORY_SERVICE_TOKEN}. It depends
 * **only on the module's own repositories**, never on another module's
 * service, so consumers cannot create a service-to-service cycle. Domain rules
 * stay in the owning services; this class only relays repository queries.
 */
@injectable()
export class ExportedInventoryService {
	constructor(
		@inject(WAREHOUSE_REPOSITORY_TOKEN)
		private readonly warehouseRepository: IWarehouseRepository,
		@inject(ITEM_REPOSITORY_TOKEN)
		private readonly itemRepository: IItemRepository,
		@inject(WAREHOUSE_STORAGE_REPOSITORY_TOKEN)
		private readonly storageRepository: IWarehouseStorageRepository,
		@inject(PRODUCT_REPOSITORY_TOKEN)
		private readonly productRepository: IProductRepository,
		@inject(ITEM_SERIAL_REPOSITORY_TOKEN)
		private readonly serialRepository: IItemSerialRepository,
	) {}

	/** Alive warehouse names for the ids; unknown or archived ids are absent. */
	async getNameMap(ids: string[]): Promise<Map<string, string>> {
		const rows = await this.warehouseRepository.findNamesByIds(ids);
		return new Map(rows.map((row) => [row.id, row.name]));
	}

	/** Alive item units per warehouse, optionally of one item kind. */
	async countItemsByWarehouse(
		warehouseIds: string[],
		itemKind?: string,
	): Promise<Map<string, number>> {
		const rows = await this.itemRepository.countByWarehouse(warehouseIds, itemKind);
		const counts = new Map<string, number>();
		for (const row of rows) if (row.warehouseId) counts.set(row.warehouseId, row.value);
		return counts;
	}

	/**
	 * Whether an alive item unit of the organization exists; the contract method
	 * other modules call before writing an item reference (ADR-0014).
	 */
	async isItemOwnedBy(itemId: string, organizationId: string): Promise<boolean> {
		const item = await this.itemRepository.findById(itemId);
		return !!item && item.organizationId === organizationId;
	}

	/** Whether an alive warehouse exists (contract method for warehouse references). */
	async warehouseExists(warehouseId: string): Promise<boolean> {
		return !!(await this.warehouseRepository.findById(warehouseId));
	}

	/** Whether the storage exists and belongs to the warehouse. */
	async storageInWarehouse(storageId: string, warehouseId: string): Promise<boolean> {
		const storage = await this.storageRepository.findById(storageId);
		return !!storage && storage.warehouseId === warehouseId;
	}

	/** Snapshot of alive, active products for documents (name, SKU, unit, price). */
	async productSnapshot(ids: string[]) {
		const rows = await this.productRepository.findActiveByIds(ids);
		return new Map(
			rows.map((row) => [
				row.id,
				{
					id: row.id,
					sku: row.sku,
					name: row.name,
					unitLabel: row.unitLabel,
					sellingPrice: row.sellingPrice,
				},
			]),
		);
	}

	/** Whether a serial number is already registered (organization scope or global). */
	async serialExists(organizationId: string | null, serialNumber: string): Promise<boolean> {
		return !!(await this.serialRepository.findBySerial(organizationId, serialNumber));
	}
}
