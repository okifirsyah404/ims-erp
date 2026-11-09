/**
 * Exact integer money arithmetic (ADR-0002): amounts are IDR minor units,
 * divisions use BigInt and round half-up, so large totals never lose
 * precision. Shared by the backend rules and the browser previews.
 */

/** round(numerator / denominator), half-up, for non-negative integers. */
export function divHalfUp(numerator: bigint, denominator: bigint): bigint {
	return (numerator * 2n + denominator) / (denominator * 2n);
}

/** {@link divHalfUp} as a number (safe for amounts within Number.MAX_SAFE_INTEGER). */
export function divHalfUpToNumber(numerator: bigint, denominator: bigint): number {
	return Number(divHalfUp(numerator, denominator));
}

/** round(amount x bps / 10000), half-up: a share in basis points (3000 = 30%). */
export function bpsShare(amount: number, bps: number): number {
	return divHalfUpToNumber(BigInt(amount) * BigInt(bps), 10_000n);
}

/** Quantities carry at most three decimals (`numeric(18,3)`). */
const QUANTITY_SCALE = 1000n;

/**
 * Parses a quantity (`"12.5"`, `12.5`, `"3"`) into thousandths.
 *
 * @throws {RangeError} When it is not a non-negative number with at most
 * three decimals
 */
export function quantityToMilli(quantity: string | number): bigint {
	const text = typeof quantity === 'number' ? String(quantity) : quantity.trim();
	const match = /^(\d+)(?:\.(\d{1,3})0*)?$/.exec(text);
	if (!match) throw new RangeError(`Invalid quantity: ${text}`);
	return BigInt(match[1]!) * QUANTITY_SCALE + BigInt((match[2] ?? '').padEnd(3, '0'));
}

/** round(quantity x unitPrice), half-up, for a quantity with up to three decimals. */
export function quantityTimesPrice(quantity: string | number, unitPrice: number): number {
	return divHalfUpToNumber(quantityToMilli(quantity) * BigInt(unitPrice), QUANTITY_SCALE);
}
