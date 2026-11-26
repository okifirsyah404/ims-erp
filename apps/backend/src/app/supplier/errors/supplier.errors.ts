/**
 * Domain errors surfaced by the supplier module.
 *
 * @remarks
 * Each error carries a locale key rather than translated prose; the caller's
 * controller resolves it per request. Reuses the existing
 * `procurement.supplierNotFound` key so no locale change is needed.
 */
import { AppError } from '@http/errors';

/** The supplier company id or code does not resolve to a live row. */
export class SupplierCompanyNotFoundError extends AppError {
	constructor() {
		super(404, 'procurement.supplierNotFound', 'Supplier not found');
	}
}

/** The supplier person id does not resolve to a live row. */
export class SupplierPersonNotFoundError extends AppError {
	constructor() {
		super(404, 'procurement.supplierNotFound', 'Supplier not found');
	}
}

/** The company code is already taken by a live row. */
export class SupplierCompanyCodeTakenError extends AppError {
	constructor(code: string) {
		super(409, 'procurement.supplierCodeTaken', 'Supplier code already in use', {
			code,
		});
	}
}

/** The caller tried to write bank details without supplier:read_bank. */
export class SupplierBankForbiddenError extends AppError {
	constructor() {
		super(403, 'supplier.bankForbidden', 'You may not read or change supplier bank details');
	}
}

/** The address id does not resolve under its owner. */
export class SupplierAddressNotFoundError extends AppError {
	constructor() {
		super(404, 'procurement.supplierNotFound', 'Supplier address not found');
	}
}
