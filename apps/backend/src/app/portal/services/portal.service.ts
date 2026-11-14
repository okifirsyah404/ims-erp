import { SERVICE_TICKET_SERVICE_TOKEN, WARRANTY_SERVICE_TOKEN } from '@app/aftersales/constants/di';
import type { TPortalTicket, TPortalTicketDetail, TPortalTicketMessage } from '@app/aftersales/contracts/service-ticket.contract';
import type { ServiceTicketService } from '@app/aftersales/services/service-ticket.service';
import type { WarrantyService } from '@app/aftersales/services/warranty.service';
import { CUSTOMER_SERVICE_TOKEN } from '@app/crm/constants/di';
import type { CustomerService } from '@app/crm/services/customer.service';
import { PROJECT_PORTAL_SERVICE_TOKEN } from '@app/projects/constants/di';
import type { ProjectPortalService, TPortalProject, TPortalProjectDetail } from '@app/projects/services/project-portal.service';
import type { PortalContext } from '@authorization/portal-auth';
import type { TCustomerSelect } from '@drizzle/schemas/crm.schema';
import type { TWarrantyCertificateSelect } from '@drizzle/schemas/aftersales.schema';
import { inject, injectable } from 'tsyringe';
import type { TPortalTicketInput } from '../contracts/portal.contract';
import { PortalProductNotFoundError, PortalProjectNotFoundError } from '../errors/portal.errors';

/** A device the customer owns: one line of one of their warranty certificates. */
export type TPortalDevice = { id: string; certificate: TWarrantyCertificateSelect; line: number };

/**
 * Customer-portal use cases (ERP-0022). Owns no data: every read and write
 * goes through the owning module's contract (projects, after-sales, CRM),
 * always with the customer id the portal guard resolved — never an id from
 * the request.
 */
@injectable()
export class PortalService {
	constructor(
		@inject(PROJECT_PORTAL_SERVICE_TOKEN) private readonly projects: Pick<ProjectPortalService, 'listForCustomer' | 'getForCustomer'>,
		@inject(SERVICE_TICKET_SERVICE_TOKEN)
		private readonly tickets: Pick<
			ServiceTicketService,
			'listForCustomer' | 'getForCustomer' | 'createFromPortal' | 'addCustomerMessage' | 'confirmFromPortal'
		>,
		@inject(WARRANTY_SERVICE_TOKEN) private readonly warranties: Pick<WarrantyService, 'listForCustomer' | 'getForCustomer'>,
		@inject(CUSTOMER_SERVICE_TOKEN) private readonly customers: Pick<CustomerService, 'getActiveCustomer'>,
	) {}

	customer(portal: PortalContext): Promise<TCustomerSelect | null> {
		return this.customers.getActiveCustomer(portal.customerId);
	}

	listProjects(portal: PortalContext): Promise<TPortalProject[]> {
		return this.projects.listForCustomer(portal.customerId);
	}

	async getProject(portal: PortalContext, id: string): Promise<TPortalProjectDetail> {
		const project = await this.projects.getForCustomer(portal.customerId, id);
		if (!project) throw new PortalProjectNotFoundError();
		return project;
	}

	listTickets(portal: PortalContext): Promise<TPortalTicket[]> {
		return this.tickets.listForCustomer(portal.customerId);
	}

	getTicket(portal: PortalContext, id: string): Promise<TPortalTicketDetail> {
		return this.tickets.getForCustomer(portal.customerId, id);
	}

	/** Opens a ticket; a device from `GET /products` fills in the project and the device line. */
	async createTicket(portal: PortalContext, input: TPortalTicketInput): Promise<TPortalTicketDetail> {
		const device = input.productId ? await this.getDevice(portal, input.productId) : null;
		const item = device ? device.certificate.items[device.line] : null;
		return this.tickets.createFromPortal(this.actor(portal), {
			subject: input.subject,
			description: input.description,
			projectId: device?.certificate.projectId ?? null,
			serialNumber: null,
			deviceDescription: item ? item.description.slice(0, 300) : null,
		});
	}

	addMessage(portal: PortalContext, id: string, text: string): Promise<TPortalTicketMessage> {
		return this.tickets.addCustomerMessage(this.actor(portal), id, text);
	}

	confirmTicket(portal: PortalContext, id: string): Promise<TPortalTicketDetail> {
		return this.tickets.confirmFromPortal(this.actor(portal), id);
	}

	async listDevices(portal: PortalContext): Promise<TPortalDevice[]> {
		const certificates = await this.warranties.listForCustomer(portal.customerId);
		return certificates.flatMap((certificate) => certificate.items.map((_, line) => ({ id: `${certificate.id}:${line}`, certificate, line })));
	}

	/** One of the customer's devices (`<certificate id>:<line>`); 404 for anyone else's. */
	async getDevice(portal: PortalContext, productId: string): Promise<TPortalDevice> {
		const [certificateId, lineText] = productId.split(':');
		const line = Number(lineText);
		const certificate = certificateId ? await this.warranties.getForCustomer(portal.customerId, certificateId) : null;
		if (!certificate || !Number.isInteger(line) || line < 0 || line >= certificate.items.length) throw new PortalProductNotFoundError();
		return { id: productId, certificate, line };
	}

	private actor(portal: PortalContext) {
		return { userId: portal.userId, name: portal.user.name, email: portal.user.email, customerId: portal.customerId };
	}
}
