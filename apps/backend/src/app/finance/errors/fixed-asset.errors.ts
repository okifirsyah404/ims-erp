/**
 * Fixed-asset book errors (ERP-0145).
 */
import { AppError } from '@http/errors';

export class FixedAssetNotFoundError extends AppError {
	constructor() {
		super(404, 'accounting.fixedAssetNotFound', 'This item is not capitalized');
	}
}

export class FixedAssetBookExistsError extends AppError {
	constructor() {
		super(409, 'accounting.fixedAssetCapitalized', 'This item is already capitalized');
	}
}

/** Only an item of this organization with an acquisition cost, not disposed, is capitalized. */
export class FixedAssetItemError extends AppError {
	constructor() {
		super(422, 'accounting.fixedAssetItemInvalid', 'The item needs an acquisition cost, this organization and a live status');
	}
}
