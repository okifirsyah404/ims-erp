/**
 * Indonesian number words for printed documents ("terbilang"). The company's
 * documents are Indonesian whatever the UI language.
 */
const ONES = [
	'',
	'satu',
	'dua',
	'tiga',
	'empat',
	'lima',
	'enam',
	'tujuh',
	'delapan',
	'sembilan',
	'sepuluh',
	'sebelas',
];

/** Indonesian words for 0 <= n < 1000. */
function underThousand(n: number): string {
	if (n < 12) return ONES[n] ?? '';
	if (n < 20) return `${ONES[n - 10]} belas`;
	if (n < 100) {
		const rest = n % 10;
		return `${ONES[Math.floor(n / 10)]} puluh${rest ? ` ${ONES[rest]}` : ''}`;
	}
	const hundreds = Math.floor(n / 100);
	const rest = n % 100;
	const head = hundreds === 1 ? 'seratus' : `${ONES[hundreds]} ratus`;
	return rest ? `${head} ${underThousand(rest)}` : head;
}

const SCALES: [number, string][] = [
	[1_000_000_000_000, 'triliun'],
	[1_000_000_000, 'miliar'],
	[1_000_000, 'juta'],
	[1_000, 'ribu'],
];

/** Indonesian words for a non-negative whole number ("seribu", "dua juta"). */
export function numberToWords(value: number): string {
	let n = Math.floor(Math.abs(value));
	if (n === 0) return 'nol';
	const parts: string[] = [];
	for (const [size, name] of SCALES) {
		if (n >= size) {
			const count = Math.floor(n / size);
			n %= size;
			parts.push(size === 1_000 && count === 1 ? 'seribu' : `${numberToWords(count)} ${name}`);
		}
	}
	if (n > 0) parts.push(underThousand(n));
	return parts.join(' ');
}

/**
 * "Terbilang" line for an amount in integer minor units (ADR-0002),
 * e.g. 79_900_000_000 → "Tujuh ratus sembilan puluh sembilan juta rupiah".
 * Sen (cents) are appended only when present.
 */
export function terbilangRupiah(minor: number): string {
	const rupiah = Math.floor(minor / 100);
	const sen = minor % 100;
	const words = `${numberToWords(rupiah)} rupiah${sen ? ` ${numberToWords(sen)} sen` : ''}`;
	return words.charAt(0).toUpperCase() + words.slice(1);
}

