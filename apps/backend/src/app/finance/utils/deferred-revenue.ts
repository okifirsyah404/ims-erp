/**
 * Straight-line monthly amortisation of deferred revenue (ERP-0135).
 *
 * A schedule recognises its total evenly per calendar month the service
 * period touches; the last month takes the remainder so the months always
 * add up to the total exactly.
 */

/** Calendar months `YYYY-MM` from `start` to `end`, inclusive. */
export function monthsBetween(start: string, end: string): string[] {
	const months: string[] = [];
	let [year, month] = start.slice(0, 7).split('-').map(Number);
	const [endYear, endMonth] = end.slice(0, 7).split('-').map(Number);
	while (year < endYear || (year === endYear && month <= endMonth)) {
		months.push(`${year}-${String(month).padStart(2, '0')}`);
		month += 1;
		if (month > 12) {
			month = 1;
			year += 1;
		}
	}
	return months;
}

/** Amount recognised in `month` (`YYYY-MM`); 0 outside the service period. */
export function amortisationForMonth(total: number, start: string, end: string, month: string): number {
	const months = monthsBetween(start, end);
	const index = months.indexOf(month);
	if (index < 0) return 0;
	const each = Math.floor(total / months.length);
	return index === months.length - 1 ? total - each * (months.length - 1) : each;
}

/** Last calendar day of `YYYY-MM` as `YYYY-MM-DD`. */
export function monthEnd(month: string): string {
	const [year, m] = month.split('-').map(Number);
	return new Date(Date.UTC(year, m, 0)).toISOString().slice(0, 10);
}

/** The month after `YYYY-MM`. */
export function nextMonth(month: string): string {
	const [year, m] = month.split('-').map(Number);
	return m === 12 ? `${year + 1}-01` : `${year}-${String(m + 1).padStart(2, '0')}`;
}
