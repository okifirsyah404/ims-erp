/**
 * CRM domain errors.
 *
 * @remarks
 * Each extends {@link AppError} so the shared `onError` arm in
 * `@http/plugin` maps it; keys resolve through `@providers/i18n/translator`.
 */
import { AppError } from '@http/errors';

/** The customer does not exist (or is archived). */
export class CustomerNotFoundError extends AppError {
	constructor() {
		super(404, 'crm.customerNotFound', 'Customer not found');
	}
}

/** A live customer already uses this code. */
export class CustomerCodeTakenError extends AppError {
	constructor(code: string) {
		super(409, 'crm.customerCodeTaken', `Customer code ${code} is already used`, { code });
	}
}

/** The requested status change does not apply (already in that status). */
export class CustomerStatusUnchangedError extends AppError {
	constructor(status: 'active' | 'inactive') {
		super(
			422,
			status === 'active' ? 'crm.customerAlreadyActive' : 'crm.customerAlreadyInactive',
			`Customer is already ${status}`,
		);
	}
}

/** The address names a village that does not exist. */
export class VillageNotFoundError extends AppError {
	constructor() {
		super(422, 'crm.villageNotFound', 'Village (kelurahan/desa) not found');
	}
}

/** The contact does not exist on this customer. */
export class CustomerContactNotFoundError extends AppError {
	constructor() {
		super(404, 'crm.contactNotFound', 'Contact not found');
	}
}

/** The address (site) is not the customer's or was removed (ERP-0075). */
export class CustomerAddressNotFoundError extends AppError {
	constructor() {
		super(404, 'crm.addressNotFound', 'Site not found');
	}
}

/** Too many installation sites on one customer (ERP-0075). */
export class CustomerSiteLimitError extends AppError {
	constructor(max: number) {
		super(422, 'crm.siteLimit', `At most ${max} sites per customer`, { max });
	}
}

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

/** The portal change request matches the current company data (ERP-0076). */
export class CustomerChangeUnchangedError extends AppError {
	constructor() {
		super(422, 'crm.changeUnchanged', 'Nothing to change');
	}
}

/** The change request is not the customer's pending one (decided, superseded or unknown; ERP-0076). */
export class CustomerChangeNotPendingError extends AppError {
	constructor() {
		super(409, 'crm.changeNotPending', 'This request is no longer pending');
	}
}

/** An individual customer has no company data to change (ERP-0076). */
export class CustomerChangeNotCompanyError extends AppError {
	constructor() {
		super(422, 'crm.changeNotCompany', 'Only business accounts have company data');
	}
}
