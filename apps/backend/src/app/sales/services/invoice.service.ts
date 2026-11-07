import { inject, injectable } from 'tsyringe';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import type { TTx } from '@drizzle/types';
import { DRIZZLE_TOKEN } from '@di/provider';
import type {
	TInvoiceItemSelect,
	TInvoiceSelect,
} from '@drizzle/schemas/sales.schema';
import type { TPaginationResult } from '@ims-erp/common';
import { DOCUMENT_NUMBERING_SERVICE_TOKEN } from '@app/organization/constants/di';
import type { DocumentNumberingService } from '@app/organization/services/document-numbering.service';
import {
	INVOICE_REPOSITORY_TOKEN,
	LEDGER_REPOSITORY_TOKEN,
	POSTING_SERVICE_TOKEN,
	AR_ACCOUNT_RESOLVER_TOKEN,
} from '../../accounting/constants/ar-di';
import type { TInvoiceRepository } from '../contracts/invoice.repository.interface';
import type {
	TCreateInvoiceInput,
	TInvoiceItemInput,
	TUpdateInvoiceInput,
} from '../contracts/invoice.repository.interface';
import type { LedgerRepository } from '../../accounting/repositories/ledger.repository';
import type { PostingService } from '../../accounting/services/posting.service';
import type { ArAccountResolverService } from '../../accounting/services/ar-account-resolver.service';
import {
	InvoiceDueBeforeIssueError,
	InvoiceNoItemsError,
	InvoiceNotDraftError,
	InvoiceNotFoundError,
} from '../errors/invoice.errors';

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
		@inject(LEDGER_REPOSITORY_TOKEN)
		private readonly ledgerRepo: LedgerRepository,
		@inject(POSTING_SERVICE_TOKEN) private readonly posting: PostingService,
		@inject(AR_ACCOUNT_RESOLVER_TOKEN)
		private readonly arResolver: ArAccountResolverService,
		@inject(DOCUMENT_NUMBERING_SERVICE_TOKEN)
		private readonly numbering: DocumentNumberingService,
	) {}

	async list(
		organizationId: string,
		filters: { status?: string; customerId?: string },
		pagination: { page: number; limit: number },
	): Promise<TPaginationResult<TInvoiceSelect>> {
		return this.repo.list(organizationId, filters, pagination);
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
			const number = await this.numbering.allocate(
				ctx.organizationId,
				'sales_invoice',
				tx as TTx,
			);
			const code = this.numbering.format(
				'INV',
				(input.issueDate ?? new Date().toISOString().slice(0, 10)).replaceAll(
					'-',
					'',
				).slice(0, 6),
				number,
				5,
			);
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
	 * status stamp, the journal (DR AR / CR revenue / CR tax payable) and the
	 * `ar_open_items` row. Idempotent through the JE idempotency key.
	 */
	async issue(ctx: TInvoiceActionContext, id: string): Promise<TInvoiceSelect> {
		return this.database.transaction(async (tx) => {
			const invoice = await this.mustFind(ctx.organizationId, id, tx);
			if (invoice.status !== 'draft') throw new InvoiceNotDraftError();

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

			await this.ledgerRepo.insertArOpenItem(
				{
					organizationId: ctx.organizationId,
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
					issuedBy: ctx.actorUserId,
					issuedAt: new Date(),
					outstandingTotal: invoice.grandTotal,
				},
				tx,
			);
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
}

// Re-export so the error family stays importable from one place in tests.
export { InvoiceNotFoundError };
