import { inject, injectable } from 'tsyringe';
import { EXPORTED_PRODUCT_SERVICE_TOKEN } from '@app/product/constants/di';
import type { ExportedProductService } from '@app/product/services/exported-product.service';
import {
	BORROWING_REQUEST_REPOSITORY_TOKEN,
	ITEM_REPOSITORY_TOKEN,
	ITEM_SERIAL_REPOSITORY_TOKEN,
	STOCK_REPOSITORY_TOKEN,
} from '../constants/di';
import type { IBorrowingRequestRepository } from '../contracts/borrowing.repository.interface';
import type { IItemRepository } from '../contracts/item.repository.interface';
import type { IItemSerialRepository } from '../contracts/item-serial.repository.interface';
import type { IStockRepository } from '../contracts/stock.repository.interface';

/**
 * Product-kind lookup, resolved lazily.
 *
 * @remarks
 * The product master and the stock facts reference each other once
 * (`ExportedInventoryService` wants a product's kind; `ExportedProductService`
 * wants a product's serial count), which is a genuine cycle in the object
 * graph. Resolving the product facade **lazily, on first use**, is what keeps
 * it out of tsyringe's constructor recursion: both facades are constructed
 * with no dependency on each other, and the edge only exists at call time.
 * Both sides are stateless, so this cannot observe a half-built object.
 * (ADR-0026, "cycle breaking".)
 */
@injectable()
export class ProductKindsPort {
	private facade: Pick<ExportedProductService, 'productKinds'> | null = null;

	constructor(
		@inject(EXPORTED_PRODUCT_SERVICE_TOKEN)
		private readonly resolveFacade: () => Pick<ExportedProductService, 'productKinds'>,
	) {}

	/** Kind of each product, keyed by id (missing ids are absent). */
	productKinds(ids: string[]): Promise<Map<string, string>> {
		const facade = this.resolveFacade();
		return facade.productKinds(ids);
	}
}

/**
 * Cross-module export facade of the inventory module.
 *
 * @remarks
 * Consumed by other modules through {@link EXPORTED_INVENTORY_SERVICE_TOKEN}.
 * It depends on **this module's own repositories** plus the `product` module's
 * repository-only facade (a product kind is a product fact), never on another
 * module's *service*, so consumers cannot create a service-to-service cycle.
 * Domain rules stay in the owning services; this class only relays repository
 * queries.
 *
 * ADR-0026 moved the product master to `product` and the warehouse estate to
 * `warehouse`, so the warehouse- and product-shaped methods that used to live
 * here now live in `ExportedWarehouseService` / `ExportedProductService`. What
 * stays here is the physical truth — units, balances, borrowings — and that is
 * what `product` and `warehouse` read back.
 */
@injectable()
export class ExportedInventoryService {
	constructor(
		@inject(ITEM_REPOSITORY_TOKEN)
		private readonly items: Pick<IItemRepository, 'findById' | 'countByWarehouse'>,
		@inject(ITEM_SERIAL_REPOSITORY_TOKEN)
		private readonly serials: Pick<
			IItemSerialRepository,
			'findBySerial' | 'countLiveUnits' | 'countLiveUnitsByProduct' | 'countByWarehouse'
		>,
		@inject(STOCK_REPOSITORY_TOKEN)
		private readonly stocks: Pick<
			IStockRepository,
			'availableByProducts' | 'productIdsInWarehouse' | 'countMaterialStocks'
		>,
		@inject(BORROWING_REQUEST_REPOSITORY_TOKEN)
		private readonly borrowings: Pick<IBorrowingRequestRepository, 'countOpenByOriginWarehouse'>,
		@inject(ProductKindsPort)
		private readonly products: ProductKindsPort,
	) {}

	/**
	 * Alive item units per warehouse, optionally of one item kind.
	 *
	 * @remarks
	 * Used by `warehouse` to decorate its list and detail pages with the
	 * equipment count.
	 */
	async countItemsByWarehouse(
		warehouseIds: string[],
		itemKind?: string,
	): Promise<Array<{ warehouseId: string | null; value: number }>> {
		return this.items.countByWarehouse(warehouseIds, itemKind);
	}

