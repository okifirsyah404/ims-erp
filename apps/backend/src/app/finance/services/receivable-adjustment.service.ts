import type { TTx } from '@drizzle/types';
import type { TArOpenItemSelect, TCreditMemoSelect } from '@drizzle/schemas/finance.schema';
import { EXPORTED_INVOICE_SERVICE_TOKEN } from '@app/sale/constants/ar-di';
import type { IExportedInvoiceService } from '@app/sale/contracts/exported-invoice.contract';
import { type ITransactionRunner, TRANSACTION_RUNNER_TOKEN } from '@providers/database/transaction-runner';
import type { AuditWriter } from '@shared/audit';
import { inject, injectable } from 'tsyringe';
import {
	AR_OPEN_ITEM_REPOSITORY_TOKEN,
	CREDIT_MEMO_REPOSITORY_TOKEN,
	FINANCE_AUDIT_WRITER_TOKEN,
	FINANCE_NUMBERING_SERVICE_TOKEN,
	POSTING_SERVICE_TOKEN,
} from '../constants/di';
import type { IArOpenItemRepository } from '../contracts/ar-open-item.repository.interface';
import type {
	ICreditMemoRepository,
	TCreditMemoPaginationRequest,
} from '../contracts/credit-memo.repository.interface';
import {
	CreditMemoAmountError,
	CreditMemoNotFoundError,
	CreditMemoTransitionError,
	WriteOffNotAllowedError,
	WriteOffNotRequestedError,
	WriteOffSelfApprovalError,
} from '../errors/ledger.errors';
import type { FinanceNumberingService } from './finance-numbering.service';
import type { PostingService } from './posting.service';

export type TAdjustmentActor = { organizationId: string; actorUserId: string };

/** Open-item and invoice status after the open amount changed. */
export function receivableStatus(item: { paidAmount: number; outstandingAmount: number }): {
	openItem: string;
	invoice: string;
} {
	if (item.outstandingAmount === 0) return { openItem: 'paid', invoice: 'paid' };
	return item.paidAmount > 0
		? { openItem: 'partially_paid', invoice: 'partially_paid' }
		: { openItem: 'open', invoice: 'issued' };
}

/** VAT part of a credited amount, at the invoice's VAT ratio (half-up). */
export function creditTax(amount: number, invoice: { taxTotal: number; grandTotal: number }): number {
	if (invoice.grandTotal <= 0 || invoice.taxTotal <= 0) return 0;
	return Math.round((amount * invoice.taxTotal) / invoice.grandTotal);
}

/**
 * Receivable adjustments (ERP-0135, grill Q56/Q57): credit memos and
 * write-offs.
 *
 * @remarks
 * Both reduce what the customer owes without being a payment: the open item's
 * `original_amount` drops by the adjustment (tracked in `adjusted_amount`),
 * so `outstanding = original - paid` keeps holding and payments keep their
 * own arithmetic. Credit memo: Dr sales returns + Dr VAT output / Cr
 * receivable. Write-off (maker-checker): Dr allowance for doubtful accounts /
 * Cr receivable for the whole open amount; open item and invoice become
 * `written_off`.
 */
@injectable()
export class ReceivableAdjustmentService {
	constructor(
		@inject(TRANSACTION_RUNNER_TOKEN) private readonly transactions: ITransactionRunner,
		@inject(CREDIT_MEMO_REPOSITORY_TOKEN) private readonly memos: ICreditMemoRepository,
		@inject(AR_OPEN_ITEM_REPOSITORY_TOKEN) private readonly openItems: IArOpenItemRepository,
		@inject(EXPORTED_INVOICE_SERVICE_TOKEN)
		private readonly invoices: Pick<IExportedInvoiceService, 'findById' | 'updateTotals'>,
		@inject(POSTING_SERVICE_TOKEN) private readonly posting: Pick<PostingService, 'postBusinessEvent' | 'reverse'>,
		@inject(FINANCE_NUMBERING_SERVICE_TOKEN) private readonly numbering: Pick<FinanceNumberingService, 'next'>,
		@inject(FINANCE_AUDIT_WRITER_TOKEN) private readonly audit?: AuditWriter,
	) {}

	/* ------------------------------ credit memos ------------------------------ */

	listCreditMemos(request: TCreditMemoPaginationRequest) {
		return this.memos.paginate(request);
	}

	async createCreditMemo(
		ctx: TAdjustmentActor,
		input: { invoiceId: string; memoDate: string; amount: number; reason: string },
	): Promise<TCreditMemoSelect> {
		const invoice = await this.invoices.findById(ctx.organizationId, input.invoiceId);
		const item = await this.openItems.findArOpenItemByInvoice(ctx.organizationId, input.invoiceId);
		if (!invoice || !item || !isCreditable(item) || input.amount > item.outstandingAmount) {
			throw new CreditMemoAmountError();
		}
		// P7-5 (T-1): the number is taken in the insert's transaction (no gap).
		const memo = await this.transactions.run(async (tx) =>
			this.memos.insert({
				organizationId: ctx.organizationId,
				code: await this.numbering.next('credit_memo', { date: new Date(`${input.memoDate}T12:00:00+07:00`), tx }),
				invoiceId: invoice.id,
				customerId: invoice.customerId,
				memoDate: input.memoDate,
				amount: input.amount,
				taxAmount: creditTax(input.amount, invoice),
				reason: input.reason,
				createdBy: ctx.actorUserId,
			}, tx),
		);
		await this.record(ctx, 'credit_memo.created', 'credit_memo', memo.id, { code: memo.code, amount: memo.amount });
		return memo;
	}

