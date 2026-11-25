import { SALE_NUMBERING_SERVICE_TOKEN } from '../constants/di';
import type { SaleNumberingService } from './sale-numbering.service';
import { COMPANY_SERVICE_TOKEN } from '@app/company';
import type { CompanyService } from '@app/company';
import { DOCUMENT_SERVICE_TOKEN } from '@app/document/constants/di';
import type { DocumentService } from '@app/document';
import { AR_LEDGER_PORT_TOKEN } from '@app/finance/constants/ar-di';
import { DEFERRED_REVENUE_PORT_TOKEN, POSTING_SERVICE_TOKEN } from '@app/finance/constants/di';
import type { IDeferredRevenuePort } from '@app/finance/contracts/deferred-revenue.port';
import type { TTx } from '@drizzle/types';
import type { TInvoiceSelect, TReceiptSelect, TOrderItemSelect, TOrderSelect } from '@drizzle/schemas/sale.schema';
import { businessDateOf } from '@utils/business-date.util';
import { inject, injectable } from 'tsyringe';
import type { IArLedgerPort } from '../../finance/contracts/ar-ledger.port';
import type { PostingService } from '../../finance/services/posting.service';
import { INVOICE_REPOSITORY_TOKEN } from '../constants/ar-di';
import { SALES_BILLING_SERVICE_TOKEN } from '../constants/di';
import type { TInvoiceTermCreateInput } from '../contracts/invoice.contract';
import type { TInvoiceRepository } from '../contracts/invoice.repository.interface';
import { InvoiceNotFoundError, InvoiceNotVoidableError, InvoiceOrderUnavailableError, InvoiceTermError } from '../errors/invoice.errors';
import type { SalesBillingService } from './sales-billing.service';
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

/** The caller (organization from the `erp` guard). */
export type TBillingContext = { organizationId: string; actorUserId: string };

/** Where an order stands in billing (the order page's billing card). */
export type TBillingSummary = {
	orderId: string;
	orderCode: string;
	grandTotal: number;
	taxBase: number;
	invoiced: number;
	paid: number;
	remainingToInvoice: number;
	outstanding: number;
	nextTerm: TPlannedTerm | null;
	invoices: TInvoiceSelect[];
};

/** A receipt as the invoice pages show it. */
export type TReceiptView = Pick<
	TReceiptSelect,
	'id' | 'code' | 'receivedDate' | 'amount' | 'method' | 'reference' | 'notes' | 'status' | 'reversalReason'
> & { invoiceId: string };

/** One printed term of the order's payment schedule (invoice sample, page 2). */
export type TScheduleRow = Pick<TInvoiceSelect, 'id' | 'code' | 'description' | 'percentageBps' | 'grandTotal' | 'status'> & {
	payments: Pick<TReceiptSelect, 'receivedDate' | 'method' | 'amount'>[];
};

/** The invoice page and print: the invoice, its receipts, the order and its billing schedule. */
export type TInvoiceDetail = TInvoiceSelect & {
	receipts: TReceiptView[];
	order:
		| (Pick<
				TOrderSelect,
				'id' | 'code' | 'customerPoNumber' | 'attention' | 'paymentTerms' | 'subtotal' | 'discountTotal' | 'taxTotal' | 'grandTotal'
		  > & { items: TOrderItemSelect[]; schedule: TScheduleRow[] })
		| null;
};

/** Billing state that counts: neither voided nor a cancelled draft. */
const live = (invoice: TInvoiceSelect) => invoice.status !== 'void' && invoice.status !== 'cancelled';
const asTerm = (invoice: TInvoiceSelect): TTermAmounts => ({ taxBase: invoice.subtotal, vatAmount: invoice.taxTotal, total: invoice.grandTotal });

function amountsOf(order: TOrderSelect): TOrderAmounts {
	return {
		taxBase: order.subtotal - order.discountTotal,
		vatAmount: order.taxTotal,
		total: order.grandTotal,
		vatEnabled: order.vatEnabled,
		vatRateBps: order.vatRateBps,
	};
}

const toReceiptView = (receipt: TReceiptSelect): TReceiptView => ({
	id: receipt.id,
	code: receipt.code,
	invoiceId: receipt.invoiceId,
	receivedDate: receipt.receivedDate,
	amount: receipt.amount,
	method: receipt.method,
	reference: receipt.reference,
	notes: receipt.notes,
	status: receipt.status,
	reversalReason: receipt.reversalReason,
});