	/**
	 * Whether an alive item unit of the organization exists; the contract method
	 * other modules call before writing an item reference (ADR-0014).
	 */
	async isItemOwnedBy(itemId: string, organizationId: string): Promise<boolean> {
		const item = await this.items.findById(itemId);
		return !!item && item.organizationId === organizationId;
	}

	/**
	 * Available quantity per product, summed over the bins of every warehouse.
	 *
	 * @remarks
	 * `product` needs it twice: the catalogue's stock status and the
	 * warehouse-scoped quantity column of the product list (ADR-0026).
	 */
	async availableByProducts(
		ids: string[],
	): Promise<Array<{ productId: string; available: number }>> {
		if (ids.length === 0) return [];
		return this.stocks.availableByProducts(ids);
	}

	/**
	 * Products with a physical presence in the warehouse: a live serialized
	 * unit or a stock balance.
	 *
	 * @remarks
	 * `product` filters its list by warehouse with this id set. Two `EXISTS`
	 * per row would have meant querying `inventory.*` from the product module,
	 * so the id set is computed here instead.
	 */
	async productIdsInWarehouse(warehouseId: string): Promise<string[]> {
		return this.stocks.productIdsInWarehouse(warehouseId);
	}

	/** Live serial units of a product (archive guard and product decoration). */
	async countSerials(productId: string): Promise<number> {
		return this.serials.countLiveUnitsByProduct(productId);
	}

	/** Whether a serial number is already registered (organization scope or global). */
	async serialExists(organizationId: string | null, serialNumber: string): Promise<boolean> {
		return !!(await this.serials.findBySerial(organizationId, serialNumber));
	}

	/** Live serialized units currently held in a warehouse (archive guard). */
	async countLiveUnits(warehouseId: string): Promise<number> {
		return this.serials.countLiveUnits(warehouseId);
	}

	/** Open borrowings originating in a warehouse (unlink guard, ERP-0031). */
	async countOpenBorrowingsByOriginWarehouse(
		warehouseId: string,
		organizationId: string,
	): Promise<number> {
		return this.borrowings.countOpenByOriginWarehouse(warehouseId, organizationId);
	}

	/** Distinct products with a positive on-hand balance per warehouse. */
	async countMaterialStocks(
		warehouseIds: string[],
	): Promise<Array<{ warehouseId: string | null; value: number }>> {
		const rows = await this.stocks.countMaterialStocks(warehouseIds);
		const counts = new Map<string, number>();
		for (const row of rows) {
			if (row.warehouseId === null) continue;
			counts.set(row.warehouseId, (counts.get(row.warehouseId) ?? 0) + 1);
		}
		return [...counts].map(([warehouseId, value]) => ({ warehouseId, value }));
	}

	/**
	 * Live serialized units per warehouse, grouped by the product's kind.
	 *
	 * @remarks
	 * The kind lives in the `product` module, so the grouping is finished here
	 * from the unit rows this module owns plus a batch kind lookup through the
	 * product facade.
	 */
	async countSerialKindsByWarehouse(
		warehouseIds: string[],
	): Promise<Array<{ warehouseId: string | null; key: string; value: number }>> {
		const rows = await this.serials.countByWarehouse(warehouseIds);
		if (rows.length === 0) return [];
		const kinds = await this.products.productKinds([
			...new Set(rows.map((row) => row.productId)),
		]);
		const grouped = new Map<string, { warehouseId: string; key: string; value: number }>();
		for (const row of rows) {
			if (row.warehouseId === null) continue;
			const key = `${row.warehouseId}:${kinds.get(row.productId) ?? 'unknown'}`;
			const entry = grouped.get(key);
			if (entry) entry.value += row.value;
			else
				grouped.set(key, {
					warehouseId: row.warehouseId,
					key: kinds.get(row.productId) ?? 'unknown',
					value: row.value,
				});
		}
		return [...grouped.values()];
	}
}
