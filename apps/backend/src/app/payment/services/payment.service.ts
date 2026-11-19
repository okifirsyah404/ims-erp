import { inject, injectable } from 'tsyringe';
import type { TTx } from '@drizzle/types';
import type { TPaymentSelect } from '@drizzle/schemas/payment.schema';
import type { TPaginationResult } from '@ims-erp/common';
import { DRIZZLE_TOKEN } from '@di/provider';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { LEDGER_SETTLEMENT_PORT_TOKEN } from '@app/finance/constants/ar-di';
import type { ILedgerSettlementPort } from '@app/finance/contracts/ledger-settlement.port';
import { PAYMENT_NUMBERING_SERVICE_TOKEN, PAYMENT_REPOSITORY_TOKEN } from '../constants/di';
import type { IPaymentRepository } from '../contracts/payment.repository.interface';
import type { PaymentNumberingService } from './payment-numbering.service';
import type {
	IPaymentService,
	TAllocationInput,
	TCreatePaymentInput,
	TPaymentActionContext,
} from '../contracts/payment.service.interface';
import {
	PaymentAllocationMismatchError,
	PaymentCashAccountRequiredError,
	PaymentInvalidTransitionError,
	PaymentNotFoundError,
	PaymentOverAllocationError,
	PaymentTargetNotIssuedError,
	PaymentVoidNotAllowedError,
} from '../errors/payment.errors';

/** Which side of the ledger a payment type settles. */
const PAYMENT_SIDE: Record<TCreatePaymentInput['paymentType'], 'receivable' | 'payable'> = {
	receipt: 'receivable',
	disbursement: 'payable',
};

@injectable()
export class PaymentService implements IPaymentService {
	constructor(
		@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase,
		@inject(PAYMENT_REPOSITORY_TOKEN) private readonly repo: IPaymentRepository,
		/** Accounting/Finance effects of a settled payment (mirrors, cash/bank). */
		@inject(LEDGER_SETTLEMENT_PORT_TOKEN) private readonly settlement: ILedgerSettlementPort,
		@inject(PAYMENT_NUMBERING_SERVICE_TOKEN) private readonly numbering: Pick<PaymentNumberingService, 'next'>,
	) {}

	async get(organizationId: string, id: string): Promise<TPaymentSelect> {
		const payment = await this.repo.findById(organizationId, id);
		if (!payment) throw new PaymentNotFoundError();
		return payment;
	}

	list(
		organizationId: string,
		filters: { status?: string; paymentType?: string },
		pagination: { page: number; limit: number },
	): Promise<TPaginationResult<TPaymentSelect>> {
		return this.repo.list(organizationId, filters, pagination);
	}

