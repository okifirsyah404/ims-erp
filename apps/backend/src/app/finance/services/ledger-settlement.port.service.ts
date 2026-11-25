import { EMPLOYEE_ADVANCE_SERVICE_TOKEN, EXPENSE_CLAIM_REPOSITORY_TOKEN } from '../constants/di';
import type { EmployeeAdvanceService } from './employee-advance.service';
import type { IExpenseClaimRepository } from '../contracts/expense-claim.repository.interface';
import type { TEmployeePayableType } from '../contracts/ledger-settlement.port';
import { inject, injectable } from 'tsyringe';
import { POSTING_SERVICE_TOKEN } from '../constants/di';
import type { PostingService } from './posting.service';
import type { TTx } from '@drizzle/types';
import { AR_ACCOUNT_RESOLVER_TOKEN, CASH_BANK_SERVICE_TOKEN } from '../constants/ar-di';
import {
	AP_OPEN_ITEM_REPOSITORY_TOKEN,
	AR_OPEN_ITEM_REPOSITORY_TOKEN,
	SUPPLIER_BILL_REPOSITORY_TOKEN,
} from '../constants/di';
// elysia-module rule 3.4: token and contract type only, never Sales' services or repositories.
import { EXPORTED_INVOICE_SERVICE_TOKEN } from '@app/sale/constants/ar-di';
import type { IExportedInvoiceService } from '@app/sale/contracts/exported-invoice.contract';
import type { CashBankService } from '../services/cash-bank.service';
import type { ArAccountResolverService } from '../services/ar-account-resolver.service';
import type {
	ILedgerSettlementPort,
	TSettlementDocument,
	TSettlementOpenItem,
} from '../contracts/ledger-settlement.port';
import type { IArOpenItemRepository } from '../contracts/ar-open-item.repository.interface';
import type { IApOpenItemRepository } from '../contracts/ap-open-item.repository.interface';
import type { ISupplierBillRepository } from '../contracts/supplier-bill.repository.interface';

/**
 * Accounting/Finance side of the payment module's settlement (ADR-0024).
 *
 * @remarks
 * Implements {@link ILedgerSettlementPort}: the AR/AP mirrors, the invoice and
 * supplier-bill totals, and the cash/bank movement. Kept here so Accounting and
 * Finance own their tables; the `payment` module only sees the port.
 */
@injectable()
export class LedgerSettlementPortService implements ILedgerSettlementPort {
	constructor(
		@inject(EXPORTED_INVOICE_SERVICE_TOKEN)
		private readonly invoices: IExportedInvoiceService,
		@inject(AR_OPEN_ITEM_REPOSITORY_TOKEN)
		private readonly ar: IArOpenItemRepository,
		@inject(AP_OPEN_ITEM_REPOSITORY_TOKEN)
		private readonly ap: IApOpenItemRepository,
		@inject(SUPPLIER_BILL_REPOSITORY_TOKEN)
		private readonly bills: ISupplierBillRepository,
		@inject(CASH_BANK_SERVICE_TOKEN)
		private readonly cashBank: Pick<CashBankService, 'postMovement'>,
		@inject(AR_ACCOUNT_RESOLVER_TOKEN)
		private readonly arResolver: Pick<ArAccountResolverService, 'resolve'>,
		@inject(POSTING_SERVICE_TOKEN)
		private readonly posting?: Pick<PostingService, 'postBusinessEvent'>,
		/** ERP-0144: advances and settlements paid through `payment`. */
		@inject(EMPLOYEE_ADVANCE_SERVICE_TOKEN)
		private readonly advances?: Pick<EmployeeAdvanceService, 'payable' | 'applyPayment'>,
		@inject(EXPENSE_CLAIM_REPOSITORY_TOKEN)
		private readonly claims?: Pick<IExpenseClaimRepository, 'findExpenseClaimById' | 'updateExpenseClaim'>,
	) {}

	async findEmployeePayable(
		organizationId: string,
		type: TEmployeePayableType,
		id: string,
		direction: 'in' | 'out',
		tx?: unknown,
	): Promise<{ outstanding: number; exact: boolean; employeeId: string | null } | null> {
		if (type === 'expense_claim') {
			const claim = this.claims ? await this.claims.findExpenseClaimById(organizationId, id, tx as TTx) : null;
			if (!claim || direction !== 'out' || claim.status !== 'approved') return null;
			return { outstanding: claim.totalAmount, exact: true, employeeId: claim.employeeId };
		}
		return this.advances ? this.advances.payable(organizationId, type, id, direction, tx as TTx) : null;
	}

	async applyEmployeePayable(
		organizationId: string,
		type: TEmployeePayableType,
		id: string,
		direction: 'in' | 'out',
		amount: number,
		paymentId: string,
		tx: TTx,
	): Promise<void> {
		if (type === 'expense_claim') {
			await this.claims?.updateExpenseClaim(organizationId, id, { status: 'paid', paymentId }, tx);
			return;
		}
		await this.advances?.applyPayment(organizationId, type, id, direction, amount, paymentId, tx);
	}

