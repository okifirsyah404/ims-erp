/**
 * Pure helpers behind `MoneyInput`.
 *
 * @remarks
 * A money field holds a **canonical rupiah string**: digits, an optional `.`
 * decimal separator, at most two decimals (sen), no grouping - exactly what
 * `rupiahToMinor` in `format.ts` expects. The text the person sees is the
 * `id-ID` rendering of it (`1.500.000,5`), so the two directions live here.
 */

/** Decimals a rupiah amount may carry (minor unit = sen, ADR-0002). */
const MAX_DECIMALS = 2;

/**
 * Turns whatever was typed or pasted into the canonical string.
 *
 * @param raw - Field text: display format (`1.500.000,5`), a canonical value
 *   (`1500000.5`), or a paste with the currency prefix (`Rp 1.500.000`)
 * @param allowNegative - Keep a leading minus (adjustments, corrections)
 * @remarks
 * `,` is always the decimal separator and `.` the grouping mark, with one
 * exception: a single `.` followed by one or two digits and no `,` is read as
 * a decimal point, so pasting a canonical `1500000.5` does not become
 * 15.000.005. A trailing separator is kept (`"12."`) so typing `12,` works.
 */
export function sanitizeMoney(raw: string, allowNegative = false): string {
	let text = raw.replace(/rp/gi, '').replace(/\s/g, '');
	const negative = allowNegative && text.startsWith('-');
	text = text.replace(/[^\d.,]/g, '');

	let integer: string;
	let fraction: string | null = null;

	const comma = text.lastIndexOf(',');
	if (comma !== -1) {
		integer = text.slice(0, comma).replace(/\D/g, '');
		fraction = text.slice(comma + 1).replace(/\D/g, '').slice(0, MAX_DECIMALS);
	} else if (/^\d*\.\d{0,2}$/.test(text) && text.includes('.') && !/^\d{1,3}(\.\d{3})+$/.test(text)) {
		const dot = text.indexOf('.');
		integer = text.slice(0, dot);
		fraction = text.slice(dot + 1);
	} else {
		integer = text.replace(/\D/g, '');
	}

	integer = integer.replace(/^0+(?=\d)/, '');
	if (integer === '' && fraction !== null) integer = '0';

	const body = fraction === null ? integer : `${integer}.${fraction}`;
	if (body === '') return '';
	return negative ? `-${body}` : body;
}

/** Groups a canonical value for display: `1500000.5` -> `1.500.000,5`. */
export function formatMoneyDisplay(canonical: string): string {
	if (canonical === '') return '';
	const negative = canonical.startsWith('-');
	const unsigned = negative ? canonical.slice(1) : canonical;
	const dot = unsigned.indexOf('.');
	const integer = dot === -1 ? unsigned : unsigned.slice(0, dot);
	const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
	const fraction = dot === -1 ? '' : `,${unsigned.slice(dot + 1)}`;
	return `${negative ? '-' : ''}${grouped}${fraction}`;
}