	/** Posts the credit and lowers the invoice's open amount. */
	async applyCreditMemo(ctx: TAdjustmentActor, id: string): Promise<TCreditMemoSelect> {
		const applied = await this.transactions.run(async (tx) => {
			const memo = await this.requireMemo(ctx.organizationId, id, tx);
			if (memo.status !== 'draft' || !memo.invoiceId) throw new CreditMemoTransitionError();
			const item = await this.openItems.findArOpenItemByInvoice(ctx.organizationId, memo.invoiceId, tx);
			if (!item || !isCreditable(item) || memo.amount > item.outstandingAmount) throw new CreditMemoAmountError();
			const party = { partyType: 'customer', partyId: memo.customerId };
			const lines = [
				{ role: 'sales_return', debit: memo.amount - memo.taxAmount, credit: 0, ...party },
				{ role: 'vat_output', debit: memo.taxAmount, credit: 0 },
				{ role: 'receivable', debit: 0, credit: memo.amount, ...party },
			].filter((line) => line.debit > 0 || line.credit > 0);
			const { entry } = await this.posting.postBusinessEvent(tx, {
				organizationId: ctx.organizationId,
				entryDate: memo.memoDate ?? new Date().toISOString().slice(0, 10),
				sourceModule: 'finance',
				sourceType: 'credit_memo',
				sourceId: memo.id,
				idempotencyKey: `credit_memo:${memo.id}`,
				eventType: 'finance.credit_memo_applied',
				description: `Credit memo ${memo.code}`,
				actorUserId: ctx.actorUserId,
				lines,
			});
			await this.adjustOpenAmount(ctx.organizationId, memo.invoiceId, item, -memo.amount, tx);
			const updated = await this.memos.update(
				ctx.organizationId,
				memo.id,
				{ status: 'applied', journalEntryId: entry.id, issuedBy: ctx.actorUserId, issuedAt: new Date() },
				tx,
			);
			return updated ?? memo;
		});
		await this.record(ctx, 'credit_memo.applied', 'credit_memo', id, { amount: applied.amount });
		return applied;
	}

	/** Voids a draft, or reverses an applied memo and restores the open amount. */
	async voidCreditMemo(ctx: TAdjustmentActor, id: string, reason: string): Promise<TCreditMemoSelect> {
		const voided = await this.transactions.run(async (tx) => {
			const memo = await this.requireMemo(ctx.organizationId, id, tx);
			if (memo.status === 'applied') {
				if (!memo.invoiceId || !memo.journalEntryId) throw new CreditMemoTransitionError();
				const item = await this.openItems.findArOpenItemByInvoice(ctx.organizationId, memo.invoiceId, tx);
				if (!item || item.status === 'written_off' || item.status === 'void') throw new CreditMemoTransitionError();
				await this.posting.reverse(tx, ctx.organizationId, memo.journalEntryId, ctx.actorUserId, {
					description: `Credit memo ${memo.code} voided: ${reason}`,
				});
				await this.adjustOpenAmount(ctx.organizationId, memo.invoiceId, item, memo.amount, tx);
			} else if (memo.status !== 'draft') {
				throw new CreditMemoTransitionError();
			}
			return (await this.memos.update(ctx.organizationId, memo.id, { status: 'void' }, tx)) ?? memo;
		});
		await this.record(ctx, 'credit_memo.voided', 'credit_memo', id, { reason });
		return voided;
	}

	/* ------------------------------ write-offs ------------------------------ */

	listWriteOffRequests(organizationId: string) {
		return this.openItems.listWriteOffRequests(organizationId);
	}

	async requestWriteOff(ctx: TAdjustmentActor, invoiceId: string, reason: string): Promise<TArOpenItemSelect> {
		const item = await this.openItems.findArOpenItemByInvoice(ctx.organizationId, invoiceId);
		if (!item || !isCreditable(item) || item.writeOffRequestedAt) throw new WriteOffNotAllowedError();
		const updated = await this.openItems.updateArOpenItem(ctx.organizationId, invoiceId, {
			writeOffReason: reason,
			writeOffRequestedBy: ctx.actorUserId,
			writeOffRequestedAt: new Date(),
		});
		await this.record(ctx, 'receivable.write_off_requested', 'ar_open_item', item.id, {
			invoiceId,
			amount: item.outstandingAmount,
			reason,
		});
		return updated ?? item;
	}

