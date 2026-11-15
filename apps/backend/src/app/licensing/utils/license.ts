/**
 * License rules (pure). Business dates are Jakarta `YYYY-MM-DD` strings.
 */

const KEY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** A new key for an own application: `XXXXX-XXXXX-XXXXX-XXXXX`, crypto random, no 0/O/1/I. */
export function generateLicenseKey(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(20));
	const chars = [...bytes].map((byte) => KEY_ALPHABET[byte % KEY_ALPHABET.length]);
	return [0, 5, 10, 15].map((at) => chars.slice(at, at + 5).join('')).join('-');
}

/** `••••-WXYZ`: only the last four characters stay readable. */
export function maskLicenseKey(key: string): string {
	return `••••-${key.slice(-4)}`;
}

/** `date` + `days` (may be negative). */
export function addDays(date: string, days: number): string {
	const value = new Date(`${date}T00:00:00Z`);
	value.setUTCDate(value.getUTCDate() + days);
	return value.toISOString().slice(0, 10);
}

/** Inclusive length of a period in days. */
export function periodDays(start: string, end: string): number {
	return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000) + 1;
}

/**
 * The renewal period: starts the day after the old end and lasts as long as
 * the old one (a perpetual or undated contract renews from today for a year).
 */
export function renewalPeriod(old: { startDate: string | null; endDate: string | null }, today: string): { startDate: string; endDate: string } {
	if (!old.endDate) {
		const nextYear = new Date(`${today}T00:00:00Z`);
		nextYear.setUTCFullYear(nextYear.getUTCFullYear() + 1);
		return { startDate: today, endDate: addDays(nextYear.toISOString().slice(0, 10), -1) };
	}
	const startDate = addDays(old.endDate, 1);
	const length = old.startDate ? periodDays(old.startDate, old.endDate) : 365;
	return { startDate, endDate: addDays(startDate, length - 1) };
}

export type TContractTiming = {
	/** Active and past its end date (not renewed). */
	isExpired: boolean;
	/** Active and ending within the given days (expired included). */
	isDue: boolean;
	/** Days until the end (negative once ended); null when perpetual. */
	daysLeft: number | null;
};

/** Derived timing of a contract on `today`; only active contracts can be due or expired. */
export function contractTiming(contract: { status: string; endDate: string | null }, today: string, withinDays = 30): TContractTiming {
	if (!contract.endDate) return { isExpired: false, isDue: false, daysLeft: null };
	const daysLeft = periodDays(today, contract.endDate) - 1;
	const active = contract.status === 'active';
	return { isExpired: active && daysLeft < 0, isDue: active && daysLeft <= withinDays, daysLeft };
}

/** Days an ended license keeps working, with a warning (owner decision 2026-11-06). */
export const GRACE_DAYS = 7;

/** Days before the end at which a `license.due` reminder goes out (M04 stage 2). */
export const DUE_NOTICE_DAYS = [30, 7] as const;

/**
 * Which `license.due` reminder a contract is due for: `30` (ends within 30
 * days), `7` (within 7 days, today included), `0` (ended, still in grace),
 * or `null` (none: perpetual, further out, or past the grace period). The
 * reminder is sent once per contract, end date and threshold, so a missed
 * day only sends the latest one.
 */
export function dueNoticeThreshold(daysLeft: number | null): 30 | 7 | 0 | null {
	if (daysLeft === null || daysLeft > DUE_NOTICE_DAYS[0]) return null;
	if (daysLeft > DUE_NOTICE_DAYS[1]) return 30;
	if (daysLeft >= 0) return 7;
	return daysLeft >= -GRACE_DAYS ? 0 : null;
}

export type TLicenseResult =
	| 'ok'
	| 'grace'
	| 'expired'
	| 'not_started'
	| 'suspended'
	| 'terminated'
	| 'revoked'
	| 'unknown';

export type TLicenseState = {
	result: TLicenseResult;
	/** The application may run (`ok` or `grace`). */
	valid: boolean;
	/** Effective end: the earlier of the contract end and the key's expiry; null = perpetual. */
	endsOn: string | null;
	graceEndsOn: string | null;
	daysLeft: number | null;
};

/**
 * What a license key allows on `today` (pure, clock injected).
 *
 * @remarks
 * Revoked keys and suspended / terminated contracts are refused; a draft is
 * not started yet. An active contract runs until the effective end, then
 * `GRACE_DAYS` more with `grace`, then `expired`.
 */
export function licenseState(
	contract: { status: string; startDate: string | null; endDate: string | null },
	key: { status: string; expiresOn: string | null },
	today: string,
	graceDays = GRACE_DAYS,
): TLicenseState {
	const ends = [contract.endDate, key.expiresOn].filter((value): value is string => !!value).sort();
	const endsOn = ends[0] ?? null;
	const graceEndsOn = endsOn ? addDays(endsOn, graceDays) : null;
	const daysLeft = endsOn ? periodDays(today, endsOn) - 1 : null;
	const refuse = (result: TLicenseResult): TLicenseState => ({ result, valid: false, endsOn, graceEndsOn, daysLeft });
	if (key.status !== 'active') return refuse('revoked');
	if (contract.status === 'suspended') return refuse('suspended');
	if (contract.status === 'terminated') return refuse('terminated');
	// A renewed contract's keys move to the renewal; one left behind is over.
	if (contract.status === 'renewed') return refuse('expired');
	if (contract.status !== 'active' || (contract.startDate && today < contract.startDate)) return refuse('not_started');
	if (!endsOn || today <= endsOn) return { result: 'ok', valid: true, endsOn, graceEndsOn, daysLeft };
	if (graceEndsOn && today <= graceEndsOn) return { result: 'grace', valid: true, endsOn, graceEndsOn, daysLeft };
	return refuse('expired');
}
