import { INVOICE_LOOKUP_SERVICE_TOKEN } from '@app/sale/constants/di';
import type { InvoiceLookupService } from '@app/sale/services/invoice-lookup.service';
import { SALE_NUMBERING_SERVICE_TOKEN } from '../constants/di';
import type { SaleNumberingService } from './sale-numbering.service';
import { DOCUMENT_SERVICE_TOKEN } from '@app/document/constants/di';
import type { DocumentService } from '@app/document';
import { PROJECT_LOOKUP_SERVICE_TOKEN } from '@app/projects/constants/di';
import { SalesOrderHasProjectError } from '@app/projects/errors/project.errors';
import type { ProjectLookupService } from '@app/projects/services/project-lookup.service';
import { USER_SERVICE_TOKEN } from '@app/user/constants/di';
import type { UserService } from '@app/user/services/user.service';
import { isUniqueViolation } from '@drizzle/errors';
import type {
	TOrderStatusHistorySelect,
	TOrderItemSelect,
	TOrderSelect,
} from '@drizzle/schemas/sale.schema';
import { businessDateOf } from '@utils/business-date.util';
import type { TPaginationResult } from '@ims-erp/common';
import { inject, injectable } from 'tsyringe';
import { DELIVERY_NOTE_REPOSITORY_TOKEN, QUOTATION_REPOSITORY_TOKEN, SALES_ORDER_REPOSITORY_TOKEN } from '../constants/di';
import type { IDeliveryNoteRepository } from '../contracts/delivery-note.repository.interface';
import { SalesOrderDeliveredError } from '../errors/delivery-note.errors';
import type { IQuotationRepository } from '../contracts/quotation.repository.interface';
import type { TCreateSalesOrderRequest, TSalesOrderListQuery } from '../contracts/sales-order.contract';
import type { ISalesOrderRepository } from '../contracts/sales-order.repository.interface';
import { QuotationNotFoundError } from '../errors/quotation.errors';
import {
	SalesOrderBilledError,
	SalesOrderExistsError,
	SalesOrderNotCancellableError,
	SalesOrderNotFoundError,
	SalesOrderQuotationNotReadyError,
} from '../errors/sales-order.errors';

export type TSalesOrderContext = {
	actorUserId: string;
	/**
	 * Holders of `sales_order:approve|export` (sales manager, owner, auditor)
	 * and billing staff (`invoice:read`) see every order; everyone else only
	 * the orders of their own SPHs.
	 */
	canViewAll: boolean;
	/** `quotation:approve|export` — may turn anyone's SPH into an order. */
	canUseAnyQuotation: boolean;
};

export type TPerson = { userId: string; name: string };

export type TSalesOrderDetail = TOrderSelect & {
	items: TOrderItemSelect[];
	history: (TOrderStatusHistorySelect & { by: TPerson | null })[];
	salesPerson: TPerson | null;
};

/**
 * Sales order use cases (M02, ADR-0011 step 3d).
 *
 * @remarks
 * Orders are company-wide and come only from an approved or sent SPH: they
 * copy its customer, lines and amounts, are `confirmed` at once, and make
 * the SPH "Deal" (`won`) in the same transaction; cancelling an order
 * reopens the SPH. No journals are posted here (accounting consumes these
 * documents later).
 */
@injectable()
export class SalesOrderService {
	constructor(
		@inject(SALES_ORDER_REPOSITORY_TOKEN)
		private readonly orders: ISalesOrderRepository,
		@inject(QUOTATION_REPOSITORY_TOKEN)
		private readonly quotations: Pick<IQuotationRepository, 'findById' | 'findItems'>,
		@inject(SALE_NUMBERING_SERVICE_TOKEN)
		private readonly numbering: Pick<SaleNumberingService, 'next'>,
		@inject(USER_SERVICE_TOKEN)
		private readonly users: Pick<UserService, 'getUser'>,
		@inject(INVOICE_LOOKUP_SERVICE_TOKEN)
		private readonly invoices: Pick<InvoiceLookupService, 'hasLiveInvoices'>,
		@inject(DELIVERY_NOTE_REPOSITORY_TOKEN)
		private readonly deliveries: Pick<IDeliveryNoteRepository, 'hasLiveNotes'>,
		@inject(PROJECT_LOOKUP_SERVICE_TOKEN)
		private readonly projects: Pick<ProjectLookupService, 'hasLiveProject'>,
		/** ERP-0044: issued orders are recorded in the document registry. */
		@inject(DOCUMENT_SERVICE_TOKEN)
		private readonly documents: Pick<DocumentService, 'register' | 'voidBySource'>,
	) {}

	private async requireVisible(ctx: TSalesOrderContext, id: string): Promise<TOrderSelect> {
		const order = await this.orders.findById(id);
		if (!order || (!ctx.canViewAll && order.salesPersonUserId !== ctx.actorUserId)) {
			throw new SalesOrderNotFoundError();
		}
		return order;
	}

	private async people(userIds: (string | null)[]): Promise<Map<string, TPerson>> {
		const ids = [...new Set(userIds.filter((id): id is string => !!id))];
		const found = await Promise.all(ids.map((id) => this.users.getUser(id)));
		return new Map(
			found.flatMap((user) => (user ? [[user.id, { userId: user.id, name: user.name }] as const] : [])),
		);
	}

