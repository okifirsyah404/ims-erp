import { AppError } from '@http/errors';

export class SalesReturnNotFoundError extends AppError {
	constructor() {
		super(404, 'sales.salesReturnNotFound', 'Sales return not found');
	}
}

/** The delivery note is missing or was not shipped. */
export class SalesReturnDeliveryError extends AppError {
	constructor() {
		super(422, 'sales.returnDelivery', 'Goods can only be returned from a shipped delivery note');
	}
}

/** Goods cannot come back without a warehouse to receive them (ADR-0014: the link is nullable). */
export class SalesReturnWarehouseRequiredError extends AppError {
	constructor() {
		super(422, 'sales.returnWarehouseRequired', 'The sales return needs a warehouse to receive the goods');
	}
}

/**
 * A return line that is unknown, not a stock item, more than is still
 * returnable, repeated, or whose serials are wrong.
 */
export class SalesReturnLineError extends AppError {
	constructor(kind: 'unknown' | 'notStock' | 'over' | 'duplicate' | 'serials' | 'notSold', line: number) {
		super(422, `sales.returnLine.${kind}` as const, `Line ${line}: ${kind}`, { line });
	}
}

/** A transition that does not start from the return's status (also races). */
export class SalesReturnStateError extends AppError {
	constructor(kind: 'notDraft' | 'notSubmitted' | 'notApproved' | 'notCancellable') {
		super(422, `sales.returnState.${kind}` as const, `Sales return state: ${kind}`);
	}
}

export class SalesReturnSelfApprovalError extends AppError {
	constructor() {
		super(403, 'sales.returnSelfApproval', 'You cannot approve or reject your own sales return');
	}
}

export class SalesReturnCodeTakenError extends AppError {
	constructor(code: string) {
		super(409, 'sales.returnCodeTaken', `Return number ${code} is already used`, { code });
	}
}

/** Receiving must give every line a condition, and storages of the return's warehouse. */
export class SalesReturnReceiveError extends AppError {
	constructor(kind: 'lines' | 'bin') {
		super(422, `sales.returnReceive.${kind}` as const, `Receiving: ${kind}`);
	}
}
