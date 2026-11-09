import { container } from 'tsyringe';
import { domainPlugin } from '@http/plugin';
import { ok } from '@http/response';
import { STOCK_VALUATION_SERVICE_TOKEN } from '../constants/di';
import { stockValuationQuerySchema } from '../contracts/stock-valuation.contract';

/**
 * REST controller for the inventory value view (`/stock/valuation`,
 * ADR-0011 step 5b). Cost is restricted, so both `stock:read` and
 * `product:read_cost` are required (owner, finance, purchasing).
 */
export class StockValuationController {
	static plugin() {
		const service = container.resolve(STOCK_VALUATION_SERVICE_TOKEN);

		return domainPlugin({ name: 'inventory-stock-valuation', prefix: '/stock/valuation', tags: ['Inventory'], guards: 'erp' }).get(
			'',
			async ({ query }) => ok(await service.get(stockValuationQuerySchema.parse(query))),
			{
				erp: { permission: ['stock:read', 'product:read_cost'] },
				detail: { description: 'Stock at moving-average cost, per balance and per warehouse' },
			},
		);
	}
}
