import { z } from 'zod';

/**
 * Inventory value view (`/stock/valuation`, ADR-0011 step 5b): balances at
 * their moving-average cost. Money is IDR minor units.
 */
export const stockValuationQuerySchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(200).default(50),
	warehouseId: z.uuid().optional(),
	search: z.string().trim().max(100).optional(),
});

export type TStockValuationQuery = z.output<typeof stockValuationQuerySchema>;

/** One balance at cost. */
export type TStockValuationRow = {
	productId: string;
	sku: string;
	name: string;
	unit: string;
	warehouseId: string;
	warehouseCode: string;
	warehouseName: string;
	binCode: string | null;
	quantityOnHand: string;
	averageCost: number;
	totalValue: number;
};

/** Value held per warehouse. */
export type TStockValuationWarehouse = {
	warehouseId: string;
	code: string;
	name: string;
	balances: number;
	totalValue: number;
};

/** Persistence port for the inventory value view (read-only). */
export interface IStockValuationRepository {
	/** Non-zero balances, by warehouse then SKU. */
	rows(query: TStockValuationQuery): Promise<{ rows: TStockValuationRow[]; total: number }>;
	/** Value per warehouse over the same filter (search ignored: totals are per warehouse). */
	byWarehouse(warehouseId?: string): Promise<TStockValuationWarehouse[]>;
}
