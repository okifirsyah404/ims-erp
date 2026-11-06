import type { DependencyContainer } from 'tsyringe';
import {
	SERVICE_TICKET_REPOSITORY_TOKEN,
	SERVICE_TICKET_SERVICE_TOKEN,
	WARRANTY_REPOSITORY_TOKEN,
	WARRANTY_SERVICE_TOKEN,
} from './constants/di';
import { ServiceTicketRepository } from './repositories/service-ticket.repository';
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
	container.register(SERVICE_TICKET_REPOSITORY_TOKEN, { useClass: ServiceTicketRepository });
	container.register(SERVICE_TICKET_SERVICE_TOKEN, { useClass: ServiceTicketService });
}
