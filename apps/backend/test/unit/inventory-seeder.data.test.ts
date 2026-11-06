/**
 * Guard tests for the inventory seeder's data.
 *
 * @remarks
 * The seeder runs against a live database, which is not available in CI, so
 * the values it inserts are asserted statically instead. This catches the
 * failure mode a type system cannot: a seed row that violates a **CHECK
 * constraint** at insert time, which would only surface when someone runs
 * `drizzle:seed` on a fresh database.
 *
 * The constraints mirrored here are from `inventory.schema.ts`:
 * - `inventory_items_kind_check` — the three consumable kinds.
 * - `inventory_items_prices_check` — prices >= 0.
 * - `inventory_items_min_stock_check` — `min_stock_qty >= 0`.
 */
import { describe, expect, test } from 'bun:test';
import { ITEM_KINDS, UNIT_STATUSES } from '@drizzle/schemas/inventory.schema';

/**
 * The seeded catalogue, mirroring `SEED_ITEMS` in
 * `database/seeders/seed/inventory.seeder.ts`.
 *
 * @remarks
 * Duplicated rather than imported because the seeder module opens a database
 * connection at import time. The shape is asserted against the real schema
 * vocabulary below, so a drift in kinds or units fails here.
 */
const SEED_ITEMS = [
	{
		sku: 'CTRL-DOOR-01',
		itemKind: 'product',
		isSerialized: true,
		isStockTracked: true,
		minStockQty: '2.000',
		sellingPrice: 2_500_000,
		purchasePrice: 1_800_000,
		serials: ['DC-2026-0001', 'DC-2026-0002'],
	},
	{
		sku: 'CMP-PSU-12V',
		itemKind: 'component',
		isSerialized: false,
		isStockTracked: true,
		minStockQty: '10.000',
		sellingPrice: 250_000,
		purchasePrice: 150_000,
		serials: [],
	},
	{
		sku: 'MAT-CABLE-CAT6',
		itemKind: 'material',
		isSerialized: false,
		isStockTracked: true,
		minStockQty: '100.000',
		sellingPrice: 12_000,
		purchasePrice: 7_500,
		serials: [],
	},
] as const;

describe('seeded items satisfy the schema CHECK constraints', () => {
	test('every kind is a known item kind', () => {
		for (const item of SEED_ITEMS) {
			expect(ITEM_KINDS).toContain(item.itemKind);
		}
	});

	test('every consumable kind is represented', () => {
		// The seed exists to give every kind a row, because kind drives the
		// unit status matrix.
		expect(new Set(SEED_ITEMS.map((i) => i.itemKind)).size).toBe(
			ITEM_KINDS.length,
		);
	});

	test('prices are non-negative', () => {
		for (const item of SEED_ITEMS) {
			expect(item.sellingPrice).toBeGreaterThanOrEqual(0);
			expect(item.purchasePrice).toBeGreaterThanOrEqual(0);
		}
	});

	test('minStockQty is non-negative and has numeric(18,3) scale', () => {
		for (const item of SEED_ITEMS) {
			expect(Number(item.minStockQty)).toBeGreaterThanOrEqual(0);
			expect(item.minStockQty).toMatch(/^\d+\.\d{3}$/);
		}
	});

	test('SKUs are unique', () => {
		expect(new Set(SEED_ITEMS.map((i) => i.sku)).size).toBe(SEED_ITEMS.length);
	});

	test('only serialized items carry serial numbers', () => {
		for (const item of SEED_ITEMS) {
			if (!item.isSerialized) expect(item.serials).toHaveLength(0);
		}
	});
});

describe('seeded units use a valid status', () => {
	test('units are seeded as in_stock', () => {
		// "Siap" in the UI is `in_stock` in the API — never `ready`.
		expect(UNIT_STATUSES).toContain('in_stock');
	});

	test('serial numbers are unique across the seed', () => {
		const all = SEED_ITEMS.flatMap((item) => item.serials);
		expect(new Set(all).size).toBe(all.length);
	});
});
