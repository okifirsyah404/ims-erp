import { CUSTOMER_SERVICE_TOKEN } from '@app/crm/constants/di';
import type { CustomerService } from '@app/crm/services/customer.service';
import { LEAD_SERVICE_TOKEN } from '@app/crm/constants/di';
import type { LeadService } from '@app/crm/services/lead.service';
import { ITEM_SERVICE_TOKEN } from '@app/inventory/constants/di';
import type { ItemService } from '@app/inventory/services/item.service';
import { NUMBERING_SERVICE_TOKEN } from '@app/organization/constants/di';
import type { NumberingService } from '@app/organization/services/numbering.service';
import { USER_SERVICE_TOKEN } from '@app/user/constants/di';
import type { UserService } from '@app/user/services/user.service';
import {
	QUOTATION_OPEN_STATUSES,
	type TQuotationItemSelect,
	type TQuotationSelect,
	type TQuotationStatusHistorySelect,
} from '@drizzle/schemas/sales.schema';
import { businessDateOf } from '@utils/business-date.util';
import type { TPaginationResult } from '@ims-erp/common';
import { documentImageUrl } from '@providers/s3/document-image';
import { type IObjectStorage, OBJECT_STORAGE_TOKEN } from '@providers/s3/object-storage';
import { inject, injectable } from 'tsyringe';
import { QUOTATION_REPOSITORY_TOKEN, SALES_ORDER_REPOSITORY_TOKEN } from '../constants/di';
import type { ISalesOrderRepository } from '../contracts/sales-order.repository.interface';
import type {
	TQuotationBodyRequest,
	TQuotationDecisionRequest,
	TQuotationListQuery,
	TQuotationLostRequest,
} from '../contracts/quotation.contract';
import type {
	IQuotationRepository,
	TQuotationHeaderData,
	TQuotationItemData,
} from '../contracts/quotation.repository.interface';
import {
	QuotationContactInvalidError,
	QuotationCustomerUnavailableError,
	QuotationDiscountTooLargeError,
	QuotationItemUnavailableError,
	QuotationLeadNotFoundError,
	QuotationNotFoundError,
	QuotationSelfApprovalError,
	QuotationStateError,
} from '../errors/quotation.errors';
import { describeSchedule } from '../utils/payment-schedule';
import { computeTotals, DEFAULT_VAT_RATE_BPS, lineGross, lineTotal } from '../utils/quotation-totals';
import { isQuotationExpired, quotationExpiresAt } from '../utils/quotation-validity';

export type TQuotationContext = {
	actorUserId: string;
	/**
	 * Holders of `quotation:approve` or `quotation:export` (sales manager,
	 * owner, auditor) see every quotation; everyone else only their own
	 * (owner decision 2026-10-31, same rule as leads).
	 */
	canViewAll: boolean;
	/**
	 * Billing staff (`invoice:read`, e.g. finance) also see "Deal" (`won`)
	 * SPHs and that SPH's earlier revisions, read only (decision 2026-11-04).
	 */
	canViewDeals: boolean;
};

/** Validity as shown to users (end of the "valid until" Jakarta day). */
export type TQuotationValidity = {
	/** Unix ms of 23:59:59.999 WIB on the valid-until date; null = open-ended. */
	expiresAt: number | null;
	/** Past `expiresAt` while still open (informational, not a status). */
	expired: boolean;
};

export type TQuotationView = TQuotationSelect & TQuotationValidity;

export type TQuotationPerson = { userId: string; name: string };

export type TQuotationDetail = TQuotationView & {
	/** Lines with a short-lived URL of their snapshotted photo. */
	items: (TQuotationItemSelect & { imageUrl: string | null })[];
	revisions: Pick<TQuotationSelect, 'id' | 'code' | 'revision' | 'status' | 'grandTotal' | 'createdAt'>[];
	history: (TQuotationStatusHistorySelect & { by: TQuotationPerson | null })[];
	creator: TQuotationPerson | null;
	approver: TQuotationPerson | null;
	/** The live sales order of a Deal (`won`) SPH. */
	salesOrder: { id: string; code: string; status: string } | null;
};

