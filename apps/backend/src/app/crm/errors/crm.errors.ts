/**
 * CRM domain errors.
 *
 * @remarks
 * Each extends {@link AppError} so the shared `onError` arm in
 * `@http/plugin` maps it; keys resolve through `@providers/i18n/translator`.
 */
import { AppError } from '@http/errors';

/** The customer does not exist (or is archived). */
export class CustomerNotFoundError extends AppError {
	constructor() {
		super(404, 'crm.customerNotFound', 'Customer not found');
	}
}

/** A live customer already uses this code. */
export class CustomerCodeTakenError extends AppError {
	constructor(code: string) {
		super(409, 'crm.customerCodeTaken', `Customer code ${code} is already used`, { code });
	}
}

/** The requested status change does not apply (already in that status). */
export class CustomerStatusUnchangedError extends AppError {
	constructor(status: 'active' | 'inactive') {
		super(
			422,
			status === 'active' ? 'crm.customerAlreadyActive' : 'crm.customerAlreadyInactive',
			`Customer is already ${status}`,
		);
	}
}

/** The address names a village that does not exist. */
export class VillageNotFoundError extends AppError {
	constructor() {
		super(422, 'crm.villageNotFound', 'Village (kelurahan/desa) not found');
	}
}

/** The contact does not exist on this customer. */
export class CustomerContactNotFoundError extends AppError {
	constructor() {
		super(404, 'crm.contactNotFound', 'Contact not found');
	}
}
