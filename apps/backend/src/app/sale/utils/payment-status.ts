/**
 * Invoice payment status from what has been received. Pure; integer minor
 * units (ADR-0002). Used by the receipt write path to recompute the parent
 * invoice's status after each receipt / reversal.
 */
export function paymentStatus(
	total: number,
	paid: number,
): 'issued' | 'partially_paid' | 'paid' {
	if (paid <= 0) return 'issued';
	return paid >= total ? 'paid' : 'partially_paid';
}
