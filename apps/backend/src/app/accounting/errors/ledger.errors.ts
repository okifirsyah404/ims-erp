/**
 * Ledger domain errors (M09 Stage 1, finance plan F2).
 *
 * @remarks
 * Each extends {@link AppError}, so the shared `onError` arm in
 * `@http/plugin` maps it. Keys resolve through `@providers/i18n/translator`.
 */
import { AppError } from '@http/errors';

export class AccountNotFoundError extends AppError {
	constructor() {
		super(404, 'accounting.accountNotFound', 'Chart of account not found');
	}
}

export class AccountCodeTakenError extends AppError {
	constructor() {
		super(409, 'accounting.accountCodeTaken', 'Account code already exists');
	}
}

export class AccountInUseError extends AppError {
	constructor() {
		super(409, 'accounting.accountInUse', 'Account is still referenced and cannot be deactivated');
	}
}

export class AccountNotPostableError extends AppError {
	constructor() {
		super(
			422,
			'accounting.accountNotPostable',
			'Journal lines require a postable account',
		);
	}
}

export class AccountInactiveError extends AppError {
	constructor() {
		super(422, 'accounting.accountInactive', 'Account is inactive');
	}
}

export class PeriodNotFoundError extends AppError {
	constructor() {
		super(404, 'accounting.periodNotFound', 'Accounting period not found');
	}
}

export class PeriodTakenError extends AppError {
	constructor() {
		super(409, 'accounting.periodTaken', 'An accounting period for this month already exists');
	}
}

/** Posting with an entry date whose period is closed or locked. */
export class PeriodLockedError extends AppError {
	constructor() {
		super(
			409,
			'accounting.periodLocked',
			'The accounting period for this date is closed',
		);
	}
}

/** A period transition (close/reopen) the state machine does not allow. */
export class PeriodTransitionError extends AppError {
	constructor() {
		super(
			409,
			'accounting.periodTransition',
			'That status change is not allowed for this period',
		);
	}
}

export class JournalEntryNotFoundError extends AppError {
	constructor() {
		super(404, 'accounting.journalEntryNotFound', 'Journal entry not found');
	}
}

/** Debits and credits do not sum to the same total. */
export class JournalUnbalancedError extends AppError {
	constructor() {
		super(
			422,
			'accounting.journalUnbalanced',
			'Journal entry is not balanced: debits must equal credits',
		);
	}
}

/** A journal line with neither, or both, of debit and credit positive. */
export class JournalLineSideError extends AppError {
	constructor() {
		super(
			422,
			'accounting.journalLineSide',
			'Each journal line must carry exactly one of debit or credit',
		);
	}
}

/** A posted entry with the same idempotency key already exists. */
export class JournalDuplicateError extends AppError {
	constructor() {
		super(
			409,
			'accounting.journalDuplicate',
			'A posted journal entry with this idempotency key already exists',
		);
	}
}

/** An entry is not in a state that accepts the requested action. */
export class JournalTransitionError extends AppError {
	constructor() {
		super(
			409,
			'accounting.journalTransition',
			'That status change is not allowed for this journal entry',
		);
	}
}

/** The entry was already reversed (reversal is once-only). */
export class JournalAlreadyReversedError extends AppError {
	constructor() {
		super(409, 'accounting.journalAlreadyReversed', 'Journal entry has already been reversed');
	}
}

/** Reversal refused: the mirrored entry would fall in a locked period. */
export class ReversalPeriodLockedError extends AppError {
	constructor() {
		super(
			409,
			'accounting.reversalPeriodLocked',
			'The reversal would fall in a closed period; reopen it first',
		);
	}
}

/* ----------------------------- opening balances (F3) ----------------------------- */

/** The batch (or row) was already posted once; it is immutable now. */
export class OpeningBalanceAlreadyPostedError extends AppError {
	constructor() {
		super(
			409,
			'accounting.openingBalanceAlreadyPosted',
			'Opening balances were already posted and cannot be changed; correct through a journal reversal',
		);
	}
}

/** The requested opening-balance row (or batch) does not exist / is not draft. */
export class OpeningBalanceLockedError extends AppError {
	constructor() {
		super(
			404,
			'accounting.openingBalanceLocked',
			'Opening balance row not found or not editable',
		);
	}
}

/* ----------------------------- cash/bank (F3) ----------------------------- */

export class CashBankAccountNotFoundError extends AppError {
	constructor() {
		super(404, 'accounting.cashBankAccountNotFound', 'Cash/bank account not found');
	}
}

export class CashBankAccountCodeTakenError extends AppError {
	constructor() {
		super(409, 'accounting.cashBankAccountCodeTaken', 'Cash/bank account code already exists');
	}
}

export class CashBankAccountInactiveError extends AppError {
	constructor() {
		super(422, 'accounting.cashBankAccountInactive', 'Cash/bank account is inactive');
	}
}

/** Posting a cash/bank movement without a GL account link. */
export class CashBankLinkRequiredError extends AppError {
	constructor() {
		super(
			422,
			'accounting.cashBankLinkRequired',
			'Cash/bank account has no general-ledger account link; add one before posting movements',
		);
	}
}

export class CashBankTransactionNotFoundError extends AppError {
	constructor() {
		super(404, 'accounting.cashBankTransactionNotFound', 'Cash/bank transaction not found');
	}
}

/** Insufficient balance on a cash/bank account for an outgoing movement. */
export class CashBankInsufficientFundsError extends AppError {
	constructor() {
		super(
			422,
			'accounting.cashBankInsufficientFunds',
			'Insufficient balance on the cash/bank account',
		);
	}
}

/* ----------------------------- AR posting (F4) ----------------------------- */

/**
 * No active, postable account exists under the provisional default code for
 * the requested posting role (business gate for the final COA is pending).
 */
export class ArAccountNotConfiguredError extends AppError {
	constructor(code: string, role: string) {
		super(
			422,
			'accounting.arAccountNotConfigured',
			`No active account with code ${code} is configured for the ${role} posting role`,
		);
	}
}

/* ----------------------------- invoices (F4) ----------------------------- */

export class InvoiceNotFoundError extends AppError {
	constructor() {
		super(404, 'sales.invoiceNotFound', 'Invoice not found');
	}
}

/** The action requires a draft invoice (edits, cancellation, issue). */
export class InvoiceNotDraftError extends AppError {
	constructor() {
		super(409, 'sales.invoiceNotDraft', 'Only draft invoices can be modified or issued');
	}
}

/** An invoice cannot be issued without at least one line item. */
export class InvoiceNoItemsError extends AppError {
	constructor() {
		super(422, 'sales.invoiceNoItems', 'Invoices need at least one line item to be issued');
	}
}

/** Due date earlier than issue date. */
export class InvoiceDueBeforeIssueError extends AppError {
	constructor() {
		super(422, 'sales.invoiceDueBeforeIssue', 'Due date cannot be before the issue date');
	}
}

/* ----------------------------- payments (F4) ----------------------------- */

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

/** Only payments that have not been executed can be voided in F4 (decision 4a). */
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
