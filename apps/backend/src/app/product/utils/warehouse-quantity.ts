/**
 * Fills in the warehouse-scoped quantity of a product page.
 *
 * @remarks
 * The product master moved to the `product` module but the balances stayed in
 * `inventory` (`stocks`), so the list endpoint asked for a warehouse used to
 * compute the quantity in the repository's SQL with a correlated subquery over
 * another module's table (ADR-0026 forbids that). The projection is now a
 * second step: `product` asks the inventory facade for the page's product ids,
 * and this pure function zips the totals back onto the rows. Missing ids get
 * `0`, matching the old `COALESCE(..., 0)`.
 *
 * @param rows - The page's product rows
 * @param quantityByProduct - `on_hand` totals keyed by product id
 * @returns The rows carrying `quantityOnHand` when one was requested
 */
export function withWarehouseQuantity<T extends { id: string }>(
	rows: T[],
	quantityByProduct: Map<string, string | number> | undefined,
): Array<T & { quantityOnHand: string | null }> {
	return rows.map((row) => ({
		...row,
		quantityOnHand:
			quantityByProduct === undefined
				? null
				: String(quantityByProduct.get(row.id) ?? '0'),
	}));
}
