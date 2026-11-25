/**
 * Employee advance and settlement errors (ERP-0144).
 */
import { AppError } from '@http/errors';

export class EmployeeAdvanceNotFoundError extends AppError {
	constructor() {
		super(404, 'accounting.advanceNotFound', 'Employee advance not found');
	}
}

export class ExpenseSettlementNotFoundError extends AppError {
	constructor() {
		super(404, 'accounting.settlementNotFound', 'Expense settlement not found');
	}
}

/** The advance or settlement is not in a state that allows the action. */
export class AdvanceStateError extends AppError {
	constructor(from: string, to: string) {
		super(409, 'accounting.advanceTransition', `Cannot move from ${from} to ${to}`, { from, to });
	}
}

/** Maker-checker: the same user may not take two consecutive steps. */
export class AdvanceSameActorError extends AppError {
	constructor() {
		super(403, 'accounting.advanceSameActor', 'A different user must take this step');
	}
}

/** A settlement needs a disbursed advance without another open settlement. */
export class SettlementAdvanceError extends AppError {
	constructor() {
		super(422, 'accounting.settlementAdvanceInvalid', 'The advance must be disbursed and have no other open settlement');
	}
}
