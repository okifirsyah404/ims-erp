/**
 * Domain errors surfaced by the customer module.
 *
 * @remarks
 * Keys resolve through `@providers/i18n/translator`; the `crm.` keys are
 * reused so no locale change is needed.
 */
import { AppError } from '@http/errors';

/** The company or person does not exist (or is archived). */
export class CustomerNotFoundError extends AppError {
	constructor() {
		super(404, 'crm.customerNotFound', 'Customer not found');
	}
}

/** A live company or person already uses this code. */
export class CustomerCodeTakenError extends AppError {
	constructor(code: string) {
		super(
			409,
			'crm.customerCodeTaken',
			`Customer code ${code} is already used`,
			{ code },
		);
	}
}

/** The requested status change does not apply (already in that status). */
export class CustomerStatusUnchangedError extends AppError {
	constructor(active: boolean) {
		super(
			422,
			active
				? 'crm.customerAlreadyActive'
				: 'crm.customerAlreadyInactive',
			`Customer is already ${active ? 'active' : 'inactive'}`,
		);
	}
}

/** The address names a village that does not exist. */
export class VillageNotFoundError extends AppError {
	constructor() {
		super(422, 'crm.villageNotFound', 'Village (kelurahan/desa) not found');
	}
}

/** The address is not on this company or person. */
export class CustomerAddressNotFoundError extends AppError {
	constructor() {
		super(404, 'crm.contactNotFound', 'Address not found');
	}
}
