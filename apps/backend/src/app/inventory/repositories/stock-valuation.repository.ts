import { DRIZZLE_TOKEN } from '@di/provider';
import { products, stocks, warehouses, warehouseStorages } from '@drizzle/schemas/inventory.schema';
import { likePattern } from '@drizzle/search';
import { and, asc, count, eq, ilike, ne, or, sql } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type {
	IStockValuationRepository,
	TStockValuationQuery,
	TStockValuationRow,
	TStockValuationWarehouse,
} from '../contracts/stock-valuation.contract';

/**
 * Drizzle implementation of {@link IStockValuationRepository}: reads
 * `stocks` (kept by the ledger, with moving-average cost since
 * ADR-0011 step 4b) joined to the item and warehouse names.
 */
@injectable()
export class StockValuationRepository implements IStockValuationRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	async rows(query: TStockValuationQuery): Promise<{ rows: TStockValuationRow[]; total: number }> {
		const { page, limit, warehouseId, search } = query;
		const where = and(
			ne(stocks.quantityOnHand, '0'),
			warehouseId ? eq(stocks.warehouseId, warehouseId) : undefined,
			search ? or(ilike(products.sku, likePattern(search)), ilike(products.name, likePattern(search))) : undefined,
		);
		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(stocks)
			.innerJoin(products, eq(products.id, stocks.productId))
			.where(where);
		const rows = await this.database
			.select({
				productId: stocks.productId,
				sku: products.sku,
				name: products.name,
				unit: products.unitLabel,
				warehouseId: stocks.warehouseId,
				warehouseCode: warehouses.code,
				warehouseName: warehouses.name,
				binCode: warehouseStorages.code,
				quantityOnHand: stocks.quantityOnHand,
				averageCost: stocks.averageCost,
				totalValue: stocks.totalValue,
			})
			.from(stocks)
			.innerJoin(products, eq(products.id, stocks.productId))
			.innerJoin(warehouses, eq(warehouses.id, stocks.warehouseId))
			.leftJoin(warehouseStorages, eq(warehouseStorages.id, stocks.binId))
			.where(where)
			.orderBy(asc(warehouses.code), asc(products.sku), asc(warehouseStorages.code))
			.limit(limit)
			.offset((page - 1) * limit);
		return { rows, total };
	}

	async byWarehouse(warehouseId?: string): Promise<TStockValuationWarehouse[]> {
		const rows = await this.database
			.select({
				warehouseId: warehouses.id,
				code: warehouses.code,
				name: warehouses.name,
				balances: count(),
				totalValue: sql<string>`coalesce(sum(${stocks.totalValue}), 0)`,
			})
			.from(stocks)
			.innerJoin(warehouses, eq(warehouses.id, stocks.warehouseId))
			.where(and(ne(stocks.quantityOnHand, '0'), warehouseId ? eq(stocks.warehouseId, warehouseId) : undefined))
			.groupBy(warehouses.id, warehouses.code, warehouses.name)
			.orderBy(asc(warehouses.code));
		// `sum(bigint)` is numeric in Postgres; values stay within 2^53 for IDR minor units.
		return rows.map((row) => ({ ...row, totalValue: Number(row.totalValue) }));
	}
}