function withValidity(quotation: TQuotationSelect): TQuotationView {
	const expiresAt = quotationExpiresAt(quotation.validUntil);
	return { ...quotation, expiresAt, expired: isQuotationExpired(quotation.status, expiresAt) };
}

/**
 * Quotation (SPH) use cases (M02, ADR-0011 step 3c).
 *
 * @remarks
 * Quotations are company-wide. Customer, lead, item and numbering data come
 * through those modules' services; customer and line data are snapshotted
 * so later master-data edits never change an issued SPH. The stored totals
 * are a cache of the lines, recomputed on every write. Separation of duties:
 * the creator can never approve or reject their own SPH; there is no amount
 * limit (owner decision 2026-10-31). Anything not visible answers 404.
 */
@injectable()
export class QuotationService {
	constructor(
		@inject(QUOTATION_REPOSITORY_TOKEN)
		private readonly quotations: IQuotationRepository,
		@inject(CUSTOMER_SERVICE_TOKEN)
		private readonly customers: Pick<CustomerService, 'getActiveCustomer' | 'getContact'>,
		@inject(LEAD_SERVICE_TOKEN)
		private readonly leads: Pick<LeadService, 'noteQuotation'>,
		@inject(ITEM_SERVICE_TOKEN)
		private readonly items: Pick<ItemService, 'getActiveItems'>,
		@inject(NUMBERING_SERVICE_TOKEN)
		private readonly numbering: Pick<NumberingService, 'next'>,
		@inject(USER_SERVICE_TOKEN)
		private readonly users: Pick<UserService, 'getUser'>,
		@inject(OBJECT_STORAGE_TOKEN)
		private readonly storage: Pick<IObjectStorage, 'presignGet'>,
		@inject(SALES_ORDER_REPOSITORY_TOKEN)
		private readonly orders: Pick<ISalesOrderRepository, 'findLiveByQuotation'>,
	) {}

	private async requireVisible(ctx: TQuotationContext, id: string): Promise<TQuotationSelect> {
		const quotation = await this.quotations.findById(id);
		if (!quotation || !(await this.isVisible(ctx, quotation))) throw new QuotationNotFoundError();
		return quotation;
	}

	private async isVisible(ctx: TQuotationContext, quotation: TQuotationSelect): Promise<boolean> {
		if (ctx.canViewAll || quotation.createdBy === ctx.actorUserId) return true;
		if (!ctx.canViewDeals) return false;
		if (quotation.status === 'won') return true;
		// An earlier revision of a deal stays readable from the deal's history.
		const family = await this.quotations.findRevisions(quotation.baseCode);
		return family.some((revision) => revision.status === 'won');
	}

	private async people(userIds: (string | null)[]): Promise<Map<string, TQuotationPerson>> {
		const ids = [...new Set(userIds.filter((id): id is string => !!id))];
		const found = await Promise.all(ids.map((id) => this.users.getUser(id)));
		return new Map(
			found.flatMap((user) => (user ? [[user.id, { userId: user.id, name: user.name }] as const] : [])),
		);
	}