/**
 * Billing a sales order by terms (M02, ADR-0011 step 3d-2) on top of the
 * Sales invoice of the accounting merge (PR #68): the order's billing card,
 * drafting the next planned / a percentage / an amount / the remaining term,
 * the invoice page with its schedule, and voiding.
 *
 * @remarks
 * PR #68 kept the accounting-aware `InvoiceService` (items, issue posts DR AR
 * / CR revenue / CR VAT, receipts) and dropped these use cases, which the web
 * admin still calls. They are restored here without changing that service:
 * a term draft is an ordinary draft with one line, so issuing and receipts go
 * through `InvoiceService` unchanged. The invoices of an order always add up
 * to its total (the last term takes the exact remainder).
 */
@injectable()
export class InvoiceBillingService {
	constructor(
		@inject(INVOICE_REPOSITORY_TOKEN) private readonly invoices: TInvoiceRepository,
		@inject(SALES_BILLING_SERVICE_TOKEN) private readonly orders: Pick<SalesBillingService, 'getOrderForBilling' | 'getOrderForPrint'>,
		@inject(SALE_NUMBERING_SERVICE_TOKEN) private readonly numbering: Pick<SaleNumberingService, 'next'>,
		@inject(COMPANY_SERVICE_TOKEN) private readonly company: Pick<CompanyService, 'get'>,
		@inject(POSTING_SERVICE_TOKEN) private readonly posting: Pick<PostingService, 'reverse'>,
		@inject(AR_LEDGER_PORT_TOKEN)
		private readonly arLedger: Pick<IArLedgerPort, 'findPostedEntryForSource' | 'setOpenItemStatus'>,
		@inject(DOCUMENT_SERVICE_TOKEN) private readonly documents: Pick<DocumentService, 'voidBySource'>,
		@inject(DEFERRED_REVENUE_PORT_TOKEN)
		private readonly deferredRevenue: Pick<IDeferredRevenuePort, 'cancelForInvoice'>,
	) {}

	/** Billing state of an order, for the order page and the invoice form. */
	async summary(orderId: string): Promise<TBillingSummary> {
		const found = await this.orders.getOrderForPrint(orderId);
		if (!found) throw new InvoiceOrderUnavailableError();
		const { order } = found;
		const all = await this.invoices.listByOrder(orderId);
		const liveInvoices = all.filter(live);
		const billed = sumTerms(liveInvoices.map(asTerm));
		const amounts = amountsOf(order);
		return {
			orderId,
			orderCode: order.code,
			grandTotal: order.grandTotal,
			taxBase: amounts.taxBase,
			invoiced: billed.total,
			paid: liveInvoices.reduce((sum, invoice) => sum + invoice.paidTotal, 0),
			remainingToInvoice: remainingOf(amounts, billed).total,
			outstanding: liveInvoices.filter((invoice) => invoice.status !== 'draft').reduce((sum, invoice) => sum + invoice.outstandingTotal, 0),
			nextTerm: order.status === 'cancelled' ? null : nextPlannedTerm(order.paymentSchedule, amounts.taxBase, billed.taxBase),
			invoices: all,
		};
	}

	/**
	 * Drafts the invoice of one billing term: one line, VAT as on the order,
	 * numbered now (like every Sales invoice draft).
	 *
	 * @throws {InvoiceOrderUnavailableError} The order is missing or cancelled
	 * @throws {InvoiceTermError} Nothing left, an empty term, or more than is left
	 */
	async createFromTerm(ctx: TBillingContext, body: TInvoiceTermCreateInput): Promise<TInvoiceSelect> {
		const found = await this.orders.getOrderForBilling(body.orderId);
		if (!found) throw new InvoiceOrderUnavailableError();
		const { order } = found;
		const amounts = amountsOf(order);
		const profile = await this.company.get();
		try {
			return await this.invoices.createTermDraftLocked(order.id, async (billed, liveCount, tx) => {
				let term: TTermAmounts;
				let planned: TPlannedTerm | null = null;
				if (body.term.mode === 'next') {
					// Chosen under the order lock, so two clicks never bill one term twice.
					planned = nextPlannedTerm(order.paymentSchedule, amounts.taxBase, billed.taxBase);
					if (!planned) throw new TermError('noPlannedTerm');
					term = computeTerm(amounts, billed, planned.last ? { mode: 'remaining' } : { mode: 'percentage', bps: planned.percentBps });
				} else {
					term = computeTerm(amounts, billed, body.term);
				}
				const settles = term.taxBase === remainingOf(amounts, billed).taxBase;
				const termKind = settles ? 'settlement' : liveCount === 0 ? 'down_payment' : 'installment';
				const percentageBps = planned?.percentBps ?? (body.term.mode === 'percentage' ? body.term.bps : null);
				const fallback =
					termKind === 'settlement'
						? 'Pelunasan'
						: `${termKind === 'down_payment' ? 'DP' : 'Termin'}${percentageBps ? ` ${formatPercent(percentageBps)}%` : ''}`;
				const description = body.description ?? planned?.description ?? fallback;
				const code = await this.numbering.next('invoice', { date: new Date(), tx: tx as TTx });
				return {
					row: {
						organizationId: ctx.organizationId,
						code,
						invoiceType: 'sales',
						termKind,
						customerId: order.customerId,
						customerSnapshot: order.customerSnapshot,
						orderId: order.id,
						orderCode: order.code,
						quotationCode: order.quotationCode,
						title: order.title,
						description,
						percentageBps,
						issueDate: null,
						dueDate: body.dueDate,
						vatEnabled: order.vatEnabled,
						vatRateBps: order.vatRateBps,
						subtotal: term.taxBase,
						discountTotal: 0,
						taxTotal: term.vatAmount,
						grandTotal: term.total,
						paidTotal: 0,
						outstandingTotal: 0,
						currencyCode: order.currencyCode,
						status: 'draft',
						terms: profile?.defaultInvoiceTerms ?? null,
						notes: body.notes,
						createdBy: ctx.actorUserId,
					},
					items: [
						{
							organizationId: ctx.organizationId,
							description,
							quantity: 1,
							unitPrice: term.taxBase,
							discountAmount: 0,
							taxAmount: term.vatAmount,
							lineTotal: term.total,
							currencyCode: order.currencyCode,
						},
					],
				};
			});
		} catch (error) {
			if (error instanceof TermError) throw new InvoiceTermError(error.problem);
			throw error;
		}
	}

