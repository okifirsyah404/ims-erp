import { CUSTOMER_SERVICE_TOKEN } from '@app/crm/constants/di';
import type { CustomerService } from '@app/crm/services/customer.service';
import { NUMBERING_SERVICE_TOKEN, ORGANIZATION_SERVICE_TOKEN } from '@app/organization/constants/di';
import type { NumberingService } from '@app/organization/services/numbering.service';
import type { OrganizationService } from '@app/organization/services/organization.service';
import { PROJECT_LOOKUP_SERVICE_TOKEN } from '@app/projects/constants/di';
import type { ProjectLookupService } from '@app/projects/services/project-lookup.service';
import { USER_SERVICE_TOKEN } from '@app/user/constants/di';
import type { UserService } from '@app/user/services/user.service';
import { type IPermissionResolver, PERMISSION_RESOLVER_TOKEN } from '@authorization/permission-resolver';
import type { TicketChannel, TServiceTicketSelect } from '@drizzle/schemas/aftersales.schema';
import { businessDateOf } from '@utils/business-date.util';
import type { TPaginationResult } from '@ims-erp/common';
import { inject, injectable } from 'tsyringe';
import { SERVICE_TICKET_REPOSITORY_TOKEN, WARRANTY_SERVICE_TOKEN } from '../constants/di';
import type { IServiceTicketRepository, TCreateTicketRequest, TTicketListQuery } from '../contracts/service-ticket.contract';
import {
	TicketAssigneeError,
	TicketForbiddenError,
	TicketNotFoundError,
	TicketReferenceError,
	TicketStateError,
} from '../errors/service-ticket.errors';
import type { TWarrantyCheck, WarrantyService } from './warranty.service';

/** Server-derived caller context (see the controller). */
export type TTicketContext = {
	organizationId: string;
	actorUserId: string;
	/** `service_ticket:assign|close`: every ticket, and works any ticket. */
	canManage: boolean;
};

export type TPerson = { userId: string; name: string };
export type TTicketView = TServiceTicketSelect & { assignee: TPerson | null };

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
 * them.
 */
@injectable()
export class ServiceTicketService {
	constructor(
		@inject(SERVICE_TICKET_REPOSITORY_TOKEN) private readonly tickets: IServiceTicketRepository,
		@inject(WARRANTY_SERVICE_TOKEN) private readonly warranty: Pick<WarrantyService, 'check'>,
		@inject(CUSTOMER_SERVICE_TOKEN) private readonly customers: Pick<CustomerService, 'getActiveCustomer'>,
		@inject(PROJECT_LOOKUP_SERVICE_TOKEN) private readonly projects: Pick<ProjectLookupService, 'getProject'>,
		@inject(ORGANIZATION_SERVICE_TOKEN) private readonly organizations: Pick<OrganizationService, 'getMemberRole' | 'listMembers'>,
		@inject(PERMISSION_RESOLVER_TOKEN) private readonly permissions: Pick<IPermissionResolver, 'hasPermission'>,
		@inject(USER_SERVICE_TOKEN) private readonly users: Pick<UserService, 'getUser'>,
		@inject(NUMBERING_SERVICE_TOKEN) private readonly numbering: Pick<NumberingService, 'next'>,
	) {}

	private async view(ticket: TServiceTicketSelect): Promise<TTicketView> {
		const user = ticket.assigneeUserId ? await this.users.getUser(ticket.assigneeUserId) : null;
		return { ...ticket, assignee: user ? { userId: user.id, name: user.name } : null };
	}

	private async require(ctx: TTicketContext, id: string): Promise<TServiceTicketSelect> {
		const ticket = await this.tickets.findById(id);
		if (!ticket || (!ctx.canManage && ticket.assigneeUserId !== ctx.actorUserId)) throw new TicketNotFoundError();
		return ticket;
	}

	/** The assignee or a ticket manager works the ticket. */
	private assertWorker(ctx: TTicketContext, ticket: TServiceTicketSelect) {
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
		const customer = await this.customers.getActiveCustomer(body.customerId);
		if (!customer) throw new TicketReferenceError('customer');
		if (body.projectId) {
			const project = await this.projects.getProject(body.projectId);
			if (!project || project.customerId !== customer.id) throw new TicketReferenceError('project');
		}
		const reportedAt = body.reportedAt ?? new Date();
		const check = await this.warranty.check({ serialNumber: body.serialNumber, projectId: body.projectId }, businessDateOf(reportedAt));
		if (check.customerId && check.customerId !== customer.id) throw new TicketReferenceError('serial');
		const code = await this.numbering.next('service_ticket', { date: reportedAt });
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
			createdBy: ctx.actorUserId,
		});
		return this.view(ticket);
	}

	async assign(ctx: TTicketContext, id: string, assigneeUserId: string): Promise<TTicketView> {
		await this.require(ctx, id);
		if (!(await this.canWork(ctx.organizationId, assigneeUserId))) throw new TicketAssigneeError();
		const updated = await this.tickets.transition(id, ['new', 'in_progress'], { assigneeUserId });
		if (!updated) throw new TicketStateError('assign');
		return this.view(updated);
	}

	async start(ctx: TTicketContext, id: string): Promise<TTicketView> {
		this.assertWorker(ctx, await this.require(ctx, id));
		const updated = await this.tickets.transition(id, ['new'], { status: 'in_progress' });
		if (!updated) throw new TicketStateError('start');
		return this.view(updated);
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
		return this.view(updated);
	}

	async reopen(ctx: TTicketContext, id: string): Promise<TTicketView> {
		this.assertWorker(ctx, await this.require(ctx, id));
		const updated = await this.tickets.transition(id, ['resolved'], { status: 'in_progress', resolvedBy: null, resolvedAt: null });
		if (!updated) throw new TicketStateError('reopen');
		return this.view(updated);
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
		return this.view(updated);
	}
}
