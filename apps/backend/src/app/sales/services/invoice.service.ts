import { inject, injectable } from 'tsyringe';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import type { TTx } from '@drizzle/types';
import { DRIZZLE_TOKEN } from '@di/provider';
import type {
	TInvoiceItemSelect,
	TInvoiceSelect,
} from '@drizzle/schemas/sales.schema';
import type { TPaginationResult } from '@ims-erp/common';
import { OUTBOX_SERVICE_TOKEN } from '@app/automation/constants/di';
import type { OutboxService } from '@app/automation/services/outbox.service';
import { CODE_NUMBER_SERVICE_TOKEN } from '@app/code-number';
import type { CodeNumberService } from '@app/code-number';
import { DOCUMENT_SERVICE_TOKEN } from '@app/document';
import type { DocumentService } from '@app/document';
import {
	AR_LEDGER_PORT_TOKEN,
	POSTING_SERVICE_TOKEN,
	AR_ACCOUNT_RESOLVER_TOKEN,
} from '../../accounting/constants/ar-di';
import { INVOICE_REPOSITORY_TOKEN } from '../constants/ar-di';
import type {
	TInvoiceRepository,
	TInvoiceSummary,
} from '../contracts/invoice.repository.interface';
import type {
	TCreateInvoiceInput,
	TInvoiceItemInput,
	TUpdateInvoiceInput,
} from '../contracts/invoice.repository.interface';
import type { IArLedgerPort } from '../../accounting/contracts/ar-ledger.port';
import type { PostingService } from '../../accounting/services/posting.service';
import type { ArAccountResolverService } from '../../accounting/services/ar-account-resolver.service';
import {
	InvoiceDueBeforeIssueError,
	InvoiceNoItemsError,
	InvoiceNotDraftError,
	InvoiceNotFoundError,
	InvoiceNotPayableError,
	ReceiptAlreadyReversedError,
	ReceiptExceedsOutstandingError,
	ReceiptNotFoundError,
} from '../errors/invoice.errors';
import { businessDateOf } from '@utils/business-date.util';
import { invoiceIssuedEvent, receiptRecordedEvent } from '../utils/invoice-events';
import type {
	TCreateReceiptInput,
	TReceiptListQuery,
} from '../contracts/invoice.contract';
import type { TReceiptSelect } from '@drizzle/schemas/sales.schema';

export type TInvoiceActionContext = {
	organizationId: string;
	actorUserId: string;
};

/**
 * Invoice application service (M09 F4).
 *
 * @remarks
 * Drafts live in `sales.invoices` (D2); totals are always recomputed
 * server-side from line items. **Issuing** is the ledger event: in ONE
 * transaction it stamps the issue fields, posts DR AR / CR revenue (+ CR tax
 * payable) through the shared posting service (D9 caller-tx contract), and
 * opens the `finance.ar_open_items` sub-ledger row (D3). Issued invoices are
 * immutable here — corrections happen via reversal (F7).
 */
@injectable()
export class InvoiceService {
	constructor(
		@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase,
		@inject(INVOICE_REPOSITORY_TOKEN)
		private readonly repo: TInvoiceRepository,
		@inject(AR_LEDGER_PORT_TOKEN)
		private readonly arLedger: IArLedgerPort,
		@inject(POSTING_SERVICE_TOKEN) private readonly posting: PostingService,
		@inject(AR_ACCOUNT_RESOLVER_TOKEN)
		private readonly arResolver: ArAccountResolverService,
		@inject(CODE_NUMBER_SERVICE_TOKEN)
		private readonly numbering: CodeNumberService,
		@inject(OUTBOX_SERVICE_TOKEN)
		private readonly outbox: Pick<OutboxService, 'publish'>,
		/** ERP-0044: issued invoices and receipts are registered documents. */
		@inject(DOCUMENT_SERVICE_TOKEN)
		private readonly documents: Pick<DocumentService, 'register' | 'voidBySource'>,
	) {}

	async list(
		organizationId: string,
		filters: { status?: string; customerId?: string; termKind?: string; search?: string; overdue?: boolean },
		pagination: { page: number; limit: number },
	): Promise<TPaginationResult<TInvoiceSelect>> {
		const { overdue, ...rest } = filters;
		return this.repo.list(organizationId, { ...rest, ...(overdue ? { overdueOn: businessDateOf() } : {}) }, pagination);
	}

