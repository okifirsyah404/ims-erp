import { AppError } from '@http/errors';

/**
 * Domain errors of the payment ledger (ADR-0024).
 *
 * @remarks
 * Moved here with the ledger from `accounting`. The i18n keys and messages keep
 * their historical `accounting.` prefix and wording: they are part of the
 * published API contract consumed by `apps/web-admin`. Renaming them is a
 * separate, cross-app change.
 */

export class PaymentNotFoundError extends AppError {
	constructor() {
		super(404, 'accounting.paymentNotFound', 'Payment not found');
	}
}

/** A workflow transition that the draft→submitted→approved→executed machine forbids. */
export class PaymentInvalidTransitionError extends AppError {
	constructor() {
		super(409, 'accounting.paymentInvalidTransition', 'That status change is not allowed for this payment');
	}
}

/** Only payments that have not been executed can be voided (F4 decision 4a). */
export class PaymentVoidNotAllowedError extends AppError {
	constructor() {
		super(
			409,
			'accounting.paymentVoidNotAllowed',
			'Executed payments cannot be voided here; correct through a period-end adjustment instead',
		);
	}
}

/** Σ allocations must equal the payment amount (keeps the JE balanced). */
export class PaymentAllocationMismatchError extends AppError {
	constructor() {
		super(
			422,
			'accounting.paymentAllocationMismatch',
			'Allocations must add up exactly to the payment amount',
		);
	}
}

/** An allocation exceeds the invoice's outstanding amount. */
export class PaymentOverAllocationError extends AppError {
	constructor() {
		super(422, 'accounting.paymentOverAllocation', 'Allocation exceeds the invoice outstanding amount');
	}
}

/** Allocations target invoices that are not issued (or already void/cancelled). */
export class PaymentTargetNotIssuedError extends AppError {
	constructor() {
		super(422, 'accounting.paymentTargetNotIssued', 'Allocations may only target issued or partially paid invoices');
	}
}

/** Executing requires the payment to carry a cash/bank account. */
export class PaymentCashAccountRequiredError extends AppError {
	constructor() {
		super(422, 'accounting.paymentCashAccountRequired', 'A cash/bank account is required to execute this payment');
	}
}

/** PPh withholding only on a supplier disbursement, with a PPh tax, below the amount (ERP-0140). */
export class PaymentWithholdingError extends AppError {
	constructor() {
		super(
			422,
			'payment.withholdingInvalid',
			'Withholding needs a supplier disbursement, a PPh tax and an amount below the payment',
		);
	}
}
