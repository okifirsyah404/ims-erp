import { EXPORTED_CUSTOMER_SERVICE_TOKEN } from '@app/customer/constants/di';
import type { ExportedCustomerService } from '@app/customer/services/exported-customer.service';
import { LEAD_SERVICE_TOKEN } from '@app/project/constants/di';
import type { LeadService } from '@app/project/services/lead.service';
import { PRODUCT_SERVICE_TOKEN } from '@app/inventory/constants/di';
import type { ProductService } from '@app/inventory/services/product.service';
import { SALE_NUMBERING_SERVICE_TOKEN } from '../constants/di';
import type { SaleNumberingService } from './sale-numbering.service';
import { DOCUMENT_SERVICE_TOKEN } from '@app/document/constants/di';
import type { DocumentService } from '@app/document';
import { USER_SERVICE_TOKEN } from '@app/user/constants/di';
import type { UserService } from '@app/user/services/user.service';
import {
	type TQuotationItemSelect,
	type TQuotationSelect,
	type TQuotationStatusHistorySelect,
} from '@drizzle/schemas/sale.schema';
import { businessDateOf } from '@utils/business-date.util';
import { OUTBOX_SERVICE_TOKEN } from '@app/automation/constants/di';
import type { OutboxService } from '@app/automation/services/outbox.service';
import { quotationFollowUpEvent, quotationFollowUpStages } from '../utils/quotation-follow-up';
import type { TPaginationResult } from '@ims-erp/common';
import { documentImageUrl } from '@providers/s3/document-image';
import { type IObjectStorage, OBJECT_STORAGE_TOKEN } from '@providers/s3/object-storage';
import { inject, injectable } from 'tsyringe';
import { pinoLogger } from '@providers/logger/logger';
import type { IQuotationSentDispatcher } from '../queues/quotation-sent.queue';
import { QUOTATION_REPOSITORY_TOKEN, QUOTATION_SENT_DISPATCHER_TOKEN, SALES_ORDER_REPOSITORY_TOKEN } from '../constants/di';
import type { ISalesOrderRepository } from '../contracts/sales-order.repository.interface';
import {
	QUOTATION_OPEN_STATUSES,
	type TQuotationBodyRequest,
	type TQuotationDecisionRequest,
	type TQuotationListQuery,
	type TQuotationLostRequest,
} from '../contracts/quotation.contract';
import type {
	IQuotationRepository,
	TQuotationHeaderData,
	TQuotationItemData,
} from '../contracts/quotation.repository.interface';
import {
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
		@inject(EXPORTED_CUSTOMER_SERVICE_TOKEN)
		private readonly customers: Pick<ExportedCustomerService, 'getActiveCustomer' | 'getActiveCompany' | 'getSnapshot'>,
		@inject(LEAD_SERVICE_TOKEN)
		private readonly leads: Pick<LeadService, 'noteQuotation'>,
		@inject(PRODUCT_SERVICE_TOKEN)
		private readonly items: Pick<ProductService, 'getActiveProducts'>,
		@inject(SALE_NUMBERING_SERVICE_TOKEN)
		private readonly numbering: Pick<SaleNumberingService, 'next'>,
		@inject(USER_SERVICE_TOKEN)
		private readonly users: Pick<UserService, 'getUser'>,
		@inject(OBJECT_STORAGE_TOKEN)
		private readonly storage: Pick<IObjectStorage, 'presignGet'>,
		@inject(SALES_ORDER_REPOSITORY_TOKEN)
		private readonly orders: Pick<ISalesOrderRepository, 'findLiveByQuotation'>,
		/** ERP-0044: the issued quotation is recorded in the document registry. */
		@inject(DOCUMENT_SERVICE_TOKEN)
		private readonly documents: Pick<DocumentService, 'register' | 'voidBySource'>,
		/** ERP-0066: follow-up reminders go to n8n through the outbox. */
		@inject(OUTBOX_SERVICE_TOKEN)
		private readonly outbox: Pick<OutboxService, 'publish'>,
		/** ERP-0067: a sent quotation gets its PDF and `quotation.sent` in a queue. */
		@inject(QUOTATION_SENT_DISPATCHER_TOKEN)
		private readonly sentDispatcher: IQuotationSentDispatcher,
	) {}

	/**
	 * Daily `quotation.follow_up_due` reminders (ERP-0066, weekdays): a
	 * quotation still `sent` (no answer) 3 and 7 days after sending, and 2
	 * days before it stops being valid, goes to the salesperson who made it.
	 * Internal only (no message to the customer). Once per (quotation, stage)
	 * through the outbox dedupe key; won / lost / superseded quotations stop.
	 */
	async publishFollowUpNotices(now = new Date()): Promise<{ processed: number; skipped: number }> {
		const today = businessDateOf(now);
		let processed = 0;
		let skipped = 0;
		for (const quotation of await this.quotations.listSentForFollowUp()) {
			if (!quotation.sentAt) continue;
			const sentDate = businessDateOf(quotation.sentAt);
			const stages = quotationFollowUpStages(sentDate, quotation.validUntil, today);
			if (stages.length === 0) continue;
			const user = quotation.createdBy ? await this.users.getUser(quotation.createdBy).catch(() => null) : null;
			const owner = quotation.createdBy
				? { userId: quotation.createdBy, name: user?.name ?? null, phone: user?.phone ?? null, email: user?.email ?? null }
				: null;
			for (const stage of stages) {
				const message = await this.outbox.publish(
					'quotation.follow_up_due',
					{ type: 'quotation', id: quotation.id },
					quotationFollowUpEvent(quotation, stage, sentDate, today, owner),
					{ dedupeKey: `quotation.follow_up_due:${quotation.id}:${stage}` },
				);
				if (message) processed += 1;
				else skipped += 1;
			}
		}
		return { processed, skipped };
	}

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

		// The person is the contact; a company, when named, is the billed entity (Q16).
		if (body.companyId && !(await this.customers.getActiveCompany(body.companyId))) {
			throw new QuotationCustomerUnavailableError();
		}
		const snapshot = await this.customers.getSnapshot({ customerId: customer.id, companyId: body.companyId });
		if (!snapshot) throw new QuotationCustomerUnavailableError();
		const attention = body.attention ?? customer.name;

		const wanted = body.lines.flatMap((line) => (line.productId ? [line.productId] : []));
		const found = new Map((await this.items.getActiveProducts(wanted)).map((item) => [item.id, item]));

		const items: TQuotationItemData[] = body.lines.map((line, index) => {
			let base: Pick<
			TQuotationItemData,
			'productId' | 'sku' | 'name' | 'specification' | 'imageObjectKey' | 'unit' | 'unitPrice'
		>;
			if (line.productId) {
				const item = found.get(line.productId);
				if (!item) throw new QuotationItemUnavailableError(index + 1);
				base = {
					productId: item.id,
					sku: item.sku,
					name: line.name ?? item.name,
					specification: line.specification ?? item.specification,
					imageObjectKey: item.imageObjectKey,
					unit: line.unit ?? item.unitLabel,
					unitPrice: line.unitPrice ?? item.sellingPrice,
				};
			} else {
				base = {
					productId: null,
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
				companyId: body.companyId ?? null,
				customerSnapshot: snapshot,
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
		const quotation = await this.quotations.create({ ...header, code, createdBy: ctx.actorUserId }, items);
		// ERP-0044: the printed SPH is registered with the same code.
		await this.documents.register({
			code: quotation.code,
			documentType: 'quotation',
			module: 'sale',
			sourceType: 'quotation',
			sourceId: quotation.id,
			organizationId: null,
			issuedOn: quotation.quotationDate,
			issuedByUserId: ctx.actorUserId,
		});
		return quotation;
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
		// ERP-0067: the PDF and the `quotation.sent` event never block or fail
		// the transition; a queue outage is logged and the SPH stays sent.
		if (updated.sentAt) {
			await this.sentDispatcher.enqueue(id, updated.sentAt).catch((error: unknown) => {
				pinoLogger.error({ err: error, quotationId: id }, 'quotation-sent job not enqueued');
			});
		}
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
		// ERP-0044: a lost SPH is a dead document in the registry.
		await this.documents.voidBySource('sale', 'quotation', id);
		return updated;
	}
}