	/** Invoiced totals for one window (M01 dashboard); zero-filled per period. */
	summary(
		organizationId: string,
		range: { from: string; to: string; groupBy: 'month' | 'day' },
	): Promise<TInvoiceSummary> {
		return this.repo.summary(organizationId, range);
	}

	async get(organizationId: string, id: string): Promise<{
		invoice: TInvoiceSelect;
		items: TInvoiceItemSelect[];
	}> {
		const invoice = await this.repo.findById(organizationId, id);
		if (!invoice) throw new InvoiceNotFoundError();
		const items = await this.repo.listItems(organizationId, id);
		return { invoice, items };
	}

	async create(
		ctx: TInvoiceActionContext,
		input: TCreateInvoiceInput,
	): Promise<TInvoiceSelect> {
		this.validateDates(input.issueDate, input.dueDate);
		return this.database.transaction(async (tx) => {
			const totals = this.totalsOf(input.items);
			const code = await this.numbering.next('sales_invoice', {
				date: input.issueDate
					? new Date(`${input.issueDate}T12:00:00+07:00`)
					: new Date(),
				tx: tx as TTx,
			});
			const invoice = await this.repo.insert(
				{
					organizationId: ctx.organizationId,
					code,
					invoiceType: input.invoiceType,
					customerId: input.customerId,
					salesOrderId: input.salesOrderId,
					paymentTermId: input.paymentTermId,
					issueDate: input.issueDate,
					dueDate: input.dueDate,
					subtotal: totals.subtotal,
					discountTotal: totals.discountTotal,
					taxTotal: totals.taxTotal,
					grandTotal: totals.grandTotal,
					paidTotal: 0,
					outstandingTotal: 0,
					currencyCode: input.currencyCode,
					status: 'draft',
					notes: input.notes,
				},
				tx as TTx,
			);
			await this.writeItems(ctx, invoice.id, input.items, tx as TTx);
			return invoice;
		});
	}

	async update(
		ctx: TInvoiceActionContext,
		id: string,
		input: TUpdateInvoiceInput,
	): Promise<TInvoiceSelect> {
		return this.database.transaction(async (tx) => {
			const invoice = await this.mustFind(ctx.organizationId, id, tx);
			if (invoice.status !== 'draft') throw new InvoiceNotDraftError();

			const items =
				input.items ?? this.itemsToInput(await this.repo.listItems(ctx.organizationId, id, tx));
			this.validateDates(input.issueDate ?? invoice.issueDate, input.dueDate ?? invoice.dueDate);

			const totals = this.totalsOf(items);
			const updated = await this.repo.update(
				ctx.organizationId,
				id,
				{
					...(input.customerId !== undefined ? { customerId: input.customerId } : {}),
					...(input.paymentTermId !== undefined ? { paymentTermId: input.paymentTermId } : {}),
					...(input.issueDate !== undefined ? { issueDate: input.issueDate } : {}),
					...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
					...(input.notes !== undefined ? { notes: input.notes } : {}),
					subtotal: totals.subtotal,
					discountTotal: totals.discountTotal,
					taxTotal: totals.taxTotal,
					grandTotal: totals.grandTotal,
				},
				tx,
			);
			if (input.items) {
				await this.writeItems(ctx, id, input.items, tx);
			}
			return updated ?? invoice;
		});
	}

	/** Draft → cancelled. No journal impact (nothing was posted). */
	async cancel(ctx: TInvoiceActionContext, id: string): Promise<TInvoiceSelect> {
		const invoice = await this.mustFind(ctx.organizationId, id);
		if (invoice.status !== 'draft') throw new InvoiceNotDraftError();
		const updated = await this.repo.update(ctx.organizationId, id, {
			status: 'cancelled',
		});
		return updated ?? invoice;
	}

	/**
	 * Issues the invoice: the ledger event of F4. One transaction covers the
	 * status stamp, the journal (DR AR / CR revenue / CR tax payable), the
	 * `ar_open_items` row and the document registry (ERP-0044); `invoice.issued`
	 * goes to n8n (M04) once that transaction has committed.
	 */
	async issue(
		ctx: TInvoiceActionContext,
		id: string,
		dates: { issueDate: string | null; dueDate: string | null } = { issueDate: null, dueDate: null },
	): Promise<TInvoiceSelect> {
		const issued = await this.issueInTransaction(ctx, id, dates);
		await this.outbox.publish('invoice.issued', { type: 'invoice', id: issued.id }, invoiceIssuedEvent(issued));
		return issued;
	}

