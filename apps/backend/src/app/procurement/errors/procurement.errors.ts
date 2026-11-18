import { AppError } from '@http/errors';

export class SupplierNotFoundError extends AppError {
	constructor() {
		super(404, 'procurement.supplierNotFound', 'Supplier not found');
	}
}

export class SupplierCodeTakenError extends AppError {
	constructor(code: string) {
		super(409, 'procurement.supplierCodeTaken', `Supplier code ${code} is already used`, { code });
	}
}

export class SupplierStatusUnchangedError extends AppError {
	constructor(status: 'active' | 'inactive') {
		super(
			422,
			status === 'active' ? 'procurement.supplierAlreadyActive' : 'procurement.supplierAlreadyInactive',
			`Supplier is already ${status}`,
		);
	}
}

export class SupplierVillageNotFoundError extends AppError {
	constructor() {
		super(422, 'procurement.villageNotFound', 'Village not found');
	}
}

export class PurchaseOrderNotFoundError extends AppError {
	constructor() {
		super(404, 'procurement.purchaseOrderNotFound', 'Purchase order not found');
	}
}

/** The supplier of a new PO is missing or inactive. */
export class PurchaseOrderSupplierUnavailableError extends AppError {
	constructor() {
		super(422, 'procurement.supplierUnavailable', 'Supplier not found or inactive');
	}
}

export class PurchaseOrderItemUnavailableError extends AppError {
	constructor(line: number) {
		super(422, 'procurement.itemUnavailable', `Line ${line}: item not found or inactive`, { line });
	}
}

/** A transition that does not start from the PO's status (also races). */
export class PurchaseOrderStateError extends AppError {
	constructor(kind: 'notDraft' | 'notSubmitted' | 'notApproved' | 'notCancellable' | 'received') {
		super(422, `procurement.poState.${kind}` as const, `Purchase order state: ${kind}`);
	}
}

export class PurchaseOrderSelfApprovalError extends AppError {
	constructor() {
		super(403, 'procurement.selfApproval', 'You cannot approve or reject your own purchase order');
	}
}

export class PurchaseOrderCodeTakenError extends AppError {
	constructor(code: string) {
		super(409, 'procurement.poCodeTaken', `PO number ${code} is already used`, { code });
	}
}

export class GoodsReceiptNotFoundError extends AppError {
	constructor() {
		super(404, 'procurement.goodsReceiptNotFound', 'Goods receipt not found');
	}
}

/** Only a sent or partly received PO can be received against. */
export class GoodsReceiptOrderNotReceivableError extends AppError {
	constructor() {
		super(422, 'procurement.orderNotReceivable', 'Only a sent or partly received purchase order can be received');
	}
}

/** A receipt line that is unknown, more than is open, or without its serials. */
export class GoodsReceiptLineError extends AppError {
	constructor(kind: 'unknown' | 'over' | 'serials', line: number) {
		super(422, `procurement.receiptLine.${kind}` as const, `Line ${line}: ${kind}`, { line });
	}
}

/** The storage is not an active storage of the chosen warehouse. */
export class GoodsReceiptBinError extends AppError {
	constructor() {
		super(422, 'procurement.receiptBin', 'The storage does not belong to the chosen warehouse');
	}
}

export class PurchaseRequestNotFoundError extends AppError {
	constructor() {
		super(404, 'procurement.purchaseRequestNotFound', 'Purchase request not found');
	}
}

/** A transition that does not start from the request's status (also races). */
export class PurchaseRequestStateError extends AppError {
	constructor(kind: 'notDraft' | 'notSubmitted' | 'notCancellable') {
		super(422, `procurement.prState.${kind}` as const, `Purchase request state: ${kind}`);
	}
}

/** Only the requester edits, submits or cancels their own request. */
export class PurchaseRequestNotOwnerError extends AppError {
	constructor() {
		super(403, 'procurement.prNotOwner', 'Only the requester can change this purchase request');
	}
}

export class PurchaseRequestCodeTakenError extends AppError {
	constructor(code: string) {
		super(409, 'procurement.prCodeTaken', `PR number ${code} is already used`, { code });
	}
}

export class PurchaseRequestSelfApprovalError extends AppError {
	constructor() {
		super(403, 'procurement.prSelfApproval', 'You cannot approve or reject your own purchase request');
	}
}

/** A PO line points at a request line that is not approved, unknown, or already ordered. */
export class PurchaseRequestLineUnavailableError extends AppError {
	constructor(line: number) {
		super(422, 'procurement.prLineUnavailable', `Line ${line}: the purchase request line is not open for ordering`, { line });
	}
}
