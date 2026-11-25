/**
 * Project budget errors (ERP-0146).
 */
import { AppError } from '@http/errors';

export class ProjectBudgetNotFoundError extends AppError {
	constructor() {
		super(404, 'accounting.budgetNotFound', 'Project budget not found');
	}
}

export class ProjectBudgetProjectError extends AppError {
	constructor() {
		super(404, 'accounting.budgetProjectNotFound', 'Project not found in this organization');
	}
}

export class ProjectBudgetStateError extends AppError {
	constructor(kind: 'draftExists' | 'notDraft' | 'duplicateLine') {
		const messages = {
			draftExists: 'This project already has a draft budget version',
			notDraft: 'Only a draft budget version can be changed',
			duplicateLine: 'An account appears twice for the same month',
		};
		super(409, `accounting.budget.${kind}` as const, messages[kind]);
	}
}

/** Blocking budget: the action would take the project over its budget. */
export class ProjectBudgetExceededError extends AppError {
	constructor(available: number) {
		super(422, 'accounting.budgetExceeded', 'This would exceed the project budget', { available });
	}
}
