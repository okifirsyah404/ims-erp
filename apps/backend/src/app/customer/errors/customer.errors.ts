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

/** The email already belongs to another Better Auth account (ERP-0114). */
export class CustomerEmailTakenError extends AppError {
	constructor(email: string) {
		super(409, 'crm.customerEmailTaken', `Email ${email} already belongs to another account`, { email });
	}
}

/** A verified account email is locked (ERP-0114). */
export class CustomerEmailVerifiedError extends AppError {
	constructor() {
		super(422, 'crm.customerEmailVerified', 'The email is verified and can no longer be changed');
	}
}

/** Every generated username candidate was taken (ERP-0114). */
export class CustomerUsernameUnavailableError extends AppError {
	constructor() {
		super(409, 'crm.customerUsernameUnavailable', 'No free username could be generated');
	}
}

/** The owner named for a company is not one of its contacts (ERP-0114). */
export class CustomerOwnerInvalidError extends AppError {
	constructor() {
		super(422, 'crm.customerOwnerInvalid', 'The owner must be a contact of this company');
	}
}

/** The person has no Better Auth account (rows written before ERP-0114). */
export class CustomerAccountMissingError extends AppError {
	constructor() {
		super(409, 'crm.customerAccountMissing', 'This customer has no account');
	}
}

/** The uploaded photo is not a decodable image within the size cap. */
export class CustomerPhotoInvalidError extends AppError {
	constructor(status: 413 | 415 = 415) {
		super(status, 'crm.customerPhotoInvalid', 'The photo must be an image up to 2 MB');
	}
}