	async cancelWriteOff(ctx: TAdjustmentActor, invoiceId: string): Promise<TArOpenItemSelect> {
		const item = await this.openItems.findArOpenItemByInvoice(ctx.organizationId, invoiceId);
		if (!item || !item.writeOffRequestedAt || item.writtenOffAt) throw new WriteOffNotRequestedError();
		const updated = await this.openItems.updateArOpenItem(ctx.organizationId, invoiceId, {
			writeOffReason: null,
			writeOffRequestedBy: null,
			writeOffRequestedAt: null,
		});
		await this.record(ctx, 'receivable.write_off_cancelled', 'ar_open_item', item.id, { invoiceId });
		return updated ?? item;
	}

	/** Approves a pending request (not by the requester) and posts the write-off. */
	async approveWriteOff(ctx: TAdjustmentActor, invoiceId: string): Promise<TArOpenItemSelect> {
		const result = await this.transactions.run(async (tx) => {
			const item = await this.openItems.findArOpenItemByInvoice(ctx.organizationId, invoiceId, tx);
			if (!item || !item.writeOffRequestedAt || item.writtenOffAt) throw new WriteOffNotRequestedError();
			if (item.writeOffRequestedBy === ctx.actorUserId) throw new WriteOffSelfApprovalError();
			if (!isCreditable(item)) throw new WriteOffNotAllowedError();
			const amount = item.outstandingAmount;
			const party = { partyType: 'customer', partyId: item.customerId };
			const { entry } = await this.posting.postBusinessEvent(tx, {
				organizationId: ctx.organizationId,
				entryDate: new Date().toISOString().slice(0, 10),
				sourceModule: 'finance',
				sourceType: 'receivable_write_off',
				sourceId: item.id,
				idempotencyKey: `write_off:${item.id}`,
				eventType: 'finance.receivable_written_off',
				description: `Write-off: ${item.writeOffReason ?? ''}`.trim(),
				actorUserId: ctx.actorUserId,
				lines: [
					{ role: 'bad_debt_allowance', debit: amount, credit: 0, ...party },
					{ role: 'receivable', debit: 0, credit: amount, ...party },
				],
			});
			const updated = await this.openItems.updateArOpenItem(
				ctx.organizationId,
				invoiceId,
				{
					originalAmount: item.originalAmount - amount,
					adjustedAmount: item.adjustedAmount + amount,
					outstandingAmount: 0,
					status: 'written_off',
					writtenOffBy: ctx.actorUserId,
					writtenOffAt: new Date(),
					writeOffEntryId: entry.id,
				},
				tx,
			);
			await this.invoices.updateTotals(ctx.organizationId, invoiceId, { outstandingTotal: 0, status: 'written_off' }, tx);
			return { item: updated ?? item, amount };
		});
		await this.record(ctx, 'receivable.write_off_approved', 'ar_open_item', result.item.id, {
			invoiceId,
			amount: result.amount,
		});
		return result.item;
	}

	/* ------------------------------ helpers ------------------------------ */

	private async adjustOpenAmount(
		organizationId: string,
		invoiceId: string,
		item: TArOpenItemSelect,
		delta: number,
		tx: TTx,
	): Promise<void> {
		const next = {
			originalAmount: item.originalAmount + delta,
			adjustedAmount: item.adjustedAmount - delta,
			outstandingAmount: item.outstandingAmount + delta,
			paidAmount: item.paidAmount,
		};
		const status = receivableStatus(next);
		await this.openItems.updateArOpenItem(
			organizationId,
			invoiceId,
			{
				originalAmount: next.originalAmount,
				adjustedAmount: next.adjustedAmount,
				outstandingAmount: next.outstandingAmount,
				status: status.openItem,
			},
			tx,
		);
		await this.invoices.updateTotals(
			organizationId,
			invoiceId,
			{ outstandingTotal: next.outstandingAmount, status: status.invoice },
			tx,
		);
	}

	private async requireMemo(organizationId: string, id: string, tx?: TTx): Promise<TCreditMemoSelect> {
		const memo = await this.memos.findById(organizationId, id, tx);
		if (!memo) throw new CreditMemoNotFoundError();
		return memo;
	}

	private async record(
		ctx: TAdjustmentActor,
		action:
			| 'credit_memo.created'
			| 'credit_memo.applied'
			| 'credit_memo.voided'
			| 'receivable.write_off_requested'
			| 'receivable.write_off_cancelled'
			| 'receivable.write_off_approved',
		targetType: 'credit_memo' | 'ar_open_item',
		targetId: string,
		meta: Record<string, unknown>,
	): Promise<void> {
		await this.audit?.record({
			actor: { userId: ctx.actorUserId },
			action,
			targetType,
			targetId,
			organizationId: ctx.organizationId,
			meta,
		});
	}
}

function isCreditable(item: TArOpenItemSelect): boolean {
	return (item.status === 'open' || item.status === 'partially_paid') && item.outstandingAmount > 0;
}
