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

/* -------------------- GL foundation (ERP-0127..0130) -------------------- */

/** No active posting rule resolves a role for a business event (ERP-0128). */
export class PostingRuleNotFoundError extends AppError {
	constructor(eventType: string, role: string) {
		super(
			422,
			'accounting.postingRuleNotFound',
			`No active posting rule maps role ${role} for event ${eventType}`,
		);
	}
}

export class PostingRuleNotFoundByIdError extends AppError {
	constructor() {
		super(404, 'accounting.postingRuleMissing', 'Posting rule not found');
	}
}

/** A rule with the same event, role and discriminator already exists. */
export class PostingRuleScopeTakenError extends AppError {
	constructor() {
		super(
			409,
			'accounting.postingRuleScopeTaken',
			'A posting rule for this event, role and discriminator already exists',
		);
	}
}

export class CostCenterNotFoundError extends AppError {
	constructor() {
		super(404, 'accounting.costCenterNotFound', 'Cost centre not found');
	}
}

export class CostCenterInactiveError extends AppError {
	constructor() {
		super(422, 'accounting.costCenterInactive', 'Cost centre is inactive');
	}
}

export class CostCenterCodeTakenError extends AppError {
	constructor() {
		super(409, 'accounting.costCenterCodeTaken', 'Cost centre code already exists');
	}
}

/** Maker-checker: the preparer of a manual journal cannot approve it. */
export class JournalSelfApprovalError extends AppError {
	constructor() {
		super(
			403,
			'accounting.journalSelfApproval',
			'The preparer of a journal entry cannot approve it',
		);
	}
}

/** Type, normal balance and postable flag freeze once an account has postings. */
export class AccountLockedError extends AppError {
	constructor() {
		super(
			409,
			'accounting.accountLocked',
			'The account already has postings: its type, normal balance and postable flag cannot change',
		);
	}
}

export class AccountBalanceNotZeroError extends AppError {
	constructor() {
		super(
			409,
			'accounting.accountBalanceNotZero',
			'Only an account with a zero balance can be deactivated',
		);
	}
}

/** Locking a period with journals still in draft/submitted. */
export class PeriodLockBlockedError extends AppError {
	constructor(pendingJournals: number) {
		super(
			409,
			'accounting.periodLockBlocked',
			`The period still has ${pendingJournals} unposted journal entries`,
		);
	}
}

/** No open period exists after the original entry to carry its reversal. */
export class NoOpenPeriodForReversalError extends AppError {
	constructor() {
		super(
			409,
			'accounting.noOpenPeriodForReversal',
			'No open accounting period exists to carry the reversal',
		);
	}
}

/* ------------------------- AR postings (ERP-0135) ------------------------- */

export class CreditMemoNotFoundError extends AppError {
	constructor() {
		super(404, 'accounting.creditMemoNotFound', 'Credit memo not found');
	}
}

export class CreditMemoTransitionError extends AppError {
	constructor() {
		super(409, 'accounting.creditMemoTransition', 'That status change is not allowed for this credit memo');
	}
}

/** The invoice is not issued, or the credit exceeds what is still open. */
export class CreditMemoAmountError extends AppError {
	constructor() {
		super(
			422,
			'accounting.creditMemoAmount',
			'A credit memo needs an issued invoice and cannot exceed its open amount',
		);
	}
}

export class WriteOffNotAllowedError extends AppError {
	constructor() {
		super(
			409,
			'accounting.writeOffNotAllowed',
			'Only an open receivable without a pending request can be written off',
		);
	}
}

export class WriteOffNotRequestedError extends AppError {
	constructor() {
		super(409, 'accounting.writeOffNotRequested', 'No write-off request is pending for this receivable');
	}
}

/** Maker-checker on write-offs: the requester cannot approve. */
export class WriteOffSelfApprovalError extends AppError {
	constructor() {
		super(403, 'accounting.writeOffSelfApproval', 'The requester of a write-off cannot approve it');
	}
}

/** Locking a period while deferred revenue is not amortised through it. */
export class DeferredRevenuePendingError extends AppError {
	constructor(pending: number) {
		super(
			409,
			'accounting.deferredRevenuePending',
			`${pending} deferred revenue schedules are not amortised through this period`,
		);
	}
}

/* ------------------------- gateway settlement (ERP-0139) ------------------------- */

/** Gross must be positive and larger than the fee. */
export class GatewaySettlementAmountError extends AppError {
	constructor() {
		super(
			422,
			'accounting.gatewaySettlementAmount',
			'A settlement needs a positive gross amount larger than the fee',
		);
	}
}

export class TaxPaymentAmountError extends AppError {
	constructor() {
		super(422, 'accounting.taxPaymentAmount', 'A tax payment needs a positive amount');
	}
}

/** A sub-ledger's opening total differs from its control account (ERP-0142). */
export class OpeningSubledgerMismatchError extends AppError {
	constructor(params: { ledger: string; subledger: number; control: number }) {
		super(422, 'accounting.openingSubledgerMismatch', 'The sub-ledger opening total differs from its control account', params);
	}
}

/** Sub-ledger rows carry another as-of date than the opening batch (ERP-0142). */
export class OpeningSubledgerDateError extends AppError {
	constructor(params: { itemDate: string; batchDate: string }) {
		super(422, 'accounting.openingSubledgerDate', 'Sub-ledger opening rows must share the batch as-of date', params);
	}
}

/** The ledger's opening detail was already posted (ERP-0142). */
export class OpeningSubledgerPostedError extends AppError {
	constructor() {
		super(409, 'accounting.openingSubledgerPosted', 'This ledger already has posted opening detail');
	}
}

/** A sub-ledger import file was rejected before its rows were read (ERP-0142). */
export class OpeningSubledgerFileError extends AppError {
	constructor(kind: 'type' | 'size' | 'empty' | 'tooMany') {
		const messages = {
			type: 'Upload a .csv file',
			size: 'The file is larger than 2 MB',
			empty: 'The file has no data rows',
			tooMany: 'The file has more than 5000 rows',
		};
		super(422, `accounting.openingSubledgerFile.${kind}` as const, messages[kind]);
	}
}
