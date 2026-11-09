import { ORGANIZATION_SERVICE_TOKEN } from '@app/organization/constants/di';
import type { OrganizationService } from '@app/organization/services/organization.service';
import { USER_SERVICE_TOKEN } from '@app/user/constants/di';
import type { UserService } from '@app/user/services/user.service';
import {
	type IPermissionResolver,
	PERMISSION_RESOLVER_TOKEN,
} from '@authorization/permission-resolver';
import type {
	TLeadActivitySelect,
	TLeadAttachmentSelect,
	TLeadSelect,
} from '@drizzle/schemas/crm.schema';
import type { TPaginationResult } from '@ims-erp/common';
import { type IObjectStorage, OBJECT_STORAGE_TOKEN } from '@providers/s3/object-storage';
import { inject, injectable } from 'tsyringe';
import {
	CUSTOMER_SERVICE_TOKEN,
	LEAD_ACTIVITY_REPOSITORY_TOKEN,
	LEAD_REPOSITORY_TOKEN,
} from '../constants/di';
import type {
	TConvertLeadInput,
	TCreateLeadInput,
	TLeadActivityInput,
	TLeadListQuery,
	TLeadStatusInput,
	TUpdateLeadInput,
} from '../contracts/lead.contract';
import type {
	ILeadActivityRepository,
	ILeadRepository,
} from '../contracts/lead.repository.interface';
import {
	LeadAlreadyConvertedError,
	LeadAssigneeInvalidError,
	LeadAssignForbiddenError,
	LeadAttachmentNotFoundError,
	LeadClosedError,
	LeadCustomerUnavailableError,
	LeadLostError,
	LeadNotFoundError,
} from '../errors/crm.errors';
import type { CustomerService } from './customer.service';

export type TLeadContext = {
	/** Caller's organization (decides permissions, not which leads exist). */
	organizationId: string;
	actorUserId: string;
	/**
	 * `lead:assign` holder (resolved by the controller with the dynamic
	 * permission resolver): sees every lead and may assign. Otherwise only
	 * leads assigned to the caller are visible.
	 */
	canManage: boolean;
};

export type TLeadPerson = { userId: string; name: string };
export type TLeadView = TLeadSelect & { assignee: TLeadPerson | null };
/** Attachment metadata for the admin; the storage key never leaves the server. */
export type TLeadAttachmentView = Omit<TLeadAttachmentSelect, 'storageKey' | 'deletedAt'>;
export type TLeadDetail = TLeadView & {
	activities: (TLeadActivitySelect & { author: TLeadPerson | null })[];
	attachments: TLeadAttachmentView[];
};

const toDate = (ms: number | null | undefined) => (ms === undefined ? undefined : ms === null ? null : new Date(ms));

/** Download links for attachments live this long (seconds). */
const ATTACHMENT_URL_SECONDS = 300;

/**
 * Lead pipeline use cases (M02, ADR-0011 step 3b).
 *
 * @remarks
 * Leads are company-wide; visibility is a service rule (see
 * {@link TLeadContext.canManage}) and anything not visible answers 404.
 * Conversion goes through {@link CustomerService}; assignee checks through
 * the organization service and the dynamic permission resolver; names
 * through the user service (assignees may sit in another department).
 */
@injectable()
export class LeadService {
	constructor(
		@inject(LEAD_REPOSITORY_TOKEN)
		private readonly leads: ILeadRepository,
		@inject(LEAD_ACTIVITY_REPOSITORY_TOKEN)
		private readonly activities: ILeadActivityRepository,
		@inject(CUSTOMER_SERVICE_TOKEN)
		private readonly customers: Pick<CustomerService, 'create' | 'getActiveCustomer'>,
		@inject(ORGANIZATION_SERVICE_TOKEN)
		private readonly organizations: Pick<OrganizationService, 'getMemberRole'>,
		@inject(PERMISSION_RESOLVER_TOKEN)
		private readonly permissions: IPermissionResolver,
		@inject(USER_SERVICE_TOKEN)
		private readonly users: Pick<UserService, 'getUser'>,
		@inject(OBJECT_STORAGE_TOKEN)
		private readonly storage: Pick<IObjectStorage, 'presignGet'>,
	) {}

