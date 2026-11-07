import { OUTBOX_SERVICE_TOKEN } from '@app/automation/constants/di';
import type { OutboxService } from '@app/automation/services/outbox.service';
import { COMPANY_PROFILE_SERVICE_TOKEN, NUMBERING_SERVICE_TOKEN } from '@app/organization/constants/di';
import type { CompanyProfileService } from '@app/organization/services/company-profile.service';
import type { NumberingService } from '@app/organization/services/numbering.service';
import { SALES_BILLING_SERVICE_TOKEN } from '@app/sales/constants/di';
import type { SalesBillingService } from '@app/sales/services/sales-billing.service';
import type { TSalesOrderItemSelect, TSalesOrderSelect } from '@drizzle/schemas/sales.schema';
import type { TInvoiceSelect, TReceiptSelect } from '@drizzle/schemas/finance.schema';
import { businessDateOf, type TPaginationResult } from '@ims-erp/common';
import { inject, injectable } from 'tsyringe';
import { INVOICE_REPOSITORY_TOKEN } from '../constants/di';
import type {
	TCreateInvoiceRequest,
	TCreateReceiptRequest,
	TInvoiceListQuery,
	TIssueInvoiceRequest,
	TReceiptListQuery,
} from '../contracts/invoice.contract';
import type { IInvoiceRepository, TComputedTerm } from '../contracts/invoice.repository.interface';
import {
	InvoiceDueBeforeIssueError,
	InvoiceNotFoundError,
	InvoiceOrderUnavailableError,
	InvoiceStateError,
	InvoiceTermError,
	ReceiptAlreadyReversedError,
	ReceiptExceedsOutstandingError,
	ReceiptNotFoundError,
} from '../errors/finance.errors';
import {
	computeTerm,
	formatPercent,
	nextPlannedTerm,
	remainingOf,
	sumTerms,
	TermError,
	type TOrderAmounts,
	type TPlannedTerm,
	type TTermAmounts,
} from '../utils/invoice-terms';
import { invoiceIssuedEvent, receiptRecordedEvent } from '../utils/finance-events';

/** Amounts of an order as billing sees them. */
function amountsOf(order: TSalesOrderSelect): TOrderAmounts {
	return {
		taxBase: order.subtotal - order.discountTotal,
		vatAmount: order.taxTotal,
		total: order.grandTotal,
		vatEnabled: order.vatEnabled,
		vatRateBps: order.vatRateBps,
	};
}

const live = (invoice: TInvoiceSelect) => invoice.status !== 'void';
const asTerm = (invoice: TInvoiceSelect): TTermAmounts => ({
	taxBase: invoice.subtotal,
	vatAmount: invoice.taxTotal,
	total: invoice.grandTotal,
});

/** Where an order stands in billing (UX summary; amounts are enforced on write). */
export type TBillingSummary = {
	salesOrderId: string;
	salesOrderCode: string;
	grandTotal: number;
	taxBase: number;
	invoiced: number;
	paid: number;
	remainingToInvoice: number;
	outstanding: number;
	nextTerm: TPlannedTerm | null;
	invoices: TInvoiceSelect[];
};

/** One printed term of the order's payment schedule (invoice sample, page 2). */
export type TScheduleRow = Pick<TInvoiceSelect, 'id' | 'code' | 'description' | 'percentageBps' | 'grandTotal' | 'status'> & {
	payments: Pick<TReceiptSelect, 'receivedDate' | 'method' | 'amount'>[];
};

export type TInvoiceDetail = TInvoiceSelect & {
	receipts: TReceiptSelect[];
	/** The order as printed (lines and amounts), and its billing terms. */
	order: (Pick<
		TSalesOrderSelect,
		'id' | 'code' | 'customerPoNumber' | 'attention' | 'paymentTerms' | 'subtotal' | 'discountTotal' | 'taxTotal' | 'grandTotal'
	> & { items: TSalesOrderItemSelect[]; schedule: TScheduleRow[] }) | null;
};

/**
 * Invoice and receipt use cases (M02 billing, ADR-0011 step 3d-2).
 *
 * @remarks
 * Invoices bill free terms of a sales order (Sales contract) and are
 * numbered on issue; receipts are valid and numbered on creation, and
 * corrected by reversal. Every amount rule that could race runs again in
 * the repository. No journals are posted here (accounting consumes these
 * documents later). Company-wide; `invoice:*` / `receipt:*` grants decide
 * who may call. Issuing an invoice and recording a receipt publish
 * `invoice.issued` / `receipt.recorded` to n8n (M04 stage 2).
 */
