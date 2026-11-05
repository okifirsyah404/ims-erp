import { AppError } from '@http/errors';

/** The quotation does not exist, is archived, or is not visible to the caller. */
export class QuotationNotFoundError extends AppError {
	constructor() {
		super(404, 'sales.quotationNotFound', 'Quotation not found');
	}
}

/** The customer is missing or inactive. */
export class QuotationCustomerUnavailableError extends AppError {
	constructor() {
		super(422, 'sales.customerUnavailable', 'Customer not found or inactive');
	}
}

/** The contact is not a live contact of the chosen customer. */
export class QuotationContactInvalidError extends AppError {
	constructor() {
		super(422, 'sales.contactInvalid', 'The contact does not belong to this customer');
	}
}

/** The referenced lead does not exist. */
export class QuotationLeadNotFoundError extends AppError {
	constructor() {
		super(422, 'sales.leadNotFound', 'Lead not found');
	}
}

/** A line references a missing, archived or inactive item. */
export class QuotationItemUnavailableError extends AppError {
	constructor(line: number) {
		super(422, 'sales.itemUnavailable', `Line ${line}: item not found or inactive`, { line });
	}
}

/** A line discount is larger than the line itself. */
export class QuotationDiscountTooLargeError extends AppError {
	constructor(line: number) {
		super(422, 'sales.discountTooLarge', `Line ${line}: the discount exceeds the line amount`, { line });
	}
}

/** The transition does not start from the status the quotation is in (also races). */
export class QuotationStateError extends AppError {
	constructor(
		kind: 'notDraft' | 'notSubmitted' | 'notApproved' | 'notOpen' | 'revisionOfDraft' | 'notLatest' | 'won',
	) {
		super(kind === 'won' ? 409 : 422, `sales.quotationState.${kind}` as const, `Quotation state: ${kind}`);
	}
}

/** The creator may never approve or reject their own quotation. */
export class QuotationSelfApprovalError extends AppError {
	constructor() {
		super(403, 'sales.selfApproval', 'Self-approval is not allowed');
	}
}
