import { AppError } from '@http/errors';

/** The application, contract or key does not exist. */
export class LicensingNotFoundError extends AppError {
	constructor(kind: 'application' | 'contract' | 'key') {
		const messages = { application: 'Application not found', contract: 'License contract not found', key: 'License key not found' };
		super(404, `licensing.notFound.${kind}` as const, messages[kind]);
	}
}

/** Another live application already uses this code. */
export class ApplicationCodeTakenError extends AppError {
	constructor() {
		super(409, 'licensing.applicationCodeTaken', 'Another application already uses this code');
	}
}

/** A contract's references do not fit (customer, application, sales order, dates). */
export class ContractInvalidError extends AppError {
	constructor(kind: 'customer' | 'application' | 'order' | 'dates' | 'startRequired') {
		const messages = {
			customer: 'The customer is missing or inactive',
			application: 'The application is missing or retired',
			order: 'The sales order is missing or belongs to another customer',
			dates: 'The end date is before the start date',
			startRequired: 'Set the start date before activating',
		};
		super(422, `licensing.contract.${kind}` as const, messages[kind]);
	}
}

/** The contract is not in the state the action needs. */
export class ContractStateError extends AppError {
	constructor(action: 'edit' | 'activate' | 'suspend' | 'reactivate' | 'terminate' | 'renew' | 'keys') {
		const messages = {
			edit: 'Only a draft contract can be edited',
			activate: 'Only a draft contract can be activated',
			suspend: 'Only an active contract can be suspended',
			reactivate: 'Only a suspended contract can be reactivated',
			terminate: 'This contract is already terminated or renewed',
			renew: 'Only an active contract can be renewed, once',
			keys: 'Keys can only be added to a draft, active or suspended contract',
		};
		super(422, `licensing.state.${action}` as const, messages[action]);
	}
}

/** The key is missing for a third-party application, or already used. */
export class LicenseKeyError extends AppError {
	constructor(kind: 'required' | 'taken') {
		const messages = {
			required: 'Type the key from the vendor (third-party application)',
			taken: 'This license key is already registered',
		};
		super(kind === 'taken' ? 409 : 422, `licensing.key.${kind}` as const, messages[kind]);
	}
}
