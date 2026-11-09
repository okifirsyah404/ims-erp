import { AppError } from '@http/errors';

/** The requested invoice does not exist in this organization. */
export class InvoiceNotFoundError extends AppError {
	constructor() {
		super(404, 'sales.invoiceNotFound', 'Invoice not found');
	}
}

/** The action requires a draft invoice (edits, cancellation, issue). */
export class InvoiceNotDraftError extends AppError {
	constructor() {
		super(409, 'sales.invoiceNotDraft', 'Only draft invoices can be modified or issued');
	}
}

/** An invoice cannot be issued without at least one line item. */
export class InvoiceNoItemsError extends AppError {
	constructor() {
		super(422, 'sales.invoiceNoItems', 'Invoices need at least one line item to be issued');
	}
}

/** Due date earlier than issue date. */
export class InvoiceDueBeforeIssueError extends AppError {
	constructor() {
		super(422, 'sales.invoiceDueBeforeIssue', 'Due date cannot be before the issue date');
	}
}

/** The receipt does not exist or is archived. */
export class ReceiptNotFoundError extends AppError {
	constructor() {
		super(404, 'sales.receiptNotFound', 'Receipt not found');
	}
}

/** The receipt would overpay the invoice's outstanding amount. */
export class ReceiptExceedsOutstandingError extends AppError {
	constructor() {
		super(422, 'sales.receiptExceeds', 'The payment exceeds the outstanding amount');
	}
}

/** The receipt was already reversed. */
export class ReceiptAlreadyReversedError extends AppError {
	constructor() {
		super(422, 'sales.receiptReversed', 'The receipt is already reversed');
	}
}

/** The invoice is not in a payable state (must be issued / partially_paid). */
export class InvoiceNotPayableError extends AppError {
	constructor() {
		super(409, 'sales.invoiceNotPayable', 'Only issued or partially paid invoices can receive payments');
	}
}
