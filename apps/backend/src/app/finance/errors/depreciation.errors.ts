import { AppError } from '@http/errors';

/** The item already has a depreciation entry for this period (idempotent per period, D14). */
export class DepreciationPeriodTakenError extends AppError {
	constructor() {
		super(409, 'assets.periodAlreadyDepreciated', 'This asset already has a depreciation entry for this period');
	}
}
