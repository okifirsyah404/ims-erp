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
