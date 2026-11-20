import type { TQuotationSelect } from '@drizzle/schemas/sale.schema';

/**
 * Follow-up stages of a sent quotation that has no answer yet (ERP-0066,
 * owner decisions 2026-11-16): 3 and 7 days after it was sent, and 2 days
 * before it stops being valid. Calendar days on Jakarta business dates.
 */
export type QuotationFollowUpStage = 'sent_3d' | 'sent_7d' | 'expiring';

export type TPersonContact = { userId: string; name: string | null; phone: string | null; email: string | null };

const day = (date: string) => Date.parse(`${date}T00:00:00Z`) / 86_400_000;

/** Days from `from` to `to` (both `YYYY-MM-DD`). */
export function daysBetween(from: string, to: string): number {
	return Math.round(day(to) - day(from));
}

/**
 * Stages due today for a quotation sent on `sentDate`. Only one "sent"
 * stage at a time (7 days wins over 3), so a missed run never sends both;
 * `expiring` is independent.
 */
export function quotationFollowUpStages(sentDate: string, validUntil: string | null, today: string): QuotationFollowUpStage[] {
	const stages: QuotationFollowUpStage[] = [];
	const sinceSent = daysBetween(sentDate, today);
	if (sinceSent >= 7) stages.push('sent_7d');
	else if (sinceSent >= 3) stages.push('sent_3d');
	if (validUntil) {
		const left = daysBetween(today, validUntil);
		if (left >= 0 && left <= 2) stages.push('expiring');
	}
	return stages;
}

/** The `quotation.follow_up_due` event data sent to n8n. Amounts are IDR minor units. */
export function quotationFollowUpEvent(
	quotation: TQuotationSelect,
	stage: QuotationFollowUpStage,
	sentDate: string,
	today: string,
	owner: TPersonContact | null,
): Record<string, unknown> {
	return {
		quotationId: quotation.id,
		code: quotation.code,
		title: quotation.title,
		stage,
		sentDate,
		daysSinceSent: daysBetween(sentDate, today),
		validUntil: quotation.validUntil,
		daysLeft: quotation.validUntil ? daysBetween(today, quotation.validUntil) : null,
		grandTotal: quotation.grandTotal,
		currencyCode: quotation.currencyCode,
		customer: { id: quotation.customerId, name: quotation.customerSnapshot.name },
		owner,
	};
}
