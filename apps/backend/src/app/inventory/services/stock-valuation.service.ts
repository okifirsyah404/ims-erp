import type { TPaginationResult } from '@ims-erp/common';
import { inject, injectable } from 'tsyringe';
import { paginationResult } from '@utils/pagination.util';
import { STOCK_VALUATION_REPOSITORY_TOKEN } from '../constants/di';
import type {
	IStockValuationRepository,
	TStockValuationQuery,
	TStockValuationRow,
	TStockValuationWarehouse,
} from '../contracts/stock-valuation.contract';

export type TStockValuation = TPaginationResult<TStockValuationRow> & {
	warehouses: TStockValuationWarehouse[];
	/** Value of everything in the filter, IDR minor units. */
	grandTotal: number;
};

/**
 * Inventory value view (ADR-0011 step 5b): what the stock is worth at its
 * moving-average cost, per balance and per warehouse. Read-only; no journal
 * is posted (the accounting module is not ported yet).
 */
@injectable()
export class StockValuationService {
	constructor(
		@inject(STOCK_VALUATION_REPOSITORY_TOKEN)
		private readonly valuation: IStockValuationRepository,
	) {}

	async get(query: TStockValuationQuery): Promise<TStockValuation> {
		const [{ rows, total }, warehouses] = await Promise.all([
			this.valuation.rows(query),
			this.valuation.byWarehouse(query.warehouseId),
		]);
		return {
			...paginationResult(query, total, rows),
			warehouses,
			grandTotal: warehouses.reduce((sum, warehouse) => sum + warehouse.totalValue, 0),
		};
	}
}
