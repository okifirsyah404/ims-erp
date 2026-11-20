/**
 * Warehouse domain errors.
 *
 * @remarks
 * Each extends {@link AppError} so the shared `onError` arm in `@http/plugin`
 * maps it without a per-module arm. Keys resolve through
 * `@providers/i18n/translator` (`warehouse` namespace), so this module owns no
 * English prose.
 */
import { AppError } from '@http/errors';
import type { ApiKey } from '@providers/i18n/translator';

/** The requested warehouse does not exist (or is soft-deleted). */
export class WarehouseNotFoundError extends AppError {
	constructor() {
		super(404, 'warehouse.notFound', 'Warehouse not found');
	}
}

/** The warehouse code is already used within this scope. */
export class WarehouseCodeTakenError extends AppError {
	constructor() {
		super(
			409,
			'warehouse.codeTaken',
			'A warehouse with this code already exists in this scope',
		);
	}
}

/** The warehouse still holds live units or stock and cannot be archived. */
export class WarehouseHasUnitsError extends AppError {
	constructor(count: number) {
		super(
			422,
			'warehouse.hasUnits',
			`Cannot archive a warehouse that still holds ${count} live unit(s)`,
			{ count },
		);
	}
}

/**
 * A warehouse↔organization link cannot be cut (ERP-0031).
 *
 * @remarks
 * 409, not 422: the conflict is with concurrent custody state (open
 * borrowings), and the caller can retry once those are returned.
 */
export class WarehouseLinkConflictError extends AppError {
	constructor(count: number) {
		super(
			409,
			'warehouse.linkConflict',
			`Cannot unlink while the organization holds ${count} open borrowing(s) originating in this warehouse`,
			{ count },
		);
	}
}

/**
 * The requested warehouse PIC (responsible employee) is not assignable.
 *
 * @remarks
 * 422: the request is well-formed but the employee is unknown, inactive, or
 * belongs to an organization not linked to the warehouse (ERP-0034; ADR-0010
 * keeps the field display-only — this only gates *assignment*, not access).
 */
export class WarehousePicInvalidError extends AppError {
	constructor() {
		super(
			422,
			'warehouse.picInvalid',
			'The responsible employee is unknown, inactive, or not from a linked organization',
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
			'warehouse.inactive',
			`Warehouse "${code}" is inactive; its storages cannot be changed`,
			{ warehouseCode: code },
		);
	}
}

/** The requested storage (bin) does not exist in this warehouse. */
export class StorageNotFoundError extends AppError {
	constructor() {
		super(404, 'warehouse.storageNotFound', 'Storage not found');
	}
}

/** The storage code is already used within this warehouse. */
export class StorageCodeTakenError extends AppError {
	constructor() {
		super(
			409,
			'warehouse.storageCodeTaken',
			'A storage with this code already exists in this warehouse',
		);
	}
}

/** The user already holds a live assignment for the warehouse (ADR-0017). */
export class WarehouseManagerExistsError extends AppError {
	constructor() {
		super(
			409,
			'warehouse.managerExists',
			'This user is already a person in charge of the warehouse',
		);
	}
}

/**
 * The user named in an assignment does not exist (or is deleted).
 *
 * @remarks
 * 404 rather than 422: the request body is well-formed, the *target resource*
 * is missing. The check goes through the Identity module contract, never
 * straight to `auth.users` (cross-module reads go through the owning module).
 */
export class WarehouseManagerUserNotFoundError extends AppError {
	constructor() {
		super(404, 'warehouse.managerUserNotFound', 'User not found');
	}
}

/**
 * A warehouse rule the business does not allow.
 *
 * @remarks
 * 422 rather than 409: the request is well-formed and the record exists, but
 * the change is forbidden by policy (a storage in an archived warehouse).
 */
export class WarehouseRuleViolationError extends AppError {
	constructor(
		readonly rule: string,
		key: ApiKey = 'warehouse.ruleViolation',
		message = rule,
	) {
		super(422, key, message, { rule });
	}
}
