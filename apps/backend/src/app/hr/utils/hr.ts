/**
 * Pure HR rules (M08 stage 1). Business dates are Jakarta `YYYY-MM-DD`.
 */

/** A real calendar date in `YYYY-MM-DD` form (`2026-11-31` is not). */
export function isBusinessDate(value: string): boolean {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
	const date = new Date(`${value}T00:00:00Z`);
	return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Every date from `start` to `end`, inclusive. */
export function datesBetween(start: string, end: string): string[] {
	const dates: string[] = [];
	const cursor = new Date(`${start}T00:00:00Z`);
	const last = new Date(`${end}T00:00:00Z`);
	while (cursor <= last) {
		dates.push(cursor.toISOString().slice(0, 10));
		cursor.setUTCDate(cursor.getUTCDate() + 1);
	}
	return dates;
}

/**
 * Leave days of a range: every date except Sundays (the company works
 * Monday–Saturday; public holidays are recorded as `holiday` attendance).
 */
export function leaveDates(start: string, end: string): string[] {
	return datesBetween(start, end).filter((date) => new Date(`${date}T00:00:00Z`).getUTCDay() !== 0);
}

/** Net pay of a salary summary; every amount is IDR minor units. */
export function netPay(amounts: { baseSalary: number; allowances: number; overtimePay: number; bonus: number; deductions: number }): number {
	return amounts.baseSalary + amounts.allowances + amounts.overtimePay + amounts.bonus - amounts.deductions;
}

/** `HH:MM` on a Jakarta business date → unix ms; null stays null. */
export function jakartaTime(date: string, time: string | null): Date | null {
	return time ? new Date(`${date}T${time}:00+07:00`) : null;
}

/** Unix ms → `HH:MM` in Jakarta; null stays null. */
export function toJakartaTime(at: Date | null): string | null {
	if (!at) return null;
	return new Date(at.getTime() + 7 * 3_600_000).toISOString().slice(11, 16);
}

/** First and last date of a `YYYY-MM` period. */
export function periodRange(period: string): { start: string; end: string } {
	const [year, month] = period.split('-').map(Number) as [number, number];
	const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
	return { start: `${period}-01`, end: `${period}-${String(last).padStart(2, '0')}` };
}

/** `••••••••••••3456`: only the last four characters stay readable. */
export function maskTail(value: string | null): string | null {
	if (!value) return value;
	const tail = value.slice(-4);
	return `${'•'.repeat(Math.max(4, value.length - 4))}${tail}`;
}

/** The month before a `YYYY-MM` period. */
export function previousPeriod(period: string): string {
	const [year, month] = period.split('-').map(Number) as [number, number];
	return month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, '0')}`;
}
