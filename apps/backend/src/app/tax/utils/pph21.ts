/**
 * PPh 21 arithmetic (ERP-0138): TER monthly withholding (PP 58/2023) and the
 * annual Pasal 17 reconciliation (UU HPP). Pure functions over integer IDR
 * minor units; rates are `numeric` percentage strings from the tax tables.
 *
 * @remarks
 * The tables are data, never constants here: PTKP and Pasal 17 are seeded,
 * TER rows are imported by finance. A rate applies from its `lowerBound` up
 * to the next row's, so a table has no gaps between whole-rupiah bounds.
 */

/** One rupiah in minor units. */
const RUPIAH = 100;
/** Biaya jabatan: 5% of gross, at most Rp500.000 a month (Rp6.000.000 a year). */
const POSITION_COST_MONTHLY_CAP = 500_000 * RUPIAH;
/** Pension contributions paid by the employee: at most Rp200.000 a month. */
const PENSION_MONTHLY_CAP = 200_000 * RUPIAH;
/** PKP is rounded down to whole thousands of rupiah. */
const PKP_ROUNDING = 1_000 * RUPIAH;

export type TPph21Ptkp = { statusCode: string; annualAmount: number; terCategory: string };
export type TPph21Band = { lowerBound: number; rate: string };
export type TPph21TerBand = TPph21Band & { category: string };

/** The tables in force on a date, as the tax module serves them. */
export type TPph21Tables = {
	ptkp: TPph21Ptkp[];
	ptkpEffectiveFrom: string | null;
	ter: TPph21TerBand[];
	terEffectiveFrom: string | null;
	brackets: TPph21Band[];
	bracketsEffectiveFrom: string | null;
};

/** `'0.2500'` → 2500: the percentage scaled by 10^4, exact for numeric(7,4). */
export function rateMicro(rate: string): number {
	const [whole = '0', fraction = ''] = rate.trim().split('.');
	return Number(whole) * 10_000 + Number(fraction.padEnd(4, '0').slice(0, 4));
}

/** `amount × rate%`, exact in integers, rounded down to whole rupiah. */
export function applyRate(amount: number, rate: string): number {
	if (amount <= 0) return 0;
	const minor = Math.floor((amount * rateMicro(rate)) / 1_000_000);
	return Math.floor(minor / RUPIAH) * RUPIAH;
}

/** The band whose lower bound is the highest at or below `amount`. */
function bandFor<T extends TPph21Band>(bands: T[], amount: number): T | null {
	let found: T | null = null;
	for (const band of bands) {
		if (band.lowerBound <= amount && (!found || band.lowerBound > found.lowerBound)) found = band;
	}
	return found;
}

/** PTKP row of a status; a missing or unknown status counts as TK/0. */
export function ptkpFor(tables: Pick<TPph21Tables, 'ptkp'>, status: string | null): TPph21Ptkp | null {
	return tables.ptkp.find((row) => row.statusCode === (status ?? 'TK/0')) ?? tables.ptkp.find((row) => row.statusCode === 'TK/0') ?? null;
}

/** TER rate for a category and monthly gross; `null` when the category has no rows. */
export function terRateFor(tables: Pick<TPph21Tables, 'ter'>, category: string, monthlyGross: number): string | null {
	return bandFor(
		tables.ter.filter((row) => row.category === category),
		Math.max(0, monthlyGross),
	)?.rate ?? null;
}

/** Pasal 17 progressive tax on an annual PKP. */
export function progressiveTax(pkp: number, brackets: TPph21Band[]): number {
	if (pkp <= 0) return 0;
	const sorted = [...brackets].sort((a, b) => a.lowerBound - b.lowerBound);
	let tax = 0;
	for (const [index, band] of sorted.entries()) {
		if (pkp <= band.lowerBound) break;
		const upper = sorted[index + 1]?.lowerBound ?? Number.POSITIVE_INFINITY;
		const slice = Math.min(pkp, upper) - band.lowerBound;
		tax += Math.floor((slice * rateMicro(band.rate)) / 1_000_000);
	}
	return Math.floor(tax / RUPIAH) * RUPIAH;
}

export type TAnnualPph21 = {
	annualGross: number;
	positionCost: number;
	pension: number;
	annualNet: number;
	ptkp: number;
	pkp: number;
	annualTax: number;
};

/**
 * Annual PPh 21 of a permanent employee for the last tax month (December or
 * the month employment ends).
 *
 * @param months - months worked in the year, which scales both caps.
 */
export function annualPph21(input: {
	annualGross: number;
	months: number;
	pensionContribution: number;
	ptkpAnnual: number;
	brackets: TPph21Band[];
}): TAnnualPph21 {
	const months = Math.min(12, Math.max(1, input.months));
	const positionCost = Math.min(Math.floor((input.annualGross * 5) / 100), POSITION_COST_MONTHLY_CAP * months);
	const pension = Math.min(Math.max(0, input.pensionContribution), PENSION_MONTHLY_CAP * months);
	const annualNet = input.annualGross - positionCost - pension;
	const pkp = Math.max(0, Math.floor((annualNet - input.ptkpAnnual) / PKP_ROUNDING) * PKP_ROUNDING);
	return {
		annualGross: input.annualGross,
		positionCost,
		pension,
		annualNet,
		ptkp: input.ptkpAnnual,
		pkp,
		annualTax: progressiveTax(pkp, input.brackets),
	};
}
