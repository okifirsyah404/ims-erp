/**
 * Lead domain errors (the project module's lead pipeline and website inquiries).
 *
 * @remarks
 * Each extends {@link AppError} so the shared `onError` arm in
 * `@http/plugin` maps it; keys resolve through `@providers/i18n/translator`.
 */
import { AppError } from '@http/errors';

/** The lead does not exist, is archived, or is not visible to the caller. */
export class LeadNotFoundError extends AppError {
	constructor() {
		super(404, 'crm.leadNotFound', 'Lead not found');
	}
}

/** A converted (`won`) lead is closed: no edits, no status change. */
export class LeadClosedError extends AppError {
	constructor() {
		super(422, 'crm.leadClosed', 'A converted lead can no longer be changed');
	}
}

/** The lead was already converted (also the race between two conversions). */
export class LeadAlreadyConvertedError extends AppError {
	constructor() {
		super(409, 'crm.leadAlreadyConverted', 'Lead is already converted');
	}
}

/** A lost lead must be reopened before it can be converted. */
export class LeadLostError extends AppError {
	constructor() {
		super(422, 'crm.leadLostReopenFirst', 'Reopen a lost lead before converting it');
	}
}

/** Assigning needs `lead:assign`. */
export class LeadAssignForbiddenError extends AppError {
	constructor() {
		super(403, 'crm.leadAssignForbidden', 'Only managers can assign leads');
	}
}

/** The assignee is not a member of the caller's organization with lead access. */
export class LeadAssigneeInvalidError extends AppError {
	constructor() {
		super(422, 'crm.leadAssigneeInvalid', 'Assignee must be a member with access to leads');
	}
}

/** Conversion target customer is missing or inactive. */
export class LeadCustomerUnavailableError extends AppError {
	constructor() {
		super(422, 'crm.leadCustomerUnavailable', 'Customer not found or inactive');
	}
}

/** The attachment is not on this lead. */
export class LeadAttachmentNotFoundError extends AppError {
	constructor() {
		super(404, 'crm.attachmentNotFound', 'Attachment not found');
	}
}

/** A website submission that breaks the attachment or payload rules. */
export class WebsiteInquiryError extends AppError {
	constructor(kind: 'tooManyFiles' | 'fileTooLarge' | 'fileType' | 'badPayload', params?: { max: number }) {
		super(
			kind === 'fileTooLarge' ? 413 : kind === 'badPayload' ? 400 : 422,
			`publicApi.${kind}` as const,
			`Website inquiry rejected: ${kind}`,
			params,
		);
	}
}
