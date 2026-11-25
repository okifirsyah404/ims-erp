/**
 * Business-date helpers shared by the portal screens.
 *
 * @remarks
 * Business dates are Asia/Jakarta days (`YYYY-MM-DD`), the same convention the
 * backend uses (`@utils/business-date.util`), so "today" on the phone and
 * "today" on the server can never disagree by a timezone.
 */
const JAKARTA_OFFSET_MS = 7 * 3_600_000;

/** The Jakarta business date containing `at` (default: now). */
export function businessDate(at: Date | number = Date.now()): string {
	return new Date(new Date(at).getTime() + JAKARTA_OFFSET_MS).toISOString().slice(0, 10);
}

/** The current Jakarta period, `YYYY-MM`. */
export function currentPeriod(at: Date | number = Date.now()): string {
	return businessDate(at).slice(0, 7);
}

/** Monday of the week containing `date`, as a `YYYY-MM-DD` business date. */
export function weekStart(date: string = businessDate()): string {
	const value = new Date(`${date}T00:00:00Z`);
	const weekday = (value.getUTCDay() + 6) % 7;
	value.setUTCDate(value.getUTCDate() - weekday);
	return value.toISOString().slice(0, 10);
}

/** Shifts a `YYYY-MM-DD` date by whole days. */
export function addDays(date: string, days: number): string {
	const value = new Date(`${date}T00:00:00Z`);
	value.setUTCDate(value.getUTCDate() + days);
	return value.toISOString().slice(0, 10);
}

/** Localized `day` label for a business date (`id-ID` / `en-GB`). */
export function weekdayLabel(date: string, language: string): string {
	return new Intl.DateTimeFormat(language === 'id' ? 'id-ID' : 'en-GB', {
		weekday: 'short',
		day: '2-digit',
		month: 'short',
		timeZone: 'UTC',
	}).format(new Date(`${date}T00:00:00Z`));
}
