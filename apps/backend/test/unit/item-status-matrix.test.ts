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
 * This matrix is the module's central business rule — a tool can only be
 * borrowed, and `sold` / `applied_warranty` are product-only. Every pair is
 * asserted explicitly rather than spot-checked, because a hole here silently
 * corrupts unit state in the stock and borrowing flows that build on it.
 */

/** Statuses a kind may hold, per ADR-0008. Source of truth for the assertions. */
const EXPECTED: Record<ItemKind, readonly UnitStatus[]> = {
	product: ['pre_order', 'in_stock', 'borrowed', 'lost', 'sold', 'applied_warranty'],
	component: ['pre_order', 'in_stock', 'borrowed', 'lost', 'sold', 'applied_warranty'],
	material: ['pre_order', 'in_stock', 'borrowed', 'lost', 'sold', 'applied_warranty'],
	tool: ['pre_order', 'in_stock', 'borrowed', 'lost'],
	service: [],
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
		it('a tool can be borrowed', () => {
			expect(isStatusAllowedForKind('tool', 'borrowed')).toBe(true);
		});

		it('a tool can never be sold', () => {
			expect(isStatusAllowedForKind('tool', 'sold')).toBe(false);
		});

		it('a tool can never be applied to warranty', () => {
			expect(isStatusAllowedForKind('tool', 'applied_warranty')).toBe(false);
		});

		it('a material can be sold', () => {
			expect(isStatusAllowedForKind('material', 'sold')).toBe(true);
		});

		it('a component can be applied to warranty', () => {
			expect(isStatusAllowedForKind('component', 'applied_warranty')).toBe(
				true,
			);
		});

		it('a service can never hold any unit status', () => {
			for (const status of UNIT_STATUSES) {
				expect(isStatusAllowedForKind('service', status)).toBe(false);
			}
		});
	});

	describe('assertTransitionAllowed', () => {
		it('rejects a kind that can never hold the destination status', () => {
			expect(() =>
				assertTransitionAllowed('tool', 'in_stock', 'sold'),
			).toThrow(InventoryRuleViolationError);
		});

		it('rejects an illegal edge even when the destination is legal', () => {
			// `pre_order` cannot jump straight to `borrowed`; it must be received
			// into stock first.
			expect(() =>
				assertTransitionAllowed('product', 'pre_order', 'borrowed'),
			).toThrow(InventoryRuleViolationError);
		});

		it('allows in_stock → borrowed for a tool', () => {
			expect(() =>
				assertTransitionAllowed('tool', 'in_stock', 'borrowed'),
			).not.toThrow();
		});

		it('allows borrowed → in_stock (return)', () => {
			expect(() =>
				assertTransitionAllowed('tool', 'borrowed', 'in_stock'),
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
				assertTransitionAllowed('tool', 'in_stock', 'sold');
				throw new Error('expected a violation');
			} catch (error) {
				expect(error).toBeInstanceOf(InventoryRuleViolationError);
				const violation = error as InventoryRuleViolationError;
				expect(violation.status).toBe(422);
				expect(violation.rule).toContain('tool');
				expect(violation.rule).toContain('sold');
			}
		});
	});
});
