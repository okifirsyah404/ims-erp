/**
 * Business dates are Asia/Jakarta days (UTC+7, no daylight saving);
 * timestamps are unix milliseconds. Shared by backend and browser.
 */
export const BUSINESS_TIME_ZONE = 'Asia/Jakarta';
export const JAKARTA_OFFSET_MS = 7 * 3_600_000;
const DAY_MS = 86_400_000;

/** Last millisecond (23:59:59.999 WIB) of the Jakarta day containing `at`. */
export function endOfBusinessDay(at: Date | number): number {
	const local = new Date(at).getTime() + JAKARTA_OFFSET_MS;
	return Math.floor(local / DAY_MS) * DAY_MS + DAY_MS - 1 - JAKARTA_OFFSET_MS;
}

/** Last millisecond (23:59:59.999 WIB) of a `YYYY-MM-DD` business date. */
export function endOfBusinessDate(date: string): number {
	const [y = 1970, m = 1, d = 1] = date.split('-').map(Number);
	return Date.UTC(y, m - 1, d + 1) - 1 - JAKARTA_OFFSET_MS;
}

/** The Jakarta business date (`YYYY-MM-DD`) containing `at`. */
export function businessDateOf(at: Date | number = Date.now()): string {
	return new Date(new Date(at).getTime() + JAKARTA_OFFSET_MS).toISOString().slice(0, 10);
}