	/** The invoice with its receipts, its order and the order's billing schedule. */
	async detail(ctx: TBillingContext, id: string): Promise<TInvoiceDetail> {
		const invoice = await this.invoices.findById(ctx.organizationId, id);
		if (!invoice) throw new InvoiceNotFoundError();
		const receipts = (await this.invoices.listReceipts(ctx.organizationId, id)).map(toReceiptView);
		if (!invoice.orderId) return { ...invoice, receipts, order: null };
		const [found, siblings] = await Promise.all([this.orders.getOrderForPrint(invoice.orderId), this.invoices.listByOrder(invoice.orderId)]);
		const terms = siblings.filter((sibling) => live(sibling) && sibling.status !== 'draft');
		const payments = await Promise.all(terms.map((term) => this.invoices.listReceipts(term.organizationId ?? ctx.organizationId, term.id)));
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
	 * Voids an unpaid draft or issued invoice with a reason. An issued invoice
	 * had its journal posted: it is reversed (append-only), the AR open item
	 * set to `void` and the registry copy voided — all in one transaction with
	 * the invoice locked, so a payment cannot slip in between.
	 *
	 * @throws {InvoiceNotVoidableError} Paid (partly or fully), or already void / cancelled
	 */
	async void(ctx: TBillingContext, id: string, reason: string): Promise<TInvoiceSelect> {
		const result = await this.invoices.withLockedInvoice(ctx.organizationId, id, async (invoice, tx) => {
			if ((invoice.status !== 'draft' && invoice.status !== 'issued') || invoice.paidTotal > 0) throw new InvoiceNotVoidableError();
			// ERP-0135: a credit memo already lowered the open amount; void that first.
			if (invoice.status === 'issued' && invoice.outstandingTotal !== invoice.grandTotal) throw new InvoiceNotVoidableError();
			if (invoice.status === 'issued') {
				const entry = await this.arLedger.findPostedEntryForSource(ctx.organizationId, 'invoice', invoice.id, tx as TTx);
				if (entry && entry.status === 'posted' && !entry.reversedByEntryId) {
					const today = businessDateOf();
					await this.posting.reverse(tx as TTx, ctx.organizationId, entry.id, ctx.actorUserId, {
						entryDate: today > entry.entryDate ? today : entry.entryDate,
						description: `Void of invoice ${invoice.code}: ${reason}`.slice(0, 500),
					});
				}
				// ERP-0135: deferred revenue of the invoice is cancelled and its
				// posted amortisations reversed in the same transaction.
				await this.deferredRevenue.cancelForInvoice(tx as TTx, ctx.organizationId, invoice.id, ctx.actorUserId);
				// Amounts stay (outstanding = original − paid is a DB check); `void`
				// takes the item out of the aging (open / partially paid only).
				await this.arLedger.setOpenItemStatus(ctx.organizationId, invoice.id, { status: 'void' }, tx as TTx);
				await this.documents.voidBySource('sale', 'invoice', invoice.id, tx as TTx);
			}
			const updated = await this.invoices.update(
				ctx.organizationId,
				invoice.id,
				{ status: 'void', outstandingTotal: 0, voidedBy: ctx.actorUserId, voidedAt: new Date(), voidReason: reason },
				tx,
			);
			return updated ?? invoice;
		});
		if (!result) throw new InvoiceNotFoundError();
		return result;
	}
}
