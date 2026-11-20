import { CUSTOMER_SERVICE_TOKEN } from '@app/customer/constants/di';
import type { CustomerService } from '@app/customer/services/customer.service';
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
} from '@drizzle/schemas/project.schema';
import type { TPaginationResult } from '@ims-erp/common';
import { type IObjectStorage, OBJECT_STORAGE_TOKEN } from '@providers/s3/object-storage';
import { OUTBOX_SERVICE_TOKEN } from '@app/automation/constants/di';
import type { OutboxService } from '@app/automation/services/outbox.service';
import { inject, injectable } from 'tsyringe';
import {
	LEAD_ACTIVITY_REPOSITORY_TOKEN,
	LEAD_ATTACHMENT_REPOSITORY_TOKEN,
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
	ILeadAttachmentRepository,
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
} from '../errors/lead.errors';
import { leadCreatedEvent } from '../utils/lead-event';
import { leadFollowUpEvent, type TLeadOwnerContact } from '../utils/lead-follow-up';
import { businessDateOf } from '@utils/business-date.util';

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
		@inject(LEAD_ATTACHMENT_REPOSITORY_TOKEN)
		private readonly attachments: ILeadAttachmentRepository,
		@inject(CUSTOMER_SERVICE_TOKEN)
		private readonly customers: Pick<CustomerService, 'createCustomer' | 'getActiveCustomer'>,
		@inject(ORGANIZATION_SERVICE_TOKEN)
		private readonly organizations: Pick<OrganizationService, 'getMemberRole'>,
		@inject(PERMISSION_RESOLVER_TOKEN)
		private readonly permissions: IPermissionResolver,
		@inject(USER_SERVICE_TOKEN)
		private readonly users: Pick<UserService, 'getUser'>,
		@inject(OBJECT_STORAGE_TOKEN)
		private readonly storage: Pick<IObjectStorage, 'presignGet'>,
		@inject(OUTBOX_SERVICE_TOKEN)
		private readonly outbox: Pick<OutboxService, 'publish'>,
	) {}

	/** The owner's contact for a reminder; `null` without an owner. */
	private async ownerContact(userId: string | null): Promise<TLeadOwnerContact | null> {
		if (!userId) return null;
		const user = await this.users.getUser(userId).catch(() => null);
		return { userId, name: user?.name ?? null, phone: user?.phone ?? null, email: user?.email ?? null };
	}

	/**
	 * Daily `lead.follow_up_due` reminders (ERP-0066, weekdays): open leads
	 * whose planned follow-up is today or past go to their owner; more than 3
	 * days late they are published again as `overdue` (n8n adds the sales
	 * manager). Once per (lead, planned time, stage) through the outbox
	 * dedupe key, so re-runs and a new follow-up date behave.
	 */
	async publishFollowUpNotices(now = new Date()): Promise<{ processed: number; skipped: number }> {
		const today = businessDateOf(now);
		const endOfToday = new Date(`${today}T23:59:59.999+07:00`);
		let processed = 0;
		let skipped = 0;
		for (const lead of await this.leads.listFollowUpsDue(endOfToday)) {
			if (!lead.nextFollowUpAt) continue;
			const dueDate = businessDateOf(lead.nextFollowUpAt);
			const daysOverdue = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${dueDate}T00:00:00Z`)) / 86_400_000);
			const data = leadFollowUpEvent(lead, dueDate, daysOverdue, await this.ownerContact(lead.ownerUserId));
			const message = await this.outbox.publish('lead.follow_up_due', { type: 'lead', id: lead.id }, data, {
				dedupeKey: `lead.follow_up_due:${lead.id}:${lead.nextFollowUpAt.getTime()}:${data.stage}`,
			});
			if (message) processed += 1;
			else skipped += 1;
		}
		return { processed, skipped };
	}

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
			this.attachments.listByLead(id),
		]);
		const people = await this.people([lead.ownerUserId, ...activities.map((a) => a.createdBy)]);
		return {
			...lead,
			assignee: lead.ownerUserId ? (people.get(lead.ownerUserId) ?? null) : null,
			activities: activities.map((activity) => ({ ...activity, author: activity.createdBy ? (people.get(activity.createdBy) ?? null) : null })),
			attachments: attachments.map(({ storageKey: _key, deletedAt: _deleted, ...rest }) => rest),
		};
	}

	/** Short-lived download URL; same visibility as the lead itself. */
	async attachmentUrl(ctx: TLeadContext, leadId: string, attachmentId: string) {
		await this.requireVisible(ctx, leadId);
		const file = (await this.attachments.listByLead(leadId)).find((a) => a.id === attachmentId);
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
		const lead = await this.leads.create({ ...rest, nextFollowUpAt: toDate(nextFollowUpAt), ownerUserId, createdBy: ctx.actorUserId });
		// n8n notifies the sales admin (M04); never fails the lead.
		await this.outbox.publish('lead.created', { type: 'lead', id: lead.id }, leadCreatedEvent(lead));
		return lead;
	}

	/**
	 * A lead from a WhatsApp chat (M04, ERP-0021) — the contract the
	 * WhatsApp inbox calls when an admin turns a chat into a lead.
	 *
	 * @remarks
	 * Source `whatsapp`, unassigned (the sales manager assigns it, like a
	 * website inquiry), `created_by` the admin. Publishes `lead.created`.
	 */
	async captureFromChat(actorUserId: string, input: { name: string; whatsapp: string; needs: string | null }): Promise<TLeadSelect> {
		const lead = await this.leads.create({
			name: input.name.slice(0, 200),
			companyName: null,
			phone: null,
			whatsapp: input.whatsapp.slice(0, 30),
			email: null,
			source: 'whatsapp',
			needs: input.needs ? input.needs.slice(0, 2000) : null,
			ownerUserId: null,
			createdBy: actorUserId,
		});
		await this.outbox.publish('lead.created', { type: 'lead', id: lead.id }, leadCreatedEvent(lead));
		return lead;
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
	 * or creates one (customer rules apply). The lead becomes `won`
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
			customerId = (await this.customers.createCustomer(input.customer, ctx.actorUserId)).id;
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
