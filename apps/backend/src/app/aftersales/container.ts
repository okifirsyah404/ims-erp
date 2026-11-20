import type { DependencyContainer } from 'tsyringe';
import { WarrantyRenderService } from './services/warranty-render.service';
import {
	SERVICE_TICKET_COMMENT_REPOSITORY_TOKEN,
	SERVICE_TICKET_REPOSITORY_TOKEN,
	SERVICE_TICKET_SERVICE_TOKEN,
	WARRANTY_REPOSITORY_TOKEN,
	WARRANTY_SERVICE_TOKEN,
	WARRANTY_RENDER_SERVICE_TOKEN,
} from './constants/di';
import { ServiceTicketRepository } from './repositories/service-ticket.repository';
import { ServiceTicketCommentRepository } from './repositories/service-ticket-comment.repository';
import { ServiceTicketService } from './services/service-ticket.service';
import { WarrantyRepository } from './repositories/warranty.repository';
import { WarrantyService } from './services/warranty.service';

export * from './constants/di';

/**
 * Registers the after-sales module (M07, ADR-0011 steps 6b–6c).
 *
 * @param container - The tsyringe container to populate
 */
export function registerAftersales(container: DependencyContainer): void {
	container.register(WARRANTY_REPOSITORY_TOKEN, { useClass: WarrantyRepository });
	container.register(WARRANTY_SERVICE_TOKEN, { useClass: WarrantyService });
	container.register(WARRANTY_RENDER_SERVICE_TOKEN, { useClass: WarrantyRenderService });
	container.register(SERVICE_TICKET_REPOSITORY_TOKEN, { useClass: ServiceTicketRepository });
	container.register(SERVICE_TICKET_COMMENT_REPOSITORY_TOKEN, { useClass: ServiceTicketCommentRepository });
	container.register(SERVICE_TICKET_SERVICE_TOKEN, { useClass: ServiceTicketService });
}
