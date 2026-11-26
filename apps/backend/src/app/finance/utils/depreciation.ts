import type { TFiscalGroup } from '@drizzle/schemas/finance.schema';

/**
 * Depreciation arithmetic (ERP-0145). Pure, integer IDR minor units, amounts
 * rounded down to whole rupiah.
 */

const RUPIAH = 100;
const floorRupiah = (minor: number) => Math.floor(minor / RUPIAH) * RUPIAH;

/**
 * One month of commercial depreciation.
 *
 * @remarks
 * Straight line: (cost - salvage) / useful life. Declining balance: double
 * declining on the book value (2 / life per month). Never below salvage; the
 * last month of the useful life takes whatever is left above salvage.
 */
export function monthlyDepreciation(input: {
	cost: number;
	salvage: number;
	bookValue: number;
	usefulLifeMonths: number;
	method: 'straight_line' | 'declining_balance' | 'none';
	/** Months already depreciated before this one. */
	monthsElapsed: number;
}): number {
	const remaining = input.bookValue - input.salvage;
	if (input.method === 'none' || input.usefulLifeMonths <= 0 || remaining <= 0) return 0;
	if (input.monthsElapsed >= input.usefulLifeMonths - 1) return remaining;
	const amount =
		input.method === 'straight_line'
			? floorRupiah((input.cost - input.salvage) / input.usefulLifeMonths)
			: floorRupiah((input.bookValue * 2) / input.usefulLifeMonths);
	return Math.min(Math.max(amount, 0), remaining);
}

/** UU PPh Pasal 11: useful life in years and the yearly rates per group. */
export const FISCAL_GROUP_RULES: Record<TFiscalGroup, { years: number; straightLine: number; decliningBalance: number | null }> = {
	kelompok_1: { years: 4, straightLine: 0.25, decliningBalance: 0.5 },
	kelompok_2: { years: 8, straightLine: 0.125, decliningBalance: 0.25 },
	kelompok_3: { years: 16, straightLine: 0.0625, decliningBalance: 0.125 },
	kelompok_4: { years: 20, straightLine: 0.05, decliningBalance: 0.1 },
	bangunan_permanen: { years: 20, straightLine: 0.05, decliningBalance: null },
	bangunan_tidak_permanen: { years: 10, straightLine: 0.1, decliningBalance: null },
};

/**
 * Fiscal depreciation of one asset up to a tax year: what earlier years took
 * and what `year` takes. Depreciation starts in the month of acquisition; the
 * first year is pro-rated by months. Declining balance expenses the remaining
 * book value in the last year of the useful life; buildings are straight
 * line only.
 */
export function fiscalDepreciation(input: {
	cost: number;
	capitalizedOn: string;
	group: TFiscalGroup;
	method: 'straight_line' | 'declining_balance' | 'none';
	year: number;
}): { method: 'straight_line' | 'declining_balance'; accumulatedBefore: number; yearAmount: number } {
	const rule = FISCAL_GROUP_RULES[input.group];
	const method = input.method === 'declining_balance' && rule.decliningBalance !== null ? 'declining_balance' : 'straight_line';
	const startYear = Number(input.capitalizedOn.slice(0, 4));
	const startMonth = Number(input.capitalizedOn.slice(5, 7));
	const lifeMonths = rule.years * 12;
	let usedMonths = 0;
	let book = input.cost;
	let accumulatedBefore = 0;
	let yearAmount = 0;
	for (let y = startYear; y <= input.year && usedMonths < lifeMonths; y += 1) {
		const months = Math.min(y === startYear ? 13 - startMonth : 12, lifeMonths - usedMonths);
		usedMonths += months;
		const last = usedMonths >= lifeMonths;
		let amount: number;
		if (method === 'straight_line') {
			amount = last ? book : Math.min(book, floorRupiah((input.cost * rule.straightLine * months) / 12));
		} else {
			amount = last ? book : Math.min(book, floorRupiah((book * (rule.decliningBalance as number) * months) / 12));
		}
		book -= amount;
		if (y < input.year) accumulatedBefore += amount;
		else yearAmount = amount;
	}
	return { method, accumulatedBefore, yearAmount };
}
