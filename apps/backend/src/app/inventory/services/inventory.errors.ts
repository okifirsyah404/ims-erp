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