	private async requireVisible(ctx: TLeadContext, id: string): Promise<TLeadSelect> {
		const lead = await this.leads.findById(id);
		if (!lead || (!ctx.canManage && lead.ownerUserId !== ctx.actorUserId)) throw new LeadNotFoundError();
		return lead;
	}

	private async people(userIds: (string | null)[]): Promise<Map<string, TLeadPerson>> {
		const ids = [...new Set(userIds.filter((id): id is string => !!id))];
		const found = await Promise.all(ids.map((id) => this.users.getUser(id)));
		return new Map(
			found.flatMap((user) => (user ? [[user.id, { userId: user.id, name: user.name }] as const] : [])),
		);
	}

	private async withAssignees(rows: TLeadSelect[]): Promise<TLeadView[]> {
		const people = await this.people(rows.map((row) => row.ownerUserId));
		return rows.map((row) => ({ ...row, assignee: row.ownerUserId ? (people.get(row.ownerUserId) ?? null) : null }));
	}

	/** The assignee must be a member of the caller's organization who can read leads. */
	private async assertAssignable(organizationId: string, userId: string) {
		const role = await this.organizations.getMemberRole(organizationId, userId);
		const roles = role?.split(',').map((name) => name.trim()) ?? [];
		if (!role || !(await this.permissions.hasPermission(organizationId, roles, { lead: ['read'] }))) {
			throw new LeadAssigneeInvalidError();
		}
	}

	async list(ctx: TLeadContext, query: TLeadListQuery): Promise<TPaginationResult<TLeadView>> {
		let ownerUserId: string | null | undefined;
		if (!ctx.canManage || query.assigned === 'me') ownerUserId = ctx.actorUserId;
		else if (query.assigned === 'unassigned') ownerUserId = null;
		else ownerUserId = query.assigned;
		const result = await this.leads.paginate({
			page: query.page,
			limit: query.limit,
			search: query.search,
			status: query.status,
			source: query.source,
			ownerUserId,
			followUpDueBefore: query.followUpDue ? new Date() : undefined,
		});
		return { meta: result.meta, data: await this.withAssignees(result.data) };
	}

	async get(ctx: TLeadContext, id: string): Promise<TLeadDetail> {
		const lead = await this.requireVisible(ctx, id);
		const [activities, attachments] = await Promise.all([
			this.activities.listByLead(id),
			this.leads.listAttachments(id),
		]);
		const people = await this.people([lead.ownerUserId, ...activities.map((a) => a.createdBy)]);
		return {
			...lead,
			assignee: lead.ownerUserId ? (people.get(lead.ownerUserId) ?? null) : null,
			activities: activities.map((activity) => ({ ...activity, author: people.get(activity.createdBy) ?? null })),
			attachments: attachments.map(({ storageKey: _key, deletedAt: _deleted, ...rest }) => rest),
		};
	}

	/** Short-lived download URL; same visibility as the lead itself. */
	async attachmentUrl(ctx: TLeadContext, leadId: string, attachmentId: string) {
		await this.requireVisible(ctx, leadId);
		const file = (await this.leads.listAttachments(leadId)).find((a) => a.id === attachmentId);
		if (!file) throw new LeadAttachmentNotFoundError();
		return {
			url: this.storage.presignGet(file.storageKey, { fileName: file.fileName, expiresIn: ATTACHMENT_URL_SECONDS }),
			expiresIn: ATTACHMENT_URL_SECONDS,
		};
	}

