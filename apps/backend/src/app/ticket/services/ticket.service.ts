import { OUTBOX_SERVICE_TOKEN } from '@app/automation/constants/di';
import type { OutboxService } from '@app/automation/services/outbox.service';
import { CUSTOMER_SERVICE_TOKEN } from '@app/customer/constants/di';
import type { CustomerService } from '@app/customer/services/customer.service';
import { TICKET_NUMBERING_SERVICE_TOKEN } from '../constants/di';
import { ORGANIZATION_SERVICE_TOKEN } from '@app/organization/constants/di';
import type { TicketNumberingService } from './ticket-numbering.service';
import { DOCUMENT_SERVICE_TOKEN } from '@app/document';
import type { DocumentService } from '@app/document';
import type { OrganizationService } from '@app/organization/services/organization.service';
import { PROJECT_LOOKUP_SERVICE_TOKEN } from '@app/project/constants/di';
import type { ProjectLookupService } from '@app/project/services/project-lookup.service';
import { USER_SERVICE_TOKEN } from '@app/user/constants/di';
import type { UserService } from '@app/user/services/user.service';
import { type IPermissionResolver, PERMISSION_RESOLVER_TOKEN } from '@authorization/permission-resolver';
import type { TicketChannel, TTicketSelect } from '@drizzle/schemas/ticket.schema';
import { businessDateOf } from '@utils/business-date.util';
import type { TPaginationResult } from '@ims-erp/common';
import { inject, injectable } from 'tsyringe';
import type { TTicketMessageSelect } from '@drizzle/schemas/ticket.schema';
import { TICKET_MESSAGE_REPOSITORY_TOKEN, TICKET_REPOSITORY_TOKEN } from '../constants/di';
import { WARRANTY_SERVICE_TOKEN } from '@app/project/constants/di';
import type {
	ITicketMessageRepository,
	ITicketRepository,
	TCreateTicketRequest,
	TPortalActor,
	TPortalTicket,
	TPortalTicketDetail,
	TPortalTicketMessage,
	TPortalTicketRequest,
	TTicketCommentRequest,
	TTicketListQuery,
} from '../contracts/ticket.contract';
import {
	TicketAssigneeError,
	TicketForbiddenError,
	TicketNotFoundError,
	TicketReferenceError,
	TicketStateError,
} from '../errors/ticket.errors';
import { type TicketChange, ticketUpdatedEvent } from '../utils/ticket-event';
import type { TWarrantyCheck, WarrantyService } from '@app/project/services/warranty.service';

/** Server-derived caller context (see the controller). */
export type TTicketContext = {
	organizationId: string;
	actorUserId: string;
	/** `service_ticket:assign|close`: every ticket, and works any ticket. */
	canManage: boolean;
};

export type TPerson = { userId: string; name: string };
export type TTicketView = TTicketSelect & { assignee: TPerson | null };
export type TTicketComment = TTicketMessageSelect;

/**
 * Service tickets (tiket servis, M07, ADR-0011 step 6c; decisions of
 * 2026-11-04).
 *
 * @remarks
 * A ticket is opened for an active customer; the warranty is checked at the
 * report time (serial → shipped delivery note → project → certificate) and
 * stored on the ticket. `new → in_progress → resolved → closed`; resolved
 * may reopen; closing needs the customer's confirmation. Ticket managers
 * see and work every ticket; everyone else only the tickets assigned to
 * them. Every change publishes `service_ticket.updated` to n8n (M04).
 */
@injectable()
export class TicketService {
	constructor(
		@inject(TICKET_REPOSITORY_TOKEN) private readonly tickets: ITicketRepository,
		@inject(WARRANTY_SERVICE_TOKEN) private readonly warranty: Pick<WarrantyService, 'check'>,
		@inject(CUSTOMER_SERVICE_TOKEN) private readonly customers: Pick<CustomerService, 'getActiveCustomer'>,
		@inject(PROJECT_LOOKUP_SERVICE_TOKEN) private readonly projects: Pick<ProjectLookupService, 'getProject'>,
		@inject(ORGANIZATION_SERVICE_TOKEN) private readonly organizations: Pick<OrganizationService, 'getMemberRole' | 'listMembers'>,
		@inject(PERMISSION_RESOLVER_TOKEN) private readonly permissions: Pick<IPermissionResolver, 'hasPermission'>,
		@inject(USER_SERVICE_TOKEN) private readonly users: Pick<UserService, 'getUser'>,
		@inject(TICKET_NUMBERING_SERVICE_TOKEN) private readonly numbering: Pick<TicketNumberingService, 'next'>,
		@inject(OUTBOX_SERVICE_TOKEN) private readonly outbox: Pick<OutboxService, 'publish'>,
		/** ERP-0044: finished tickets are recorded in the registry. */
		@inject(DOCUMENT_SERVICE_TOKEN) private readonly documents: Pick<DocumentService, 'register'>,
		/** ERP-0022: the ticket's message thread (staff notes and replies, customer messages). */
		@inject(TICKET_MESSAGE_REPOSITORY_TOKEN) private readonly comments: ITicketMessageRepository,
	) {}