	/** Validates references and derives the snapshot header and priced lines. */
	private async build(body: TQuotationBodyRequest): Promise<{ header: TQuotationHeaderData; items: TQuotationItemData[] }> {
		const customer = await this.customers.getActiveCustomer(body.customerId);
		if (!customer) throw new QuotationCustomerUnavailableError();

		let attention = body.attention;
		if (body.customerContactId) {
			const contact = await this.customers.getContact(customer.id, body.customerContactId);
			if (!contact) throw new QuotationContactInvalidError();
			attention ??= contact.name;
		}

		const wanted = body.lines.flatMap((line) => (line.itemId ? [line.itemId] : []));
		const found = new Map((await this.items.getActiveItems(wanted)).map((item) => [item.id, item]));

		const items: TQuotationItemData[] = body.lines.map((line, index) => {
			let base: Pick<
			TQuotationItemData,
			'itemId' | 'sku' | 'name' | 'specification' | 'imageObjectKey' | 'unit' | 'unitPrice'
		>;
			if (line.itemId) {
				const item = found.get(line.itemId);
				if (!item) throw new QuotationItemUnavailableError(index + 1);
				base = {
					itemId: item.id,
					sku: item.sku,
					name: line.name ?? item.name,
					specification: line.specification ?? item.specification,
					imageObjectKey: item.imageObjectKey,
					unit: line.unit ?? item.unitLabel,
					unitPrice: line.unitPrice ?? item.sellingPrice,
				};
			} else {
				base = {
					itemId: null,
					sku: null,
					name: line.name!,
					specification: line.specification,
					imageObjectKey: null,
					unit: line.unit!,
					unitPrice: line.unitPrice!,
				};
			}
			const amounts = { quantity: line.quantity, unitPrice: base.unitPrice!, discountAmount: line.discountAmount };
			if (amounts.discountAmount > lineGross(amounts)) throw new QuotationDiscountTooLargeError(index + 1);
			return { ...base, ...amounts, lineTotal: lineTotal(amounts) };
		});

		const vatRateBps = body.vatEnabled ? (body.vatRateBps ?? DEFAULT_VAT_RATE_BPS) : 0;
		const totals = computeTotals(
			items.map((item) => ({ quantity: String(item.quantity), unitPrice: item.unitPrice!, discountAmount: item.discountAmount! })),
			{ enabled: body.vatEnabled, rateBps: vatRateBps },
		);

		return {
			header: {
				customerId: customer.id,
				customerContactId: body.customerContactId ?? null,
				customerSnapshot: {
					code: customer.code,
					name: customer.name,
					type: customer.customerType,
					email: customer.email,
					phone: customer.phone,
					whatsapp: customer.whatsapp,
					taxId: customer.taxId,
					addressLine: customer.addressLine,
					postalCode: customer.postalCode,
				},
				leadId: body.leadId ?? null,
				title: body.title,
				heading: body.heading,
				attention,
				// The printed "Payment" line defaults to the planned schedule.
				paymentTerms: body.paymentTerms ?? (body.paymentSchedule ? describeSchedule(body.paymentSchedule) : null),
				paymentSchedule: body.paymentSchedule ?? null,
				guarantee: body.guarantee,
				quotationDate: body.quotationDate ?? businessDateOf(),
				validUntil: body.validUntil ?? null,
				vatEnabled: body.vatEnabled,
				vatRateBps,
				subtotal: totals.subtotal,
				discountTotal: totals.discountTotal,
				taxTotal: totals.taxTotal,
				grandTotal: totals.grandTotal,
				notes: body.notes,
				terms: body.terms,
			},
			items,
		};
	}

	async list(ctx: TQuotationContext, query: TQuotationListQuery): Promise<TPaginationResult<TQuotationView>> {
		const result = await this.quotations.paginate({
			...query,
			createdBy: ctx.canViewAll ? undefined : ctx.actorUserId,
			includeWon: !ctx.canViewAll && ctx.canViewDeals,
			excludeSuperseded: true,
		});
		return { meta: result.meta, data: result.data.map(withValidity) };
	}

	async get(ctx: TQuotationContext, id: string): Promise<TQuotationDetail> {
		const quotation = await this.requireVisible(ctx, id);
		const [items, revisions, history, order] = await Promise.all([
			this.quotations.findItems(id),
			this.quotations.findRevisions(quotation.baseCode),
			this.quotations.findHistory(id),
			quotation.status === 'won' ? this.orders.findLiveByQuotation(id) : Promise.resolve(null),
		]);
		const people = await this.people([quotation.createdBy, quotation.approvedBy, ...history.map((h) => h.changedBy)]);
		const person = (userId: string | null) => (userId ? (people.get(userId) ?? null) : null);
		return {
			...withValidity(quotation),
			items: items.map((item) => ({ ...item, imageUrl: documentImageUrl(this.storage, item.imageObjectKey) })),
			revisions: revisions.map(({ id, code, revision, status, grandTotal, createdAt }) => ({
				id,
				code,
				revision,
				status,
				grandTotal,
				createdAt,
			})),
			history: history.map((entry) => ({ ...entry, by: person(entry.changedBy) })),
			creator: person(quotation.createdBy),
			approver: person(quotation.approvedBy),
			salesOrder: order ? { id: order.id, code: order.code, status: order.status } : null,
		};
	}

