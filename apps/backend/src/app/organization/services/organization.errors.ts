/** Domain errors surfaced by the organization service. */

export class OrganizationNotFoundError extends Error {
	readonly status = 404;
	constructor() {
		super('Organization not found');
		this.name = 'OrganizationNotFoundError';
	}
}

/** Single-organization invariant: an organization already exists. */
export class OrganizationAlreadyExistsError extends Error {
	readonly status = 422;
	constructor() {
		super('An organization already exists; only one is allowed');
		this.name = 'OrganizationAlreadyExistsError';
	}
}

export class OrganizationSlugTakenError extends Error {
	readonly status = 409;
	constructor() {
		super('Organization slug is already taken');
		this.name = 'OrganizationSlugTakenError';
	}
}

/** Soft-delete guard: the organization is already soft-deleted. */
export class OrganizationAlreadyDeletedError extends Error {
	readonly status = 409;
	constructor() {
		super('Organization is already deleted');
		this.name = 'OrganizationAlreadyDeletedError';
	}
}

export class OrganizationNotDeletedError extends Error {
	readonly status = 409;
	constructor() {
		super('Organization is not deleted');
		this.name = 'OrganizationNotDeletedError';
	}
}

export class MemberNotFoundError extends Error {
	readonly status = 404;
	constructor() {
		super('Member not found');
		this.name = 'MemberNotFoundError';
	}
}

/** Last-owner protection on role change / removal. */
export class LastOwnerError extends Error {
	readonly status = 409;
	constructor() {
		super('Cannot remove or demote the last owner');
		this.name = 'LastOwnerError';
	}
}
