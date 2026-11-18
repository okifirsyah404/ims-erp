import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Pure signing helpers of the payment gateway adapters (ERP-0020).
 * Secrets are arguments only; nothing here logs.
 */

/** Object keys sorted alphabetically at every depth (SingaPay body canonical form). */
export function sortKeysDeep(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(sortKeysDeep);
	if (value && typeof value === 'object') {
		const source = value as Record<string, unknown>;
		return Object.fromEntries(
			Object.keys(source)
				.sort()
				.map((key) => [key, sortKeysDeep(source[key])]),
		);
	}
	return value;
}

/** Compact JSON of the key-sorted value, unescaped unicode and slashes. */
export function canonicalJson(value: unknown): string {
	return JSON.stringify(sortKeysDeep(value));
}

export function sha256Hex(text: string): string {
	return createHash('sha256').update(text, 'utf8').digest('hex');
}

export function hmacHex(algorithm: 'sha256' | 'sha512', key: string, text: string): string {
	return createHmac(algorithm, key).update(text, 'utf8').digest('hex');
}

/** Constant-time string comparison; false on any length mismatch. */
export function safeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
	if (!a || !b) return false;
	const left = Buffer.from(a, 'utf8');
	const right = Buffer.from(b, 'utf8');
	return left.length === right.length && timingSafeEqual(left, right);
}

/** Whole rupiah charged for an amount in IDR minor units (rounded up). */
export function minorToChargeRupiah(minor: number): number {
	return Math.ceil(minor / 100);
}

/** IDR minor units of a provider amount in rupiah (number or decimal string). */
export function rupiahToMinor(value: number | string | null | undefined): number | null {
	if (value == null || value === '') return null;
	const rupiah = typeof value === 'number' ? value : Number(value);
	return Number.isFinite(rupiah) ? Math.round(rupiah * 100) : null;
}
