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
