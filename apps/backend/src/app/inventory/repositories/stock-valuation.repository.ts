import { DRIZZLE_TOKEN } from '@di/provider';
import { stocks } from '@drizzle/schemas/inventory.schema';
import { likePattern } from '@drizzle/search';
import { EXPORTED_PRODUCT_SERVICE_TOKEN } from '@app/product/constants/di';
import type { ExportedProductService } from '@app/product/services/exported-product.service';
import { EXPORTED_WAREHOUSE_SERVICE_TOKEN } from '@app/warehouse/constants/di';
import type { ExportedWarehouseService } from '@app/warehouse/services/exported-warehouse.service';
import { and, asc, count, eq, ilike, inArray, ne, or, sql } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type {
	IStockValuationRepository,
	TStockValuationQuery,
	TStockValuationRow,
	TStockValuationWarehouse,
} from '../contracts/stock-valuation.contract';

/**
 * Drizzle implementation of {@link IStockValuationRepository}: reads `stocks`
 * (kept by the ledger, with moving-average cost since ADR-0011 step 4b) and
 * decorates every row with the product and warehouse labels.
 *
 * @remarks
 * The product master and the warehouse estate are other modules since
 * ADR-0026, so this query no longer joins `product.products` or
 * `warehouse.*`. The labels and the warehouse ids come from the two export
 * facades in one batch per page; the search filter is pushed down as an id set
 * for the same reason.
 */
@injectable()
export class StockValuationRepository implements IStockValuationRepository {
	constructor(
		@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase,
		@inject(EXPORTED_PRODUCT_SERVICE_TOKEN)
		private readonly products: Pick<ExportedProductService, 'productsById' | 'findBySearch'>,
		@inject(EXPORTED_WAREHOUSE_SERVICE_TOKEN)
		private readonly warehouses: Pick<
			ExportedWarehouseService,
			'warehousesById' | 'findByWarehouseIds'
		>,
	) {}

	async rows(query: TStockValuationQuery): Promise<{ rows: TStockValuationRow[]; total: number }> {
		const { page, limit, warehouseId, search } = query;

		// Search and the warehouse label are resolved through the owning
		// modules first; an empty search result short-circuits to an empty page
		// (never to "no filter", which would leak every product).
		const matchingProductIds = search
			? (await this.products.findBySearch(search)).map((row) => row.id)
			: undefined;
		if (matchingProductIds !== undefined && matchingProductIds.length === 0) {
			return { rows: [], total: 0 };
		}

		const where = and(
			ne(stocks.quantityOnHand, '0'),
			warehouseId ? eq(stocks.warehouseId, warehouseId) : undefined,
			matchingProductIds ? inArray(stocks.productId, matchingProductIds) : undefined,
		);

		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(stocks)
			.where(where);

		const balances = await this.database
			.select()
			.from(stocks)
			.where(where)
			.limit(limit)
			.offset((page - 1) * limit);

		const [products, warehouses] = await Promise.all([
			this.products.productsById(balances.flatMap((row) => (row.productId ? [row.productId] : []))),
			this.warehouses.warehousesById(
				balances.flatMap((row) => (row.warehouseId ? [row.warehouseId] : [])),
			),
		]);

		const rows = balances.map((balance) => {
			const product = balance.productId ? products.get(balance.productId) : undefined;
			const warehouse = balance.warehouseId ? warehouses.get(balance.warehouseId) : undefined;
			return {
				productId: balance.productId ?? '',
				sku: product?.sku ?? '',
				name: product?.name ?? '',
				unit: product?.unitLabel ?? '',
				warehouseId: balance.warehouseId ?? '',
				warehouseCode: warehouse?.code ?? '',
				warehouseName: warehouse?.name ?? '',
				binCode: balance.binId,
				quantityOnHand: balance.quantityOnHand,
				averageCost: balance.averageCost,
				totalValue: balance.totalValue,
			};
		});

		// Stable page order: warehouse code, then SKU, then bin — the same keys
		// the SQL join used to sort on, resolved from the owning modules.
		rows.sort(
			(a, b) =>
				a.warehouseCode.localeCompare(b.warehouseCode) ||
				a.sku.localeCompare(b.sku) ||
				(a.binCode ?? '').localeCompare(b.binCode ?? ''),
		);

		return { rows, total };
	}

	async byWarehouse(warehouseId?: string): Promise<TStockValuationWarehouse[]> {
		const grouped = await this.database
			.select({
				warehouseId: stocks.warehouseId,
				balances: count(),
				totalValue: sql<string>`coalesce(sum(${stocks.totalValue}), 0)`,
			})
			.from(stocks)
			.where(
				and(
					ne(stocks.quantityOnHand, '0'),
					warehouseId ? eq(stocks.warehouseId, warehouseId) : undefined,
				),
			)
			.groupBy(stocks.warehouseId);

		const ids = grouped.flatMap((row) => (row.warehouseId ? [row.warehouseId] : []));
		const warehouses = await this.warehouses.findByWarehouseIds(ids);

		// `sum(bigint)` is numeric in Postgres; values stay within 2^53 for IDR minor units.
		return grouped
			.flatMap((row) => {
				const warehouse = row.warehouseId ? warehouses.get(row.warehouseId) : undefined;
				if (!warehouse) return [];
				return [
					{
						warehouseId: warehouse.id,
						code: warehouse.code,
						name: warehouse.name,
						balances: row.balances,
						totalValue: Number(row.totalValue),
					},
				];
			})
			.sort((a, b) => a.code.localeCompare(b.code));
	}
}
