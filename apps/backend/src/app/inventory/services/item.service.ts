import { inject, injectable } from 'tsyringe';
import type { TPaginationResult } from '@ims-erp/common';
import type {
	ItemKind,
	TItemSelect,
	TSerialTrackedItemSelect,
	UnitStatus,
} from '@drizzle/schemas/inventory.schema';
import { UNIT_STATUS_TRANSITIONS } from '@drizzle/schemas/inventory.schema';
import type {
	IItemRepository,
	TItemCreateData,
	TItemPaginationRequest,
	TItemUpdateData,
} from '../contracts/item.repository.interface';
import type {
	ISerialUnitRepository,
	TUnitPaginationRequest,
} from '../contracts/serial-unit.repository.interface';
import {
	ITEM_REPOSITORY_TOKEN,
	SERIAL_UNIT_REPOSITORY_TOKEN,
} from '../constants/di';
import {
	InventoryRuleViolationError,
	ItemHasUnitsError,
	ItemNotFoundError,
	ItemSkuTakenError,
	SerialNumberTakenError,
	UnitNotFoundError,
} from '../errors/inventory.errors';

/**
 * Unit statuses allowed per item kind.
 *
 * @remarks
 * `UNIT_STATUS_TRANSITIONS` in the schema describes where a status may go.
 * This table describes which statuses a kind may hold **at all**:
 * - `tool` may only be borrowed (plus the states any unit passes through on
 *   its way in and out: pre-ordered, in stock, lost).
 * - `sold` and `applied_warranty` are product-only.
 * - The four consumable kinds additionally reach `sold`/`applied_warranty`.
 */
const STATUSES_BY_KIND: Record<ItemKind, readonly UnitStatus[]> = {
	product: [
		'pre_order',
		'in_stock',
		'borrowed',
		'lost',
		'sold',
		'applied_warranty',
	],
	component: [
		'pre_order',
		'in_stock',
		'borrowed',
		'lost',
		'sold',
		'applied_warranty',
	],
	material: [
		'pre_order',
		'in_stock',
		'borrowed',
		'lost',
		'sold',
		'applied_warranty',
	],
	tool: ['pre_order', 'in_stock', 'borrowed', 'lost'],
	service: [],
};

/**
 * Transition matrix and inventory rules.
 *
 * @remarks
 * Pure functions with no I/O, exported separately from
 * {@link ItemService} so the matrix can be tested exhaustively without
 * building a database.
 */

/**
 * Returns whether `itemKind` accepts `status` at all.
 *
 * @param itemKind - The kind of the item the unit belongs to
 * @param status - The status being requested
 */
export function isStatusAllowedForKind(
	itemKind: ItemKind,
	status: UnitStatus,
): boolean {
	return STATUSES_BY_KIND[itemKind].includes(status);
}

/**
 * Asserts that a status transition is legal for the kind.
 *
 * @remarks
 * Checks both the kind/status pair and the from→to edge, because a legal
 * destination can still be illegal from the current state.
 *
 * @param itemKind - The kind of the item the unit belongs to
 * @param from - Current status
 * @param to - Requested status
 * @throws {InventoryRuleViolationError} When either check fails
 */
export function assertTransitionAllowed(
	itemKind: ItemKind,
	from: UnitStatus,
	to: UnitStatus,
): void {
	if (!isStatusAllowedForKind(itemKind, to)) {
		throw new InventoryRuleViolationError(
			`A ${itemKind} unit can never be "${to}"`,
		);
	}
	if (!UNIT_STATUS_TRANSITIONS[from].includes(to)) {
		throw new InventoryRuleViolationError(
			`A unit cannot move from "${from}" to "${to}"`,
		);
	}
}

/**
 * Application service for the item master and its serialized units.
 *
 * @remarks
 * Owns the cross-field rules the schema cannot express, because a unit row
 * does not know its item's kind without a join:
 * - A `service` item is never serialized and never stock-tracked.
 * - A non-serialized item has no units.
 * - A unit's status must be legal for its item's kind.
 * - A provisional serial is replaced exactly once.
 */
