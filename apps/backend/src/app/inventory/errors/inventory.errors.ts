/**
 * Inventory domain errors.
 *
 * @remarks
 * Each extends {@link AppError} so the shared `onError` arm in
 * `@http/plugin` maps it without a per-module arm. Keys resolve through
 * `@providers/i18n/translator`, so this module owns no English prose.
 */
import { AppError } from '@http/errors';
import type { ApiKey } from '@providers/i18n/translator';

/** The requested item does not exist (or is soft-deleted). */
export class ItemNotFoundError extends AppError {
	constructor() {
		super(404, 'inventory.itemNotFound', 'Item not found');
	}
}

/** The requested item unit does not exist (or is soft-deleted). */
export class UnitNotFoundError extends AppError {
	constructor() {
		super(404, 'inventory.unitNotFound', 'Item unit not found');
	}
}

/** The item already exists for this tenant. */
export class ItemSkuTakenError extends AppError {
	constructor() {
		super(409, 'inventory.skuTaken', 'An item with this SKU already exists');
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
 * the transition is forbidden by policy (tools cannot be sold, a provisional
 * serial cannot be replaced twice, and so on).
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

/** An item with live units cannot be archived. */
export class ItemHasUnitsError extends AppError {
	constructor(count: number) {
		super(
			422,
			'inventory.itemHasUnits',
			`Cannot archive an item that still has ${count} live unit(s)`,
			{ count },
		);
	}
}

/** The requested warehouse does not exist (or is soft-deleted). */
export class WarehouseNotFoundError extends AppError {
	constructor() {
		super(404, 'inventory.warehouseNotFound', 'Warehouse not found');
	}
}

/** The warehouse code is already used within this scope. */
export class WarehouseCodeTakenError extends AppError {
	constructor() {
		super(
			409,
			'inventory.warehouseCodeTaken',
			'A warehouse with this code already exists in this scope',
		);
	}
}

/** The warehouse still holds live units and cannot be archived. */
export class WarehouseHasUnitsError extends AppError {
	constructor(count: number) {
		super(
			422,
			'inventory.warehouseHasUnits',
			`Cannot archive a warehouse that still holds ${count} live unit(s)`,
			{ count },
		);
	}
}

/**
 * A storage cannot be written into an inactive warehouse.
 *
 * @remarks
 * 422 rather than 409: the warehouse exists and the request is well-formed,
 * but the parent warehouse's state forbids the write (D4 in
 * `docs/plan/plans/warehouse-hardening.md`).
 */
export class WarehouseInactiveError extends AppError {
	constructor(code: string) {
		super(
			422,
			'inventory.warehouseInactive',
			`Warehouse "${code}" is inactive; its storages cannot be changed`,
			{ warehouseCode: code },
		);
	}
}

/** The requested storage (bin) does not exist in this warehouse. */
export class StorageNotFoundError extends AppError {
	constructor() {
		super(404, 'inventory.storageNotFound', 'Storage not found');
	}
}

/** The storage code is already used within this warehouse. */
export class StorageCodeTakenError extends AppError {
	constructor() {
		super(
			409,
			'inventory.storageCodeTaken',
			'A storage with this code already exists in this warehouse',
		);
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

/** The requested borrowing does not exist (or is soft-deleted). */
export class BorrowingNotFoundError extends AppError {
	constructor() {
		super(404, 'inventory.borrowingNotFound', 'Borrowing not found');
	}
}

/** The requested borrowing line does not exist on this borrowing. */
export class BorrowingLineNotFoundError extends AppError {
	constructor() {
		super(404, 'inventory.borrowingLineNotFound', 'Borrowing line not found');
	}
}

/** The requested unit is not on this borrowing. */
export class UnitNotOnBorrowingError extends AppError {
	constructor() {
		super(
			422,
			'inventory.unitNotOnBorrowing',
			'That unit is not issued on this borrowing',
		);
	}
}

/**
 * A borrowing status change the state machine does not allow.
 *
 * @remarks
 * 422, matching {@link InventoryRuleViolationError}: the request is well-formed
 * and the document exists, but the edge is forbidden (issuing a rejected
 * borrowing, returning an unissued one).
 */
export class BorrowingTransitionError extends AppError {
	constructor(from: string, to: string) {
		super(
			422,
			'inventory.borrowingTransition',
			`A borrowing cannot move from "${from}" to "${to}"`,
			{ from, to },
		);
	}
}

/** The borrowing code could not be allocated after repeated collisions. */
export class BorrowingCodeTakenError extends AppError {
	constructor() {
		super(
			409,
			'inventory.borrowingCodeTaken',
			'Could not allocate a unique borrowing code',
		);
	}
}

/** A borrowing was raised with no lines. */
export class BorrowingHasNoLinesError extends AppError {
	constructor() {
		super(
			422,
			'inventory.borrowingHasNoLines',
			'A borrowing must have at least one line',
		);
	}
}

/**
 * A unit could not be issued because it is not available.
 *
 * @remarks
 * Distinct from `InsufficientStockError` because the cause is unit custody
 * (`status <> 'in_stock'`), not a balance shortfall. Both can appear on the
 * same request; the unit is checked first.
 */
export class UnitNotAvailableError extends AppError {
	constructor(serialNumber: string, status: string) {
		super(
			422,
			'inventory.unitNotAvailable',
			`Unit "${serialNumber}" cannot be issued: it is ${status}`,
			{ serialNumber, status },
		);
	}
}

/** The borrower identity is inconsistent with `borrower_type`. */
export class BorrowerIdentityError extends AppError {
	constructor(reason: string) {
		super(422, 'inventory.borrowerIdentity', reason);
	}
}

/** A guest borrowing is missing identity data a guest must provide. */
export class GuestIdentityIncompleteError extends AppError {
	constructor(field: string) {
		super(
			422,
			'inventory.guestIdentityIncomplete',
			`A guest borrower must provide ${field}`,
			{ field },
		);
	}
}

/** The caller tried to approve a borrowing they raised, without the bypass. */
export class BorrowingSelfApprovalForbiddenError extends AppError {
	constructor() {
		super(
			403,
			'inventory.borrowingSelfApprovalForbidden',
			'You cannot approve your own borrowing',
		);
	}
}
