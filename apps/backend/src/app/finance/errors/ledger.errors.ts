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

// ADR-0024: the payment ledger lives in the payment module, and it owns its own
// domain errors. Accounting does not re-export them (errors never cross a
// module boundary); this file keeps only Accounting's errors.

/** The AR/AP open-item mirror a settlement expects is missing (ledger drift). */
export class OpenItemNotFoundError extends AppError {
	constructor() {
		super(409, 'accounting.openItemNotFound', 'The open-item sub-ledger row for this document is missing');
	}
}

/* ----------------------------- supplier bills (F5) ----------------------------- */

export class BillNotFoundError extends AppError {
	constructor() {
		super(404, 'accounting.billNotFound', 'Supplier bill not found');
	}
}

/** The action requires a draft bill (record, cancel). */
export class BillNotDraftError extends AppError {
	constructor() {
		super(409, 'accounting.billNotDraft', 'Only draft supplier bills can be modified or recorded');
	}
}

/** The purchase order has nothing received to bill (ERP-0012). */
export class BillOrderNotBillableError extends AppError {
	constructor() {
		super(422, 'accounting.billOrderNotBillable', 'Only a purchase order that received goods can be billed');
	}
}

/** A bill line that is unknown, repeated, or over what was received and not yet billed (ERP-0012). */
export class BillLineError extends AppError {
	constructor(kind: 'unknown' | 'duplicate' | 'over', line: number) {
		super(422, `accounting.billLine.${kind}` as const, `Line ${line}: ${kind}`, { line });
	}
}

/* ----------------------------- bank reconciliation (F6) ----------------------------- */

export class BankReconciliationNotFoundError extends AppError {
	constructor() {
		super(404, 'accounting.bankReconciliationNotFound', 'Bank reconciliation not found');
	}
}

/** The reconciliation workflow refused the transition or closing condition. */
export class BankReconciliationStateError extends AppError {
	constructor(detail?: string) {
		super(
			409,
			'accounting.bankReconciliationState',
			detail
				? `That reconciliation action is not allowed: ${detail}`
				: 'That reconciliation action is not allowed for this document',
		);
	}
}

/* ----------------------------- reports (F6) ----------------------------- */

export class ReportPeriodInvalidError extends AppError {
	constructor() {
		super(422, 'accounting.reportPeriodInvalid', 'Report date range is invalid');
	}
}

/* ----------------------------- report archive (M12 T30) ----------------------------- */

export class ReportArchiveNotFoundError extends AppError {
	constructor() {
		super(404, 'accounting.reportArchiveNotFound', 'Report archive not found');
	}
}

/**
 * Archiving requires a closed or locked period.
 *
 * @remarks
 * Archiving an open month would freeze numbers that still move, and a frozen
 * statement is exactly what SOP S13 promises the owner. Reopening a period
 * unlocks the re-archive instead.
 */
export class ReportArchivePeriodOpenError extends AppError {
	constructor(periodYear: number, periodMonth: number) {
		super(
			409,
			'accounting.reportArchivePeriodOpen',
			`Period ${periodYear}-${String(periodMonth).padStart(2, '0')} is still open; close it before archiving`,
		);
	}
}

/** The employee payee account does not exist or belongs to an employee the caller does not see (ERP-0119). */
export class EmployeeBankAccountNotFoundError extends AppError {
	constructor() {
		super(404, 'accounting.employeeBankAccountNotFound', 'Employee bank account not found');
	}
}

/** The employee does not exist or is outside the caller's scope (ERP-0119). */
export class EmployeeNotVisibleError extends AppError {
	constructor() {
		super(404, 'accounting.employeeNotFound', 'Employee not found');
	}
}