	private async view(ticket: TTicketSelect): Promise<TTicketView> {
		const user = ticket.assigneeUserId ? await this.users.getUser(ticket.assigneeUserId) : null;
		return { ...ticket, assignee: user ? { userId: user.id, name: user.name } : null };
	}

	/** Publishes `service_ticket.updated` to n8n (M04 stage 2) and returns the view. */
	private async changed(ticket: TTicketSelect, change: TicketChange): Promise<TTicketView> {
		const view = await this.view(ticket);
		// ADR-0014: a ticket may carry no customer; the event then has no contact.
		const customer = ticket.customerId ? await this.customers.getActiveCustomer(ticket.customerId) : null;
		// The phone is also the WhatsApp number since ERP-0114.
		const contact = customer ? { phone: customer.phone, whatsapp: customer.phone, email: customer.email } : null;
		await this.outbox.publish('service_ticket.updated', { type: 'ticket', id: ticket.id }, ticketUpdatedEvent(ticket, change, view.assignee, contact));
		return view;
	}

	private async require(ctx: TTicketContext, id: string): Promise<TTicketSelect> {
		const ticket = await this.tickets.findById(id);
		if (!ticket || (!ctx.canManage && ticket.assigneeUserId !== ctx.actorUserId)) throw new TicketNotFoundError();
		return ticket;
	}

	/** The assignee or a ticket manager works the ticket. */
	private assertWorker(ctx: TTicketContext, ticket: TTicketSelect) {
		if (!ctx.canManage && ticket.assigneeUserId !== ctx.actorUserId) throw new TicketForbiddenError();
	}

	private async canWork(organizationId: string, userId: string): Promise<boolean> {
		const role = await this.organizations.getMemberRole(organizationId, userId);
		if (!role) return false;
		return this.permissions.hasPermission(organizationId, role.split(',').map((name) => name.trim()), { service_ticket: ['update'] });
	}

	async list(ctx: TTicketContext, query: TTicketListQuery): Promise<TPaginationResult<TTicketView>> {
		const result = await this.tickets.paginate({ ...query, assigneeUserId: ctx.canManage ? undefined : ctx.actorUserId });
		return { meta: result.meta, data: await Promise.all(result.data.map((ticket) => this.view(ticket))) };
	}

	async get(ctx: TTicketContext, id: string): Promise<TTicketView> {
		return this.view(await this.require(ctx, id));
	}

	/** Members of the caller's organization who can work tickets. */
	async technicians(ctx: TTicketContext): Promise<TPerson[]> {
		const members = await this.organizations.listMembers(ctx.organizationId, { page: 1, limit: 100 });
		const people: TPerson[] = [];
		for (const member of members.data) {
			const roles = member.role.split(',').map((name) => name.trim());
			if (await this.permissions.hasPermission(ctx.organizationId, roles, { service_ticket: ['update'] })) {
				people.push({ userId: member.userId, name: member.user?.name ?? member.userId });
			}
		}
		return people.sort((a, b) => a.name.localeCompare(b.name));
	}

	/** The warranty check the new-ticket form shows live. */
	checkWarranty(query: { serialNumber?: string; projectId?: string }): Promise<TWarrantyCheck> {
		return this.warranty.check(query, businessDateOf());
	}

	async create(ctx: TTicketContext, body: TCreateTicketRequest): Promise<TTicketView> {
		return this.view(await this.open(ctx.actorUserId, body));
	}

	/** Opens a ticket: customer and project checked, warranty checked and stored, numbered. */
	private async open(actorUserId: string, body: TCreateTicketRequest): Promise<TTicketSelect> {
		const customer = await this.customers.getActiveCustomer(body.customerId);
		if (!customer) throw new TicketReferenceError('customer');
		if (body.projectId) {
			const project = await this.projects.getProject(body.projectId);
			if (!project || project.customerId !== customer.id) throw new TicketReferenceError('project');
		}
		const reportedAt = body.reportedAt ?? new Date();
		const check = await this.warranty.check({ serialNumber: body.serialNumber, projectId: body.projectId }, businessDateOf(reportedAt));
		if (check.customerId && check.customerId !== customer.id) throw new TicketReferenceError('serial');
		const code = await this.numbering.next('ticket', undefined, reportedAt);
		const ticket = await this.tickets.create({
			code,
			customerId: customer.id,
			customerName: customer.name,
			projectId: body.projectId ?? check.projectId,
			serialNumber: body.serialNumber,
			deviceDescription: body.deviceDescription ?? check.deviceDescription,
			channel: body.channel,
			reporterName: body.reporterName,
			reporterContact: body.reporterContact,
			complaint: body.complaint,
			reportedAt,
			inWarranty: check.inWarranty,
			warrantyEndsOn: check.warrantyEndsOn,
			warrantyCode: check.warrantyCode,
			createdBy: actorUserId,
		});
		return this.changed(ticket, 'created');
	}

