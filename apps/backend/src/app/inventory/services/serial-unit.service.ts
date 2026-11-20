/**
 * Serial-unit (physical instance) application service.
 *
 * @remarks
 * The product master moved to the `product` module but the physical units stay
 * in `inventory` (`item_serials`), because a unit's custody is an inventory
 * fact (ADR-0026). This service owns the rules the schema cannot express,
 * because a unit row does not know its product's kind without a contract call:
 *
 * - A non-serialized product has no units.
 * - A unit's status must be legal for its product's kind.
 * - A provisional serial is replaced exactly once.
 *
 * The product facts (kind, serialized flag, SKU) are read through
 * {@link EXPORTED_PRODUCT_SERVICE_TOKEN}, never by querying `product.*` here.
 */
import { inject, injectable } from 'tsyringe';
import type { TTx } from '@drizzle/types';
import type { TPaginationResult } from '@ims-erp/common';
import type { ProductKind } from '@drizzle/schemas/product.schema';
import type { SerialStatus, TItemSerialSelect } from '@drizzle/schemas/inventory.schema';
import { ITEM_SERIAL_REPOSITORY_TOKEN } from '../constants/di';
import { EXPORTED_PRODUCT_SERVICE_TOKEN } from '@app/product/constants/di';
import { assertTransitionAllowed, isStatusAllowedForKind } from '../constants/serial-matrix';
import type {
	IItemSerialRepository,
	TUnitPaginationRequest,
} from '../contracts/item-serial.repository.interface';
import {
	InventoryRuleViolationError,
	SerialNotFoundError,
	SerialNumberTakenError,
} from '../errors/inventory.errors';
import type { ExportedProductService } from '@app/product/services/exported-product.service';

/**
 * Product facts a unit needs.
 *
 * @remarks
 * `productKind` is `string` because it arrives from the product contract as a
 * plain `text` column value; the matrix narrows it.
 */
export type TUnitProductContext = Awaited<
	ReturnType<ExportedProductService['assertProduct']>
>;

/** Input for registering one unit. */
export type TRegisterUnitData = {
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
};

@injectable()
export class SerialUnitService {
	constructor(
		@inject(ITEM_SERIAL_REPOSITORY_TOKEN)
		private readonly units: IItemSerialRepository,
		@inject(EXPORTED_PRODUCT_SERVICE_TOKEN)
		private readonly products: Pick<ExportedProductService, 'assertProduct'>,
	) {}

	/** Fetches one filtered page of units. */
	paginate(
		request: TUnitPaginationRequest,
	): Promise<TPaginationResult<TItemSerialSelect>> {
		return this.units.paginate(request);
	}

	/**
	 * Registers a unit against a serialized product.
	 *
	 * @remarks
	 * A provisional serial (`isProvisionalSerial: true`) is only accepted on a
	 * `pre_order` unit — the schema check enforces the pairing and this method
	 * supplies a provisional serial number when the caller has none yet.
	 *
	 * @throws {ProductNotFoundError} When the product is absent or archived
	 * @throws {InventoryRuleViolationError} When the product is not serialized
	 * @throws {SerialNumberTakenError} When the serial is already used
	 */
	async registerUnit(
		productId: string,
		data: TRegisterUnitData,
		/** Joins an outer transaction (a goods receipt posts units with its movements). */
		tx?: TTx,
	): Promise<TItemSerialSelect> {
		const product = await this.products.assertProduct(productId);

		if (!product.isSerialized) {
			throw new InventoryRuleViolationError(
				`Product "${product.sku}" is not serialized and cannot have units`,
			);
		}

		const status = data.status ?? 'in_stock';
		// A brand-new unit has no previous status, so only the kind/status
		// pair is checked — not a transition edge.
		if (!isStatusAllowedForKind(product.productKind as ProductKind, status)) {
			throw new InventoryRuleViolationError(
				`A ${product.productKind} unit can never be "${status}"`,
			);
		}

		// A pre-ordered unit has no physical serial yet: mint a provisional one
		// that is replaced exactly once on receipt (ADR-0009).
		const isProvisional = status === 'pre_order';
		const serialNumber =
			data.serialNumber ??
			(isProvisional
				? `PO-${product.sku}-${Date.now().toString(36).toUpperCase()}`
				: null);
		if (!serialNumber) {
			throw new InventoryRuleViolationError(
				'A serial number is required unless the unit is pre-ordered',
			);
		}

		const existing = await this.units.findBySerial(
			data.organizationId ?? null,
			serialNumber,
		);
		if (existing) throw new SerialNumberTakenError();

		return this.units.create(
			{
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
			},
			tx,
		);
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
		const unit = await this.units.findById(unitId);
		if (!unit) throw new SerialNotFoundError();

		if (!unit.isProvisionalSerial || unit.status !== 'pre_order') {
			throw new InventoryRuleViolationError(
				'Only a pre-ordered unit with a provisional serial can have its serial replaced',
			);
		}

		const existing = await this.units.findBySerial(
			unit.organizationId,
			serialNumber,
		);
		if (existing) throw new SerialNumberTakenError();

		/** @throws {InventoryRuleViolationError} When it lost the race */
		const updated = await this.units.replaceProvisionalSerial(unitId, serialNumber);
		if (!updated) {
			throw new InventoryRuleViolationError(
				'This unit serial has already been replaced',
			);
		}
		return updated;
	}

