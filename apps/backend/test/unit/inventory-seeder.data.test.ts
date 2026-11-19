/**
 * Guard tests for the inventory seeder's data (ADR-0024 Q14/Q24).
 *
 * @remarks
 * The seeder runs against a live database, which is not available in CI, so the
 * values it inserts are asserted statically instead. This catches the failure
 * mode a type system cannot: a seed row that violates a **CHECK constraint** at
 * insert time, which would only surface when someone runs `drizzle:seed` on a
 * fresh database.
 *
 * The constraints mirrored here are from `inventory.schema.ts`:
 * - `products_kind_check` - the three product kinds.
 * - `products_prices_check` - prices >= 0.
 * - `products_min_stock_check` - `min_stock_qty >= 0`.
 * - `items_status_check` / `items_condition_check` - the item unit matrix.
 */
import { describe, expect, test } from 'bun:test';
import {
	ITEM_CONDITIONS,
	ITEM_STATUSES,
	PRODUCT_KINDS,
} from '@drizzle/schemas/inventory.schema';

/**
 * The seeded catalogue, mirroring `SEED_PRODUCTS` in
 * `database/seeders/seed/inventory.seeder.ts`.
 *
 * @remarks
 * Duplicated rather than imported because the seeder module opens a database
 * connection at import time. The shape is asserted against the real schema
 * vocabulary below, so a drift in kinds or units fails here.
 */
const SEED_PRODUCTS = [
	{
		sku: 'CTRL-DOOR-01',
		productKind: 'product',
		isSerialized: true,
		isStockTracked: true,
		minStockQty: '2.000',
		sellingPrice: 2_500_000,
		purchasePrice: 1_800_000,
		serials: ['DC-2026-0001', 'DC-2026-0002'],
	},
	{
		sku: 'CMP-PSU-12V',
		productKind: 'component',
		isSerialized: false,
		isStockTracked: true,
		minStockQty: '10.000',
		sellingPrice: 250_000,
		purchasePrice: 150_000,
		serials: [],
	},
	{
		sku: 'MAT-CABLE-CAT6',
		productKind: 'material',
		isSerialized: false,
		isStockTracked: true,
		minStockQty: '100.000',
		sellingPrice: 12_000,
		purchasePrice: 7_500,
		serials: [],
	},
] as const;

/** The seeded tool fleet, mirroring `SEED_ITEMS` in the same seeder. */
const SEED_ITEMS = [
	{ code: 'AST-SEED-001', itemKind: 'tool', status: 'borrowed', condition: 'good' },
	{ code: 'AST-SEED-002', itemKind: 'tool', status: 'ready', condition: 'good' },
	{ code: 'AST-SEED-003', itemKind: 'tool', status: 'lost', condition: 'damaged' },
	{ code: 'AST-SEED-004', itemKind: 'tool', status: 'ready', condition: 'good' },
	{ code: 'AST-SEED-005', itemKind: 'tool', status: 'ready', condition: 'fair' },
	{ code: 'AST-SEED-006', itemKind: 'equipment', status: 'ready', condition: 'good' },
] as const;

describe('seeded products satisfy the schema CHECK constraints', () => {
	test('every kind is a known product kind', () => {
		for (const product of SEED_PRODUCTS) {
			expect(PRODUCT_KINDS).toContain(product.productKind);
		}
	});

	test('every product kind is represented', () => {
		// The seed exists to give every kind a row, because kind drives the
		// serial and stock-tracking matrix.
		expect(new Set(SEED_PRODUCTS.map((p) => p.productKind)).size).toBe(
			PRODUCT_KINDS.length,
		);
	});

	test('prices are non-negative', () => {
		for (const product of SEED_PRODUCTS) {
			expect(product.sellingPrice).toBeGreaterThanOrEqual(0);
			expect(product.purchasePrice).toBeGreaterThanOrEqual(0);
		}
	});

	test('minStockQty is non-negative and has numeric(18,3) scale', () => {
		for (const product of SEED_PRODUCTS) {
			expect(Number(product.minStockQty)).toBeGreaterThanOrEqual(0);
			expect(product.minStockQty).toMatch(/^\d+\.\d{3}$/);
		}
	});

	test('SKUs are unique', () => {
		expect(new Set(SEED_PRODUCTS.map((p) => p.sku)).size).toBe(SEED_PRODUCTS.length);
	});

	test('only serialized products carry serial numbers', () => {
		for (const product of SEED_PRODUCTS) {
			if (!product.isSerialized) expect(product.serials).toHaveLength(0);
		}
	});
});

describe('seeded item units use the schema vocabularies', () => {
	test('every status and condition is a known value', () => {
		for (const item of SEED_ITEMS) {
			expect(ITEM_STATUSES).toContain(item.status);
			expect(ITEM_CONDITIONS).toContain(item.condition);
		}
	});

	test('codes are unique', () => {
		expect(new Set(SEED_ITEMS.map((i) => i.code)).size).toBe(SEED_ITEMS.length);
	});

	test('serial numbers are unique across the products', () => {
		const all = SEED_PRODUCTS.flatMap((product) => product.serials);
		expect(new Set(all).size).toBe(all.length);
	});
});
