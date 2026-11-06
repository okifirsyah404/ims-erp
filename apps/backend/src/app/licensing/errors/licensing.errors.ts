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

/** The application's API key is missing, invalid or over its rate limit. */
export class LicenseApiAuthError extends AppError {
	constructor(kind: 'missing' | 'invalid' | 'rateLimited') {
		const messages = { missing: 'License API key required', invalid: 'Invalid license API key', rateLimited: 'Too many license API calls' };
		super(kind === 'rateLimited' ? 429 : 401, `licensing.api.${kind}` as const, messages[kind]);
	}
}

/** The license key may not be activated or released (machine API). */
export class LicenseRefusedError extends AppError {
	constructor(result: 'unknown' | 'expired' | 'not_started' | 'suspended' | 'terminated' | 'revoked' | 'seat_limit' | 'not_activated') {
		const messages = {
			unknown: 'Unknown license key',
			expired: 'The license has expired',
			not_started: 'The license is not active yet',
			suspended: 'The license is suspended',
			terminated: 'The license is terminated',
			revoked: 'The license key is revoked',
			seat_limit: 'Every activation of this key is in use',
			not_activated: 'This installation is not activated',
		};
		const status = result === 'unknown' || result === 'not_activated' ? 404 : result === 'seat_limit' ? 409 : 403;
		super(status, `licensing.refused.${result}` as const, messages[result], { result });
	}
}

/** API keys are for own applications, issued on behalf of the organization owner. */
export class ApiKeyIssueError extends AppError {
	constructor(kind: 'ownOnly' | 'noOwner' | 'notFound') {
		const messages = {
			ownOnly: 'API keys are only for the company’s own, active applications',
			noOwner: 'The organization has no owner to issue the key',
			notFound: 'API key not found',
		};
		super(kind === 'notFound' ? 404 : 422, `licensing.apiKey.${kind}` as const, messages[kind]);
	}
}

/** The activation does not exist on this contract or is already released. */
export class ActivationNotFoundError extends AppError {
	constructor() {
		super(404, 'licensing.activationNotFound', 'Activation not found or already released');
	}
}
