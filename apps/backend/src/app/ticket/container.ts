import type { DependencyContainer } from 'tsyringe';
import {
	TICKET_CODE_NUMBERING_REPOSITORY_TOKEN,
	TICKET_MESSAGE_REPOSITORY_TOKEN,
	TICKET_NUMBERING_SERVICE_TOKEN,
	TICKET_REPOSITORY_TOKEN,
	TICKET_SERVICE_TOKEN,
} from './constants/di';
import { TicketCodeNumberingRepository } from './repositories/code-numbering.repository';
import { TicketMessageRepository } from './repositories/ticket-message.repository';
import { TicketRepository } from './repositories/ticket.repository';
import { TicketNumberingService } from './services/ticket-numbering.service';
import { TicketService } from './services/ticket.service';

export * from './constants/di';

/**
 * Registers the ticket module (ADR-0024 Q13/Q29).
 *
 * @remarks
 * Requires the `project` module (warranty checks through
 * `ExportedWarrantyService`) and `company` (the `{COMPANY}` numbering token).
 *
 * @param container - The tsyringe container to populate
 */
export function registerTicket(container: DependencyContainer): void {
	container.register(TICKET_REPOSITORY_TOKEN, { useClass: TicketRepository });
	container.register(TICKET_MESSAGE_REPOSITORY_TOKEN, { useClass: TicketMessageRepository });
	container.register(TICKET_CODE_NUMBERING_REPOSITORY_TOKEN, { useClass: TicketCodeNumberingRepository });
	container.register(TICKET_NUMBERING_SERVICE_TOKEN, { useClass: TicketNumberingService });
	container.register(TICKET_SERVICE_TOKEN, { useClass: TicketService });
}
