/**
 * Seeds the product module (ADR-0026).
 *
 * @remarks
 * ADR-0026 split the product master and the warehouse estate out of
 * `inventory`, so their fixtures moved with their tables. Idempotent on
 * natural keys like every other seeder: a second `drizzle:seed` inserts
 * nothing.
 */
import { and, eq, inArray, isNull } from 'drizzle-orm';
import pino from 'pino';
import { isProductionEnv } from '../../../config/providers/env';
import { drizzleDB } from '../../../drizzle/db';
import { itemSerials } from '../../../drizzle/schemas/inventory.schema';
import { productCategories, productComponents, products } from '../../../drizzle/schemas/product.schema';

const logger = pino({
	timestamp: false,
	formatters: {
		level: (label) => ({ level: label }),
	},
});

/** Product categories of the website (1:1 by slug with the landing app). */
export const WEBSITE_CATEGORIES = [
	{ slug: 'swing-barrier-gate', name: 'Swing Barrier Gate', shortName: 'Swing Gates' },
	{ slug: 'flap-barrier-gate', name: 'Flap Barrier Gate', shortName: 'Flap Gates' },
	{ slug: 'tripod-turnstile', name: 'Tripod Turnstile', shortName: 'Turnstiles' },
	{ slug: 'parking-barrier', name: 'Automatic Parking Barrier', shortName: 'Parking Barriers' },
	{ slug: 'parking-equipment', name: 'Parking Equipment', shortName: 'Parking Kiosks' },
	{ slug: 'face-recognition', name: 'Face Recognition', shortName: 'Face Recognition' },
	{ slug: 'rfid-qr-scanner', name: 'RFID & QR Scanner', shortName: 'RFID & QR' },
	{ slug: 'access-controllers', name: 'Access Controllers', shortName: 'Controllers' },
	{ slug: 'accessories', name: 'Accessories', shortName: 'Accessories' },
] as const;

/** Internal categories for the dev inventory seed (tools, cable stock). */
export const DEV_INTERNAL_CATEGORIES = [
	{ slug: 'tools', name: 'Tools and instruments', shortName: 'Tools' },
	{ slug: 'cabling', name: 'Cabling and materials', shortName: 'Cabling' },
] as const;

/** One seeded product plus, for serialized ones, the units to register. */
type TSeedProduct = {
	sku: string;
	name: string;
	productKind: 'product' | 'component' | 'material';
	categorySlug: string | null;
	unitLabel: string;
	isSerialized: boolean;
	isStockTracked: boolean;
	minStockQty: string;
	sellingPrice: number;
	purchasePrice: number;
	serials?: readonly string[];
};

/**
 * The seeded catalogue.
 *
 * @remarks
 * Fixed values, not faker: the seeder is the fixture every other seed and the
 * demo screens read, so it must be the same on every machine. One row per
 * product kind, plus a serialized product to exercise the unit status matrix.
 */
const SEED_PRODUCTS: readonly TSeedProduct[] = [
	{
		sku: 'CTRL-DOOR-01',
		name: 'Door access controller',
		productKind: 'product',
		categorySlug: 'access-controllers',
		unitLabel: 'pcs',
		isSerialized: true,
		isStockTracked: true,
		minStockQty: '2.000',
		sellingPrice: 2_500_000,
		purchasePrice: 1_800_000,
		serials: ['DC-2026-0001', 'DC-2026-0002'],
	},
	{
		sku: 'CMP-PSU-12V',
		name: '12V power supply module',
		productKind: 'component',
		categorySlug: 'accessories',
		unitLabel: 'pcs',
		isSerialized: false,
		isStockTracked: true,
		minStockQty: '10.000',
		sellingPrice: 250_000,
		purchasePrice: 150_000,
	},
	{
		sku: 'MAT-CABLE-CAT6',
		name: 'CAT6 cable',
		productKind: 'material',
		categorySlug: 'cabling',
		unitLabel: 'm',
		isSerialized: false,
		isStockTracked: true,
		minStockQty: '100.000',
		sellingPrice: 12_000,
		purchasePrice: 7_500,
	},
] as const;

/**
 * Seeds the product master: the website categories and (dev only) the
 * catalogue with its serialized units.
 *
 * @param warehouseId - Warehouse the seeded units are placed in, if any
 */
export async function seedProduct(warehouseId: string | null = null): Promise<void> {
	await seedProductCategories();
	if (isProductionEnv()) {
		logger.info('Production environment; skipping product sample data');
		return;
	}
	await ensureProducts(null, warehouseId);
	logger.info({ products: SEED_PRODUCTS.length }, 'Product seeding complete');
}

/** Inserts the website and (outside production) internal product categories. */
async function seedProductCategories(): Promise<void> {
	const wanted = [
		...WEBSITE_CATEGORIES,
		...(isProductionEnv() ? [] : DEV_INTERNAL_CATEGORIES),
	].map((category, index) => ({ ...category, sortOrder: (index + 1) * 10 }));

	const existing = await drizzleDB
		.select({ slug: productCategories.slug })
		.from(productCategories)
		.where(
			and(
				isNull(productCategories.deletedAt),
				inArray(
					productCategories.slug,
					wanted.map((category) => category.slug),
				),
			),
		);
	const have = new Set(existing.map((row) => row.slug));
	const missing = wanted.filter((category) => !have.has(category.slug));
	if (missing.length > 0) {
		const now = new Date();
		await drizzleDB
			.insert(productCategories)
			.values(missing.map((category) => ({ ...category, createdAt: now, updatedAt: now })));
	}
	logger.info({ inserted: missing.length }, 'Product categories seeded');
}

