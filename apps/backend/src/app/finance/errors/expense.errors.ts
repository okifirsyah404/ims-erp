/**
 * Expense-claim domain errors (ERP-0013).
 *
 * @remarks
 * Each extends {@link AppError}; keys resolve through
 * `@providers/i18n/translator` from the `api` namespace.
 */
import { AppError } from '@http/errors';

export class ExpenseClaimNotFoundError extends AppError {
	constructor() {
		super(404, 'accounting.expenseClaimNotFound', 'Expense claim not found');
	}
}

/** Only a draft (or a reopened rejected) claim can be edited. */
export class ExpenseClaimNotDraftError extends AppError {
	constructor() {
		super(
			409,
			'accounting.expenseClaimNotDraft',
			'Only a draft or rejected expense claim can be modified',
		);
	}
}

/** A claim cannot be submitted without at least one line. */
export class ExpenseClaimEmptyError extends AppError {
	constructor() {
		super(
			422,
			'accounting.expenseClaimEmpty',
			'An expense claim needs at least one line to be submitted',
		);
	}
}

/** The state machine refused the transition for the claim's current status. */
export class ExpenseClaimTransitionError extends AppError {
	constructor(from: string, to: string) {
		super(
			409,
			'accounting.expenseClaimInvalidTransition',
			`An expense claim cannot go from ${from} to ${to}`,
		);
	}
}

/** `category_code` is not an active, postable expense account. */
export class ExpenseClaimAccountError extends AppError {
	constructor(code: string) {
		super(
			422,
			'accounting.expenseClaimAccountInvalid',
			`${code} is not an active, postable expense account`,
			{ code },
		);
	}
}

/** The employee is missing or terminated (HR contract check). */
export class ExpenseClaimEmployeeError extends AppError {
	constructor() {
		super(
			422,
			'accounting.expenseClaimEmployeeInvalid',
			'The employee is missing or no longer active',
		);
	}
}
