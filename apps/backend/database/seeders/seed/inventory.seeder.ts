import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import pino from 'pino';
import { isProductionEnv } from '../../../config/providers/env';
import { drizzleDB } from '../../../drizzle/db';
import { organizations } from '../../../drizzle/schemas/auth.schema';
import { village } from '../../../drizzle/schemas/location.schema';
import {
	itemCategories,
	items,
	type ItemStatus,
	itemSerials,
	movements,
	productCategories,
	products,
	stocks,
	warehouseAddresses,
	warehouseOrganizations,
	warehouseStorages,
	warehouses,
} from '../../../drizzle/schemas/inventory.schema';
import { SEED_ORGANIZATION_SLUG } from './organization.seeder';

const logger = pino({
	timestamp: false,
	formatters: {
		level: (label) => ({ level: label }),
	},
});

/**
 * Seeds the inventory module (ADR-0024 Q14/Q24): the two reference category
 * tables, a global default warehouse and an organization warehouse with their
 * addresses and bins, the product master with serialized units, a small tool
 * fleet as `items`, and opening stock as `receipt` movements plus their
 * balances.
 *
 * @remarks
 * Idempotent on natural keys (`product_categories.slug`,
 * `product_categories.code`, `products.sku`, `item_serials.serial_number`,
 * `items.code`, `warehouses.code`, `warehouse_storages.code`), so a second
 * `drizzle:seed` inserts nothing. Every amount is integer IDR; every date is a
 * fixed business date, never `new Date()` in a row that a later assertion reads.
 *
 * The tool fleet used to live in the removed `assets` module; it is seeded here
 * as `inventory.items` because the units now share one table (Q24).
 */

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

/** The seeded tool fleet (formerly `assets`), as `inventory.items` rows. */
const SEED_ITEMS: readonly {
	code: string;
	name: string;
	itemKind: 'equipment' | 'tool';
	serialNumber: string;
	status: ItemStatus;
	condition: 'good' | 'fair' | 'damaged';
	placed: boolean;
	acquisitionCost: number;
}[] = [
	{
		code: 'AST-SEED-001',
		name: 'Digital multimeter',
		itemKind: 'tool',
		serialNumber: 'SN-SEED-001',
		status: 'borrowed',
		condition: 'good',
		placed: false,
		acquisitionCost: 2_500_000,
	},
	{
		code: 'AST-SEED-002',
		name: 'Cordless drill',
		itemKind: 'tool',
		serialNumber: 'SN-SEED-002',
		status: 'ready',
		condition: 'good',
		placed: true,
		acquisitionCost: 3_200_000,
	},
	{
		code: 'AST-SEED-003',
		name: 'Cable tester',
		itemKind: 'tool',
		serialNumber: 'SN-SEED-003',
		status: 'lost',
		condition: 'damaged',
		placed: false,
		acquisitionCost: 1_750_000,
	},
	{
		code: 'AST-SEED-004',
		name: 'Crimping tool',
		itemKind: 'tool',
		serialNumber: 'SN-SEED-004',
		status: 'ready',
		condition: 'good',
		placed: true,
		acquisitionCost: 850_000,
	},
	{
		code: 'AST-SEED-005',
		name: 'Field toolbox',
		itemKind: 'tool',
		serialNumber: 'SN-SEED-005',
		status: 'ready',
		condition: 'fair',
		placed: true,
		acquisitionCost: 1_100_000,
	},
	{
		code: 'AST-SEED-006',
		name: 'Site projector',
		itemKind: 'equipment',
		serialNumber: 'SN-SEED-006',
		status: 'ready',
		condition: 'good',
		placed: true,
		acquisitionCost: 12_000_000,
	},
] as const;

/** Opening stock of the global (shared) warehouse, keyed on product SKU. */
const SEED_GLOBAL_STOCK = [
	{ sku: 'CMP-PSU-12V', quantity: '50.000' },
	{ sku: 'MAT-CABLE-CAT6', quantity: '500.000' },
] as const;

