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

/**
 * Online ordering has no salesperson to own the SPH: the customer has no
 * account manager and `sales / online_order_owner_user_id` is not set to an
 * active user (ERP-0070).
 */
export class OnlineOrderNotConfiguredError extends AppError {
	constructor() {
		super(503, 'sales.onlineOrderNotConfigured', 'Online ordering is not configured');
	}
}

/** The SPH is not waiting for the customer's answer (it must be `sent`). */
export class QuotationNotAwaitingCustomerError extends AppError {
	constructor() {
		super(409, 'sales.quotationNotAwaitingCustomer', 'This quotation is not waiting for your answer');
	}
}
