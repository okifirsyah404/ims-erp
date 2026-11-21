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

/** The device (session) is gone or belongs to another login (ERP-0106). */
export class PortalDeviceNotFoundError extends AppError {
	constructor() {
		super(404, 'portal.deviceNotFound', 'That device is no longer signed in');
	}
}