	async assign(ctx: TTicketContext, id: string, assigneeUserId: string): Promise<TTicketView> {
		await this.require(ctx, id);
		if (!(await this.canWork(ctx.organizationId, assigneeUserId))) throw new TicketAssigneeError();
		const updated = await this.tickets.transition(id, ['new', 'in_progress'], { assigneeUserId });
		if (!updated) throw new TicketStateError('assign');
		return this.changed(updated, 'assigned');
	}

	async start(ctx: TTicketContext, id: string): Promise<TTicketView> {
		this.assertWorker(ctx, await this.require(ctx, id));
		const updated = await this.tickets.transition(id, ['new'], { status: 'in_progress' });
		if (!updated) throw new TicketStateError('start');
		return this.changed(updated, 'started');
	}

	async resolve(ctx: TTicketContext, id: string, body: { resolution: string; serviceCost: number }): Promise<TTicketView> {
		this.assertWorker(ctx, await this.require(ctx, id));
		const updated = await this.tickets.transition(id, ['new', 'in_progress'], {
			status: 'resolved',
			resolution: body.resolution,
			serviceCost: body.serviceCost,
			resolvedBy: ctx.actorUserId,
			resolvedAt: new Date(),
		});
		if (!updated) throw new TicketStateError('resolve');
		return this.changed(updated, 'resolved');
	}

	async reopen(ctx: TTicketContext, id: string): Promise<TTicketView> {
		this.assertWorker(ctx, await this.require(ctx, id));
		const updated = await this.tickets.transition(id, ['resolved'], { status: 'in_progress', resolvedBy: null, resolvedAt: null });
		if (!updated) throw new TicketStateError('reopen');
		return this.changed(updated, 'reopened');
	}

	/** Resolved → closed with the customer's confirmation. */
	async close(ctx: TTicketContext, id: string, body: { confirmedByName: string; confirmationChannel: TicketChannel }): Promise<TTicketView> {
		await this.require(ctx, id);
		const now = new Date();
		const updated = await this.tickets.transition(id, ['resolved'], {
			status: 'closed',
			confirmedByName: body.confirmedByName,
			confirmationChannel: body.confirmationChannel,
			confirmedAt: now,
			closedBy: ctx.actorUserId,
			closedAt: now,
		});
		if (!updated) throw new TicketStateError('close');
		// ERP-0044: a closed ticket is the service report the customer signed.
		await this.documents.register({
			code: updated.code,
			documentType: 'ticket',
			module: 'ticket',
			sourceType: 'service_ticket',
			sourceId: updated.id,
			organizationId: null,
			issuedOn: businessDateOf(now),
			issuedByUserId: ctx.actorUserId,
		});
		return this.changed(updated, 'closed');
	}
	/* -------------------------------------------------------------------- *
	 * Message thread (ERP-0022)
	 * -------------------------------------------------------------------- */

	/** Every comment of a ticket the caller may see (staff view: internal notes included). */
	async listComments(ctx: TTicketContext, id: string): Promise<TTicketComment[]> {
		await this.require(ctx, id);
		return this.comments.list(id);
	}

	/** A staff note (`internal`) or a reply the customer sees in the portal (`customer`). */
	async addComment(ctx: TTicketContext, id: string, body: TTicketCommentRequest): Promise<TTicketComment> {
		const ticket = await this.require(ctx, id);
		if (ticket.status === 'closed') throw new TicketStateError('comment');
		const author = await this.users.getUser(ctx.actorUserId);
		return this.comments.create({
			ticketId: ticket.id,
			authorType: 'staff',
			authorUserId: ctx.actorUserId,
			authorName: author?.name ?? 'Staff',
			body: body.body,
			visibility: body.visibility,
		});
	}

	/* -------------------------------------------------------------------- *
	 * Customer portal (ERP-0022): scoped to the portal login's customer
	 * -------------------------------------------------------------------- */

