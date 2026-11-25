/**
 * Invoice payment status from what has been received. Pure; integer minor
 * units (ADR-0002). Used by the receipt write path to recompute the parent
 * invoice's status after each receipt / reversal.
 */
/**
 * Invoice status after a receipt or its reversal (ERP-0139), from what is
 * paid and what is still open - credit memos lower the open amount without
 * being payments, so `grand_total` alone cannot decide `paid`.
 */
export function receiptStatus(paid: number, outstanding: number): 'issued' | 'partially_paid' | 'paid' {
	if (outstanding <= 0) return 'paid';
	return paid > 0 ? 'partially_paid' : 'issued';
}

export function paymentStatus(
	total: number,
	paid: number,
): 'issued' | 'partially_paid' | 'paid' {
	if (paid <= 0) return 'issued';
	return paid >= total ? 'paid' : 'partially_paid';
}
