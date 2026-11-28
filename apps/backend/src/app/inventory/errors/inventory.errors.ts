/**
 * Inventory domain errors.
 *
 * @remarks
 * Each extends {@link AppError} so the shared `onError` arm in
 * `@http/plugin` maps it without a per-module arm. Keys resolve through
 * `@providers/i18n/translator`, so this module owns no English prose.
 *
 * ADR-0026 moved the product master and the warehouse estate to their own
 * modules, so their errors (`ProductNotFoundError`,
 * `WarehouseNotFoundError`, ...) live in `product.errors.ts` /
 * `warehouse.errors.ts`. A missing product or warehouse reached from a stock
 * write is reported as {@link InventoryReferenceError} instead, so the
 * inventory module does not translate another module's vocabulary.
 */
import { AppError } from '@http/errors';
import type { ApiKey } from '@providers/i18n/translator';

/** The requested product does not exist (or is soft-deleted). */
export class ProductNotFoundError extends AppError {
	constructor() {
		super(404, 'product.notFound', 'Product not found');
	}
}

/** The requested item unit does not exist (or is soft-deleted). */
export class SerialNotFoundError extends AppError {
	constructor() {
		super(404, 'inventory.unitNotFound', 'Item unit not found');
	}
}

/**
 * A manual stock receipt or issue the screen must correct (B-29).
 *
 * @remarks
 * `serialsRequired`: the product is serialized and the quantity must be a
 * whole number matched by one serial per unit; `serialsNotAllowed`: the
 * product has no serials; `serialsUnavailable`: those serials are not in
 * stock in the warehouse; `projectNotFound`: the project does not exist.
 */
export class ManualStockError extends AppError {
	constructor(
		kind: 'serialsRequired' | 'serialsNotAllowed' | 'serialsUnavailable' | 'projectNotFound',
		params?: Record<string, string | number>,
	) {
		super(422, `inventory.manualStock.${kind}` as const, `Manual stock: ${kind}`, params);
	}
}

/** The serial number already exists for this tenant. */
export class SerialNumberTakenError extends AppError {
	constructor() {
		super(
			409,
			'inventory.serialTaken',
			'An item unit with this serial number already exists',
		);
	}
}

/**
 * A status or kind combination the business does not allow.
 *
 * @remarks
 * 422 rather than 409: the request is well-formed and the record exists, but
 * the transition is forbidden by policy (a non-serialized product cannot have
 * units, a provisional serial cannot be replaced twice, and so on).
 */
export class InventoryRuleViolationError extends AppError {
	constructor(
		readonly rule: string,
		key: ApiKey = 'inventory.ruleViolation',
		message = rule,
	) {
		super(422, key, message, { rule });
	}
}

/**
 * A product or warehouse named by a stock document cannot be used.
 *
 * @remarks
 * The row lives in another module (`product` / `warehouse`, ADR-0026) and is
 * checked through that module's facade. 422 rather than 404: the stock
 * document is the resource being written; the reference is what is unusable.
 */
export class InventoryReferenceError extends AppError {
	constructor(
		readonly reference: 'product' | 'warehouse' | 'storage',
		key: ApiKey = 'inventory.referenceUnavailable',
		message = `${reference} is unknown, archived or inactive`,
	) {
		super(422, key, message, { reference });
	}
}

/** The requested stock movement does not exist. */
export class MovementNotFoundError extends AppError {
	constructor() {
		super(404, 'inventory.movementNotFound', 'Stock movement not found');
	}
}

/**
 * A movement was already reversed.
 *
 * @remarks
 * Reversal is one-shot: reversing twice would double-count the correction, so
 * the second attempt is a 409 rather than a silent no-op.
 */
export class MovementAlreadyReversedError extends AppError {
	constructor() {
		super(
			409,
			'inventory.movementAlreadyReversed',
			'This stock movement has already been reversed',
		);
	}
}

/**
 * A movement would take the balance below zero.
 *
 * @remarks
 * Negative stock is refused for **every** movement type, including
 * adjustments. Correcting an over-stated balance therefore means reversing the
 * offending movement and posting a new one, not writing a negative adjustment.
 */
export class InsufficientStockError extends AppError {
	constructor(available: string, requested: string) {
		super(
			422,
			'inventory.insufficientStock',
			`Cannot move ${requested}: only ${available} on hand`,
			{ available, requested },
		);
	}
}

/** The requested stock adjustment does not exist. */
export class AdjustmentNotFoundError extends AppError {
	constructor() {
		super(404, 'inventory.adjustmentNotFound', 'Stock adjustment not found');
	}
}

/** The adjustment code is already used by this organization. */
export class AdjustmentCodeTakenError extends AppError {
	constructor() {
		super(
			409,
			'inventory.adjustmentCodeTaken',
			'An adjustment with this code already exists in this organization',
		);
	}
}

/** An adjustment transition is not legal from its current status. */
export class AdjustmentTransitionError extends AppError {
	constructor(from: string, to: string) {
		super(
			422,
			'inventory.adjustmentTransition',
			`An adjustment cannot move from "${from}" to "${to}"`,
			{ from, to },
		);
	}
}

/**
 * The requester tried to approve their own adjustment.
 *
 * @remarks
 * The `stock_adjustment:approve` permission is the bypass: holding it means the
 * approval step is not a separate person's control for that user.
 */
export class SelfApprovalForbiddenError extends AppError {
	constructor() {
		super(
			403,
			'inventory.selfApprovalForbidden',
			'You cannot approve your own stock adjustment',
		);
	}
}

/** An adjustment has no lines, so there is nothing to approve or post. */
export class AdjustmentHasNoLinesError extends AppError {
	constructor() {
		super(
			422,
			'inventory.adjustmentHasNoLines',
			'A stock adjustment must have at least one line',
		);
	}
}