	async create(ctx: TLeadContext, input: TCreateLeadInput): Promise<TLeadSelect> {
		// Non-managers always own what they create; managers may assign.
		let ownerUserId: string | null = ctx.actorUserId;
		if (ctx.canManage && input.assignedTo !== undefined) {
			ownerUserId = input.assignedTo;
			if (ownerUserId) await this.assertAssignable(ctx.organizationId, ownerUserId);
		}
		const { assignedTo: _ignored, nextFollowUpAt, ...rest } = input;
		return this.leads.create({ ...rest, nextFollowUpAt: toDate(nextFollowUpAt), ownerUserId, createdBy: ctx.actorUserId });
	}

	async update(ctx: TLeadContext, id: string, patch: TUpdateLeadInput): Promise<TLeadSelect> {
		const lead = await this.requireVisible(ctx, id);
		if (lead.status === 'won') throw new LeadClosedError();
		const { nextFollowUpAt, ...rest } = patch;
		const updated = await this.leads.update(id, { ...rest, nextFollowUpAt: toDate(nextFollowUpAt) });
		if (!updated) throw new LeadClosedError();
		return updated;
	}

	async changeStatus(ctx: TLeadContext, id: string, input: TLeadStatusInput): Promise<TLeadSelect> {
		const lead = await this.requireVisible(ctx, id);
		if (lead.status === 'won') throw new LeadClosedError();
		const updated = await this.leads.setStatus(id, input.status, input.status === 'lost' ? (input.lostReason ?? null) : null);
		if (!updated) throw new LeadClosedError();
		return updated;
	}

	/**
	 * Cross-module contract for sales: confirms the lead exists and, when it is
	 * still before the quotation stage, moves it to `quotation`. Not bound to
	 * the caller's lead visibility — the quotation's creator may not own it.
	 *
	 * @returns `false` when the lead does not exist (or is archived)
	 */
	async noteQuotation(leadId: string): Promise<boolean> {
		const lead = await this.leads.findById(leadId);
		if (!lead) return false;
		await this.leads.markQuoted(leadId);
		return true;
	}

	async assign(ctx: TLeadContext, id: string, userId: string | null): Promise<TLeadSelect> {
		if (!ctx.canManage) throw new LeadAssignForbiddenError();
		await this.requireVisible(ctx, id);
		if (userId) await this.assertAssignable(ctx.organizationId, userId);
		const updated = await this.leads.assign(id, userId);
		if (!updated) throw new LeadNotFoundError();
		return updated;
	}

	async addActivity(ctx: TLeadContext, id: string, input: TLeadActivityInput): Promise<TLeadActivitySelect> {
		await this.requireVisible(ctx, id);
		const activity = await this.activities.create({
			leadId: id,
			activityType: input.activityType,
			notes: input.notes,
			occurredAt: new Date(input.occurredAt ?? Date.now()),
			createdBy: ctx.actorUserId,
		});
		if (input.nextFollowUpAt !== undefined) {
			await this.leads.update(id, { nextFollowUpAt: toDate(input.nextFollowUpAt) });
		}
		return activity;
	}

	/**
	 * Converts an open lead into a customer: links an existing active customer
	 * or creates one (CRM customer rules apply). The lead becomes `won`
	 * atomically; a race with another conversion answers 409.
	 */
	async convert(ctx: TLeadContext, id: string, input: TConvertLeadInput): Promise<TLeadSelect> {
		const lead = await this.requireVisible(ctx, id);
		if (lead.status === 'won' || lead.customerId) throw new LeadAlreadyConvertedError();
		if (lead.status === 'lost') throw new LeadLostError();
		let customerId: string;
		if ('customerId' in input) {
			const customer = await this.customers.getActiveCustomer(input.customerId);
			if (!customer) throw new LeadCustomerUnavailableError();
			customerId = customer.id;
		} else {
			customerId = (await this.customers.create(input.customer, ctx.actorUserId)).id;
		}
		const converted = await this.leads.markConverted(id, customerId);
		if (!converted) throw new LeadAlreadyConvertedError();
		return converted;
	}

	async archive(ctx: TLeadContext, id: string): Promise<void> {
		await this.requireVisible(ctx, id);
		if (!(await this.leads.softDelete(id))) throw new LeadNotFoundError();
	}
}
