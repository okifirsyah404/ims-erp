import { TICKET_SERVICE_TOKEN } from '@app/ticket/constants/di';
import type { TPortalTicket, TPortalTicketDetail, TPortalTicketMessage } from '@app/ticket/contracts/ticket.contract';
import type { TicketService } from '@app/ticket/services/ticket.service';
import { WARRANTY_SERVICE_TOKEN } from '@app/project/constants/di';
import type { WarrantyService } from '@app/project/services/warranty.service';
import { PROJECT_PORTAL_SERVICE_TOKEN } from '@app/project/constants/di';
import type { ProjectPortalService, TPortalProject, TPortalProjectDetail } from '@app/project/services/project-portal.service';
import type { PortalContext } from '@authorization/portal-auth';
import type { TCustomerCompanySelect, TCustomerSelect } from '@drizzle/schemas/customer.schema';
import type { TWarrantySelect } from '@drizzle/schemas/project.schema';
import { inject, injectable } from 'tsyringe';
import { COMPANY_REPOSITORY_TOKEN, CUSTOMER_PERSON_REPOSITORY_TOKEN, PORTAL_ACCOUNT_SERVICE_TOKEN } from '../constants/di';
import type { ICompanyRepository, ICustomerPersonRepository } from '../contracts/customer.repository.interface';
import type { TPortalAccountView, TPortalMemberInvite } from '../contracts/portal-account.contract';
import type { TPortalTicketInput } from '../contracts/portal.contract';
import { PortalProductNotFoundError, PortalProjectNotFoundError } from '../errors/portal.errors';
import type { PortalAccountService } from './portal-account.service';

/** The signed-in person and their company (`null` for an individual customer). */
export type TPortalSubject = { person: TCustomerSelect; company: TCustomerCompanySelect | null };

/** A device the customer owns: one line of one of their warranty certificates. */
export type TPortalDevice = { id: string; certificate: TWarrantySelect; line: number };

/**
 * Customer-portal use cases (ERP-0022). Owns no data: every read and write
 * goes through the owning module's contract (project, ticket),
 * always with the customer id the portal guard resolved — never an id from
 * the request.
 */
@injectable()
export class PortalService {
	constructor(
		@inject(PROJECT_PORTAL_SERVICE_TOKEN) private readonly projects: Pick<ProjectPortalService, 'listForCustomer' | 'getForCustomer'>,
		@inject(TICKET_SERVICE_TOKEN)
		private readonly tickets: Pick<
			TicketService,
			'listForCustomer' | 'getForCustomer' | 'createFromPortal' | 'addCustomerMessage' | 'confirmFromPortal'
		>,
		@inject(WARRANTY_SERVICE_TOKEN) private readonly warranties: Pick<WarrantyService, 'listForCustomer' | 'getForCustomer'>,
		@inject(CUSTOMER_PERSON_REPOSITORY_TOKEN) private readonly people: Pick<ICustomerPersonRepository, 'findById'>,
		@inject(COMPANY_REPOSITORY_TOKEN) private readonly companies: Pick<ICompanyRepository, 'findById'>,
		@inject(PORTAL_ACCOUNT_SERVICE_TOKEN) private readonly accounts: Pick<PortalAccountService, 'members' | 'inviteMember' | 'removeMember'>,
	) {}

	/** The customer's logins (every member may see them; only owners change them). */
	members(portal: PortalContext): Promise<TPortalAccountView[]> {
		return this.accounts.members(portal);
	}

	inviteMember(portal: PortalContext, input: TPortalMemberInvite): Promise<TPortalAccountView> {
		return this.accounts.inviteMember(portal, input);
	}

	removeMember(portal: PortalContext, id: string): Promise<void> {
		return this.accounts.removeMember(portal, id);
	}

	/** The signed-in person with their company; `null` when the person is no longer active. */
	async customer(portal: PortalContext): Promise<TPortalSubject | null> {
		const person = await this.people.findById(portal.customerId);
		if (!person || person.status !== 'active') return null;
		const company = portal.companyId ? await this.companies.findById(portal.companyId) : null;
		return { person, company };
	}

	/**
	 * The id every owning module scopes its portal reads by: the company when
	 * the login belongs to one, otherwise the individual customer.
	 */
	private scope(portal: PortalContext): string {
		return portal.companyId ?? portal.customerId;
	}

	listProjects(portal: PortalContext): Promise<TPortalProject[]> {
		return this.projects.listForCustomer(this.scope(portal));
	}

	async getProject(portal: PortalContext, id: string): Promise<TPortalProjectDetail> {
		const project = await this.projects.getForCustomer(this.scope(portal), id);
		if (!project) throw new PortalProjectNotFoundError();
		return project;
	}

	listTickets(portal: PortalContext): Promise<TPortalTicket[]> {
		return this.tickets.listForCustomer(this.scope(portal));
	}

	getTicket(portal: PortalContext, id: string): Promise<TPortalTicketDetail> {
		return this.tickets.getForCustomer(this.scope(portal), id);
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
		const certificates = await this.warranties.listForCustomer(this.scope(portal));
		return certificates.flatMap((certificate) => certificate.items.map((_, line) => ({ id: `${certificate.id}:${line}`, certificate, line })));
	}

	/** One of the customer's devices (`<certificate id>:<line>`); 404 for anyone else's. */
	async getDevice(portal: PortalContext, productId: string): Promise<TPortalDevice> {
		const [certificateId, lineText] = productId.split(':');
		const line = Number(lineText);
		const certificate = certificateId ? await this.warranties.getForCustomer(this.scope(portal), certificateId) : null;
		if (!certificate || !Number.isInteger(line) || line < 0 || line >= certificate.items.length) throw new PortalProductNotFoundError();
		return { id: productId, certificate, line };
	}

	private actor(portal: PortalContext) {
		return { userId: portal.userId, name: portal.user.name, email: portal.user.email, customerId: portal.customerId };
	}
}
