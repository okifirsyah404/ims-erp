/**
 * SPH validity (owner decision 2026-11-04): an SPH is valid through the end
 * of its "valid until" business day in Asia/Jakarta (23:59:59.999 WIB).
 * Expiry is informational only: it never changes the status, and a customer
 * may still accept an expired SPH.
 */
import { endOfBusinessDate } from '@utils/business-date.util';
import type { QuotationStatus } from '@drizzle/schemas/sales.schema';

/** Last millisecond of the `valid_until` Jakarta day; null = open-ended. */
export function quotationExpiresAt(validUntil: string | null): number | null {
	return validUntil === null ? null : endOfBusinessDate(validUntil);
}

/** Statuses for which expiry no longer matters (closed or replaced). */
const CLOSED: ReadonlySet<QuotationStatus> = new Set(['won', 'lost', 'superseded']);

export function isQuotationExpired(
	status: QuotationStatus,
	expiresAt: number | null,
	now: number = Date.now(),
): boolean {
	return expiresAt !== null && !CLOSED.has(status) && now > expiresAt;
}
