import { inject, injectable } from 'tsyringe';
import { WAREHOUSE_REPOSITORY_TOKEN } from '../constants/di';
import type { IWarehouseRepository } from '../contracts/warehouse.repository.interface';

/**
 * Cross-module export facade for the inventory module's warehouses.
 *
 * @remarks
 * Consumed by other modules (e.g. `AssetService` decorating asset rows with
 * their storage warehouse's name) through
 * {@link EXPORTED_WAREHOUSE_SERVICE_TOKEN}. It deliberately depends **only on
 * the module's own repository** — never on another module's service — so
 * cross-module consumers cannot create a service-to-service dependency
 * cycle. Domain rules stay in `WarehouseService`; this class only relays
 * repository queries.
 */
@injectable()
export class ExportedWarehouseService {
	constructor(
		@inject(WAREHOUSE_REPOSITORY_TOKEN)
		private readonly warehouseRepository: IWarehouseRepository,
	) {}

	/**
	 * Resolves alive warehouse names for the given ids. Unknown or archived
	 * ids are simply absent from the returned map.
	 */
	async getNameMap(ids: string[]): Promise<Map<string, string>> {
		const rows = await this.warehouseRepository.findNamesByIds(ids);
		return new Map(rows.map((row) => [row.id, row.name]));
	}
}
