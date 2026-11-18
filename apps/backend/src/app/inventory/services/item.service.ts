import type { TTx } from '@drizzle/types';
import { inject, injectable } from 'tsyringe';
import { CODE_NUMBER_SERVICE_TOKEN } from '@app/code-number';
import type { CodeNumberService } from '@app/code-number';
import { InventoryAuditWriter } from './inventory-audit.writer';
import { SYSTEM_AUDIT_ACTOR } from '../constants/audit-actor';
import type { TInventoryAuditActor } from '../constants/audit-actor';
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
	TItemListRow,
	TItemPaginationRequest,
	TItemUpdateData,
} from '../contracts/item.repository.interface';
import type {
	ISerialUnitRepository,
	TUnitPaginationRequest,
} from '../contracts/serial-unit.repository.interface';
import type { IItemCategoryRepository } from '../contracts/item-category.repository.interface';
import {
	ITEM_CATEGORY_REPOSITORY_TOKEN,
	ITEM_REPOSITORY_TOKEN,
	SERIAL_UNIT_REPOSITORY_TOKEN,
} from '../constants/di';
import {
	InventoryRuleViolationError,
	ItemCategoryUnavailableError,
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
 * - `sold` and `applied_warranty` are product-only.
 * - Every consumable kind additionally reaches `sold`/`applied_warranty`.
 *
 * ERP-0036 removed `tool` and `service` as item kinds, and `borrowed` moved
 * with the borrowing engine to `assets` (Slice 3).
 */
const STATUSES_BY_KIND: Record<ItemKind, readonly UnitStatus[]> = {
	product: ['pre_order', 'in_stock', 'lost', 'sold', 'applied_warranty', 'returned', 'damaged'],
	component: ['pre_order', 'in_stock', 'lost', 'sold', 'applied_warranty', 'returned', 'damaged'],
	material: ['pre_order', 'in_stock', 'lost', 'sold', 'applied_warranty', 'returned', 'damaged'],
};

/**
 * Code type each item kind is numbered with (ERP-0043).
 *
 * @remarks
 * One series per kind, so a product can never consume a material number.
 * `itemKind` arrives as a plain `text` value from the schema insert type, so
 * {@link itemCodeType} narrows it instead of indexing this map directly.
 */
const ITEM_CODE_TYPES = {
	product: 'item_product',
	material: 'item_material',
	component: 'item_component',
} as const satisfies Record<ItemKind, string>;

/** Narrows a stored `item_kind` to its code type. */
function itemCodeType(kind: string) {
	const codeType = ITEM_CODE_TYPES[kind as ItemKind];
	if (!codeType) {
		throw new InventoryRuleViolationError(`Unknown item kind: ${kind}`);
	}
	return codeType;
}

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
		@inject(ITEM_CATEGORY_REPOSITORY_TOKEN)
		private readonly categoryRepository: Pick<IItemCategoryRepository, 'findById'>,
		/** Fire-and-forget audit writer (hardening plan D3). */
		private readonly audit: InventoryAuditWriter,
		/** ERP-0043: item codes are allocated, never typed. */
		@inject(CODE_NUMBER_SERVICE_TOKEN)
		private readonly numbering: Pick<CodeNumberService, 'next'>,
	) {}

	/**
	 * A newly chosen category must exist and be active; an item may keep the
	 * (now inactive) category it already has.
	 *
	 * @throws {ItemCategoryUnavailableError} When the category cannot be used
	 */
	private async assertCategory(categoryId: string | null | undefined, current?: string | null) {
		if (!categoryId || categoryId === current) return;
		const category = await this.categoryRepository.findById(categoryId);
		if (!category?.isActive) throw new ItemCategoryUnavailableError();
	}

	/** Fetches one filtered page of items. */
	paginate(
		request: TItemPaginationRequest,
	): Promise<TPaginationResult<TItemListRow>> {
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
	 * Active items among `ids`, for modules putting items on new documents
	 * (sales quotations). Missing, archived and inactive items are skipped;
	 * the caller reports which ones it did not get back.
	 */
	getActiveItems(ids: string[]): Promise<TItemSelect[]> {
		return this.itemRepository.findActiveByIds([...new Set(ids)]);
	}

	/**
	 * Creates an item.
	 *
	 * @remarks
	 * ERP-0043: the item `code` is allocated by the numbering authority per
	 * kind (`PRD-`/`MAT-`/`CMP-`); the client never sends it. `sku` and
	 * `serialNumber` stay user-typed, and the code is immutable afterwards.
	 *
	 * @throws {InventoryRuleViolationError} When the kind/data combination is
	 * impossible (e.g. a serialized service)
	 * @throws {ItemSkuTakenError} When the SKU is already used for this tenant
	 */
	async createItem(
		data: TItemCreateData,
		actor: TInventoryAuditActor = SYSTEM_AUDIT_ACTOR,
	): Promise<TItemSelect> {
		this.assertItemShape(data);
		await this.assertCategory(data.categoryId);

		const existing = await this.itemRepository.findBySku(
			data.organizationId ?? null,
			data.sku,
		);
		if (existing) throw new ItemSkuTakenError();

		const code = await this.numbering.next(itemCodeType(data.itemKind));
		const item = await this.itemRepository.create(data, code);
		await this.audit.record({
			actor,
			action: 'item.created',
			targetType: 'item',
			targetId: item.id,
			organizationId: item.organizationId,
			meta: {
				code: item.code,
				sku: item.sku,
				name: item.name,
				itemKind: item.itemKind,
			},
		});
		return item;
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
		actor: TInventoryAuditActor = SYSTEM_AUDIT_ACTOR,
	): Promise<TItemSelect> {
		const current = await this.getItem(id);
		await this.assertCategory(data.categoryId, current.categoryId);

		if (Object.keys(data).length > 0) {
			this.assertItemShape({
				...current,
				...data,
			} as TItemCreateData);
		}

		const updated = await this.itemRepository.update(id, data);
		if (!updated) throw new ItemNotFoundError();
		await this.audit.record({
			actor,
			action: 'item.updated',
			targetType: 'item',
			targetId: id,
			organizationId: updated.organizationId,
			meta: InventoryAuditWriter.snapshot(
				{
					name: current.name,
					purchasePrice: current.purchasePrice,
					sellingPrice: current.sellingPrice,
					description: current.description,
				},
				{
					name: updated.name,
					purchasePrice: updated.purchasePrice,
					sellingPrice: updated.sellingPrice,
					description: updated.description,
				},
			),
		});
		return updated;
	}

	/**
	 * Archives an item.
	 *
	 * @throws {ItemNotFoundError} When the item is absent or archived
	 * @throws {ItemHasUnitsError} When live units still reference it
	 */
	async archiveItem(
		id: string,
		actor: TInventoryAuditActor = SYSTEM_AUDIT_ACTOR,
	): Promise<TItemSelect> {
		await this.getItem(id);

		const units = await this.itemRepository.countUnits(id);
		if (units > 0) throw new ItemHasUnitsError(units);

		const archived = await this.itemRepository.archive(id);
		if (!archived) throw new ItemNotFoundError();
		await this.audit.record({
			actor,
			action: 'item.archived',
			targetType: 'item',
			targetId: id,
			organizationId: archived.organizationId,
			meta: { sku: archived.sku },
		});
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
			/** Procurement link of a received unit (ADR-0011 step 4b). */
			purchaseOrderLineId?: string | null;
			stockMovementId?: string | null;
		},
		/** Joins an outer transaction (a goods receipt posts units with its movements). */
		tx?: TTx,
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
			purchaseOrderLineId: data.purchaseOrderLineId ?? null,
			customerId: null,
			stockMovementId: data.stockMovementId ?? null,
			notes: data.notes ?? null,
		}, tx);
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

	/** Serials of an item in stock in one warehouse, for picking a delivery (step 5a). */
	inStockSerials(itemId: string, warehouseId: string): Promise<string[]> {
		return this.serialUnitRepository.listInStockSerials(itemId, warehouseId);
	}

	/**
	 * Sells serialized units shipped on a delivery note (`in_stock → sold`,
	 * ADR-0011 §4), inside the caller's transaction.
	 *
	 * @returns The serials that were not in stock in that warehouse (nothing
	 * to roll back here: the caller fails its transaction when any are left)
	 * @throws {InventoryRuleViolationError} When the item's kind cannot be sold
	 */
	async sellUnits(
		itemId: string,
		serialNumbers: readonly string[],
		data: { warehouseId: string; customerId: string | null; stockMovementId: string | null },
		tx: TTx,
	): Promise<string[]> {
		const item = await this.getItem(itemId);
		assertTransitionAllowed(item.itemKind as ItemKind, 'in_stock', 'sold');
		const sold = await this.serialUnitRepository.sell(itemId, serialNumbers, data, tx);
		return serialNumbers.filter((serial) => !sold.includes(serial));
	}

	/**
	 * Serials a purchase return may send back: `in_stock` or `damaged` in one
	 * warehouse (ERP-0068 / ERP-0065).
	 */
	supplierReturnableSerials(itemId: string, warehouseId: string): Promise<string[]> {
		return this.serialUnitRepository.listSerialsInStatuses(itemId, warehouseId, ['in_stock', 'damaged']);
	}

	/**
	 * Takes sold units back from a customer (`sold → in_stock | damaged`,
	 * ERP-0065), inside the caller's transaction.
	 *
	 * @returns The serials that were not sold (the caller fails its
	 * transaction when any are left)
	 * @throws {InventoryRuleViolationError} When the item's kind cannot take that status
	 */
	async receiveCustomerUnits(
		itemId: string,
		serialNumbers: readonly string[],
		data: { warehouseId: string; binId: string | null; status: 'in_stock' | 'damaged'; stockMovementId: string | null },
		tx: TTx,
	): Promise<string[]> {
		const item = await this.getItem(itemId);
		assertTransitionAllowed(item.itemKind as ItemKind, 'sold', data.status);
		const received = await this.serialUnitRepository.receiveFromCustomer(itemId, serialNumbers, data, tx);
		return serialNumbers.filter((serial) => !received.includes(serial));
	}

	/**
	 * Returns serialized units to their supplier (`in_stock → returned`,
	 * ERP-0068), inside the caller's transaction.
	 *
	 * @returns The serials that were not in stock in that warehouse (the
	 * caller fails its transaction when any are left)
	 * @throws {InventoryRuleViolationError} When the item's kind cannot be returned
	 */
	async returnUnits(
		itemId: string,
		serialNumbers: readonly string[],
		data: { warehouseId: string; stockMovementId: string | null },
		tx: TTx,
	): Promise<string[]> {
		const item = await this.getItem(itemId);
		assertTransitionAllowed(item.itemKind as ItemKind, 'in_stock', 'returned');
		const returned = await this.serialUnitRepository.returnToSupplier(itemId, serialNumbers, data, tx);
		return serialNumbers.filter((serial) => !returned.includes(serial));
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
		if (data.isSerialized && !data.isStockTracked) {
			throw new InventoryRuleViolationError(
				'A serialized item must be stock-tracked',
			);
		}
	}
}