	async create(
		ctx: TPaymentActionContext,
		input: TCreatePaymentInput,
		_allocations: TAllocationInput[],
	): Promise<TPaymentSelect> {
		return this.database.transaction(async (tx) => {
			const code = await this.numbering.next('payment', {
				date: new Date(`${input.paymentDate}T12:00:00+07:00`),
				tx,
			});
			return this.repo.insert(
				{
					organizationId: ctx.organizationId,
					code,
					paymentType: input.paymentType,
					direction: PAYMENT_SIDE[input.paymentType] === 'payable' ? 'out' : 'in',
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
			await this.validateAllocations(
				ctx.organizationId,
				payment.paymentType as TCreatePaymentInput['paymentType'],
				payment.amount,
				allocations,
				tx,
			);
			await this.repo.syncAllocations(ctx.organizationId, payment.id, allocations, tx);
			return payment;
		});
	}

	submit(ctx: TPaymentActionContext, id: string): Promise<TPaymentSelect> {
		return this.transition(ctx, id, 'draft', 'submitted', () => ({ submittedAt: new Date() }));
	}

	approve(ctx: TPaymentActionContext, id: string): Promise<TPaymentSelect> {
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
		const updated = await this.repo.update(ctx.organizationId, id, {
			status: 'void',
			voidedAt: new Date(),
			voidReason: reason,
		});
		return updated ?? payment;
	}

	/**
	 * Executes the payment — the ledger event. Allocates to invoices/bills,
	 * updates both mirrors, and posts the cash movement (auto-journal
	 * DR cash / CR AR) inside one transaction.
	 */
	async execute(ctx: TPaymentActionContext, id: string): Promise<TPaymentSelect> {
		return this.database.transaction(async (tx) => {
			const payment = await this.mustFind(ctx.organizationId, id, tx);
			if (payment.status !== 'approved') throw new PaymentInvalidTransitionError();
			if (!payment.cashBankAccountId) throw new PaymentCashAccountRequiredError();

			const allocations = await this.repo.listAllocations(ctx.organizationId, payment.id, tx);
			if (allocations.length === 0) throw new PaymentAllocationMismatchError();
			const allocated = allocations.reduce((s, a) => s + a.amount, 0);
			if (allocated !== payment.amount) throw new PaymentAllocationMismatchError();

			await this.validateAllocations(
				ctx.organizationId,
				payment.paymentType as TCreatePaymentInput['paymentType'],
				payment.amount,
				allocations.map((a) => ({ payableType: a.payableType as TAllocationInput['payableType'], payableId: a.payableId, amount: a.amount })),
				tx,
			);

			for (const allocation of allocations) {
				if (allocation.payableType === 'supplier_bill') {
					await this.applyBillAllocation(ctx.organizationId, allocation.payableId, allocation.amount, tx);
				} else if (allocation.payableType === 'sale_invoice') {
					await this.applyInvoiceAllocation(ctx.organizationId, allocation.payableId, allocation.amount, tx);
				} else {
					throw new PaymentTargetNotIssuedError();
				}
			}

			const side = PAYMENT_SIDE[payment.paymentType as TCreatePaymentInput['paymentType']];
			await this.settlement.postCashMovement(
				{
					organizationId: ctx.organizationId,
					actorUserId: ctx.actorUserId,
					cashBankAccountId: payment.cashBankAccountId,
					side,
					direction: side === 'payable' ? 'out' : 'in',
					amount: payment.amount,
					businessDate: payment.paymentDate ?? new Date().toISOString().slice(0, 10),
					description: `Payment ${payment.code}`,
					referenceNumber: payment.code,
					sourceType: 'payment',
					sourceId: payment.id,
				},
				tx,
			);

			const updated = await this.repo.update(
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

	private async mustFind(organizationId: string, id: string, tx?: TTx): Promise<TPaymentSelect> {
		const payment = await this.repo.findById(organizationId, id, tx);
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
		const updated = await this.repo.update(ctx.organizationId, id, { status: to, ...extra(payment) } as Partial<TPaymentSelect>);
		return updated ?? payment;
	}

	/** Σ = amount and every target (invoice or bill) open with room left. */
	private async validateAllocations(
		organizationId: string,
		paymentType: TCreatePaymentInput['paymentType'],
		amount: number,
		allocations: TAllocationInput[],
		tx?: TTx,
	): Promise<void> {
		const total = allocations.reduce((s, a) => s + a.amount, 0);
		if (total !== amount) throw new PaymentAllocationMismatchError();
		const expectsPayable = PAYMENT_SIDE[paymentType] === 'payable';
		for (const allocation of allocations) {
			// Resolver map: only the payables of the two ledger sides are wired so far.
			if (allocation.payableType !== 'sale_invoice' && allocation.payableType !== 'supplier_bill') {
				throw new PaymentTargetNotIssuedError();
			}
			if (expectsPayable !== (allocation.payableType === 'supplier_bill')) {
				throw new PaymentTargetNotIssuedError();
			}
			if (allocation.payableType === 'sale_invoice') {
				const invoice = await this.settlement.findSalesInvoice(organizationId, allocation.payableId, tx);
				if (!invoice) throw new PaymentTargetNotIssuedError();
				if (invoice.status !== 'issued' && invoice.status !== 'partially_paid') {
					throw new PaymentTargetNotIssuedError();
				}
				if (allocation.amount > invoice.outstandingTotal) throw new PaymentOverAllocationError();
				continue;
			}
			const bill = await this.settlement.findSupplierBill(organizationId, allocation.payableId, tx);
			if (!bill) throw new PaymentTargetNotIssuedError();
			if (bill.status !== 'approved' && bill.status !== 'partially_paid') {
				throw new PaymentTargetNotIssuedError();
			}
			if (allocation.amount > bill.outstandingTotal) throw new PaymentOverAllocationError();
		}
	}

	/** Applies one settled allocation to the AR mirror + `sales.invoices` totals. */
	private async applyInvoiceAllocation(
		organizationId: string,
		invoiceId: string,
		amount: number,
		tx: TTx,
	): Promise<void> {
		const item = await this.settlement.findArOpenItem(organizationId, invoiceId, tx);
		if (!item) throw new PaymentTargetNotIssuedError();
		const paidAmount = item.paidAmount + amount;
		const outstandingAmount = item.originalAmount - paidAmount;
		const status = outstandingAmount === 0 ? 'paid' : 'partially_paid';
		await this.settlement.applyArSettlement(
			organizationId,
			invoiceId,
			{ paidAmount, outstandingAmount, status },
			tx,
		);
	}

	/** Applies one settled allocation to the AP mirror + `finance.supplier_bills`. */
	private async applyBillAllocation(
		organizationId: string,
		billId: string,
		amount: number,
		tx: TTx,
	): Promise<void> {
		const item = await this.settlement.findApOpenItem(organizationId, billId, tx);
		if (!item) throw new PaymentTargetNotIssuedError();
		const paidAmount = item.paidAmount + amount;
		const outstandingAmount = item.originalAmount - paidAmount;
		const status = outstandingAmount === 0 ? 'paid' : 'partially_paid';
		await this.settlement.applyApSettlement(
			organizationId,
			billId,
			{ paidAmount, outstandingAmount, status },
			tx,
		);
	}
}
