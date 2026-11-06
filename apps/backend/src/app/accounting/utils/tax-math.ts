/**
 * Pure tax arithmetic: rates, rounding, effective-date selection, overlap.
 *
 * @remarks
 * Money is integer minor units (ADR-0002). Rates are percentages with four
 * decimals (`numeric(9,4)`). Everything here uses `bigint` internally, so no
 * float ever touches an amount.
 *
 * Rounding is half-up to the nearest whole rupiah, which is {@link
 * ROUNDING_UNIT_MINOR} minor units. This is the documented default from
 * `docs/plan/plans/tax.md` (D14). Finance still has to confirm it before UAT.
 */

/** Minor units per whole rupiah. Finance gate: change only after confirmation. */
export const ROUNDING_UNIT_MINOR = 100n;

/** Scale of the stored rate: `numeric(9,4)`. */
const RATE_SCALE = 10_000n;

/** Denominator for `amount * rateScaled / 100%` with a 4-decimal rate. */
const PERCENT_DENOMINATOR = 100n * RATE_SCALE;

/** Open-ended `effective_to` compares as the far future. */
const OPEN_END = '9999-12-31';

/** A tax row's effective window, as stored (`YYYY-MM-DD` strings). */
export type TEffectiveWindow = {
	effectiveFrom: string;
	effectiveTo: string | null;
};

/**
 * Parses a `numeric(9,4)` percentage string into an integer scaled by 10^4.
 *
 * @example parseRateScaled('11') === 110000n
 * @throws RangeError when the string is not a non-negative decimal with at
 * most four fractional digits
 */
export function parseRateScaled(rate: string): bigint {
	const match = /^(\d{1,5})(?:\.(\d{1,4}))?$/.exec(rate.trim());
	if (!match) throw new RangeError(`Invalid tax rate: ${rate}`);
	const whole = BigInt(match[1] ?? '0');
	const fraction = BigInt((match[2] ?? '').padEnd(4, '0'));
	return whole * RATE_SCALE + fraction;
}

/**
 * Computes the tax amount for a taxable base at a given rate.
 *
 * @param baseMinor - Taxable base in minor units, non-negative integer
 * @param rate - Percentage string, e.g. `'11.0000'`
 * @returns Tax in minor units, rounded half-up to {@link ROUNDING_UNIT_MINOR}
 */
export function computeTaxAmountMinor(baseMinor: number, rate: string): number {
	if (!Number.isSafeInteger(baseMinor) || baseMinor < 0) {
		throw new RangeError('Taxable base must be a non-negative safe integer');
	}
	const numerator = BigInt(baseMinor) * parseRateScaled(rate);
	// floor((x + half) / unit) * unit, with x = numerator / PERCENT_DENOMINATOR
	const half = PERCENT_DENOMINATOR * ROUNDING_UNIT_MINOR / 2n;
	const unitsOfRounding =
		(numerator + half) / (PERCENT_DENOMINATOR * ROUNDING_UNIT_MINOR);
	return Number(unitsOfRounding * ROUNDING_UNIT_MINOR);
}

/** First day of a period as a `YYYY-MM-DD` string. */
export function periodStartDate(year: number, month: number): string {
	return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-01`;
}

/** Whether a date falls inside a row's window (inclusive, open-ended `to`). */
export function isEffectiveOn(window: TEffectiveWindow, date: string): boolean {
	return (
		window.effectiveFrom <= date &&
		(window.effectiveTo === null || window.effectiveTo >= date)
	);
}

/**
 * Chooses the row that applies on `date`: the latest `effectiveFrom` among
 * rows whose window covers the date. Returns `undefined` when none does.
 */
export function pickEffectiveRow<T extends TEffectiveWindow>(
	rows: readonly T[],
	date: string,
): T | undefined {
	let best: T | undefined;
	for (const row of rows) {
		if (!isEffectiveOn(row, date)) continue;
		if (!best || row.effectiveFrom > best.effectiveFrom) best = row;
	}
	return best;
}

/** Whether two effective windows share at least one day. */
export function windowsOverlap(a: TEffectiveWindow, b: TEffectiveWindow): boolean {
	return (
		a.effectiveFrom <= (b.effectiveTo ?? OPEN_END) &&
		b.effectiveFrom <= (a.effectiveTo ?? OPEN_END)
	);
}
