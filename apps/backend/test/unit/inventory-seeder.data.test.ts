/**
 * Guard tests for the seeded product and inventory data (ADR-0024 Q14/Q24,
 * ADR-0026 split).
 *
 * @remarks
 * The seeders run against a live database, which is not available in CI, so the
 * values they insert are asserted statically instead. This catches the failure
 * mode a type system cannot: a seed row that violates a **CHECK constraint** at
 * insert time, which would only surface when someone runs `drizzle:seed` on a
 * fresh database.
 *
 * The fixtures are read from the seeders themselves (`product.seeder.ts` and
 * `inventory.seeder.ts`) by extracting their module-private literal arrays with
 * a parser, because importing the modules would open a database connection.
 * The shape is asserted against the real schema vocabulary below, so a drift in
 * kinds, units, statuses or quantities fails here.
 *
 * Constraints mirrored from the schemas:
 * - `product.products_kind_check` - the three product kinds.
 * - `product.products_prices_check` - prices >= 0.
 * - `product.products_min_stock_check` - `min_stock_qty >= 0`.
 * - `inventory.items_status_check` / `items_condition_check` - the item matrix.
 * - `inventory.stocks_quantity_check` - quantities >= 0, `numeric(18,3)`.
 */
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ITEM_CONDITIONS, ITEM_STATUSES } from '@drizzle/schemas/inventory.schema';
import { PRODUCT_KINDS } from '@drizzle/schemas/product.schema';

const SEED_DIR = join(import.meta.dir, '../../database/seeders/seed');

/**
 * Extracts one `const <name> ... = [ ... ];` literal from a seeder source.
 *
 * @param file - Seeder file name under `database/seeders/seed`
 * @param name - The const to read
 * @returns The declared array, as data
 * @remarks
 * Bracket-matching on the source keeps this honest: the fixtures stay the
 * seeders' own values (no copy that can drift), and no database module is
 * imported.
 */
function readConst(file: string, name: string): unknown[] {
	const source = readFileSync(join(SEED_DIR, file), 'utf8');
	const declaration = new RegExp(`const ${name}[^=]*=\\s*\\[`).exec(source);
	if (!declaration) throw new Error(`const ${name} not found in ${file}`);
	const start = declaration.index + declaration[0].length - 1;

	let depth = 0;
	let end = -1;
	for (let index = start; index < source.length; index += 1) {
		const char = source[index];
		if (char === '[') depth += 1;
		if (char === ']') {
			depth -= 1;
			if (depth === 0) {
				end = index;
				break;
			}
		}
	}
	if (end < 0) throw new Error(`unbalanced literal for ${name} in ${file}`);
	// The slice is a plain literal (string/number/boolean/array values only),
	// so evaluating it is equivalent to reading it back.
	const literal = source.slice(start, end + 1).replace(/ as const$/, '');
	return new Function(`return ${literal};`)() as unknown[];
}

type TSeedProduct = {
	sku: string;
	name: string;
	productKind: string;
	unitLabel: string;
	isSerialized: boolean;
	isStockTracked: boolean;
	minStockQty: string;
	sellingPrice: number;
	purchasePrice: number;
	serials?: readonly string[];
};

type TSeedItem = {
	code: string;
	name: string;
	itemKind: string;
	serialNumber: string;
	status: string;
	condition: string;
	acquisitionCost: number;
};

/** The seeded catalogue, from `product.seeder.ts`. */
const SEED_PRODUCTS = readConst('product.seeder.ts', 'SEED_PRODUCTS') as TSeedProduct[];
/** The seeded product categories, from the same seeder. */
const WEBSITE_CATEGORIES = readConst(
	'product.seeder.ts',
	'WEBSITE_CATEGORIES',
) as Array<{ slug: string; name: string; shortName: string }>;
/** The seeded tool fleet, from `inventory.seeder.ts`. */
const SEED_ITEMS = readConst('inventory.seeder.ts', 'SEED_ITEMS') as TSeedItem[];
/** Opening stock of the global warehouse, from `inventory.seeder.ts`. */
const SEED_GLOBAL_STOCK = readConst(
	'inventory.seeder.ts',
	'SEED_GLOBAL_STOCK',
) as Array<{ sku: string; quantity: string }>;
/** Opening stock of the organization warehouse, from `inventory.seeder.ts`. */
const SEED_ORG_STOCK = readConst('inventory.seeder.ts', 'SEED_ORG_STOCK') as Array<{
	sku: string;
	quantity: string;
}>;

