const DAY_MS = 86_400_000;

/**
 * Period keys from `from` to `to`, inclusive, oldest first.
 *
 * @remarks
 * `month` yields `YYYY-MM` keys (one per calendar month the window touches),
 * `day` yields `YYYY-MM-DD`. The window is a pair of Jakarta business dates, so
 * this arithmetic runs on UTC midnights and never consults the server zone.
 */
export function periodKeys(
	from: string,
	to: string,
	groupBy: 'month' | 'day',
): string[] {
	if (groupBy === 'month') {
		const keys: string[] = [];
		let [year, month] = from.split('-').map(Number) as [number, number];
		const [endYear, endMonth] = to.split('-').map(Number) as [number, number];
		while (year < endYear || (year === endYear && month <= endMonth)) {
			keys.push(`${year}-${String(month).padStart(2, '0')}`);
			month += 1;
			if (month > 12) {
				month = 1;
				year += 1;
			}
		}
		return keys;
	}
	const keys: string[] = [];
	const end = Date.parse(`${to}T00:00:00Z`);
	for (
		let at = Date.parse(`${from}T00:00:00Z`);
		at <= end;
		at += DAY_MS
	) {
		keys.push(new Date(at).toISOString().slice(0, 10));
	}
	return keys;
}
