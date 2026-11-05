/**
 * Inventory value view (ADR-0011 step 5b): balances at cost, value per
 * warehouse and the grand total over the same warehouse filter.
 */
import { describe, expect, test } from 'bun:test';
import type { TStockValuationQuery } from '../../src/app/inventory/contracts/stock-valuation.contract';
import { StockValuationService } from '../../src/app/inventory/services/stock-valuation.service';

describe('stock valuation', () => {
	test('pages the balances and totals the value per warehouse', async () => {
		const seen: (string | undefined)[] = [];
		const service = new StockValuationService({
			async rows(query: TStockValuationQuery) {
				seen.push(query.warehouseId);
				return {
					rows: [
						{
							itemId: 'i1',
							sku: 'CBL',
							name: 'Kabel',
							unit: 'm',
							warehouseId: 'w1',
							warehouseCode: 'WH1',
							warehouseName: 'Gudang',
							binCode: null,
							quantityOnHand: '10.000',
							averageCost: 7_000,
							totalValue: 70_000,
						},
					],
					total: 51,
				};
			},
			async byWarehouse(warehouseId?: string) {
				seen.push(warehouseId);
				return [
					{ warehouseId: 'w1', code: 'WH1', name: 'Gudang', balances: 40, totalValue: 70_000 },
					{ warehouseId: 'w2', code: 'WH2', name: 'Cabang', balances: 11, totalValue: 30_001 },
				];
			},
		});
		const result = await service.get({ page: 2, limit: 50, warehouseId: 'w1' });
		expect(result.meta).toEqual({ page: 2, limit: 50, total: 51, totalPages: 2 });
		expect(result.grandTotal).toBe(100_001);
		expect(result.warehouses).toHaveLength(2);
		expect(seen).toEqual(['w1', 'w1']);
	});
});