@injectable()
export class InvoiceService {
	constructor(
		@inject(INVOICE_REPOSITORY_TOKEN)
		private readonly invoices: IInvoiceRepository,
		@inject(SALES_BILLING_SERVICE_TOKEN)
		private readonly orders: Pick<SalesBillingService, 'getOrderForBilling' | 'getOrderForPrint'>,
		@inject(NUMBERING_SERVICE_TOKEN)
		private readonly numbering: Pick<NumberingService, 'next'>,
		@inject(COMPANY_PROFILE_SERVICE_TOKEN)
		private readonly company: Pick<CompanyProfileService, 'get'>,
		@inject(OUTBOX_SERVICE_TOKEN)
		private readonly outbox: Pick<OutboxService, 'publish'>,
	) {}

	private async requireInvoice(id: string): Promise<TInvoiceSelect> {
		const invoice = await this.invoices.findById(id);
		if (!invoice) throw new InvoiceNotFoundError();
		return invoice;
	}

	list(query: TInvoiceListQuery): Promise<TPaginationResult<TInvoiceSelect>> {
		return this.invoices.paginate({ ...query, today: businessDateOf() });
	}

	listReceipts(query: TReceiptListQuery) {
		return this.invoices.paginateReceipts(query);
	}

	/** Billing state of an order, for the order page and the invoice form. */
	async summary(salesOrderId: string): Promise<TBillingSummary> {
		const found = await this.orders.getOrderForPrint(salesOrderId);
		if (!found) throw new InvoiceOrderUnavailableError();
		const { order } = found;
		const all = await this.invoices.listByOrder(salesOrderId);
		const liveInvoices = all.filter(live);
		const billed = sumTerms(liveInvoices.map(asTerm));
		const amounts = amountsOf(order);
		return {
			salesOrderId,
			salesOrderCode: order.code,
			grandTotal: order.grandTotal,
			taxBase: amounts.taxBase,
			invoiced: billed.total,
			paid: liveInvoices.reduce((sum, invoice) => sum + invoice.paidTotal, 0),
			remainingToInvoice: remainingOf(amounts, billed).total,
			outstanding: liveInvoices
				.filter((invoice) => invoice.status !== 'draft')
				.reduce((sum, invoice) => sum + invoice.outstandingTotal, 0),
			nextTerm:
				order.status === 'cancelled' ? null : nextPlannedTerm(order.paymentSchedule, amounts.taxBase, billed.taxBase),
			invoices: all,
		};
	}

	async get(id: string): Promise<TInvoiceDetail> {
		const invoice = await this.requireInvoice(id);
		const [receipts, found, siblings] = await Promise.all([
			this.invoices.listReceipts(id),
			this.orders.getOrderForPrint(invoice.salesOrderId),
			this.invoices.listByOrder(invoice.salesOrderId),
		]);
		const terms = siblings.filter((sibling) => live(sibling) && sibling.status !== 'draft');
		const payments = await Promise.all(terms.map((term) => this.invoices.listReceipts(term.id)));
		return {
			...invoice,
			receipts,
			order: found
				? {
						id: found.order.id,
						code: found.order.code,
						customerPoNumber: found.order.customerPoNumber,
						attention: found.order.attention,
						paymentTerms: found.order.paymentTerms,
						subtotal: found.order.subtotal,
						discountTotal: found.order.discountTotal,
						taxTotal: found.order.taxTotal,
						grandTotal: found.order.grandTotal,
						items: found.items,
						schedule: terms.map((term, index) => ({
							id: term.id,
							code: term.code,
							description: term.description,
							percentageBps: term.percentageBps,
							grandTotal: term.grandTotal,
							status: term.status,
							payments: payments[index]!
								.filter((receipt) => receipt.status === 'posted')
								.map(({ receivedDate, method, amount }) => ({ receivedDate, method, amount })),
						})),
					}
				: null,
		};
	}

