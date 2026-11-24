/**
 * Ledger value of a stock quantity at a unit cost (ERP-0136/0137): quantity
 * is the 3-decimal string of the stock ledger, cost is integer IDR minor units.
 * Shared by every module that posts a stock movement, so receipts, bills,
 * returns, shipments and adjustments round the same way (half-up per line).
 */
export function inventoryValue(quantity: string | number, unitCost: number | null | undefined): number {
	return Math.round(Number(quantity) * (unitCost ?? 0));
}