	/** Serials of a product in stock in one warehouse, for picking a delivery (step 5a). */
	inStockSerials(productId: string, warehouseId: string): Promise<string[]> {
		return this.units.listInStockSerials(productId, warehouseId);
	}

	/**
	 * Sells serialized units shipped on a delivery note (`in_stock → sold`,
	 * ADR-0011 §4), inside the caller's transaction.
	 *
	 * @returns The serials that were not in stock in that warehouse (nothing
	 * to roll back here: the caller fails its transaction when any are left)
	 * @throws {InventoryRuleViolationError} When the product's kind cannot be sold
	 */
	async sellUnits(
		productId: string,
		serialNumbers: readonly string[],
		data: { warehouseId: string; customerId: string | null; movementId: string | null },
		tx: TTx,
	): Promise<string[]> {
		const product = await this.products.assertProduct(productId);
		assertTransitionAllowed(product.productKind as ProductKind, 'in_stock', 'sold');
		const sold = await this.units.sell(productId, serialNumbers, data, tx);
		return serialNumbers.filter((serial) => !sold.includes(serial));
	}

	/**
	 * Serials a purchase return may send back: `in_stock` or `damaged` in one
	 * warehouse (ERP-0068 / ERP-0065).
	 */
	supplierReturnableSerials(productId: string, warehouseId: string): Promise<string[]> {
		return this.units.listSerialsInStatuses(productId, warehouseId, ['in_stock', 'damaged']);
	}

	/**
	 * Takes sold units back from a customer (`sold → in_stock | damaged`,
	 * ERP-0065), inside the caller's transaction.
	 *
	 * @returns The serials that were not sold (the caller fails its
	 * transaction when any are left)
	 * @throws {InventoryRuleViolationError} When the product's kind cannot take that status
	 */
	async receiveCustomerUnits(
		productId: string,
		serialNumbers: readonly string[],
		data: { warehouseId: string; binId: string | null; status: 'in_stock' | 'damaged'; movementId: string | null },
		tx: TTx,
	): Promise<string[]> {
		const product = await this.products.assertProduct(productId);
		assertTransitionAllowed(product.productKind as ProductKind, 'sold', data.status);
		const received = await this.units.receiveFromCustomer(productId, serialNumbers, data, tx);
		return serialNumbers.filter((serial) => !received.includes(serial));
	}

	/**
	 * Returns serialized units to their supplier (`in_stock → returned`,
	 * ERP-0068), inside the caller's transaction.
	 *
	 * @returns The serials that were not in stock in that warehouse (the
	 * caller fails its transaction when any are left)
	 * @throws {InventoryRuleViolationError} When the product's kind cannot be returned
	 */
	async returnUnits(
		productId: string,
		serialNumbers: readonly string[],
		data: { warehouseId: string; movementId: string | null },
		tx: TTx,
	): Promise<string[]> {
		const product = await this.products.assertProduct(productId);
		assertTransitionAllowed(product.productKind as ProductKind, 'in_stock', 'returned');
		const returned = await this.units.returnToSupplier(productId, serialNumbers, data, tx);
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
		const unit = await this.units.findById(unitId);
		if (!unit) throw new SerialNotFoundError();

		if (!unit.productId) throw new SerialNotFoundError();
		const product = await this.products.assertProduct(unit.productId);
		assertTransitionAllowed(
			product.productKind as ProductKind,
			unit.status as SerialStatus,
			status,
		);

		const updated = await this.units.updateStatus(unitId, status);
		if (!updated) throw new SerialNotFoundError();
		return updated;
	}
}
