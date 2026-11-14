import { isValidPhoneNumber } from 'libphonenumber-js/min';

/**
 * Assembles a dial code and national number into E.164.
 *
 * @remarks
 * Strips non-digits and a leading trunk zero (`0812…` → `812…`), then
 * validates with `libphonenumber-js/min` — the same library and metadata the
 * backend re-parses with, so a number accepted here is not rejected there.
 *
 * @returns the canonical number, or `''` when the pair is not a valid
 * subscriber number (callers block submission on `''`).
 */
export function toE164(callingCode: string, national: string): string {
	const digits = national.replace(/\D/g, '').replace(/^0+/, '');
	const e164 = digits ? `+${callingCode}${digits}` : '';
	return e164 && isValidPhoneNumber(e164) ? e164 : '';
}
