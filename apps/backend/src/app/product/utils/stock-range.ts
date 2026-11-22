/**
 * Turns an on-hand range into an id predicate over `products.id`.
 *
 * @remarks
 * The stock totals live in `inventory` and only exist for products that have a
 * stock row; every other product holds 0. A range that includes 0 (the common
 * "up to N" case) therefore has to match products *without* a row too, so it is
 * expressed as `NOT IN (rows outside the range)`; a range that excludes 0 is a
 * plain `IN (rows inside the range)`.
 *
 * @param totals - Summed available quantity per product, rows only
 * @param min - Inclusive lower bound, if any
 * @param max - Inclusive upper bound, if any
 * @returns `in` / `notIn` with the ids to apply, or `null` for no filter
 */
export function stockRangePredicate(
	totals: ReadonlyArray<{ productId: string; available: number }>,
	min: number | undefined,
	max: number | undefined,
): { mode: 'in' | 'notIn'; ids: string[] } | null {
	if (min === undefined && max === undefined) return null;
	const inRange = (value: number) =>
		(min === undefined || value >= min) && (max === undefined || value <= max);

	if (inRange(0)) {
		return {
			mode: 'notIn',
			ids: totals.filter((row) => !inRange(row.available)).map((row) => row.productId),
		};
	}
	return {
		mode: 'in',
		ids: totals.filter((row) => inRange(row.available)).map((row) => row.productId),
	};
}
