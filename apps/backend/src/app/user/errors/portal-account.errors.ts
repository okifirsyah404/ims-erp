import { AppError } from '@http/errors';

/** The customer is missing, inactive or archived (checked through CRM's contract). */
export class PortalCustomerUnavailableError extends AppError {
	constructor() {
		super(422, 'portal.customerUnavailable', 'The customer is missing or inactive');
	}
}

/** The contact already has a live portal login (one per person, owner decision D2). */
export class PortalAccountExistsError extends AppError {
	constructor() {
		super(409, 'portal.accountExists', 'This person already has a portal account');
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

/** Owner decision D1: only individuals sign up; a company is invited by staff. */
export class PortalBusinessSignupError extends AppError {
	constructor() {
		super(403, 'portal.businessByInvitation', 'Business accounts are created by invitation');
	}
}

/** Wrong, expired or used sign-up code (5 attempts per code). */
export class PortalInvalidCodeError extends AppError {
	constructor() {
		super(400, 'portal.invalidCode', 'Invalid or expired code');
	}
}

/** Managing members is the owner's job (owner decision D2). */
export class PortalOwnerOnlyError extends AppError {
	constructor() {
		super(403, 'portal.ownerOnly', 'Only an owner can manage members');
	}
}

export class PortalRemoveSelfError extends AppError {
	constructor() {
		super(422, 'portal.removeSelf', 'You cannot remove your own access');
	}
}

/** The contact does not exist or belongs to another customer. */
export class PortalContactUnavailableError extends AppError {
	constructor() {
		super(422, 'portal.contactUnavailable', 'The contact is missing or belongs to another customer');
	}
}
