import { AppError } from '@http/errors';

/** The order does not exist, is archived, or is not visible to the caller. */
export class SalesOrderNotFoundError extends AppError {
	constructor() {
		super(404, 'sales.orderNotFound', 'Sales order not found');
	}
}

/** Only an approved or sent quotation becomes a sales order. */
export class SalesOrderQuotationNotReadyError extends AppError {
	constructor() {
		super(422, 'sales.orderQuotationNotReady', 'Only an approved or sent quotation can become a sales order');
	}
}

/** The quotation already has a live order (also the race between two). */
export class SalesOrderExistsError extends AppError {
	constructor() {
		super(409, 'sales.orderExists', 'This quotation already has a sales order');
	}
}

/** Only a confirmed order can be cancelled. */
export class SalesOrderNotCancellableError extends AppError {
	constructor() {
		super(422, 'sales.orderNotCancellable', 'Only a confirmed sales order can be cancelled');
	}
}
