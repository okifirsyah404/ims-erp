/**
 * Domain errors surfaced by the organization service.
 *
 * @remarks
 * Each error carries a locale **key** (`ApiKey`) rather than translated prose.
 * The service layer has no request context and must not know about
 * presentation; the controller resolves the key against the request's
 * `Accept-Language` before writing the response envelope.
 */
import type { ApiKey } from '@providers/i18n/translator';

/** Organization lookup by id or slug failed in the auth gateway. */
export class OrganizationNotFoundError extends Error {
	readonly status = 404;
	readonly key: ApiKey = 'organization.notFound';
	constructor() {
		super('Organization not found');
		this.name = 'OrganizationNotFoundError';
	}
}

/** Last-organization guard: the final live organization cannot be deleted. */
export class LastOrganizationError extends Error {
	readonly status = 409;
	readonly key: ApiKey = 'organization.lastOrganization';
	constructor() {
		super('The last organization cannot be deleted');
		this.name = 'LastOrganizationError';
	}
}

/** Slug conflict on create/update (unique-slug constraint). */
export class OrganizationSlugTakenError extends Error {
	readonly status = 409;
	readonly key: ApiKey = 'organization.slugTaken';
	constructor() {
		super('Organization slug is already taken');
		this.name = 'OrganizationSlugTakenError';
	}
}

/** Soft-delete guard: the organization is already soft-deleted. */
export class OrganizationAlreadyDeletedError extends Error {
	readonly status = 409;
	readonly key: ApiKey = 'organization.alreadyDeleted';
	constructor() {
		super('Organization is already deleted');
		this.name = 'OrganizationAlreadyDeletedError';
	}
}

/** Soft-delete guard: the organization is not deleted, so restore is invalid. */
export class OrganizationNotDeletedError extends Error {
	readonly status = 409;
	readonly key: ApiKey = 'organization.notDeleted';
	constructor() {
		super('Organization is not deleted');
		this.name = 'OrganizationNotDeletedError';
	}
}

/** A member id/email did not resolve within the target organization. */
export class MemberNotFoundError extends Error {
	readonly status = 404;
	readonly key: ApiKey = 'organization.memberNotFound';
	constructor() {
		super('Member not found');
		this.name = 'MemberNotFoundError';
	}
}

/** Last-owner protection on role change / removal. */
export class LastOwnerError extends Error {
	readonly status = 409;
	readonly key: ApiKey = 'organization.lastOwner';
	constructor() {
		super('Cannot remove or demote the last owner');
		this.name = 'LastOwnerError';
	}
}

/**
 * The caller tried to grant an organization role above their own tier.
 *
 * @remarks
 * `owner` is never *granted* here (it is born with the organization); a
 * non-owner must not add or promote anyone to `owner`, and an org admin or
 * org HR must not hand out `admin`/`hr` respectively. The shared ladder lives
 * in `@ims-erp/common` (`assignableOrganizationRoles`), so the member-edit
 * checkboxes and this guard agree.
 */
export class MemberRoleNotAssignableError extends Error {
	readonly status = 403;
	readonly key: ApiKey = 'organization.roleNotAssignable';
	constructor(readonly roles: readonly string[]) {
		super(`Role not assignable: ${roles.join(', ')}`);
		this.name = 'MemberRoleNotAssignableError';
	}
}