	/** The customer's tickets, newest first. Another customer's ticket never appears. */
	async listForCustomer(customerId: string): Promise<TPortalTicket[]> {
		const tickets = await this.tickets.listByCustomer(customerId);
		const latest = await this.comments.latestCustomerVisible(tickets.map((ticket) => ticket.id));
		return Promise.all(
			tickets.map(async (ticket) => {
				const thread = latest.get(ticket.id);
				return this.portalTicket(ticket, thread?.count ?? 0, thread ? this.portalMessage(thread.latest) : null);
			}),
		);
	}

	/** One of the customer's tickets with its customer-visible messages; 404 for anyone else's. */
	async getForCustomer(customerId: string, id: string): Promise<TPortalTicketDetail> {
		const ticket = await this.requireOwned(customerId, id);
		const messages = (await this.comments.list(ticket.id, 'customer')).map((comment) => this.portalMessage(comment));
		const last = messages.length > 0 ? messages[messages.length - 1] : null;
		return { ...(await this.portalTicket(ticket, messages.length, last)), messages };
	}

	/** The customer reports a problem from the portal: channel `portal`, reporter = the portal login. */
	async createFromPortal(actor: TPortalActor, body: TPortalTicketRequest): Promise<TPortalTicketDetail> {
		const ticket = await this.open(actor.userId, {
			customerId: actor.customerId,
			projectId: body.projectId,
			serialNumber: body.serialNumber,
			deviceDescription: body.deviceDescription,
			channel: 'portal',
			reporterName: actor.name,
			reporterContact: actor.email,
			complaint: `${body.subject}\n\n${body.description}`.trim(),
			reportedAt: null,
		});
		return this.getForCustomer(actor.customerId, ticket.id);
	}

	/** A customer message on the thread (always customer-visible). */
	async addCustomerMessage(actor: TPortalActor, id: string, text: string): Promise<TPortalTicketMessage> {
		const ticket = await this.requireOwned(actor.customerId, id);
		if (ticket.status === 'closed') throw new TicketStateError('comment');
		const comment = await this.comments.create({
			ticketId: ticket.id,
			authorType: 'customer',
			authorUserId: actor.userId,
			authorName: actor.name,
			body: text,
			visibility: 'customer',
		});
		return this.portalMessage(comment);
	}

	/**
	 * The customer confirms the fix in the portal: resolved → closed, the
	 * confirmation recorded with channel `portal` (it replaces the
	 * staff-recorded confirmation for these tickets).
	 */
	async confirmFromPortal(actor: TPortalActor, id: string): Promise<TPortalTicketDetail> {
		const ticket = await this.requireOwned(actor.customerId, id);
		const now = new Date();
		const updated = await this.tickets.transition(ticket.id, ['resolved'], {
			status: 'closed',
			confirmedByName: actor.name,
			confirmationChannel: 'portal',
			confirmedAt: now,
			closedBy: actor.userId,
			closedAt: now,
		});
		if (!updated) throw new TicketStateError('close');
		await this.documents.register({
			code: updated.code,
			documentType: 'ticket',
			module: 'ticket',
			sourceType: 'service_ticket',
			sourceId: updated.id,
			organizationId: null,
			issuedOn: businessDateOf(now),
			issuedByUserId: actor.userId,
		});
		return this.getForCustomer(actor.customerId, updated.id);
	}

	private async requireOwned(customerId: string, id: string): Promise<TTicketSelect> {
		const ticket = await this.tickets.findById(id);
		if (!ticket || ticket.customerId !== customerId) throw new TicketNotFoundError();
		return ticket;
	}

	private portalMessage(comment: TTicketMessageSelect): TPortalTicketMessage {
		return { id: comment.id, authorType: comment.authorType, authorName: comment.authorName, body: comment.body, createdAt: comment.createdAt };
	}

	private async portalTicket(ticket: TTicketSelect, messageCount: number, lastMessage: TPortalTicketMessage | null): Promise<TPortalTicket> {
		const assignee = ticket.assigneeUserId ? await this.users.getUser(ticket.assigneeUserId) : null;
		return {
			id: ticket.id,
			code: ticket.code,
			status: ticket.status,
			complaint: ticket.complaint,
			serialNumber: ticket.serialNumber,
			deviceDescription: ticket.deviceDescription,
			projectId: ticket.projectId,
			inWarranty: ticket.inWarranty,
			warrantyEndsOn: ticket.warrantyEndsOn,
			reportedAt: ticket.reportedAt,
			resolution: ticket.resolution,
			resolvedAt: ticket.resolvedAt,
			closedAt: ticket.closedAt,
			assigneeName: assignee?.name ?? null,
			messageCount,
			lastMessage,
		};
	}
}
