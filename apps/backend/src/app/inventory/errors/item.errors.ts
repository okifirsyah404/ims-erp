/**
 * Asset domain errors.
 *
 * @remarks
 * Each extends {@link AppError} so the shared `onError` arm in
 * `@http/plugin` maps it without a per-module arm. Keys resolve through
 * `@providers/i18n/translator`.
 */
import { AppError } from '@http/errors';
import type { ApiKey } from '@providers/i18n/translator';

/** The requested asset does not exist (or is soft-deleted). */
export class ItemNotFoundError extends AppError {
	constructor() {
		super(404, 'assets.assetNotFound', 'Asset not found');
	}
}

/** The requested asset category does not exist (or is soft-deleted). */
export class ItemCategoryNotFoundError extends AppError {
	constructor() {
		super(404, 'assets.categoryNotFound', 'Asset category not found');
	}
}

/** The category code is already used for this tenant. */
export class ItemCategoryCodeTakenError extends AppError {
	constructor() {
		super(
			409,
			'assets.categoryCodeTaken',
			'An asset category with this code already exists',
		);
	}
}

/**
 * A status or custody transition the business does not allow (e.g.
 * assigning a borrowed or inactive asset).
 *
 * 422 rather than 409: the request is well-formed and the record exists,
 * but the transition is forbidden by policy.
 */
export class ItemRuleViolationError extends AppError {
	constructor(
		readonly rule: string,
		key: ApiKey = 'assets.ruleViolation',
		message = rule,
	) {
		super(422, key, message, { rule });
	}
}

/**
 * A lifecycle transition attempted from the wrong state (status machine
 * violation), distinct from a business-rule refusal above.
 */
export class ItemTransitionError extends ItemRuleViolationError {
	constructor(from: string, to: string) {
		super(
			`illegal_transition:${from}->${to}`,
			'assets.illegalTransition',
			`Cannot move an asset from "${from}" to "${to}"`,
		);
	}
}
