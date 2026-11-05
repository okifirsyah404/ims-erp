/**
 * Domain errors surfaced by the organization service.
 *
 * @remarks
 * Each error carries a locale **key** (`ApiKey`) rather than translated prose.
 * The service layer has no request context and must not know about
 * presentation; the controller resolves the key against the request's
 * `Accept-Language` before writing the response envelope.
 */
import { AppError } from '@http/errors';
import type { ApiKey } from '@providers/i18n/translator';
import type { TPatternProblem } from '../domain/document-number';

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

/** Document numbers need the company profile (its document code). */
export class CompanyProfileRequiredError extends AppError {
	constructor() {
		super(422, 'organization.companyProfileRequired', 'Fill in the company profile first');
	}
}

/** The document type has no numbering series. */
export class UnknownDocumentTypeError extends AppError {
	constructor() {
		super(404, 'numbering.unknownDocumentType', 'Unknown document type');
	}
}

/** A numbering pattern the owner typed is not valid (first problem reported). */
export class NumberingPatternError extends AppError {
	constructor(problem: TPatternProblem) {
		super(
			422,
			`numbering.pattern.${problem.code}` as ApiKey,
			`Invalid numbering pattern: ${problem.code}`,
			problem.params,
		);
	}
}

/**
 * The deployment serves one company with one organization (ADR-0012): a
 * second one cannot be created or restored next to the live one.
 */
export class SingleOrganizationError extends AppError {
	constructor() {
		super(409, 'organization.singleCompany', 'Only one organization is allowed');
	}
}
