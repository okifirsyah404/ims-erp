/**
 * Injection tokens for the ticket module (ADR-0024 Q13/Q29): service tickets,
 * their messages, ticket templates and the ticket numbering series.
 */
import type { InjectionToken } from 'tsyringe';
import type { ITicketMessageRepository, ITicketRepository } from '../contracts/ticket.contract';
import type { TicketCodeNumberingRepository } from '../repositories/code-numbering.repository';
import type { TicketNumberingService } from '../services/ticket-numbering.service';
import type { TicketService } from '../services/ticket.service';

/** Token resolving to the ticket repository implementation. */
export const TICKET_REPOSITORY_TOKEN: InjectionToken<ITicketRepository> = Symbol('TICKET_REPOSITORY_TOKEN');

/** Token resolving to the ticket message repository implementation. */
export const TICKET_MESSAGE_REPOSITORY_TOKEN: InjectionToken<ITicketMessageRepository> = Symbol(
	'TICKET_MESSAGE_REPOSITORY_TOKEN',
);

/** Token resolving to the {@link TicketService}. */
export const TICKET_SERVICE_TOKEN: InjectionToken<TicketService> = Symbol('TICKET_SERVICE_TOKEN');

/** Token resolving to the repository of `ticket.code_numberings`. */
export const TICKET_CODE_NUMBERING_REPOSITORY_TOKEN: InjectionToken<TicketCodeNumberingRepository> = Symbol(
	'TICKET_CODE_NUMBERING_REPOSITORY_TOKEN',
);

/** Token resolving to the {@link TicketNumberingService}. */
export const TICKET_NUMBERING_SERVICE_TOKEN: InjectionToken<TicketNumberingService> = Symbol(
	'TICKET_NUMBERING_SERVICE_TOKEN',
);