@injectable()
export class ItemService {
	constructor(
		@inject(ITEM_REPOSITORY_TOKEN)
		private readonly itemRepository: IItemRepository,
		@inject(SERIAL_UNIT_REPOSITORY_TOKEN)
		private readonly serialUnitRepository: ISerialUnitRepository,
	) {}

	/** Fetches one filtered page of items. */
	paginate(
		request: TItemPaginationRequest,
	): Promise<TPaginationResult<TItemSelect>> {
		return this.itemRepository.paginate(request);
	}

	/**
	 * Fetches one item.
	 *
	 * @throws {ItemNotFoundError} When the item is absent or archived
	 */
	async getItem(id: string): Promise<TItemSelect> {
		const item = await this.itemRepository.findById(id);
		if (!item) throw new ItemNotFoundError();
		return item;
	}

	/**
	 * Creates an item.
	 *
	 * @throws {InventoryRuleViolationError} When the kind/data combination is
	 * impossible (e.g. a serialized service)
	 * @throws {ItemSkuTakenError} When the SKU is already used for this tenant
	 */
	async createItem(data: TItemCreateData): Promise<TItemSelect> {
		this.assertItemShape(data);

		const existing = await this.itemRepository.findBySku(
			data.organizationId ?? null,
			data.sku,
		);
		if (existing) throw new ItemSkuTakenError();

		return this.itemRepository.create(data);
	}

	/**
	 * Updates an item.
	 *
	 * @remarks
	 * `sku` and `itemKind` are deliberately not updatable: both are load
	 * bearing for uniqueness and for the status matrix, and changing either
	 * would silently invalidate existing units.
	 *
	 * @throws {ItemNotFoundError} When the item is absent or archived
	 * @throws {InventoryRuleViolationError} When the result would be impossible
	 */
	async updateItem(
		id: string,
		data: TItemUpdateData,
	): Promise<TItemSelect> {
		const current = await this.getItem(id);

		if (Object.keys(data).length > 0) {
			this.assertItemShape({
				...current,
				...data,
			} as TItemCreateData);
		}

		const updated = await this.itemRepository.update(id, data);
		if (!updated) throw new ItemNotFoundError();
		return updated;
	}

	/**
	 * Archives an item.
	 *
	 * @throws {ItemNotFoundError} When the item is absent or archived
	 * @throws {ItemHasUnitsError} When live units still reference it
	 */
	async archiveItem(id: string): Promise<TItemSelect> {
		await this.getItem(id);

		const units = await this.itemRepository.countUnits(id);
		if (units > 0) throw new ItemHasUnitsError(units);

		const archived = await this.itemRepository.archive(id);
		if (!archived) throw new ItemNotFoundError();
		return archived;
	}

	/** Fetches one filtered page of units. */
	paginateUnits(
		request: TUnitPaginationRequest,
	): Promise<TPaginationResult<TSerialTrackedItemSelect>> {
		return this.serialUnitRepository.paginate(request);
	}

	/**
	 * Registers a unit against a serialized item.
	 *
	 * @remarks
	 * A provisional serial (`isProvisionalSerial: true`) is only accepted on a
	 * `pre_order` unit — the schema check enforces the pairing and this method
	 * supplies a provisional serial number when the caller has none yet.
	 *
	 * @throws {InventoryNotFoundError} When the item is absent or archived
	 * @throws {InventoryRuleViolationError} When the item is not serialized
	 * @throws {SerialNumberTakenError} When the serial is already used
	 */
	async registerUnit(
		itemId: string,
		data: {
			serialNumber?: string;
			organizationId?: string | null;
			status?: UnitStatus;
			warehouseId?: string | null;
			binId?: string | null;
			assetTag?: string | null;
			acquiredOn?: string | null;
			warrantyExpiresOn?: string | null;
			notes?: string | null;
		},
	): Promise<TSerialTrackedItemSelect> {
		const item = await this.getItem(itemId);

		if (!item.isSerialized) {
			throw new InventoryRuleViolationError(
				`Item "${item.sku}" is not serialized and cannot have units`,
			);
		}

		const status = data.status ?? 'in_stock';
		// A brand-new unit has no previous status, so only the kind/status
		// pair is checked — not a transition edge.
		if (!isStatusAllowedForKind(item.itemKind as ItemKind, status)) {
			throw new InventoryRuleViolationError(
				`A ${item.itemKind} unit can never be "${status}"`,
			);
		}

		// A pre-ordered unit has no physical serial yet: mint a provisional one
		// that is replaced exactly once on receipt (ADR-0009).
		const isProvisional = status === 'pre_order';
		const serialNumber =
			data.serialNumber ??
			(isProvisional
				? `PO-${item.sku}-${Date.now().toString(36).toUpperCase()}`
				: null);
		if (!serialNumber) {
			throw new InventoryRuleViolationError(
				'A serial number is required unless the unit is pre-ordered',
			);
		}

		const existing = await this.serialUnitRepository.findBySerial(
			data.organizationId ?? null,
			serialNumber,
		);
		if (existing) throw new SerialNumberTakenError();

		return this.serialUnitRepository.create({
			organizationId: data.organizationId ?? null,
			itemId,
			serialNumber,
			isProvisionalSerial: isProvisional,
			assetTag: data.assetTag ?? null,
			status,
			warehouseId: data.warehouseId ?? null,
			binId: data.binId ?? null,
			acquiredOn: data.acquiredOn ?? null,
			warrantyExpiresOn: data.warrantyExpiresOn ?? null,
			purchaseOrderLineId: null,
			customerId: null,
			stockMovementId: null,
			notes: data.notes ?? null,
		});
	}