	private async issueInTransaction(
		ctx: TInvoiceActionContext,
		id: string,
		dates: { issueDate: string | null; dueDate: string | null },
	): Promise<TInvoiceSelect> {
		return this.database.transaction(async (tx) => {
			const found = await this.mustFind(ctx.organizationId, id, tx);
			if (found.status !== 'draft') throw new InvoiceNotDraftError();
			// The web's issue form confirms the dates (M02); otherwise the draft's own.
			const invoice =
				dates.issueDate || dates.dueDate
					? { ...found, issueDate: dates.issueDate ?? found.issueDate, dueDate: dates.dueDate ?? found.dueDate }
					: found;

			const items = await this.repo.listItems(ctx.organizationId, id, tx);
			if (items.length === 0) throw new InvoiceNoItemsError();
			if (
				invoice.dueDate &&
				invoice.issueDate &&
				invoice.dueDate < invoice.issueDate
			) {
				throw new InvoiceDueBeforeIssueError();
			}

			const accounts = await this.arResolver.resolveAll(ctx.organizationId);
			const issueDate =
				invoice.issueDate ?? new Date().toISOString().slice(0, 10);
			const revenue = invoice.subtotal - invoice.discountTotal;

			const lines: Array<{
				accountId: string;
				debit: number;
				credit: number;
			}> = [
				{
					accountId: accounts.ar,
					debit: invoice.grandTotal,
					credit: 0,
				},
				{
					accountId: accounts.revenue,
					debit: 0,
					credit: revenue,
				},
			];
			if (invoice.taxTotal > 0) {
				lines.push({
					accountId: accounts.taxPayable,
					debit: 0,
					credit: invoice.taxTotal,
				});
			}

			await this.posting.post(tx, {
				organizationId: ctx.organizationId,
				entryDate: issueDate,
				sourceModule: 'sales',
				sourceType: 'invoice',
				sourceId: invoice.id,
				idempotencyKey: `invoice:${invoice.id}`,
				description: `Invoice ${invoice.code}`,
				lines,
			});

			await this.arLedger.openItem(
				ctx.organizationId,
				{
					salesInvoiceId: invoice.id,
					customerId: invoice.customerId,
					invoiceDate: issueDate,
					dueDate: invoice.dueDate,
					originalAmount: invoice.grandTotal,
					paidAmount: 0,
					outstandingAmount: invoice.grandTotal,
					currencyCode: invoice.currencyCode,
					status: 'open',
				},
				tx,
			);

			const issued = await this.repo.update(
				ctx.organizationId,
				id,
				{
					status: 'issued',
					issueDate,
					dueDate: invoice.dueDate,
					issuedBy: ctx.actorUserId,
					issuedAt: new Date(),
					outstandingTotal: invoice.grandTotal,
				},
				tx,
			);
			// ERP-0044: the tax invoice joins the registry with its own code.
			// `code` is nullable in the schema (legacy drafts) but `create`
			// always allocates it, so a coded draft is the only issuable state.
			if (invoice.code) {
				await this.documents.register(
					{
						code: invoice.code,
						documentType: 'sales_invoice',
						module: 'sales',
						sourceType: 'invoice',
						sourceId: invoice.id,
						organizationId: ctx.organizationId,
						issuedOn: issueDate,
						issuedByUserId: ctx.actorUserId,
					},
					tx,
				);
			}
			return issued ?? invoice;
		});
	}

	/* ----------------------------- internals ----------------------------- */

	private async mustFind(
		organizationId: string,
		id: string,
		tx?: TTx,
	): Promise<TInvoiceSelect> {
		const invoice = await this.repo.findById(organizationId, id, tx);
		if (!invoice) throw new InvoiceNotFoundError();
		return invoice;
	}

	private validateDates(issueDate: string | null, dueDate: string | null) {
		if (issueDate && dueDate && dueDate < issueDate) {
			throw new InvoiceDueBeforeIssueError();
		}
	}

	private totalsOf(items: TInvoiceItemInput[]) {
		let subtotal = 0;
		let discountTotal = 0;
		let taxTotal = 0;
		for (const item of items) {
			subtotal += item.quantity * item.unitPrice;
			discountTotal += item.discountAmount;
			taxTotal += item.taxAmount;
		}
		return {
			subtotal,
			discountTotal,
			taxTotal,
			grandTotal: subtotal - discountTotal + taxTotal,
		};
	}