/** Opening stock of the organization warehouse. */
const SEED_ORG_STOCK = [
	{ sku: 'CMP-PSU-12V', quantity: '20.000' },
	{ sku: 'MAT-CABLE-CAT6', quantity: '150.000' },
] as const;

/** Runs the whole inventory seed. */
export async function seedInventory(): Promise<void> {
	await seedProductCategories();
	// Dev-only sample data (fixed rows): production starts with an empty master.
	if (isProductionEnv()) {
		logger.info('Production environment; skipping inventory sample data');
		return;
	}

	const [organization] = await drizzleDB
		.select({ id: organizations.id })
		.from(organizations)
		.where(eq(organizations.slug, SEED_ORGANIZATION_SLUG))
		.limit(1);
	const [villageRow] = await drizzleDB.select({ id: village.id }).from(village).limit(1);
	const organizationId = organization?.id ?? null;
	const villageId = villageRow?.id ?? null;

	const globalWarehouse = await ensureWarehouse({
		code: 'GLOBAL-MAIN',
		name: 'Global warehouse',
		isDefault: true,
		villageId,
	});
	const orgWarehouse = await ensureWarehouse({
		code: 'WH-MAIN',
		name: 'Main warehouse',
		isDefault: false,
		villageId,
	});

	if (organizationId !== null) {
		await ensureWarehouseOrganizationLink(globalWarehouse, organizationId);
		await ensureWarehouseOrganizationLink(orgWarehouse, organizationId);
	}

	await ensureStorage(globalWarehouse, 'A1', 'Shelf A1');
	await ensureStorage(globalWarehouse, 'A2', 'Shelf A2');
	await ensureStorage(orgWarehouse, 'B1', 'Shelf B1');

	await ensureItemCategories(organizationId);
	await ensureProducts(organizationId, orgWarehouse);
	await ensureItems(organizationId, orgWarehouse);
	await seedStock({ organizationId, globalWarehouse, orgWarehouse });

	logger.info(
		{ organizationId, products: SEED_PRODUCTS.length, items: SEED_ITEMS.length },
		'Inventory seeding complete',
	);
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

/** Inserts the item categories of the dev tool fleet. */
async function ensureItemCategories(organizationId: string | null): Promise<void> {
	const wanted = [
		{ code: 'TOOLS', name: 'Tools and instruments', itemKind: 'tool' as const },
		{ code: 'EQUIP', name: 'Site equipment', itemKind: 'equipment' as const },
	];
	const existing = await drizzleDB
		.select({ code: itemCategories.code })
		.from(itemCategories)
		.where(
			and(
				isNull(itemCategories.deletedAt),
				inArray(
					itemCategories.code,
					wanted.map((category) => category.code),
				),
			),
		);
	const have = new Set(existing.map((row) => row.code));
	const missing = wanted.filter((category) => !have.has(category.code));
	if (missing.length === 0) return;
	const now = new Date();
	await drizzleDB.insert(itemCategories).values(
		missing.map((category) => ({
			...category,
			organizationId,
			isActive: true,
			createdAt: now,
			updatedAt: now,
		})),
	);
	logger.info({ inserted: missing.length }, 'Item categories seeded');
}

/** Inserts the product master and its serialized units. */
async function ensureProducts(organizationId: string | null, warehouseId: string): Promise<void> {
	const categoryRows = await drizzleDB
		.select({ id: productCategories.id, slug: productCategories.slug })
		.from(productCategories)
		.where(isNull(productCategories.deletedAt));
	const categoryIds = new Map(categoryRows.map((row) => [row.slug, row.id]));

	let index = 0;
	for (const seed of SEED_PRODUCTS) {
		index += 1;
		const productId = await ensureProduct(seed, organizationId, categoryIds, index);
		for (const serialNumber of seed.serials ?? []) {
			await ensureUnit({ organizationId, productId, serialNumber, warehouseId });
		}
	}
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
	warehouseId: string;
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

/** Inserts the tool fleet as `items` rows, keyed on their code. */
async function ensureItems(organizationId: string | null, warehouseId: string): Promise<void> {
	const categoryRows = await drizzleDB
		.select({ id: itemCategories.id, code: itemCategories.code })
		.from(itemCategories)
		.where(isNull(itemCategories.deletedAt));
	const categoryIds = new Map(categoryRows.map((row) => [row.code, row.id]));

	for (const seed of SEED_ITEMS) {
		const [existing] = await drizzleDB
			.select({ id: items.id })
			.from(items)
			.where(
				and(
					organizationId === null ? isNull(items.organizationId) : eq(items.organizationId, organizationId),
					eq(items.code, seed.code),
					isNull(items.deletedAt),
				),
			)
			.limit(1);
		if (existing) continue;

		const now = new Date();
		await drizzleDB.insert(items).values({
			organizationId,
			code: seed.code,
			name: seed.name,
			itemKind: seed.itemKind,
			itemCategoryId: categoryIds.get(seed.itemKind === 'tool' ? 'TOOLS' : 'EQUIP') ?? null,
			serialNumber: seed.serialNumber,
			acquisitionDate: '2026-01-15',
			acquisitionCost: seed.acquisitionCost,
			bookValue: seed.acquisitionCost,
			currencyCode: 'IDR',
			condition: seed.condition,
			status: seed.status,
			warehouseId: seed.placed ? warehouseId : null,
			createdAt: now,
			updatedAt: now,
		});
	}
	logger.info({ items: SEED_ITEMS.length }, 'Item fleet seeded');
}

/**
 * Seeds opening stock as `receipt` movements plus their balances.
 *
 * @remarks
 * Written as a movement **and** a balance because the two must agree: a
 * balance without a movement is erased by `recomputeFromLedger`, a movement
 * without a balance leaves the list empty. Idempotent on
 * `(scope, warehouse, product, reference_type = 'seed')`.
 */
async function seedStock(input: {
	organizationId: string | null;
	globalWarehouse: string;
	orgWarehouse: string;
}): Promise<void> {
	const { organizationId, globalWarehouse, orgWarehouse } = input;

	for (const entry of SEED_GLOBAL_STOCK) {
		await ensureOpeningStock({
			scopeOrganizationId: null,
			warehouseId: globalWarehouse,
			sku: entry.sku,
			quantity: entry.quantity,
			productOrganizationId: organizationId,
		});
	}
	if (organizationId === null) return;
	for (const entry of SEED_ORG_STOCK) {
		await ensureOpeningStock({
			scopeOrganizationId: organizationId,
			warehouseId: orgWarehouse,
			sku: entry.sku,
			quantity: entry.quantity,
			productOrganizationId: organizationId,
		});
	}
}

/** Records one opening receipt and its balance when absent. */
async function ensureOpeningStock(input: {
	scopeOrganizationId: string | null;
	warehouseId: string;
	sku: string;
	quantity: string;
	productOrganizationId: string | null;
}): Promise<void> {
	const { scopeOrganizationId, warehouseId, sku, quantity, productOrganizationId } = input;

	const [product] = await drizzleDB
		.select({ id: products.id })
		.from(products)
		.where(
			and(
				productOrganizationId === null
					? isNull(products.organizationId)
					: eq(products.organizationId, productOrganizationId),
				eq(products.sku, sku),
				isNull(products.deletedAt),
			),
		)
		.limit(1);
	if (!product) return;

	const [existing] = await drizzleDB
		.select({ id: movements.id })
		.from(movements)
		.where(
			and(
				scopeOrganizationId === null
					? isNull(movements.organizationId)
					: eq(movements.organizationId, scopeOrganizationId),
				eq(movements.warehouseId, warehouseId),
				eq(movements.productId, product.id),
				eq(movements.referenceType, 'seed'),
				eq(movements.referenceId, sku),
			),
		)
		.limit(1);
	if (existing) return;

	const now = new Date();
	await drizzleDB.transaction(async (tx) => {
		await tx.insert(movements).values({
			organizationId: scopeOrganizationId,
			code: `MV-SEED-${warehouseId.slice(0, 8)}-${sku}`.slice(0, 32),
			movementType: 'receipt',
			productId: product.id,
			warehouseId,
			quantity,
			referenceType: 'seed',
			referenceId: sku,
			status: 'posted',
			occurredAt: now,
			notes: 'Opening stock seeded by database/seeders',
			createdAt: now,
		});

		await tx
			.insert(stocks)
			.values({
				organizationId: scopeOrganizationId,
				productId: product.id,
				warehouseId,
				binId: null,
				quantityOnHand: quantity,
				quantityReserved: '0',
				quantityAvailable: quantity,
				averageCost: 0,
				totalValue: 0,
				createdAt: now,
				updatedAt: now,
			})
			.onConflictDoUpdate({
				// The partial unique index is the conflict target (scope, warehouse,
				// product, bin); the scope predicate is part of it.
				target: [stocks.warehouseId, stocks.productId, stocks.binId],
				targetWhere: sql`organization_id IS NULL`,
				set: {
					quantityOnHand: quantity,
					quantityAvailable: quantity,
					updatedAt: now,
				},
			});
	});

	logger.info({ sku, warehouseId, quantity }, 'Seeded opening stock');
}

/** Creates a warehouse (and its address) when absent. */
async function ensureWarehouse(input: {
	code: string;
	name: string;
	isDefault: boolean;
	villageId: string | null;
}): Promise<string> {
	const { code, name, isDefault, villageId } = input;
	const [existing] = await drizzleDB
		.select({ id: warehouses.id })
		.from(warehouses)
		.where(and(eq(warehouses.code, code), isNull(warehouses.deletedAt)))
		.limit(1);
	if (existing) return existing.id;

	const now = new Date();
	const [created] = await drizzleDB
		.insert(warehouses)
		.values({
			organizationId: null,
			code,
			name,
			isDefault,
			isActive: true,
			createdAt: now,
			updatedAt: now,
		})
		.returning({ id: warehouses.id });

	await drizzleDB.insert(warehouseAddresses).values({
		warehouseId: created!.id,
		label: 'Gudang utama',
		addressLine: 'Jl. Contoh No. 1',
		rt: '001',
		rw: '002',
		postalCode: '12345',
		villageId,
		createdAt: now,
		updatedAt: now,
	});

	logger.info({ code }, 'Seeded warehouse');
	return created!.id;
}

/** Ensures the warehouse-organization link row exists (ERP-0031). */
async function ensureWarehouseOrganizationLink(warehouseId: string, organizationId: string): Promise<void> {
	const [existing] = await drizzleDB
		.select({ id: warehouseOrganizations.id, deletedAt: warehouseOrganizations.deletedAt })
		.from(warehouseOrganizations)
		.where(
			and(
				eq(warehouseOrganizations.warehouseId, warehouseId),
				eq(warehouseOrganizations.organizationId, organizationId),
			),
		)
		.limit(1);
	if (existing?.deletedAt === null) return;
	if (existing) {
		await drizzleDB
			.update(warehouseOrganizations)
			.set({ deletedAt: null, updatedAt: new Date() })
			.where(eq(warehouseOrganizations.id, existing.id));
		return;
	}
	await drizzleDB.insert(warehouseOrganizations).values({
		warehouseId,
		organizationId,
		createdAt: new Date(),
	});
}

/** Creates a storage (bin) when absent, keyed on `(warehouse_id, code)`. */
async function ensureStorage(warehouseId: string, code: string, name: string): Promise<void> {
	const [existing] = await drizzleDB
		.select({ id: warehouseStorages.id })
		.from(warehouseStorages)
		.where(
			and(
				eq(warehouseStorages.warehouseId, warehouseId),
				eq(warehouseStorages.code, code),
				isNull(warehouseStorages.deletedAt),
			),
		)
		.limit(1);
	if (existing) return;
	const now = new Date();
	await drizzleDB.insert(warehouseStorages).values({
		warehouseId,
		code,
		name,
		isActive: true,
		createdAt: now,
		updatedAt: now,
	});
}
