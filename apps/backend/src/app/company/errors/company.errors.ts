/**
 * Domain errors surfaced by the company service.
 *
 * @remarks
 * Each error carries a locale **key** rather than translated prose; the
 * controller resolves it against the request's `Accept-Language`.
 */
import { AppError } from '@http/errors';

/** The profile must exist before an image can be attached to it. */
export class CompanyProfileRequiredError extends AppError {
	constructor() {
		super(422, 'company.profileRequired', 'Fill in the company profile first');
	}
}

/** The value does not parse as its declared `value_type`. */
export class CompanySettingInvalidError extends AppError {
	constructor(valueType: string) {
		super(422, 'company.settingInvalid', `Value is not a valid ${valueType}`);
	}
}

/** No live letterhead with this id (ERP-0165). */
export class LetterheadNotFoundError extends AppError {
	constructor() {
		super(404, 'company.letterheadNotFound', 'Letterhead not found');
	}
}
