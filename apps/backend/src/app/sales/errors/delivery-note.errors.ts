import { AppError } from '@http/errors';

/** The delivery note does not exist or is archived. */
export class DeliveryNoteNotFoundError extends AppError {
	constructor() {
		super(404, 'sales.deliveryNoteNotFound', 'Delivery note not found');
	}
}

/** Only a confirmed or in-progress order can be delivered. */
export class DeliveryNoteOrderNotDeliverableError extends AppError {
	constructor() {
		super(422, 'sales.deliveryOrderNotDeliverable', 'Only a confirmed or in-progress sales order can be delivered');
	}
}

/** A line is unknown, over what is still open, or misses its serials. */
export class DeliveryNoteLineError extends AppError {
	constructor(kind: 'unknown' | 'over' | 'serials' | 'notInStock', line: number) {
		const messages = {
			unknown: `Line ${line}: not a line of this sales order`,
			over: `Line ${line}: more than is still open on the sales order`,
			serials: `Line ${line}: give one unique serial number per unit`,
			notInStock: `Line ${line}: a serial number is not in stock in this warehouse`,
		};
		super(422, `sales.deliveryLine.${kind}` as const, messages[kind], { line });
	}
}

/** The storage does not belong to the chosen warehouse. */
export class DeliveryNoteBinError extends AppError {
	constructor() {
		super(422, 'sales.deliveryBin', 'The storage does not belong to this warehouse');
	}
}

/** The note is not in the state the action needs. */
export class DeliveryNoteStateError extends AppError {
	constructor(action: 'ship' | 'deliver' | 'cancel') {
		const messages = {
			ship: 'Only a prepared delivery note can be shipped',
			deliver: 'Only a shipped delivery note can be marked delivered',
			cancel: 'Only a prepared delivery note can be cancelled',
		};
		super(422, `sales.deliveryState.${action}` as const, messages[action]);
	}
}

/** An order with live delivery notes cannot be cancelled. */
export class SalesOrderDeliveredError extends AppError {
	constructor() {
		super(422, 'sales.orderDelivered', 'This sales order has delivery notes; cancel them before cancelling the order');
	}
}

/** Reading delivery notes needs `stock:read` or `sales_order:read`. */
export class DeliveryNoteReadForbiddenError extends AppError {
	constructor() {
		super(403, 'sales.deliveryReadForbidden', 'You may not read delivery notes');
	}
}
