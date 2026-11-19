import type { TTx } from '@drizzle/types';
import { inject, injectable } from 'tsyringe';
import { InventoryAuditWriter } from './inventory-audit.writer';
import type { InventoryNumberingService } from './inventory-numbering.service';
import { SYSTEM_AUDIT_ACTOR } from '../constants/audit-actor';
import type { TInventoryAuditActor } from '../constants/audit-actor';
import type { TPaginationResult } from '@ims-erp/common';
import type {
	ProductKind,
	TProductSelect,
	TItemSerialSelect,
	SerialStatus,
} from '@drizzle/schemas/inventory.schema';
import { SERIAL_STATUS_TRANSITIONS } from '../constants/serial-status';
import type {
	IProductRepository,
	TProductCreateData,
	TProductListRow,
	TProductPaginationRequest,
	TProductUpdateData,
} from '../contracts/product.repository.interface';
import type {
	IItemSerialRepository,
	TUnitPaginationRequest,
} from '../contracts/item-serial.repository.interface';
import type { IProductCategoryRepository } from '../contracts/product-category.repository.interface';
import {
	INVENTORY_NUMBERING_SERVICE_TOKEN,
	PRODUCT_CATEGORY_REPOSITORY_TOKEN,
	PRODUCT_REPOSITORY_TOKEN,
	ITEM_SERIAL_REPOSITORY_TOKEN,
} from '../constants/di';
import {
	InventoryRuleViolationError,
	ProductCategoryUnavailableError,
	ProductHasSerialsError,
	ProductNotFoundError,
	ProductSkuTakenError,
	SerialNumberTakenError,
	SerialNotFoundError,
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
const STATUSES_BY_KIND: Record<ProductKind, readonly SerialStatus[]> = {
	product: ['pre_order', 'in_stock', 'lost', 'sold', 'applied_warranty', 'returned', 'damaged'],
	component: ['pre_order', 'in_stock', 'lost', 'sold', 'applied_warranty', 'returned', 'damaged'],
	material: ['pre_order', 'in_stock', 'lost', 'sold', 'applied_warranty', 'returned', 'damaged'],
};

/**
 * Code type each item kind is numbered with (ERP-0043).
 *
 * @remarks
 * One series per kind, so a product can never consume a material number.
 * `productKind` arrives as a plain `text` value from the schema insert type, so
 * {@link productCodeType} narrows it instead of indexing this map directly.
 */
const PRODUCT_CODE_TYPES = {
	product: 'item_product',
	material: 'item_material',
	component: 'item_component',
} as const satisfies Record<ProductKind, string>;

/** Narrows a stored `item_kind` to its code type. */
function productCodeType(kind: string) {
	const codeType = PRODUCT_CODE_TYPES[kind as ProductKind];
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
 * {@link ProductService} so the matrix can be tested exhaustively without
 * building a database.
 */

/**
 * Returns whether `productKind` accepts `status` at all.
 *
 * @param productKind - The kind of the item the unit belongs to
 * @param status - The status being requested
 */
export function isStatusAllowedForKind(
	productKind: ProductKind,
	status: SerialStatus,
): boolean {
	return STATUSES_BY_KIND[productKind].includes(status);
}

/**
 * Asserts that a status transition is legal for the kind.
 *
 * @remarks
 * Checks both the kind/status pair and the from→to edge, because a legal
 * destination can still be illegal from the current state.
 *
 * @param productKind - The kind of the item the unit belongs to
 * @param from - Current status
 * @param to - Requested status
 * @throws {InventoryRuleViolationError} When either check fails
 */
export function assertTransitionAllowed(
	productKind: ProductKind,
	from: SerialStatus,
	to: SerialStatus,
): void {
	if (!isStatusAllowedForKind(productKind, to)) {
		throw new InventoryRuleViolationError(
			`A ${productKind} unit can never be "${to}"`,
		);
	}
	if (!SERIAL_STATUS_TRANSITIONS[from].includes(to)) {
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
export class ProductService {
	constructor(
		@inject(PRODUCT_REPOSITORY_TOKEN)
		private readonly productRepository: IProductRepository,
		@inject(ITEM_SERIAL_REPOSITORY_TOKEN)
		private readonly itemSerialRepository: IItemSerialRepository,
		@inject(PRODUCT_CATEGORY_REPOSITORY_TOKEN)
		private readonly categoryRepository: Pick<IProductCategoryRepository, 'findById'>,
		/** Fire-and-forget audit writer (hardening plan D3). */
		private readonly audit: InventoryAuditWriter,
		/** ERP-0043: product codes are allocated, never typed. */
		@inject(INVENTORY_NUMBERING_SERVICE_TOKEN)
		private readonly numbering: Pick<InventoryNumberingService, 'next'>,
	) {}

	/**
	 * A newly chosen category must exist and be active; an item may keep the
	 * (now inactive) category it already has.
	 *
	 * @throws {ProductCategoryUnavailableError} When the category cannot be used
	 */
	private async assertCategory(productCategoryId: string | null | undefined, current?: string | null) {
		if (!productCategoryId || productCategoryId === current) return;
		const category = await this.categoryRepository.findById(productCategoryId);
		if (!category?.isActive) throw new ProductCategoryUnavailableError();
	}

	/** Fetches one filtered page of items. */
	paginate(
		request: TProductPaginationRequest,
	): Promise<TPaginationResult<TProductListRow>> {
		return this.productRepository.paginate(request);
	}

	/**
	 * Fetches one item.
	 *
	 * @throws {ProductNotFoundError} When the item is absent or archived
	 */
	async getProduct(id: string): Promise<TProductSelect> {
		const item = await this.productRepository.findById(id);
		if (!item) throw new ProductNotFoundError();
		return item;
	}

	/**
	 * Active items among `ids`, for modules putting items on new documents
	 * (sales quotations). Missing, archived and inactive items are skipped;
	 * the caller reports which ones it did not get back.
	 */
	getActiveProducts(ids: string[]): Promise<TProductSelect[]> {
		return this.productRepository.findActiveByIds([...new Set(ids)]);
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
	 * @throws {ProductSkuTakenError} When the SKU is already used for this tenant
	 */
	async createProduct(
		data: TProductCreateData,
		actor: TInventoryAuditActor = SYSTEM_AUDIT_ACTOR,
	): Promise<TProductSelect> {
		this.assertProductShape(data);
		await this.assertCategory(data.productCategoryId);

		const existing = await this.productRepository.findBySku(
			data.organizationId ?? null,
			data.sku,
		);
		if (existing) throw new ProductSkuTakenError();

		const code = await this.numbering.next(productCodeType(data.productKind));
		const item = await this.productRepository.create(data, code);
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
				productKind: item.productKind,
			},
		});
		return item;
	}

	/**
	 * Updates an item.
	 *
	 * @remarks
	 * `sku` and `productKind` are deliberately not updatable: both are load
	 * bearing for uniqueness and for the status matrix, and changing either
	 * would silently invalidate existing units.
	 *
	 * @throws {ProductNotFoundError} When the item is absent or archived
	 * @throws {InventoryRuleViolationError} When the result would be impossible
	 */
	async updateProduct(
		id: string,
		data: TProductUpdateData,
		actor: TInventoryAuditActor = SYSTEM_AUDIT_ACTOR,
	): Promise<TProductSelect> {
		const current = await this.getProduct(id);
		await this.assertCategory(data.productCategoryId, current.productCategoryId);

		if (Object.keys(data).length > 0) {
			this.assertProductShape({
				...current,
				...data,
			} as TProductCreateData);
		}

		const updated = await this.productRepository.update(id, data);
		if (!updated) throw new ProductNotFoundError();
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
	 * @throws {ProductNotFoundError} When the item is absent or archived
	 * @throws {ProductHasSerialsError} When live units still reference it
	 */
	async archiveProduct(
		id: string,
		actor: TInventoryAuditActor = SYSTEM_AUDIT_ACTOR,
	): Promise<TProductSelect> {
		await this.getProduct(id);

		const units = await this.productRepository.countUnits(id);
		if (units > 0) throw new ProductHasSerialsError(units);

		const archived = await this.productRepository.archive(id);
		if (!archived) throw new ProductNotFoundError();
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
	): Promise<TPaginationResult<TItemSerialSelect>> {
		return this.itemSerialRepository.paginate(request);
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
		productId: string,
		data: {
			serialNumber?: string;
			organizationId?: string | null;
			status?: SerialStatus;
			warehouseId?: string | null;
			binId?: string | null;
			assetTag?: string | null;
			acquiredOn?: string | null;
			warrantyExpiresOn?: string | null;
			notes?: string | null;
			/** Procurement link of a received unit (ADR-0011 step 4b). */
			purchaseOrderLineId?: string | null;
			movementId?: string | null;
		},
		/** Joins an outer transaction (a goods receipt posts units with its movements). */
		tx?: TTx,
	): Promise<TItemSerialSelect> {
		const item = await this.getProduct(productId);

		if (!item.isSerialized) {
			throw new InventoryRuleViolationError(
				`Item "${item.sku}" is not serialized and cannot have units`,
			);
		}

		const status = data.status ?? 'in_stock';
		// A brand-new unit has no previous status, so only the kind/status
		// pair is checked — not a transition edge.
		if (!isStatusAllowedForKind(item.productKind as ProductKind, status)) {
			throw new InventoryRuleViolationError(
				`A ${item.productKind} unit can never be "${status}"`,
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

		const existing = await this.itemSerialRepository.findBySerial(
			data.organizationId ?? null,
			serialNumber,
		);
		if (existing) throw new SerialNumberTakenError();

		return this.itemSerialRepository.create({
			organizationId: data.organizationId ?? null,
			productId,
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
			movementId: data.movementId ?? null,
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
	 * @throws {SerialNotFoundError} When the unit is absent
	 * @throws {InventoryRuleViolationError} When the unit is not provisional or
	 * has already left `pre_order`
	 * @throws {SerialNumberTakenError} When the serial is already used
	 */
	async replaceProvisionalSerial(
		unitId: string,
		serialNumber: string,
	): Promise<TItemSerialSelect> {
		const unit = await this.itemSerialRepository.findById(unitId);
		if (!unit) throw new SerialNotFoundError();

		if (!unit.isProvisionalSerial || unit.status !== 'pre_order') {
			throw new InventoryRuleViolationError(
				'Only a pre-ordered unit with a provisional serial can have its serial replaced',
			);
		}

		const existing = await this.itemSerialRepository.findBySerial(
			unit.organizationId,
			serialNumber,
		);
		if (existing) throw new SerialNumberTakenError();

		const updated = await this.itemSerialRepository.replaceProvisionalSerial(
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
	inStockSerials(productId: string, warehouseId: string): Promise<string[]> {
		return this.itemSerialRepository.listInStockSerials(productId, warehouseId);
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
		productId: string,
		serialNumbers: readonly string[],
		data: { warehouseId: string; customerId: string | null; movementId: string | null },
		tx: TTx,
	): Promise<string[]> {
		const item = await this.getProduct(productId);
		assertTransitionAllowed(item.productKind as ProductKind, 'in_stock', 'sold');
		const sold = await this.itemSerialRepository.sell(productId, serialNumbers, data, tx);
		return serialNumbers.filter((serial) => !sold.includes(serial));
	}

	/**
	 * Serials a purchase return may send back: `in_stock` or `damaged` in one
	 * warehouse (ERP-0068 / ERP-0065).
	 */
	supplierReturnableSerials(productId: string, warehouseId: string): Promise<string[]> {
		return this.itemSerialRepository.listSerialsInStatuses(productId, warehouseId, ['in_stock', 'damaged']);
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
		productId: string,
		serialNumbers: readonly string[],
		data: { warehouseId: string; binId: string | null; status: 'in_stock' | 'damaged'; movementId: string | null },
		tx: TTx,
	): Promise<string[]> {
		const item = await this.getProduct(productId);
		assertTransitionAllowed(item.productKind as ProductKind, 'sold', data.status);
		const received = await this.itemSerialRepository.receiveFromCustomer(productId, serialNumbers, data, tx);
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
		productId: string,
		serialNumbers: readonly string[],
		data: { warehouseId: string; movementId: string | null },
		tx: TTx,
	): Promise<string[]> {
		const item = await this.getProduct(productId);
		assertTransitionAllowed(item.productKind as ProductKind, 'in_stock', 'returned');
		const returned = await this.itemSerialRepository.returnToSupplier(productId, serialNumbers, data, tx);
		return serialNumbers.filter((serial) => !returned.includes(serial));
	}

	/**
	 * Moves a unit to a new status, enforcing the kind/transition matrix.
	 *
	 * @param unitId - The unit to transition
	 * @param status - The destination status
	 * @throws {SerialNotFoundError} When the unit is absent
	 * @throws {InventoryRuleViolationError} When the transition is illegal
	 */
	async transitionUnit(
		unitId: string,
		status: SerialStatus,
	): Promise<TItemSerialSelect> {
		const unit = await this.itemSerialRepository.findById(unitId);
		if (!unit) throw new SerialNotFoundError();

		const item = await this.getProduct(unit.productId);
		assertTransitionAllowed(
			item.productKind as ProductKind,
			unit.status as SerialStatus,
			status,
		);

		const updated = await this.itemSerialRepository.updateStatus(unitId, status);
		if (!updated) throw new SerialNotFoundError();
		return updated;
	}

	/**
	 * Enforces the item shape rules.
	 *
	 * @throws {InventoryRuleViolationError} When the shape is impossible
	 */
	private assertProductShape(data: TProductCreateData): void {
		if (data.isSerialized && !data.isStockTracked) {
			throw new InventoryRuleViolationError(
				'A serialized item must be stock-tracked',
			);
		}
	}
}
