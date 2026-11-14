import { AppError } from '@http/errors';

/** The customer is missing, inactive or archived (checked through CRM's contract). */
export class PortalCustomerUnavailableError extends AppError {
	constructor() {
		super(422, 'portal.customerUnavailable', 'The customer is missing or inactive');
	}
}

/** The customer already has a live portal login (one per customer, owner decision 2026-11-14). */
export class PortalAccountExistsError extends AppError {
	constructor() {
		super(409, 'portal.accountExists', 'This customer already has a portal account');
	}
}

/** The email already belongs to a staff login or to another customer's portal login. */
export class PortalEmailTakenError extends AppError {
	constructor() {
		super(409, 'portal.emailTaken', 'This email already belongs to another account');
	}
}

export class PortalAccountNotFoundError extends AppError {
	constructor() {
		super(404, 'portal.accountNotFound', 'Portal account not found');
	}
}

/** Links point at the customer portal; without PORTAL_URL no link can be sent. */
export class PortalNotConfiguredError extends AppError {
	constructor() {
		super(503, 'portal.notConfigured', 'The customer portal URL is not configured');
	}
}
