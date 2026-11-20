/**
 * Injection tokens for the after-sales module (M07, ADR-0011 steps 6b–6c).
 */
import type { InjectionToken } from 'tsyringe';
import type { WarrantyRenderService } from '../services/warranty-render.service';
import type { IWarrantyRepository } from '../contracts/warranty.contract';
import type { WarrantyService } from '../services/warranty.service';
import type { IServiceTicketCommentRepository, IServiceTicketRepository } from '../contracts/service-ticket.contract';
import type { ServiceTicketService } from '../services/service-ticket.service';

/** Token resolving to the warranty certificate repository implementation. */
export const WARRANTY_REPOSITORY_TOKEN: InjectionToken<IWarrantyRepository> = Symbol('WARRANTY_REPOSITORY_TOKEN');

/** Token resolving to the {@link WarrantyService}. */
export const WARRANTY_SERVICE_TOKEN: InjectionToken<WarrantyService> = Symbol('WARRANTY_SERVICE_TOKEN');

/** Token resolving to the service ticket repository implementation. */
export const SERVICE_TICKET_REPOSITORY_TOKEN: InjectionToken<IServiceTicketRepository> = Symbol('SERVICE_TICKET_REPOSITORY_TOKEN');

/** Token resolving to the {@link ServiceTicketService}. */
export const SERVICE_TICKET_COMMENT_REPOSITORY_TOKEN: InjectionToken<IServiceTicketCommentRepository> = Symbol(
	'SERVICE_TICKET_COMMENT_REPOSITORY_TOKEN',
);

export const SERVICE_TICKET_SERVICE_TOKEN: InjectionToken<ServiceTicketService> = Symbol('SERVICE_TICKET_SERVICE_TOKEN');

/** Warranty-certificate print-view data for the PDF renderer (ERP-0079). */
export const WARRANTY_RENDER_SERVICE_TOKEN: InjectionToken<WarrantyRenderService> = Symbol('WARRANTY_RENDER_SERVICE_TOKEN');
