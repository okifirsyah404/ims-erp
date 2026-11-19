import { AppError } from '@http/errors';

/** Wrong email or password — the same answer for an unknown email or a non-portal login. */
export class PortalInvalidCredentialsError extends AppError {
	constructor() {
		super(401, 'portal.invalidCredentials', 'Invalid email or password');
	}
}

/** Too many failed sign-ins for this email; the portal reads 423 as "locked". */
export class PortalLockedError extends AppError {
	constructor() {
		super(423, 'portal.locked', 'Too many failed sign-ins');
	}
}

export class PortalInvalidTokenError extends AppError {
	constructor() {
		super(400, 'portal.invalidToken', 'Invalid or expired link');
	}
}

export class PortalWrongPasswordError extends AppError {
	constructor() {
		super(400, 'portal.wrongPassword', 'The current password is wrong');
	}
}

export class PortalProjectNotFoundError extends AppError {
	constructor() {
		super(404, 'portal.projectNotFound', 'Project not found');
	}
}

export class PortalProductNotFoundError extends AppError {
	constructor() {
		super(404, 'portal.productNotFound', 'Device not found');
	}
}

/** Photos and files on tickets are not stored yet (stage 1). */
export class PortalAttachmentsUnsupportedError extends AppError {
	constructor() {
		super(422, 'portal.attachmentsUnsupported', 'Attachments are not supported yet');
	}
}

/** A malformed id in a portal URL: answered like an unknown record (the portal reads 404 as "not found"). */
export class PortalNotFoundError extends AppError {
	constructor() {
		super(404, 'common.notFound', 'Not found');
	}
}

/** The caller's portal role may not do this (e.g. a viewer placing an order, ERP-0070). */
export class PortalRoleForbiddenError extends AppError {
	constructor() {
		super(403, 'portal.roleForbidden', 'Your role in this account cannot do this');
	}
}

/** No orderable line, or the prices changed since the checkout quote (ERP-0070). */
export class PortalCheckoutChangedError extends AppError {
	constructor() {
		super(409, 'portal.checkoutChanged', 'Prices or availability changed. Please review your order again.');
	}
}
