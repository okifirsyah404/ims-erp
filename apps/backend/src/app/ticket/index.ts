/**
 * Public entry point of the ticket module (`/tickets`, ADR-0024 Q13/Q29).
 *
 * @remarks
 * Replaces the former `aftersales` module: warranty certificates moved to
 * `project`, the service tickets and their messages stay here. The customer
 * portal reads tickets through `ExportedTicketService`.
 */
import Elysia from 'elysia';

import { TicketController } from './controllers/ticket.controller';

export { registerTicket } from './container';
export { TICKET_SERVICE_TOKEN } from './constants/di';
export type { TicketService } from './services/ticket.service';

/** Elysia instance mounting every ticket controller. */
export function ticketModule() {
	return new Elysia({ name: 'ticket' }).use(TicketController.plugin());
}