describe('seeded products satisfy the schema CHECK constraints', () => {
	test('the fixtures are actually read from the seeders', () => {
		// Guards the extractor: an empty list would make every assertion below
		// vacuously true.
		expect(SEED_PRODUCTS.length).toBeGreaterThan(0);
		expect(SEED_ITEMS.length).toBeGreaterThan(0);
		expect(WEBSITE_CATEGORIES.length).toBeGreaterThan(0);
	});

	test('every kind is a known product kind', () => {
		for (const product of SEED_PRODUCTS) {
			expect(PRODUCT_KINDS).toContain(product.productKind as never);
		}
	});

	test('every product kind is represented', () => {
		// The seed exists to give every kind a row, because kind drives the
		// serial and stock-tracking matrix.
		expect(new Set(SEED_PRODUCTS.map((product) => product.productKind)).size).toBe(
			PRODUCT_KINDS.length,
		);
	});

	test('prices are non-negative integers in IDR minor units', () => {
		for (const product of SEED_PRODUCTS) {
			expect(product.sellingPrice).toBeGreaterThanOrEqual(0);
			expect(product.purchasePrice).toBeGreaterThanOrEqual(0);
			expect(Number.isInteger(product.sellingPrice)).toBe(true);
			expect(Number.isInteger(product.purchasePrice)).toBe(true);
		}
	});

	test('minStockQty is non-negative and has numeric(18,3) scale', () => {
		for (const product of SEED_PRODUCTS) {
			expect(Number(product.minStockQty)).toBeGreaterThanOrEqual(0);
			expect(product.minStockQty).toMatch(/^\d+\.\d{3}$/);
		}
	});

	test('SKUs are unique', () => {
		expect(new Set(SEED_PRODUCTS.map((product) => product.sku)).size).toBe(
			SEED_PRODUCTS.length,
		);
	});

	test('only serialized products carry serial numbers', () => {
		for (const product of SEED_PRODUCTS) {
			if (!product.isSerialized) expect(product.serials ?? []).toHaveLength(0);
			if (product.isSerialized) expect(product.isStockTracked).toBe(true);
		}
	});

	test('serial numbers are unique across the products', () => {
		const all = SEED_PRODUCTS.flatMap((product) => product.serials ?? []);
		expect(new Set(all).size).toBe(all.length);
	});
});

describe('seeded product categories use the website slugs', () => {
	test('slugs are lower-case kebab and unique', () => {
		for (const category of WEBSITE_CATEGORIES) {
			expect(category.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
		}
		expect(new Set(WEBSITE_CATEGORIES.map((category) => category.slug)).size).toBe(
			WEBSITE_CATEGORIES.length,
		);
	});

	test('every product category slug the products name exists', () => {
		const slugs = new Set(WEBSITE_CATEGORIES.map((category) => category.slug));
		// `DEV_INTERNAL_CATEGORIES` are seeded outside production too; only the
		// product rows' referenced slugs are checked here, plus the two internal
		// ones the catalogue uses.
		const internal = readConst('product.seeder.ts', 'DEV_INTERNAL_CATEGORIES') as Array<{
			slug: string;
		}>;
		for (const category of internal) slugs.add(category.slug);
		for (const product of SEED_PRODUCTS) {
			const categorySlug = (product as { categorySlug?: string | null }).categorySlug;
			if (categorySlug) expect(slugs.has(categorySlug)).toBe(true);
		}
	});
});

describe('seeded item units use the schema vocabularies', () => {
	test('every status and condition is a known value', () => {
		for (const item of SEED_ITEMS) {
			expect(ITEM_STATUSES).toContain(item.status as never);
			expect(ITEM_CONDITIONS).toContain(item.condition as never);
		}
	});

	test('codes and serial numbers are unique', () => {
		expect(new Set(SEED_ITEMS.map((item) => item.code)).size).toBe(
			SEED_ITEMS.length,
		);
		expect(new Set(SEED_ITEMS.map((item) => item.serialNumber)).size).toBe(
			SEED_ITEMS.length,
		);
	});

	test('acquisition costs are non-negative integers', () => {
		for (const item of SEED_ITEMS) {
			expect(item.acquisitionCost).toBeGreaterThanOrEqual(0);
			expect(Number.isInteger(item.acquisitionCost)).toBe(true);
		}
	});
});

describe('seeded opening stock is consistent', () => {
	test('quantities are non-negative with numeric(18,3) scale', () => {
		for (const entry of [...SEED_GLOBAL_STOCK, ...SEED_ORG_STOCK]) {
			expect(Number(entry.quantity)).toBeGreaterThanOrEqual(0);
			expect(entry.quantity).toMatch(/^\d+\.\d{3}$/);
		}
	});

	test('every stocked SKU exists in the seeded catalogue', () => {
		const skus = new Set(SEED_PRODUCTS.map((product) => product.sku));
		for (const entry of [...SEED_GLOBAL_STOCK, ...SEED_ORG_STOCK]) {
			expect(skus.has(entry.sku)).toBe(true);
		}
	});

	test('only quantity-tracked products carry stock', () => {
		for (const entry of [...SEED_GLOBAL_STOCK, ...SEED_ORG_STOCK]) {
			const product = SEED_PRODUCTS.find((row) => row.sku === entry.sku);
			expect(product?.isStockTracked).toBe(true);
			// A serialized product's presence is its units, not a balance.
			expect(product?.isSerialized).toBe(false);
		}
	});
});