	/**
	 * Replaces a unit's provisional serial with the real one.
	 *
	 * @remarks
	 * The single mutation allowed on `serial_number`. The repository applies
	 * the guard atomically, so a concurrent second call matches no row.
	 *
	 * @throws {UnitNotFoundError} When the unit is absent
	 * @throws {InventoryRuleViolationError} When the unit is not provisional or
	 * has already left `pre_order`
	 * @throws {SerialNumberTakenError} When the serial is already used
	 */
	async replaceProvisionalSerial(
		unitId: string,
		serialNumber: string,
	): Promise<TSerialTrackedItemSelect> {
		const unit = await this.serialUnitRepository.findById(unitId);
		if (!unit) throw new UnitNotFoundError();

		if (!unit.isProvisionalSerial || unit.status !== 'pre_order') {
			throw new InventoryRuleViolationError(
				'Only a pre-ordered unit with a provisional serial can have its serial replaced',
			);
		}

		const existing = await this.serialUnitRepository.findBySerial(
			unit.organizationId,
			serialNumber,
		);
		if (existing) throw new SerialNumberTakenError();

		const updated = await this.serialUnitRepository.replaceProvisionalSerial(
			unitId,
			serialNumber,
		);
		if (!updated) {
			// Lost the race against a concurrent replacement.
			throw new InventoryRuleViolationError(
				'This unit serial has already been replaced',
			);
		}
		return updated;
	}

	/**
	 * Moves a unit to a new status, enforcing the kind/transition matrix.
	 *
	 * @param unitId - The unit to transition
	 * @param status - The destination status
	 * @throws {UnitNotFoundError} When the unit is absent
	 * @throws {InventoryRuleViolationError} When the transition is illegal
	 */
	async transitionUnit(
		unitId: string,
		status: UnitStatus,
	): Promise<TSerialTrackedItemSelect> {
		const unit = await this.serialUnitRepository.findById(unitId);
		if (!unit) throw new UnitNotFoundError();

		const item = await this.getItem(unit.itemId);
		assertTransitionAllowed(
			item.itemKind as ItemKind,
			unit.status as UnitStatus,
			status,
		);

		const updated = await this.serialUnitRepository.updateStatus(unitId, status);
		if (!updated) throw new UnitNotFoundError();
		return updated;
	}

	/**
	 * Enforces the item shape rules.
	 *
	 * @throws {InventoryRuleViolationError} When the shape is impossible
	 */
	private assertItemShape(data: TItemCreateData): void {
		if (data.itemKind === 'service') {
			if (data.isSerialized || data.isStockTracked) {
				throw new InventoryRuleViolationError(
					'A service is never serialized and never stock-tracked',
				);
			}
		}
		if (data.isSerialized && !data.isStockTracked) {
			throw new InventoryRuleViolationError(
				'A serialized item must be stock-tracked',
			);
		}
	}
}
