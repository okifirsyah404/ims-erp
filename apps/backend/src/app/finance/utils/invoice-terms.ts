/**
 * Pure billing-term rules for invoices against a sales order (free terms,
 * owner decision 2026-10-31). Amounts are integer IDR minor units; divisions
 * use BigInt half-up. The term that reaches the order's tax base takes the
 * exact remaining VAT, so the invoices of an order always sum to the order
 * total with no rounding drift.
 */
import { bpsShare, divHalfUpToNumber } from '@ims-erp/common';

export type TOrderAmounts = {
	/** Tax base (DPP) = subtotal − discounts. */
	taxBase: number;
	vatAmount: number;
	total: number;
	vatEnabled: boolean;
	vatRateBps: number;
};

export type TTermAmounts = { taxBase: number; vatAmount: number; total: number };

export type TTermRequest =
	| { mode: 'percentage'; bps: number }
	| { mode: 'amount'; total: number }
	| { mode: 'remaining' };

export type TScheduleItem = { label: string; percentBps: number };

/** Why a term cannot be billed. */
export type TTermProblem = 'fullyInvoiced' | 'empty' | 'exceeds' | 'noPlannedTerm';

export class TermError extends Error {
	constructor(readonly problem: TTermProblem) {
		super(problem);
	}
}

export const ZERO_TERM: TTermAmounts = { taxBase: 0, vatAmount: 0, total: 0 };

export function sumTerms(terms: TTermAmounts[]): TTermAmounts {
	return terms.reduce(
		(sum, term) => ({
			taxBase: sum.taxBase + term.taxBase,
			vatAmount: sum.vatAmount + term.vatAmount,
			total: sum.total + term.total,
		}),
		ZERO_TERM,
	);
}

export function remainingOf(order: TOrderAmounts, billed: TTermAmounts): TTermAmounts {
	return {
		taxBase: order.taxBase - billed.taxBase,
		vatAmount: order.vatAmount - billed.vatAmount,
		total: order.total - billed.total,
	};
}

/**
 * Amounts of a new term.
 *
 * @throws {TermError} When nothing is left, the term is empty, or it exceeds
 * what is left to bill
 */
export function computeTerm(order: TOrderAmounts, billed: TTermAmounts, request: TTermRequest): TTermAmounts {
	const remaining = remainingOf(order, billed);
	if (remaining.total <= 0) throw new TermError('fullyInvoiced');
	if (request.mode === 'remaining') return remaining;

	let taxBase: number;
	if (request.mode === 'percentage') {
		taxBase = bpsShare(order.taxBase, request.bps);
	} else if (order.vatEnabled) {
		// Split a VAT-inclusive amount into tax base + VAT.
		taxBase = divHalfUpToNumber(BigInt(request.total) * 10_000n, BigInt(10_000 + order.vatRateBps));
	} else {
		taxBase = request.total;
	}

	if (taxBase <= 0) throw new TermError('empty');
	// Percentage terms may overshoot by one minor unit through half-up
	// rounding (e.g. 2 × 50% of an odd base): bill the rest.
	if (request.mode === 'percentage' && taxBase - remaining.taxBase === 1) return remaining;
	if (taxBase > remaining.taxBase) throw new TermError('exceeds');
	if (taxBase === remaining.taxBase) return remaining;

	const vatAmount = !order.vatEnabled
		? 0
		: request.mode === 'amount'
			? request.total - taxBase
			: bpsShare(taxBase, order.vatRateBps);
	const total = taxBase + vatAmount;
	if (total > remaining.total || vatAmount > remaining.vatAmount) throw new TermError('exceeds');
	return { taxBase, vatAmount, total };
}

/** Percent text without trailing zeros: 3000 → "30", 3350 → "33.5". */
export function formatPercent(bps: number): string {
	return String(Number((bps / 100).toFixed(2)));
}

/** Without a planned schedule the deal is billed in one term (2026-11-04). */
export const SINGLE_TERM_SCHEDULE: TScheduleItem[] = [{ label: 'Pelunasan', percentBps: 10_000 }];

export type TPlannedTerm = {
	/** Position in the schedule (0-based). */
	index: number;
	label: string;
	percentBps: number;
	/** The last term bills the exact remainder. */
	last: boolean;
	/** Invoice description, e.g. "DP 30%". */
	description: string;
};

/**
 * First planned term not yet covered by what has been invoiced (live
 * invoices' tax base); one minor unit of rounding is tolerated. `null` when
 * nothing is left.
 */
export function nextPlannedTerm(
	schedule: TScheduleItem[] | null,
	taxBase: number,
	billedTaxBase: number,
): TPlannedTerm | null {
	if (billedTaxBase >= taxBase) return null;
	const plan = schedule?.length ? schedule : SINGLE_TERM_SCHEDULE;
	let cumulative = 0;
	for (const [index, item] of plan.entries()) {
		cumulative += item.percentBps;
		if (billedTaxBase < bpsShare(taxBase, cumulative) - 1) {
			return {
				index,
				label: item.label,
				percentBps: item.percentBps,
				last: index === plan.length - 1,
				description: `${item.label} ${formatPercent(item.percentBps)}%`.slice(0, 200),
			};
		}
	}
	return null;
}

/** Invoice payment status from what has been received. */
export function paymentStatus(total: number, paid: number): 'issued' | 'partially_paid' | 'paid' {
	if (paid <= 0) return 'issued';
	return paid >= total ? 'paid' : 'partially_paid';
}
