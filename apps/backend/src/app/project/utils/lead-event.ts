import type { TLeadSelect } from '@drizzle/schemas/project.schema';

/**
 * The `lead.created` event data sent to n8n (M04): enough for a WhatsApp or
 * email notice to the sales admin, nothing else.
 */
export function leadCreatedEvent(lead: TLeadSelect): Record<string, unknown> {
	return {
		leadId: lead.id,
		reference: lead.reference,
		name: lead.name,
		companyName: lead.companyName,
		phone: lead.phone,
		whatsapp: lead.whatsapp,
		email: lead.email,
		source: lead.source,
		channel: lead.channel,
		needs: lead.needs,
		ownerUserId: lead.ownerUserId,
		createdAt: lead.createdAt.toISOString(),
	};
}
