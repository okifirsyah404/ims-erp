import type { TTx } from '@drizzle/types';

/**
 * Accounting/Finance contract for the payment module (ADR-0024).
 *
 * @remarks
 * A settled payment has to move other modules' rows: the AR/AP open-item
 * mirrors, the `sales.invoices` totals and `finance.supplier_bills`, and the
 * cash/bank movement that auto-journals DR cash / CR AR. Those tables belong to
 * Accounting and Finance, so `payment` reaches them through this port — never
 * through their repositories, and never by writing their tables directly
 * (`elysia-module` rule 3.5). Every method takes the caller's transaction so
 * the whole execution stays one atomic unit.
 */

/** Minimal shape the payment service needs from an open item. */
export type TSettlementOpenItem = { paidAmount: number; originalAmount: number };

/** Minimal shape the payment service needs from a sales invoice or supplier bill. */
export type TSettlementDocument = {
	id: string;
	organizationId: string;
	paidTotal: number;
	outstandingTotal: number;
	status: string;
};

/** Employee payables a payment may settle (ERP-0144). */
export type TEmployeePayableType = 'expense_claim' | 'employee_advance' | 'expense_settlement';

/** Which side of the ledger the cash movement settles. */
export type TSettlementSide = 'receivable' | 'payable';

export interface ILedgerSettlementPort {
	/** The sales invoice being settled, or null when absent in this organization. */
	findSalesInvoice(organizationId: string, invoiceId: string, tx?: unknown): Promise<TSettlementDocument | null>;
	/** The AR open item mirror of that invoice, or null when the invoice was never issued. */
	findArOpenItem(organizationId: string, invoiceId: string, tx?: unknown): Promise<TSettlementOpenItem | null>;
	/** Applies the settled amount to the AR mirror and the invoice totals. */
	applyArSettlement(
		organizationId: string,
		invoiceId: string,
		patch: { paidAmount: number; outstandingAmount: number; status: string },
		tx: TTx,
	): Promise<void>;

	/** The supplier bill being settled, or null. */
	findSupplierBill(organizationId: string, billId: string, tx?: unknown): Promise<TSettlementDocument | null>;
	/** The AP open item mirror of that bill, or null when the bill was never recorded. */
	findApOpenItem(organizationId: string, billId: string, tx?: unknown): Promise<TSettlementOpenItem | null>;
	/** Applies the settled amount to the AP mirror and the supplier bill totals. */
	applyApSettlement(
		organizationId: string,
		billId: string,
		patch: { paidAmount: number; outstandingAmount: number; status: string },
		tx: TTx,
	): Promise<void>;

	/**
	 * Records the cash/bank movement of the executed payment (auto-journal
	 * DR cash / CR AR or DR AP / CR cash), joining the caller's transaction.
	 * This module resolves the counterpart GL account from `side`.
	 */
	/**
	 * PPh withheld from a supplier payment (ERP-0140): Dr payable / Cr the
	 * withholding payable of that tax (posting-rule discriminator `tax` = tax
	 * code). The cash movement carries only the net amount.
	 */
	postWithholding(
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
	): Promise<void>;

	/**
	 * What a payment may still allocate to an employee payable (ERP-0144):
	 * `exact` means the allocation must equal `outstanding` (claims and advance
	 * disbursements are paid in full). `null` when the target is not payable
	 * in that direction.
	 */
	findEmployeePayable(
		organizationId: string,
		type: TEmployeePayableType,
		id: string,
		direction: 'in' | 'out',
		tx?: unknown,
	): Promise<{ outstanding: number; exact: boolean; employeeId: string | null } | null>;

	/** Applies an executed allocation to an employee payable. */
	applyEmployeePayable(
		organizationId: string,
		type: TEmployeePayableType,
		id: string,
		direction: 'in' | 'out',
		amount: number,
		paymentId: string,
		tx: TTx,
	): Promise<void>;

	postCashMovement(
		input: {
			organizationId: string;
			actorUserId: string;
			cashBankAccountId: string;
			side: TSettlementSide;
			/** ERP-0144: counterpart for employee payments instead of AR/AP. */
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
	): Promise<void>;
}
