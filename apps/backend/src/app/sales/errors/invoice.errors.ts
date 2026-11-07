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
