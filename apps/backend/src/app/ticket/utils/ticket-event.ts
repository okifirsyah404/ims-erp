import type { TTicketSelect } from '@drizzle/schemas/ticket.schema';

/** What happened to the ticket in the `service_ticket.updated` event. */
export type TicketChange = 'created' | 'assigned' | 'started' | 'resolved' | 'reopened' | 'closed';

export type TTicketEventContact = { phone: string | null; whatsapp: string | null; email: string | null };

/**
 * The `service_ticket.updated` event data sent to n8n (M04 stage 2): enough
 * to tell the customer or the technician what changed. The service cost is
 * an integer IDR minor-unit amount.
 */
export function ticketUpdatedEvent(
	ticket: TTicketSelect,
	change: TicketChange,
	assignee: { userId: string; name: string } | null,
	contact: TTicketEventContact | null,
): Record<string, unknown> {
	return {
		ticketId: ticket.id,
		code: ticket.code,
		change,
		status: ticket.status,
		customer: { id: ticket.customerId, name: ticket.customerName, ...(contact ?? { phone: null, whatsapp: null, email: null }) },
		reporterName: ticket.reporterName,
		reporterContact: ticket.reporterContact,
		channel: ticket.channel,
		complaint: ticket.complaint,
		inWarranty: ticket.inWarranty,
		assignee,
		resolution: ticket.resolution,
		serviceCost: ticket.serviceCost,
		reportedAt: ticket.reportedAt.toISOString(),
	};
}
