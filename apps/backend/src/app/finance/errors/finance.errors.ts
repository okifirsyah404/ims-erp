import { AppError } from '@http/errors';
import type { TTermProblem } from '../utils/invoice-terms';

/** The invoice does not exist or is archived. */
export class InvoiceNotFoundError extends AppError {
	constructor() {
		super(404, 'finance.invoiceNotFound', 'Invoice not found');
	}
}

/** The receipt does not exist or is archived. */
export class ReceiptNotFoundError extends AppError {
	constructor() {
		super(404, 'finance.receiptNotFound', 'Receipt not found');
	}
}

/** The sales order is missing or cancelled. */
export class InvoiceOrderUnavailableError extends AppError {
	constructor() {
		super(422, 'finance.orderUnavailable', 'The sales order is not found or is cancelled');
	}
}

/** The requested term cannot be billed. */
export class InvoiceTermError extends AppError {
	constructor(problem: TTermProblem) {
		super(422, `finance.term.${problem}` as const, `Invoice term: ${problem}`);
	}
}

/** A transition that does not start from the invoice's status (also races). */
export class InvoiceStateError extends AppError {
	constructor(kind: 'notDraft' | 'notVoidable' | 'notPayable') {
		super(422, `finance.invoiceState.${kind}` as const, `Invoice state: ${kind}`);
	}
}

/** A payment larger than what is still outstanding. */
export class ReceiptExceedsOutstandingError extends AppError {
	constructor() {
		super(422, 'finance.receiptExceeds', 'The payment exceeds the outstanding amount');
	}
}

/** The receipt was already reversed. */
export class ReceiptAlreadyReversedError extends AppError {
	constructor() {
		super(422, 'finance.receiptReversed', 'The receipt is already reversed');
	}
}

/** The due date lies before the issue date. */
export class InvoiceDueBeforeIssueError extends AppError {
	constructor() {
		super(422, 'finance.dueBeforeIssue', 'The due date cannot be before the issue date');
	}
}
