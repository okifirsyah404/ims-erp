/**
 * Borrowing domain errors.
 *
 * @remarks
 * Each extends {@link AppError} so the shared `onError` arm in
 * `@http/plugin` maps it without a per-module arm. Keys resolve through
 * `@providers/i18n/translator`, so this module owns no English prose.
 */
import { AppError } from '@http/errors';

/** The requested borrowing does not exist (or is soft-deleted). */
export class BorrowingNotFoundError extends AppError {
	constructor() {
		super(404, 'assets.borrowingNotFound', 'Borrowing not found');
	}
}

/** The requested borrowing item does not exist on this borrowing. */
export class BorrowingItemNotFoundError extends AppError {
	constructor() {
		super(404, 'assets.borrowingLineNotFound', 'Borrowing item not found');
	}
}

/** The requested asset is not on this borrowing. */
export class UnitNotOnBorrowingError extends AppError {
	constructor() {
		super(
			422,
			'assets.unitNotOnBorrowing',
			'That asset is not issued on this borrowing',
		);
	}
}

/**
 * A borrowing status change the state machine does not allow.
 *
 * @remarks
 * 422: the request is well-formed and the document exists, but the edge is
 * forbidden (issuing a rejected borrowing, returning an unissued one).
 */
export class BorrowingTransitionError extends AppError {
	constructor(from: string, to: string) {
		super(
			422,
			'assets.borrowingTransition',
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
			'assets.borrowingCodeTaken',
			'Could not allocate a unique borrowing code',
		);
	}
}

/** A borrowing was raised with no items. */
export class BorrowingHasNoItemsError extends AppError {
	constructor() {
		super(
			422,
			'assets.borrowingHasNoLines',
			'A borrowing must have at least one item',
		);
	}
}

/**
 * An asset could not be issued because it is not available.
 *
 * @remarks
 * Distinct from `InsufficientStockError` because the cause is asset custody
 * (`status <> 'ready'`), not a balance shortfall. Both can appear on the
 * same request; the asset is checked first.
 */
export class UnitNotAvailableError extends AppError {
	constructor(serialNumber: string, status: string) {
		super(
			422,
			'assets.unitNotAvailable',
			`Asset "${serialNumber}" cannot be issued: it is ${status}`,
			{ serialNumber, status },
		);
	}
}

/** The borrower identity is inconsistent with `borrower_type`. */
export class BorrowerIdentityError extends AppError {
	constructor(reason: string) {
		super(422, 'assets.borrowerIdentity', reason);
	}
}

/** A guest borrowing is missing identity data a guest must provide. */
export class GuestIdentityIncompleteError extends AppError {
	constructor(field: string) {
		super(
			422,
			'assets.guestIdentityIncomplete',
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
			'assets.borrowingSelfApprovalForbidden',
			'You cannot approve your own borrowing',
		);
	}
}