	list(ctx: TSalesOrderContext, query: TSalesOrderListQuery): Promise<TPaginationResult<TOrderSelect>> {
		return this.orders.paginate({ ...query, salesPersonUserId: ctx.canViewAll ? undefined : ctx.actorUserId });
	}

	async get(ctx: TSalesOrderContext, id: string): Promise<TSalesOrderDetail> {
		const order = await this.requireVisible(ctx, id);
		const [items, history] = await Promise.all([this.orders.findItems(id), this.orders.findHistory(id)]);
		const people = await this.people([order.salesPersonUserId, ...history.map((entry) => entry.changedBy)]);
		const person = (userId: string | null) => (userId ? (people.get(userId) ?? null) : null);
		return {
			...order,
			items,
			history: history.map((entry) => ({ ...entry, by: person(entry.changedBy) })),
			salesPerson: person(order.salesPersonUserId),
		};
	}

	/** The live order of an SPH, for the quotation detail page. */
	async liveOrderOf(quotationId: string): Promise<Pick<TOrderSelect, 'id' | 'code' | 'status'> | null> {
		const order = await this.orders.findLiveByQuotation(quotationId);
		return order ? { id: order.id, code: order.code, status: order.status } : null;
	}

	/**
	 * Turns an approved or sent SPH into a confirmed order; the SPH becomes
	 * "Deal".
	 *
	 * @throws {QuotationNotFoundError} The SPH is missing or not the caller's
	 * @throws {SalesOrderExistsError} It already has a live order
	 * @throws {SalesOrderQuotationNotReadyError} It is not approved or sent
	 */
	async create(ctx: TSalesOrderContext, body: TCreateSalesOrderRequest): Promise<TOrderSelect> {
		const quotation = await this.quotations.findById(body.quotationId);
		if (!quotation || (!ctx.canUseAnyQuotation && quotation.createdBy !== ctx.actorUserId)) {
			throw new QuotationNotFoundError();
		}
		if (quotation.status === 'won') throw new SalesOrderExistsError();
		if (quotation.status !== 'approved' && quotation.status !== 'sent') {
			throw new SalesOrderQuotationNotReadyError();
		}
		const lines = await this.quotations.findItems(quotation.id);
		const orderDate = body.orderDate ?? businessDateOf();
		const code = await this.numbering.next('order', { date: new Date(`${orderDate}T12:00:00+07:00`) });
		try {
			const order = await this.orders.createFromQuotation(
				{
					code,
					quotationId: quotation.id,
					quotationCode: quotation.code,
					customerId: quotation.customerId,
					customerSnapshot: quotation.customerSnapshot,
					customerPoNumber: body.customerPoNumber,
					title: quotation.title,
					attention: quotation.attention,
					orderDate,
					deliveryDate: body.deliveryDate ?? null,
					paymentTerms: quotation.paymentTerms,
					paymentSchedule: quotation.paymentSchedule,
					guarantee: quotation.guarantee,
					vatEnabled: quotation.vatEnabled,
					vatRateBps: quotation.vatRateBps,
					subtotal: quotation.subtotal,
					discountTotal: quotation.discountTotal,
					taxTotal: quotation.taxTotal,
					grandTotal: quotation.grandTotal,
					currencyCode: quotation.currencyCode,
					salesPersonUserId: quotation.createdBy,
					notes: body.notes,
					createdBy: ctx.actorUserId,
				},
				lines.map((line) => ({
					quotationItemId: line.id,
					productId: line.productId,
					sku: line.sku,
					name: line.name,
					specification: line.specification,
					unit: line.unit,
					quantity: line.quantity,
					unitPrice: line.unitPrice,
					discountAmount: line.discountAmount,
					lineTotal: line.lineTotal,
				})),
				ctx.actorUserId,
			);
			if (!order) throw new SalesOrderQuotationNotReadyError();
			// ERP-0044: the confirmed order is registered with the same code.
			await this.documents.register({
				code: order.code,
				documentType: 'order',
				module: 'sale',
				sourceType: 'sales_order',
				sourceId: order.id,
				organizationId: null,
				issuedOn: order.orderDate,
				issuedByUserId: ctx.actorUserId,
			});
			return order;
		} catch (error) {
			if (isUniqueViolation(error)) throw new SalesOrderExistsError();
			throw error;
		}
	}

	/** Confirmed → cancelled with a reason; the SPH is reopened. */
	async cancel(ctx: TSalesOrderContext, id: string, reason: string): Promise<TOrderSelect> {
		await this.requireVisible(ctx, id);
		// Void the invoices first: an order that was billed stays.
		if (await this.invoices.hasLiveInvoices(id)) throw new SalesOrderBilledError();
		// Cancel the prepared delivery notes first; shipped goods keep the order.
		if (await this.deliveries.hasLiveNotes(id)) throw new SalesOrderDeliveredError();
		// Cancel the project first: a deal being executed stays.
		if (await this.projects.hasLiveProject(id)) throw new SalesOrderHasProjectError();
		const cancelled = await this.orders.cancel(id, ctx.actorUserId, reason);
		if (!cancelled) throw new SalesOrderNotCancellableError();
		// ERP-0044: a cancelled order is a dead document in the registry.
		await this.documents.voidBySource('sale', 'order', id);
		return cancelled;
	}
}
