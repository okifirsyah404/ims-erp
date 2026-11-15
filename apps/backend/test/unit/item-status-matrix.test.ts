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
 * This matrix is the module's central business rule — no unit is ever `ready`
 * or `borrowed` (those are the **asset** vocabulary). Every pair is asserted
 * explicitly rather than spot-checked, because a hole here silently corrupts
 * unit state in the stock flows that build on it.
 *
 * ERP-0036 removed `tool` and `service`, and moved `borrowed` to `assets`
 * (Slice 3).
 */

/** Statuses a kind may hold, per ADR-0008. Source of truth for the assertions. */
const EXPECTED: Record<ItemKind, readonly UnitStatus[]> = {
	// ERP-0061: any stocked unit can go back to its supplier.
	product: ['pre_order', 'in_stock', 'lost', 'sold', 'applied_warranty', 'returned', 'damaged'],
	component: ['pre_order', 'in_stock', 'lost', 'sold', 'applied_warranty', 'returned', 'damaged'],
	material: ['pre_order', 'in_stock', 'lost', 'sold', 'applied_warranty', 'returned', 'damaged'],
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
			// `pre_order` cannot jump straight to `sold`; it must be received
			// into stock first.
			expect(() =>
				assertTransitionAllowed('product', 'pre_order', 'sold'),
			).toThrow(InventoryRuleViolationError);
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

		it('lets a sold unit only come back from a customer (ERP-0062)', () => {
			for (const to of UNIT_STATUSES) {
				if (to === 'in_stock' || to === 'damaged') {
					expect(() => assertTransitionAllowed('product', 'sold', to)).not.toThrow();
				} else {
					expect(() => assertTransitionAllowed('product', 'sold', to)).toThrow(
						InventoryRuleViolationError,
					);
				}
			}
		});

		it('treats returned as terminal (ERP-0061)', () => {
			for (const to of UNIT_STATUSES) {
				expect(() => assertTransitionAllowed('product', 'returned', to)).toThrow(
					InventoryRuleViolationError,
				);
			}
		});

		it('names the rule in the error so the envelope can explain it', () => {
			try {
				assertTransitionAllowed('product', 'pre_order', 'sold');
				throw new Error('expected a violation');
			} catch (error) {
				expect(error).toBeInstanceOf(InventoryRuleViolationError);
				const violation = error as InventoryRuleViolationError;
				expect(violation.status).toBe(422);
				expect(violation.rule).toContain('pre_order');
				expect(violation.rule).toContain('sold');
			}
		});
	});
});
