import type { TTx } from '@drizzle/types';
import type {
	TPaymentSelect,
} from '@drizzle/schemas/finance.schema';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import { DRIZZLE_TOKEN } from '@di/provider';
import { DOCUMENT_NUMBERING_SERVICE_TOKEN } from '@app/organization/constants/di';
import type { DocumentNumberingService } from '@app/organization/services/document-numbering.service';
import {
	AR_ACCOUNT_RESOLVER_TOKEN,
	CASH_BANK_SERVICE_TOKEN,
	LEDGER_REPOSITORY_TOKEN,
} from '../constants/ar-di';
import type { LedgerRepository } from '../repositories/ledger.repository';
import type { ArAccountResolverService } from '../services/ar-account-resolver.service';
import type { CashBankService } from '../services/cash-bank.service';
import {
	PaymentAllocationMismatchError,
	PaymentCashAccountRequiredError,
	PaymentInvalidTransitionError,
	PaymentNotFoundError,
	PaymentOverAllocationError,
	PaymentTargetNotIssuedError,
	PaymentVoidNotAllowedError,
} from '../errors/ledger.errors';

export type TPaymentActionContext = {
	organizationId: string;
	actorUserId: string;
};

export type TCreatePaymentInput = {
	paymentType: 'customer_payment';
	counterpartyType: 'customer' | null;
	counterpartyId: string | null;
	amount: number;
	paymentMethod: 'bank_transfer' | 'cash' | 'cheque' | 'virtual_account';
	paymentDate: string;
	cashBankAccountId: string | null;
	referenceNumber: string | null;
	notes: string | null;
};

export type TAllocationInput = {
	salesInvoiceId: string;
	amount: number;
};

/**
 * Payment application service (M09 F4).
 *
 * @remarks
 * Single payment ledger (D5): `draft → submitted → approved → executed`,
 * one approver role. Executing is the ledger event — in ONE transaction it
 * validates allocations (Σ = amount, each ≤ outstanding), updates both the
 * `ar_open_items` mirror and the `sales.invoices` totals, then routes the
 * money through {@link CashBankService.postMovement} (joining the caller's
 * tx per D9), whose auto-journal debits cash and credits AR.
 *
 * Voiding an executed payment is deliberately out of scope (F4 decision 4a)
 * — it belongs to the F7 adjustments/reversal work.
 */
@injectable()
export class PaymentService {
	constructor(
		@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase,
		@inject(LEDGER_REPOSITORY_TOKEN) private readonly repo: LedgerRepository,
		@inject(CASH_BANK_SERVICE_TOKEN) private readonly cashBank: CashBankService,
		@inject(AR_ACCOUNT_RESOLVER_TOKEN)
		private readonly arResolver: ArAccountResolverService,
		@inject(DOCUMENT_NUMBERING_SERVICE_TOKEN)
		private readonly numbering: DocumentNumberingService,
	) {}

	async get(organizationId: string, id: string): Promise<TPaymentSelect> {
		const payment = await this.repo.findPaymentById(organizationId, id);
		if (!payment) throw new PaymentNotFoundError();
		return payment;
	}

	async list(
		organizationId: string,
		filters: { status?: string; paymentType?: string },
		pagination: { page: number; limit: number },
	): Promise<ReturnType<LedgerRepository['listPayments']>> {
		return this.repo.listPayments(organizationId, filters, pagination);
	}

	async create(
		ctx: TPaymentActionContext,
		input: TCreatePaymentInput,
		_allocations: TAllocationInput[],
	): Promise<TPaymentSelect> {
		return this.database.transaction(async (tx) => {
			const number = await this.numbering.allocate(
				ctx.organizationId,
				'payment',
				tx,
			);
			const code = this.numbering.format(
				'PAY',
				input.paymentDate.replaceAll('-', '').slice(0, 6),
				number,
				5,
			);
			return this.repo.insertPayment(
				{
					organizationId: ctx.organizationId,
					code,
					paymentType: input.paymentType,
					direction: 'in',
					counterpartyType: input.counterpartyType,
					counterpartyId: input.counterpartyId,
					amount: input.amount,
					currencyCode: 'IDR',
					paymentMethod: input.paymentMethod,
					paymentDate: input.paymentDate,
					status: 'draft',
					requestedBy: ctx.actorUserId,
					requestedAt: new Date(),
					submittedAt: null,
					approvedBy: null,
					approvedAt: null,
					executedBy: null,
					executedAt: null,
					cashBankAccountId: input.cashBankAccountId,
					referenceNumber: input.referenceNumber,
					notes: input.notes,
				},
				tx,
			);
		});
	}

	/** Stores/refreshes the allocation set. Drafts only. */
	async setAllocations(
		ctx: TPaymentActionContext,
		id: string,
		allocations: TAllocationInput[],
	): Promise<TPaymentSelect> {
		return this.database.transaction(async (tx) => {
			const payment = await this.mustFind(ctx.organizationId, id, tx);
			if (payment.status !== 'draft') throw new PaymentInvalidTransitionError();
			await this.validateAllocations(ctx.organizationId, payment.amount, allocations, tx);
			await this.repo.insertPaymentAllocations(
				allocations.map((a) => ({
					organizationId: ctx.organizationId,
					paymentId: payment.id,
					targetType: 'sales_invoice',
					salesInvoiceId: a.salesInvoiceId,
					supplierBillId: null,
					amount: a.amount,
				})),
				tx,
			);
			return payment;
		});
	}

	async submit(ctx: TPaymentActionContext, id: string): Promise<TPaymentSelect> {
		return this.transition(ctx, id, 'draft', 'submitted', () => ({
			submittedAt: new Date(),
		}));
	}

