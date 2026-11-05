import { describe, expect, it } from 'bun:test';
import {
	ITEM_KINDS,
	UNIT_STATUSES,
	type ItemKind,
	type UnitStatus,
} from '@drizzle/schemas/inventory.schema';
import {
	assertTransitionAllowed,
	isStatusAllowedForKind,
} from '../../src/app/inventory/services/item.service';
import { InventoryRuleViolationError } from '../../src/app/inventory/errors/inventory.errors';

/**
 * Exhaustive coverage of the kind × status matrix.
 *
 * @remarks
 * This matrix is the module's central business rule — a serialized consumable
 * passes through `borrowed` while it is out, and no unit is ever `ready` (that
 * is the **asset** vocabulary). Every pair is asserted explicitly rather than
 * spot-checked, because a hole here silently corrupts unit state in the stock
 * and borrowing flows that build on it.
 *
 * ERP-0036 removed `tool` and `service`; `borrowed` stays until borrowing moves
 * to `assets` (Slice 3).
 */

/** Statuses a kind may hold, per ADR-0008. Source of truth for the assertions. */
const EXPECTED: Record<ItemKind, readonly UnitStatus[]> = {
	product: ['pre_order', 'in_stock', 'borrowed', 'lost', 'sold', 'applied_warranty'],
	component: ['pre_order', 'in_stock', 'borrowed', 'lost', 'sold', 'applied_warranty'],
	material: ['pre_order', 'in_stock', 'borrowed', 'lost', 'sold', 'applied_warranty'],
};

describe('item kind × status matrix', () => {
	describe('isStatusAllowedForKind', () => {
		for (const kind of ITEM_KINDS) {
			for (const status of UNIT_STATUSES) {
				const allowed = EXPECTED[kind].includes(status);
				it(`${kind} + ${status} → ${allowed ? 'allowed' : 'rejected'}`, () => {
					expect(isStatusAllowedForKind(kind, status)).toBe(allowed);
				});
			}
		}
	});

	describe('consumption rules from the requirements', () => {
		it('a material can be sold', () => {
			expect(isStatusAllowedForKind('material', 'sold')).toBe(true);
		});

		it('a component can be applied to warranty', () => {
			expect(isStatusAllowedForKind('component', 'applied_warranty')).toBe(
				true,
			);
		});
	});

	describe('assertTransitionAllowed', () => {
		it('rejects an illegal edge even when the destination is legal', () => {
			// `pre_order` cannot jump straight to `borrowed`; it must be received
			// into stock first.
			expect(() =>
				assertTransitionAllowed('product', 'pre_order', 'borrowed'),
			).toThrow(InventoryRuleViolationError);
		});

		it('allows in_stock → borrowed', () => {
			expect(() =>
				assertTransitionAllowed('product', 'in_stock', 'borrowed'),
			).not.toThrow();
		});

		it('allows borrowed → in_stock (return)', () => {
			expect(() =>
				assertTransitionAllowed('product', 'borrowed', 'in_stock'),
			).not.toThrow();
		});

		it('allows in_stock → sold for a product', () => {
			expect(() =>
				assertTransitionAllowed('product', 'in_stock', 'sold'),
			).not.toThrow();
		});

		it('treats lost as terminal', () => {
			for (const to of UNIT_STATUSES) {
				expect(() => assertTransitionAllowed('product', 'lost', to)).toThrow(
					InventoryRuleViolationError,
				);
			}
		});

		it('treats sold as terminal', () => {
			for (const to of UNIT_STATUSES) {
				expect(() => assertTransitionAllowed('product', 'sold', to)).toThrow(
					InventoryRuleViolationError,
				);
			}
		});

		it('names the rule in the error so the envelope can explain it', () => {
			try {
				assertTransitionAllowed('product', 'pre_order', 'borrowed');
				throw new Error('expected a violation');
			} catch (error) {
				expect(error).toBeInstanceOf(InventoryRuleViolationError);
				const violation = error as InventoryRuleViolationError;
				expect(violation.status).toBe(422);
				expect(violation.rule).toContain('pre_order');
				expect(violation.rule).toContain('borrowed');
			}
		});
	});
});