	private itemsToInput(items: TInvoiceItemSelect[]): TInvoiceItemInput[] {
		return items.map((i) => ({
			itemId: i.itemId,
			description: i.description,
			quantity: Number(i.quantity),
			unitPrice: i.unitPrice,
			discountAmount: i.discountAmount,
			taxAmount: i.taxAmount,
		}));
	}

	private async writeItems(
		ctx: TInvoiceActionContext,
		invoiceId: string,
		items: TInvoiceItemInput[],
		tx: TTx,
	): Promise<void> {
		await this.repo.replaceItems(
			ctx.organizationId,
			invoiceId,
			items.map((item) => ({
				organizationId: ctx.organizationId,
				invoiceId,
				itemId: item.itemId,
				description: item.description,
				quantity: item.quantity,
				unitPrice: item.unitPrice,
				discountAmount: item.discountAmount,
				taxAmount: item.taxAmount,
				lineTotal:
					item.quantity * item.unitPrice - item.discountAmount + item.taxAmount,
				currencyCode: 'IDR',
			})),
			tx,
		);
	}

	/* ---------------------------- receipts (AR) ---------------------------- */

	/** One live invoice of this organization, or 404. */
	private async requireInvoice(
		organizationId: string,
		id: string,
	): Promise<TInvoiceSelect> {
		const invoice = await this.repo.findById(organizationId, id);
		if (!invoice) throw new InvoiceNotFoundError();
		return invoice;
	}

	/** Paginated receipts joined with their invoice and customer. */
	listReceipts(
		organizationId: string,
		query: TReceiptListQuery,
	): Promise<
		TPaginationResult<
			TReceiptSelect & { invoiceCode: string | null; customerName: string }
		>
	> {
		return this.repo.paginateReceipts(organizationId, query);
	}

	/** Records a payment against a live invoice and recomputes its status. */
	async addReceipt(
		ctx: TInvoiceActionContext,
		invoiceId: string,
		body: TCreateReceiptInput,
	): Promise<TReceiptSelect> {
		const invoice = await this.requireInvoice(ctx.organizationId, invoiceId);
		if (invoice.status !== 'issued' && invoice.status !== 'partially_paid')
			throw new InvoiceNotPayableError();
		if (body.amount > invoice.outstandingTotal)
			throw new ReceiptExceedsOutstandingError();
		const receivedDate = body.receivedDate ?? businessDateOf();
		const code = await this.numbering.next('receipt', {
			date: new Date(`${receivedDate}T12:00:00+07:00`),
		});
		const receipt = await this.repo.addReceipt({
			salesInvoiceId: invoiceId,
			organizationId: ctx.organizationId,
			code,
			receivedDate,
			amount: body.amount,
			currencyCode: invoice.currencyCode,
			method: body.method,
			reference: body.reference,
			notes: body.notes,
			receivedBy: ctx.actorUserId,
		});
		if (!receipt) throw new ReceiptExceedsOutstandingError();
		// ERP-0044: a receipt (kuitansi) is an issued document too.
		await this.documents.register({
			code: receipt.code,
			documentType: 'receipt',
			module: 'sales',
			sourceType: 'receipt',
			sourceId: receipt.id,
			organizationId: ctx.organizationId,
			issuedOn: receipt.receivedDate,
			issuedByUserId: ctx.actorUserId,
		});
		// n8n event (M04), with the invoice as it stands after the payment.
		const paid = (await this.repo.findById(ctx.organizationId, invoiceId)) ?? invoice;
		await this.outbox.publish('receipt.recorded', { type: 'receipt', id: receipt.id }, receiptRecordedEvent(receipt, paid));
		return receipt;
	}

	/** Reverses a posted receipt with a reason and restores the invoice. */
	async reverseReceipt(
		ctx: TInvoiceActionContext,
		id: string,
		reason: string,
	): Promise<TReceiptSelect> {
		if (!(await this.repo.findReceipt(ctx.organizationId, id)))
			throw new ReceiptNotFoundError();
		const reversed = await this.repo.reverseReceipt(
			ctx.organizationId,
			id,
			ctx.actorUserId,
			reason,
		);
		if (!reversed) throw new ReceiptAlreadyReversedError();
		// ERP-0044: a reversed receipt is a dead document.
		await this.documents.voidBySource('sales', 'receipt', id);
		return reversed;
	}
}

// Re-export so the error family stays importable from one place in tests.
export { InvoiceNotFoundError };