	async approve(ctx: TPaymentActionContext, id: string): Promise<TPaymentSelect> {
		return this.transition(ctx, id, 'submitted', 'approved', () => ({
			approvedBy: ctx.actorUserId,
			approvedAt: new Date(),
		}));
	}

	/** Void pre-execution only; no journal impact (nothing posted yet). */
	async void(ctx: TPaymentActionContext, id: string, reason: string): Promise<TPaymentSelect> {
		const payment = await this.mustFind(ctx.organizationId, id);
		if (payment.status === 'executed') throw new PaymentVoidNotAllowedError();
		if (payment.status === 'void') throw new PaymentInvalidTransitionError();
		const updated = await this.repo.updatePayment(ctx.organizationId, id, {
			status: 'void',
			voidedAt: new Date(),
			voidReason: reason,
		});
		return updated ?? payment;
	}

	/**
	 * Executes the payment — the ledger event. Allocates to invoices, updates
	 * both AR mirrors, and posts the cash movement (auto-journal DR cash /
	 * CR AR) inside one transaction.
	 */
	async execute(ctx: TPaymentActionContext, id: string): Promise<TPaymentSelect> {
		return this.database.transaction(async (tx) => {
			const payment = await this.mustFind(ctx.organizationId, id, tx);
			if (payment.status !== 'approved') throw new PaymentInvalidTransitionError();
			if (!payment.cashBankAccountId) throw new PaymentCashAccountRequiredError();

			const allocations = await this.repo.listPaymentAllocations(
				ctx.organizationId,
				payment.id,
				tx,
			);
			if (allocations.length === 0) throw new PaymentAllocationMismatchError();
			const allocated = allocations.reduce((s, a) => s + a.amount, 0);
			if (allocated !== payment.amount) throw new PaymentAllocationMismatchError();

			await this.validateAllocations(
				ctx.organizationId,
				payment.amount,
				allocations.map((a) => ({ salesInvoiceId: a.salesInvoiceId!, amount: a.amount })),
				tx,
			);

			// Apply each allocation to both mirrors.
			for (const allocation of allocations) {
				const item = await this.repo.findArOpenItemByInvoice(
					ctx.organizationId,
					allocation.salesInvoiceId!,
					tx,
				);
				if (!item) throw new PaymentTargetNotIssuedError();
				const paidAmount = item.paidAmount + allocation.amount;
				const outstandingAmount = item.originalAmount - paidAmount;
				const status = outstandingAmount === 0 ? 'paid' : 'partially_paid';
				await this.repo.updateArOpenItem(
					ctx.organizationId,
					allocation.salesInvoiceId!,
					{ paidAmount, outstandingAmount, status },
					tx,
				);
				await this.repo.updateSalesInvoiceTotals(
					ctx.organizationId,
					allocation.salesInvoiceId!,
					{
						paidTotal: paidAmount,
						outstandingTotal: outstandingAmount,
						status,
					},
					tx,
				);
				await this.repo.markAllocationExecuted(
					ctx.organizationId,
					allocation.id,
					tx,
				);
			}

			// Money movement through the shared cash path, joining this tx (D9):
			// auto-journal = DR cash GL / CR AR.
			const arAccountId = await this.arResolver.resolve(ctx.organizationId, 'ar');
			await this.cashBank.postMovement(
				ctx,
				{
					cashBankAccountId: payment.cashBankAccountId,
					transactionDate: payment.paymentDate ?? new Date().toISOString().slice(0, 10),
					direction: 'in',
					amount: payment.amount,
					description: `Payment ${payment.code}`,
					referenceNumber: payment.code,
					counterpartAccountId: arAccountId,
					sourceType: 'payment',
					sourceId: payment.id,
				},
				tx,
			);

			const updated = await this.repo.updatePayment(
				ctx.organizationId,
				payment.id,
				{
					status: 'executed',
					executedBy: ctx.actorUserId,
					executedAt: new Date(),
				},
				tx,
			);
			return updated ?? payment;
		});
	}

	/* ----------------------------- internals ----------------------------- */

	private async mustFind(
		organizationId: string,
		id: string,
		tx?: TTx,
	): Promise<TPaymentSelect> {
		const payment = await this.repo.findPaymentById(organizationId, id, tx);
		if (!payment) throw new PaymentNotFoundError();
		return payment;
	}

	private async transition(
		ctx: TPaymentActionContext,
		id: string,
		from: string,
		to: string,
		extra: (payment: TPaymentSelect) => Record<string, unknown>,
	): Promise<TPaymentSelect> {
		const payment = await this.mustFind(ctx.organizationId, id);
		if (payment.status !== from) throw new PaymentInvalidTransitionError();
		const updated = await this.repo.updatePayment(
			ctx.organizationId,
			id,
			{ status: to, ...extra(payment) },
		);
		return updated ?? payment;
	}

	/** Σ = amount and every target invoice issued/partially_paid with room left. */
	private async validateAllocations(
		organizationId: string,
		amount: number,
		allocations: TAllocationInput[],
		tx?: TTx,
	): Promise<void> {
		const total = allocations.reduce((s, a) => s + a.amount, 0);
		if (total !== amount) throw new PaymentAllocationMismatchError();
		for (const allocation of allocations) {
			const invoice = await this.repo.findSalesInvoiceById(
				organizationId,
				allocation.salesInvoiceId,
				tx,
			);
			if (!invoice) throw new PaymentTargetNotIssuedError();
			if (invoice.status !== 'issued' && invoice.status !== 'partially_paid') {
				throw new PaymentTargetNotIssuedError();
			}
			if (allocation.amount > invoice.outstandingTotal) {
				throw new PaymentOverAllocationError();
			}
		}
	}
}