/** Ensures the product master and, for the serialized ones, the seeded units. */
async function ensureProducts(
	organizationId: string | null,
	warehouseId: string | null,
): Promise<void> {
	const categoryRows = await drizzleDB
		.select({ id: productCategories.id, slug: productCategories.slug })
		.from(productCategories)
		.where(isNull(productCategories.deletedAt));
	const categoryIds = new Map(categoryRows.map((row) => [row.slug, row.id]));

	let index = 0;
	const idsBySku = new Map<string, string>();
	for (const seed of SEED_PRODUCTS) {
		index += 1;
		const productId = await ensureProduct(seed, organizationId, categoryIds, index);
		idsBySku.set(seed.sku, productId);
		for (const serialNumber of seed.serials ?? []) {
			await ensureUnit({ organizationId, productId, serialNumber, warehouseId });
		}
	}
	for (const composition of SEED_COMPOSITIONS) {
		await ensureComposition(composition, idsBySku);
	}
}

/**
 * Composition (bill of materials) of seeded products: parent SKU, then its
 * component/material SKUs with the quantity per unit.
 */
const SEED_COMPOSITIONS = [
	{
		parentSku: 'CTRL-DOOR-01',
		lines: [
			{ sku: 'CMP-PSU-12V', quantity: '1.000' },
			{ sku: 'MAT-CABLE-CAT6', quantity: '3.000' },
		],
	},
] as const;

/** Writes a composition once; a product that already has live lines is left alone. */
async function ensureComposition(
	composition: (typeof SEED_COMPOSITIONS)[number],
	idsBySku: ReadonlyMap<string, string>,
): Promise<void> {
	const productId = idsBySku.get(composition.parentSku);
	if (!productId) return;
	const [existing] = await drizzleDB
		.select({ id: productComponents.id })
		.from(productComponents)
		.where(and(eq(productComponents.productId, productId), isNull(productComponents.deletedAt)))
		.limit(1);
	if (existing) return;

	const now = new Date();
	const rows = composition.lines.flatMap((line, sortOrder) => {
		const componentId = idsBySku.get(line.sku);
		return componentId ? [{ productId, componentId, quantity: line.quantity, sortOrder, createdAt: now }] : [];
	});
	if (rows.length) await drizzleDB.insert(productComponents).values(rows);
}

/** Creates one product when absent, keyed on `(organization_id, sku)`. */
async function ensureProduct(
	seed: TSeedProduct,
	organizationId: string | null,
	categoryIds: ReadonlyMap<string, string>,
	index: number,
): Promise<string> {
	const [existing] = await drizzleDB
		.select({ id: products.id })
		.from(products)
		.where(
			and(
				organizationId === null ? isNull(products.organizationId) : eq(products.organizationId, organizationId),
				eq(products.sku, seed.sku),
				isNull(products.deletedAt),
			),
		)
		.limit(1);
	if (existing) return existing.id;

	const prefix = seed.productKind === 'product' ? 'PRD' : seed.productKind === 'component' ? 'CMP' : 'MAT';
	const [created] = await drizzleDB
		.insert(products)
		.values({
			organizationId,
			code: `${prefix}-${String(index).padStart(5, '0')}`,
			sku: seed.sku,
			name: seed.name,
			productKind: seed.productKind,
			productCategoryId: seed.categorySlug ? (categoryIds.get(seed.categorySlug) ?? null) : null,
			unitLabel: seed.unitLabel,
			isSerialized: seed.isSerialized,
			isStockTracked: seed.isStockTracked,
			minStockQty: seed.minStockQty,
			sellingPrice: seed.sellingPrice,
			purchasePrice: seed.purchasePrice,
			currencyCode: 'IDR',
			createdAt: new Date(),
			updatedAt: new Date(),
		})
		.returning({ id: products.id });
	return created!.id;
}

/** Registers one serialized unit in stock when absent. */

async function ensureUnit(input: {
	organizationId: string | null;
	productId: string;
	serialNumber: string;
	warehouseId: string | null;
}): Promise<void> {
	const { organizationId, productId, serialNumber, warehouseId } = input;
	const [existing] = await drizzleDB
		.select({ id: itemSerials.id })
		.from(itemSerials)
		.where(
			and(
				organizationId === null
					? isNull(itemSerials.organizationId)
					: eq(itemSerials.organizationId, organizationId),
				eq(itemSerials.serialNumber, serialNumber),
			),
		)
		.limit(1);
	if (existing) return;

	const now = new Date();
	await drizzleDB.insert(itemSerials).values({
		organizationId,
		productId,
		serialNumber,
		isProvisionalSerial: false,
		status: 'in_stock',
		warehouseId,
		acquiredOn: '2026-01-15',
		createdAt: now,
		updatedAt: now,
	});
}
