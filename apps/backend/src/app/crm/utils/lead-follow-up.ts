import type { TLeadSelect } from '@drizzle/schemas/crm.schema';

/** A lead overdue by more than this many days is also escalated to the sales manager. */
export const LEAD_FOLLOW_UP_ESCALATE_AFTER_DAYS = 3;

export type LeadFollowUpStage = 'due' | 'overdue';

export type TLeadOwnerContact = { userId: string; name: string | null; phone: string | null; email: string | null };

/**
 * The `lead.follow_up_due` event data sent to n8n (ERP-0066): the lead, when
 * the follow-up was planned, how late it is, and its owner's contact so n8n
 * can message that salesperson. `overdue` (more than 3 days late) also goes
 * to the sales manager.
 */
export function leadFollowUpEvent(
	lead: TLeadSelect,
	dueDate: string,
	daysOverdue: number,
	owner: TLeadOwnerContact | null,
): Record<string, unknown> {
	return {
		leadId: lead.id,
		reference: lead.reference,
		name: lead.name,
		companyName: lead.companyName,
		phone: lead.phone,
		whatsapp: lead.whatsapp,
		email: lead.email,
		status: lead.status,
		source: lead.source,
		needs: lead.needs,
		estimatedValue: lead.estimatedValue,
		nextFollowUpAt: lead.nextFollowUpAt?.toISOString() ?? null,
		dueDate,
		daysOverdue,
		stage: daysOverdue > LEAD_FOLLOW_UP_ESCALATE_AFTER_DAYS ? 'overdue' : 'due',
		owner,
	};
}
