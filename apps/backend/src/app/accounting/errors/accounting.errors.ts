/**
 * Accounting (tax) domain errors.
 *
 * @remarks
 * Each extends {@link AppError}, so the shared `onError` arm in
 * `@http/plugin` maps it. Keys resolve through `@providers/i18n/translator`,
 * so this module owns no English prose for clients.
 */
import { AppError } from '@http/errors';

export class TaxTypeNotFoundError extends AppError {
	constructor() {
		super(404, 'accounting.taxTypeNotFound', 'Tax type not found');
	}
}

/** A new or re-dated tax row would overlap another row with the same code. */
export class TaxTypeOverlapError extends AppError {
	constructor() {
		super(
			409,
			'accounting.taxTypeOverlap',
			'Effective period overlaps an existing rate for this tax code',
		);
	}
}

/** The tax type still has recap or withholding records and cannot be removed. */
export class TaxTypeInUseError extends AppError {
	constructor() {
		super(409, 'accounting.taxTypeInUse', 'Tax type is still in use');
	}
}

/** No active rate covers the date for this tax code. */
export class TaxRateNotFoundError extends AppError {
	constructor() {
		super(
			422,
			'accounting.taxRateNotFound',
			'No active tax rate covers this date',
		);
	}
}

export class TaxRecordNotFoundError extends AppError {
	constructor() {
		super(404, 'accounting.taxRecordNotFound', 'Tax record not found');
	}
}

/** A recap already exists for this tax type and period. */
export class TaxRecordPeriodTakenError extends AppError {
	constructor() {
		super(
			409,
			'accounting.taxRecordPeriodTaken',
			'A tax record already exists for this type and period',
		);
	}
}

/** Only draft records accept edits of their amounts. */
export class TaxRecordLockedError extends AppError {
	constructor() {
		super(
			409,
			'accounting.taxRecordLocked',
			'Tax record is no longer editable',
		);
	}
}

/** A status change the state machine does not allow, or a lost race. */
export class TaxTransitionError extends AppError {
	constructor() {
		super(
			409,
			'accounting.taxTransition',
			'That status change is not allowed for this record',
		);
	}
}

export class WithholdingNotFoundError extends AppError {
	constructor() {
		super(
			404,
			'accounting.withholdingNotFound',
			'Withholding record not found',
		);
	}
}

export class WithholdingTransitionError extends AppError {
	constructor() {
		super(
			409,
			'accounting.withholdingTransition',
			'That status change is not allowed for this withholding record',
		);
	}
}
