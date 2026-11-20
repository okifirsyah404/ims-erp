import { inject, injectable } from 'tsyringe';
import { WAREHOUSE_ADDRESS_REPOSITORY_TOKEN, WAREHOUSE_REPOSITORY_TOKEN, WAREHOUSE_STORAGE_REPOSITORY_TOKEN } from '../constants/di';
import type { IWarehouseAddressRepository } from '../contracts/warehouse-address.repository.interface';
import type { IWarehouseRepository } from '../contracts/warehouse.repository.interface';
import type { IWarehouseStorageRepository } from '../contracts/warehouse-storage.repository.interface';

/**
 * Cross-module export facade of the warehouse module.
 *
 * @remarks
 * Consumed through {@link EXPORTED_WAREHOUSE_SERVICE_TOKEN}. It depends
 * **only on the module's own repositories**, never on another module's service,
 * so consumers (inventory, sale, procurement) cannot create a
 * service-to-service cycle (ADR-0026). It answers the `assert`/`resolve`
 * questions those modules ask before writing a logical warehouse or storage id
 * (ADR-0014); the write rules stay in `WarehouseService`.
 */
@injectable()
export class ExportedWarehouseService {
	constructor(
		@inject(WAREHOUSE_REPOSITORY_TOKEN)
		private readonly warehouses: Pick<
			IWarehouseRepository,
			'findById' | 'findNamesByIds' | 'isLinked' | 'findByIds' | 'findAlive'
		>,
		@inject(WAREHOUSE_STORAGE_REPOSITORY_TOKEN)
		private readonly storages: Pick<IWarehouseStorageRepository, 'findById'>,
		@inject(WAREHOUSE_ADDRESS_REPOSITORY_TOKEN)
		private readonly addresses: Pick<IWarehouseAddressRepository, 'findByWarehouseId'>,
	) {}

	/**
	 * Whether an alive warehouse exists (the check before writing a warehouse id
	 * on a movement, balance or document).
	 */
	async warehouseExists(warehouseId: string): Promise<boolean> {
		return !!(await this.warehouses.findById(warehouseId));
	}

	/** Whether the warehouse is alive and active (stock may still be posted). */
	async warehouseIsActive(warehouseId: string): Promise<boolean> {
		const warehouse = await this.warehouses.findById(warehouseId);
		return !!warehouse && warehouse.isActive;
	}

	/** Whether the storage exists and belongs to the warehouse. */
	async storageInWarehouse(storageId: string, warehouseId: string): Promise<boolean> {
		const storage = await this.storages.findById(storageId);
		return !!storage && storage.warehouseId === warehouseId;
	}

	/** Alive warehouse names for the ids; unknown or archived ids are absent. */
	async getNameMap(ids: string[]): Promise<Map<string, string>> {
		const rows = await this.warehouses.findNamesByIds(ids);
		return new Map(rows.map((row) => [row.id, row.name]));
	}

	/**
	 * The warehouse's organization scope, or `null` for the global scope.
	 *
	 * @remarks
	 * The stock ledger derives a balance's `organization_id` from the
	 * warehouse, so the inventory module reads the scope through this method
	 * instead of querying `warehouse.warehouses` itself.
	 */
	async organizationScope(warehouseId: string): Promise<{ found: false } | { found: true; organizationId: string | null }> {
		const warehouse = await this.warehouses.findById(warehouseId);
		if (!warehouse) return { found: false };
		return { found: true, organizationId: warehouse.organizationId };
	}

	/** Whether an organization is linked to the warehouse (ADR-0010). */
	async isLinked(warehouseId: string, organizationId: string): Promise<boolean> {
		return this.warehouses.isLinked(warehouseId, organizationId);
	}

	/** Warehouse code/name/id rows for the ids; unknown ids are absent. */
	async warehousesById(
		ids: string[],
	): Promise<Map<string, { id: string; code: string; name: string }>> {
		return toLabelMap(await this.warehouses.findByIds(ids));
	}

	/** Alias used by the stock value view: same lookup, explicit intent. */
	async findByWarehouseIds(
		ids: string[],
	): Promise<Map<string, { id: string; code: string; name: string }>> {
		return toLabelMap(await this.warehouses.findByIds(ids));
	}

	/**
	 * Every alive warehouse of a balance scope.
	 *
	 * @param organizationId - `null` selects the global warehouses
	 * @returns The ids, for a movement ledger filter owned by `inventory`
	 */
	async idsInScope(organizationId: string | null): Promise<string[]> {
		const rows = await this.warehouses.findAlive();
		return rows
			.filter((row) => (row.organizationId ?? null) === organizationId)
			.map((row) => row.id);
	}

	/** Whether the warehouse has an address on file. */
	async hasAddress(warehouseId: string): Promise<boolean> {
		return (await this.addresses.findByWarehouseId(warehouseId)) !== null;
	}
}

/** Keys a `{ id, code, name }` row list by id. */
function toLabelMap(
	rows: Array<{ id: string; code: string; name: string }>,
): Map<string, { id: string; code: string; name: string }> {
	return new Map(rows.map((row) => [row.id, row]));
}
