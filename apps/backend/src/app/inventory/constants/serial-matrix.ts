/**
 * Unit status matrix and the item-kind guard.
 *
 * @remarks
 * Moved out of `product.service.ts` when the serial units stayed in the
 * `inventory` module while the product master moved to `product` (ADR-0026).
 * Pure functions with no I/O, exported separately so the matrix can be tested
 * exhaustively without building a database.
 *
 * `UNIT_STATUS_TRANSITIONS` in `inventory.schema.ts` describes where a status
 * may go; this file describes which statuses a kind may hold **at all**:
 * - `sold` and `applied_warranty` are product-only (tools can never be sold).
 * - `inactive` in the item lifecycle is not a unit status.
 */
import type { ProductKind } from '@drizzle/schemas/product.schema';
import type { SerialStatus } from '@drizzle/schemas/inventory.schema';
import { SERIAL_STATUS_TRANSITIONS } from './serial-status';
import { InventoryRuleViolationError } from '../errors/inventory.errors';

const STATUSES_BY_KIND: Record<ProductKind, readonly SerialStatus[]> = {
	product: ['pre_order', 'in_stock', 'lost', 'sold', 'applied_warranty', 'returned', 'damaged', 'issued'],
	component: ['pre_order', 'in_stock', 'lost', 'sold', 'applied_warranty', 'returned', 'damaged', 'issued'],
	material: ['pre_order', 'in_stock', 'lost', 'sold', 'applied_warranty', 'returned', 'damaged', 'issued'],
};

/**
 * Returns whether `productKind` accepts `status` at all.
 *
 * @param productKind - The kind of the product the unit belongs to
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
 * @param productKind - The kind of the product the unit belongs to
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