	async findSalesInvoice(
		organizationId: string,
		invoiceId: string,
		tx?: unknown,
	): Promise<TSettlementDocument | null> {
		const invoice = await this.invoices.findById(organizationId, invoiceId, tx);
		if (!invoice) return null;
		return {
			id: invoice.id,
			// The lookup is scoped by organizationId, so a found row belongs to it (ADR-0014: the column is nullable).
			organizationId,
			paidTotal: invoice.paidTotal,
			outstandingTotal: invoice.outstandingTotal,
			status: invoice.status,
		};
	}

	async findArOpenItem(
		organizationId: string,
		invoiceId: string,
		tx?: unknown,
	): Promise<TSettlementOpenItem | null> {
		const item = await this.ar.findArOpenItemByInvoice(organizationId, invoiceId, tx as TTx | undefined);
		return item ? { paidAmount: item.paidAmount, originalAmount: item.originalAmount } : null;
	}

	async applyArSettlement(
		organizationId: string,
		invoiceId: string,
		patch: { paidAmount: number; outstandingAmount: number; status: string },
		tx: TTx,
	): Promise<void> {
		await this.ar.updateArOpenItem(organizationId, invoiceId, patch, tx);
		await this.invoices.updateTotals(
			organizationId,
			invoiceId,
			{
				paidTotal: patch.paidAmount,
				outstandingTotal: patch.outstandingAmount,
				status: patch.status,
			},
			tx,
		);
	}

	async findSupplierBill(
		organizationId: string,
		billId: string,
		tx?: unknown,
	): Promise<TSettlementDocument | null> {
		const bill = await this.bills.findSupplierBillById(organizationId, billId, tx as TTx | undefined);
		if (!bill) return null;
		return {
			id: bill.id,
			// The lookup is scoped by organizationId, so a found row belongs to it (ADR-0014: the column is nullable).
			organizationId,
			paidTotal: bill.paidTotal,
			outstandingTotal: bill.outstandingTotal,
			status: bill.status,
		};
	}

	async findApOpenItem(
		organizationId: string,
		billId: string,
		tx?: unknown,
	): Promise<TSettlementOpenItem | null> {
		const item = await this.ap.findApOpenItemByBill(organizationId, billId, tx as TTx | undefined);
		return item ? { paidAmount: item.paidAmount, originalAmount: item.originalAmount } : null;
	}

	async applyApSettlement(
		organizationId: string,
		billId: string,
		patch: { paidAmount: number; outstandingAmount: number; status: string },
		tx: TTx,
	): Promise<void> {
		await this.ap.updateApOpenItem(organizationId, billId, patch, tx);
		await this.bills.updateSupplierBill(
			organizationId,
			billId,
			{
				paidTotal: patch.paidAmount,
				outstandingTotal: patch.outstandingAmount,
				status: patch.status,
			},
			tx,
		);
	}

	async postWithholding(
		input: {
			organizationId: string;
			actorUserId: string;
			paymentId: string;
			paymentCode: string;
			businessDate: string;
			amount: number;
			taxCode: string;
			supplierId: string | null;
		},
		tx: TTx,
	): Promise<void> {
		if (!this.posting) return;
		const party = { partyType: 'supplier', partyId: input.supplierId };
		await this.posting.postBusinessEvent(tx, {
			organizationId: input.organizationId,
			entryDate: input.businessDate,
			sourceModule: 'payment',
			sourceType: 'payment_withholding',
			sourceId: input.paymentId,
			idempotencyKey: `payment_withholding:${input.paymentId}`,
			eventType: 'payment.withholding_recorded',
			description: `PPh withheld on payment ${input.paymentCode}`,
			actorUserId: input.actorUserId,
			lines: [
				{ role: 'payable', debit: input.amount, credit: 0, ...party },
				{ role: 'wht_payable', discriminatorType: 'tax', discriminatorValue: input.taxCode, debit: 0, credit: input.amount, ...party },
			],
		});
	}

	async postCashMovement(
		input: {
			organizationId: string;
			actorUserId: string;
			cashBankAccountId: string;
			side: 'receivable' | 'payable';
			counterpartRole?: 'claim_payable' | 'employee_advance';
			direction: 'in' | 'out';
			amount: number;
			businessDate: string;
			description: string;
			referenceNumber: string;
			sourceType: string;
			sourceId: string;
		},
		tx: TTx,
	): Promise<void> {
		const key = input.counterpartRole === 'claim_payable' ? 'claimPayable' : input.counterpartRole === 'employee_advance' ? 'employeeAdvance' : input.side === 'payable' ? 'ap' : 'ar';
		const counterpartAccountId = await this.arResolver.resolve(input.organizationId, key);
		await this.cashBank.postMovement(
			{ organizationId: input.organizationId, actorUserId: input.actorUserId },
			{
				cashBankAccountId: input.cashBankAccountId,
				transactionDate: input.businessDate,
				direction: input.direction,
				amount: input.amount,
				description: input.description,
				referenceNumber: input.referenceNumber,
				counterpartAccountId,
				sourceType: input.sourceType,
				sourceId: input.sourceId,
			},
			tx,
		);
	}
}