	async create(ctx: TQuotationContext, body: TQuotationBodyRequest): Promise<TQuotationSelect> {
		const { header, items } = await this.build(body);
		if (header.leadId && !(await this.leads.noteQuotation(header.leadId))) throw new QuotationLeadNotFoundError();
		// Numbered on creation; gaps from abandoned drafts are accepted.
		const code = await this.numbering.next('quotation', { date: new Date() });
		return this.quotations.create({ ...header, code, createdBy: ctx.actorUserId }, items);
	}

	async update(ctx: TQuotationContext, id: string, body: TQuotationBodyRequest): Promise<TQuotationSelect> {
		const quotation = await this.requireVisible(ctx, id);
		if (quotation.status !== 'draft') throw new QuotationStateError('notDraft');
		const { header, items } = await this.build(body);
		if (header.leadId && header.leadId !== quotation.leadId && !(await this.leads.noteQuotation(header.leadId))) {
			throw new QuotationLeadNotFoundError();
		}
		const updated = await this.quotations.replaceDraft(id, header, items);
		if (!updated) throw new QuotationStateError('notDraft');
		return updated;
	}

	async submit(ctx: TQuotationContext, id: string): Promise<TQuotationSelect> {
		await this.requireVisible(ctx, id);
		const updated = await this.quotations.transition(
			id,
			['draft'],
			'submitted',
			{ submittedAt: new Date() },
			{ userId: ctx.actorUserId },
		);
		if (!updated) throw new QuotationStateError('notDraft');
		return updated;
	}

	async decide(ctx: TQuotationContext, id: string, input: TQuotationDecisionRequest): Promise<TQuotationSelect> {
		const quotation = await this.requireVisible(ctx, id);
		if (quotation.createdBy === ctx.actorUserId) throw new QuotationSelfApprovalError();
		const approve = input.decision === 'approve';
		const updated = await this.quotations.transition(
			id,
			['submitted'],
			approve ? 'approved' : 'rejected',
			approve
				? { approvedBy: ctx.actorUserId, approvedAt: new Date(), rejectedReason: null }
				: { rejectedReason: input.reason ?? null },
			{ userId: ctx.actorUserId, note: approve ? null : (input.reason ?? null) },
		);
		if (!updated) throw new QuotationStateError('notSubmitted');
		return updated;
	}

	/** Supersedes a non-draft SPH and opens its next draft revision. */
	async revise(ctx: TQuotationContext, id: string): Promise<TQuotationSelect> {
		const quotation = await this.requireVisible(ctx, id);
		if (quotation.status === 'draft') throw new QuotationStateError('revisionOfDraft');
		if (quotation.status === 'superseded') throw new QuotationStateError('notLatest');
		if (quotation.status === 'won' || (await this.orders.findLiveByQuotation(id))) {
			throw new QuotationStateError('won');
		}
		const revision = await this.quotations.createRevision(
			id,
			['submitted', 'approved', 'rejected', 'sent', 'lost'],
			ctx.actorUserId,
		);
		if (!revision) throw new QuotationStateError('notLatest');
		return revision;
	}

	/** Approved → sent (recorded after sending it to the customer). */
	async markSent(ctx: TQuotationContext, id: string): Promise<TQuotationSelect> {
		await this.requireVisible(ctx, id);
		const updated = await this.quotations.transition(
			id,
			['approved'],
			'sent',
			{ sentBy: ctx.actorUserId, sentAt: new Date() },
			{ userId: ctx.actorUserId },
		);
		if (!updated) throw new QuotationStateError('notApproved');
		return updated;
	}

	/**
	 * Any open status → lost ("Batal") with a reason (decision 2026-11-04).
	 * "Deal" is not set here: it happens by creating the sales order.
	 */
	async markLost(ctx: TQuotationContext, id: string, input: TQuotationLostRequest): Promise<TQuotationSelect> {
		await this.requireVisible(ctx, id);
		const updated = await this.quotations.transition(
			id,
			QUOTATION_OPEN_STATUSES,
			'lost',
			{ closedBy: ctx.actorUserId, closedAt: new Date(), lostReason: input.reason, lostNote: input.note ?? null },
			{ userId: ctx.actorUserId, note: input.note ?? null },
		);
		if (!updated) throw new QuotationStateError('notOpen');
		return updated;
	}
}