	/**
	 * Drafts the invoice of one billing term.
	 *
	 * @throws {InvoiceOrderUnavailableError} The order is missing or cancelled
	 * @throws {InvoiceTermError} Nothing left, an empty term, or more than is left
	 */
	async createDraft(actorUserId: string, body: TCreateInvoiceRequest): Promise<TInvoiceSelect> {
		const found = await this.orders.getOrderForBilling(body.salesOrderId);
		if (!found) throw new InvoiceOrderUnavailableError();
		const { order } = found;
		const amounts = amountsOf(order);
		const profile = await this.company.get(false);
		try {
			return await this.invoices.createDraftLocked(
				{
					invoiceType: 'sales',
					customerId: order.customerId,
					customerSnapshot: order.customerSnapshot,
					salesOrderId: order.id,
					salesOrderCode: order.code,
					quotationCode: order.quotationCode,
					title: order.title,
					issueDate: null,
					dueDate: body.dueDate ?? null,
					vatEnabled: order.vatEnabled,
					vatRateBps: order.vatRateBps,
					currencyCode: order.currencyCode,
					terms: profile?.defaultInvoiceTerms ?? null,
					notes: body.notes,
					createdBy: actorUserId,
				},
				(billed, liveCount): TComputedTerm => {
					let term: TTermAmounts;
					let planned: TPlannedTerm | null = null;
					if (body.term.mode === 'next') {
						// Chosen under the order lock, so two clicks never bill one term twice.
						planned = nextPlannedTerm(order.paymentSchedule, amounts.taxBase, billed.taxBase);
						if (!planned) throw new TermError('noPlannedTerm');
						term = computeTerm(
							amounts,
							billed,
							planned.last ? { mode: 'remaining' } : { mode: 'percentage', bps: planned.percentBps },
						);
					} else {
						term = computeTerm(amounts, billed, body.term);
					}
					const settles = term.taxBase === remainingOf(amounts, billed).taxBase;
					const termKind = settles ? 'settlement' : liveCount === 0 ? 'down_payment' : 'installment';
					const percentageBps =
						planned?.percentBps ?? (body.term.mode === 'percentage' ? body.term.bps : null);
					const fallback =
						termKind === 'settlement'
							? 'Pelunasan'
							: `${termKind === 'down_payment' ? 'DP' : 'Termin'}${percentageBps ? ` ${formatPercent(percentageBps)}%` : ''}`;
					return {
						...term,
						termKind,
						percentageBps,
						description: body.description ?? planned?.description ?? fallback,
					};
				},
			);
		} catch (error) {
			if (error instanceof TermError) throw new InvoiceTermError(error.problem);
			throw error;
		}
	}

	/** Draft → issued; the number is taken now, so issued numbers have no gaps. */
	async issue(actorUserId: string, id: string, body: TIssueInvoiceRequest): Promise<TInvoiceSelect> {
		const invoice = await this.requireInvoice(id);
		if (invoice.status !== 'draft') throw new InvoiceStateError('notDraft');
		const issueDate = body.issueDate ?? businessDateOf();
		const dueDate = body.dueDate ?? invoice.dueDate;
		if (dueDate && dueDate < issueDate) throw new InvoiceDueBeforeIssueError();
		const code = await this.numbering.next('invoice', { date: new Date(`${issueDate}T12:00:00+07:00`) });
		const issued = await this.invoices.issue(id, { code, issueDate, dueDate, issuedBy: actorUserId });
		if (!issued) throw new InvoiceStateError('notDraft');
		await this.outbox.publish('invoice.issued', { type: 'invoice', id: issued.id }, invoiceIssuedEvent(issued));
		return issued;
	}

	/** Unpaid draft or issued → void with a reason (reverse receipts first). */
	async void(actorUserId: string, id: string, reason: string): Promise<TInvoiceSelect> {
		await this.requireInvoice(id);
		const voided = await this.invoices.void(id, actorUserId, reason);
		if (!voided) throw new InvoiceStateError('notVoidable');
		return voided;
	}

	/** Records money received; never more than what is outstanding. */
	async addReceipt(actorUserId: string, invoiceId: string, body: TCreateReceiptRequest): Promise<TReceiptSelect> {
		const invoice = await this.requireInvoice(invoiceId);
		if (invoice.status !== 'issued' && invoice.status !== 'partially_paid') throw new InvoiceStateError('notPayable');
		if (body.amount > invoice.outstandingTotal) throw new ReceiptExceedsOutstandingError();
		const receivedDate = body.receivedDate ?? businessDateOf();
		const code = await this.numbering.next('receipt', { date: new Date(`${receivedDate}T12:00:00+07:00`) });
		const receipt = await this.invoices.addReceipt({
			invoiceId,
			code,
			receivedDate,
			amount: body.amount,
			currencyCode: invoice.currencyCode,
			method: body.method,
			reference: body.reference,
			notes: body.notes,
			receivedBy: actorUserId,
		});
		if (!receipt) throw new ReceiptExceedsOutstandingError();
		const paid = (await this.invoices.findById(invoiceId)) ?? invoice;
		await this.outbox.publish('receipt.recorded', { type: 'receipt', id: receipt.id }, receiptRecordedEvent(receipt, paid));
		return receipt;
	}

	async reverseReceipt(actorUserId: string, id: string, reason: string): Promise<TReceiptSelect> {
		if (!(await this.invoices.findReceipt(id))) throw new ReceiptNotFoundError();
		const reversed = await this.invoices.reverseReceipt(id, actorUserId, reason);
		if (!reversed) throw new ReceiptAlreadyReversedError();
		return reversed;
	}
}
