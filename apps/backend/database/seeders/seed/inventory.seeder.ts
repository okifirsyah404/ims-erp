import { eq, sql } from 'drizzle-orm';
import pino from 'pino';
import { faker } from '@faker-js/faker';
import { seedSafeText } from './faker-content';
import { drizzleDB } from '../../../drizzle/db';
import { BalanceRepository } from '../../../src/app/inventory/repositories/balance.repository';
import {
	type ItemUnit,
	itemCategories,
	items,
	serialTrackedItems,
	stockMovements,
	warehouseAddresses,
	warehouseOrganizations,
	warehouseStorages,
	warehouses,
} from '../../../drizzle/schemas/inventory.schema';
import { organizations } from '../../../drizzle/schemas/auth.schema';
import { village } from '../../../drizzle/schemas/location.schema';
import { SEED_ORGANIZATION_SLUG } from './organization.seeder';
import { isProductionEnv } from '../../../config/providers/env';
import { WEBSITE_CATEGORIES } from './item-category.seeder';

const logger = pino({
	timestamp: false,
	formatters: {
		level: (label) => ({ level: label }),
	},
});

/**
 * Deterministic faker seed for the inventory seeder.
 *
 * @remarks
 * Faker content is random, but seed identity is not: SKUs and serial numbers
 * are deterministic anchors (`ITEM-<n>`, `<prefix>-<n>`), and idempotency is
 * keyed on those anchors. Seeding faker makes repeated runs on the SAME
 * database produce identical content, so the existence guards below always
 * match; a different seed constant would make re-runs insert "new" items
 * instead of no-ops. Change it only together with a fresh database.
 */
const FAKER_SEED = 20261102;

/** Number of fake items generated per item kind. */
const ITEMS_PER_KIND = 4;

/** One seeded item plus, for serialized kinds, the units to register. */
type TSeedItem = {
	sku: string;
	name: string;
	itemKind: 'product' | 'component' | 'material';
	/** Slug of an `inventory.item_categories` row (ADR-0011), or none. */
	categorySlug: string | null;
	unitLabel: ItemUnit;
	isSerialized: boolean;
	isStockTracked: boolean;
	minStockQty: string;
	sellingPrice: number;
	purchasePrice: number;
	/** Serial numbers to register as `in_stock` units. */
	serials?: readonly string[];
};

/**
 * Generates the item master with faker, deterministically.
 *
 * @remarks
 * Covers every remaining kind. ERP-0036 moved physical tools to `assets` and
 * deleted `service`, so only consumables are seeded here; asset equipment is
 * seeded by the assets seeder.
 *
 * Kind invariants:
 * - `material` items are quantity-tracked, not serialized, and use unit
 *   labels (m, kg, ...).
 * - `product`/`component` are stocked; even-indexed products are serialized.
 *
 * Money is integer IDR (rupiah) per ADR-0002 — faker money helpers are float
 * based and are NOT used for amounts.
 */
function generateSeedItems(): TSeedItem[] {
	// seedSafeText wraps every faker text field: WIN1252 dev databases cannot
	// store emoji/multi-byte characters faker occasionally emits (see
	// faker-content.ts).
	faker.seed(FAKER_SEED);

	const safeName = () => seedSafeText(faker.commerce.productName());
	const safeMaterial = () => seedSafeText(faker.commerce.productMaterial());

	const kinds: TSeedItem['itemKind'][] = ['product', 'component', 'material'];

	const items: TSeedItem[] = [];
	let index = 0;

	for (const itemKind of kinds) {
		for (let i = 0; i < ITEMS_PER_KIND; i++) {
			index += 1;
			const sku = `ITEM-${String(index).padStart(3, '0')}`;

			if (itemKind === 'material') {
				items.push({
					sku,
					name: safeMaterial(),
					itemKind,
					categorySlug: 'cabling',
					unitLabel: faker.helpers.arrayElement(['m', 'kg', 'roll']),
					isSerialized: false,
					isStockTracked: true,
					minStockQty: faker.number
						.int({ min: 10, max: 200 })
						.toFixed(3),
					sellingPrice: faker.number.int({ min: 5_000, max: 100_000 }),
					purchasePrice: faker.number.int({ min: 2_500, max: 60_000 }),
				});
				continue;
			}

			// product and component share the same shape.
			items.push({
				sku,
				name: safeName(),
				itemKind,
				categorySlug: faker.helpers.arrayElement(WEBSITE_CATEGORIES).slug,
				unitLabel: 'pcs',
				isSerialized: itemKind === 'product' && i % 2 === 0,
				isStockTracked: true,
				minStockQty: faker.number.int({ min: 1, max: 10 }).toFixed(3),
				sellingPrice: faker.number.int({ min: 100_000, max: 10_000_000 }),
				purchasePrice: faker.number.int({ min: 50_000, max: 7_500_000 }),
				...(itemKind === 'product' && i % 2 === 0
					? {
							serials: Array.from({ length: 2 }, (_, n) =>
								`${sku}-S${String(n + 1).padStart(3, '0')}`,
							),
						}
					: {}),
			});
		}
	}

	return items;
}

/**
 * The generated item master. Computed once at module load with a fixed
 * faker seed; see {@link generateSeedItems} for the kind invariants.
 */
const SEED_ITEMS: readonly TSeedItem[] = generateSeedItems();

/**
 * Seeds the inventory module: a global default warehouse, an
 * organization-scoped warehouse, their addresses and bins, and the item
 * master (consumables only since ERP-0036).
 *
 * @remarks
 * Idempotent: every insert is guarded by a lookup on the natural key
 * (`(organization_id, code)` for warehouses, `(organization_id, sku)` for
 * items, `(organization_id, serial_number)` for units), so re-running
 * `drizzle:seed` or `migrate-reset` never duplicates rows.
 *
 * The global warehouse (`organization_id IS NULL`) is seeded as the default so
 * that S3/S4 have a resolvable "default warehouse" without inventing one.
 */
export async function seedInventory(): Promise<void> {
	// Dev-only sample data (faker): production starts with an empty inventory.
	if (isProductionEnv()) {
		logger.info('Production environment; skipping inventory sample data');
		return;
	}
	const [organization] = await drizzleDB
		.select({ id: organizations.id })
		.from(organizations)
		.where(eq(organizations.slug, SEED_ORGANIZATION_SLUG))
		.limit(1);

	// A village id is needed to make the seeded address realistic; it is
	// optional because location data is seeded before this runs but must not
	// be a hard dependency.
	const [villageRow] = await drizzleDB
		.select({ id: village.id })
		.from(village)
		.limit(1);

	const organizationId = organization?.id ?? null;
	const villageId = villageRow?.id ?? null;

	const globalWarehouse = await ensureWarehouse({
		organizationId: null,
		code: 'GLOBAL-MAIN',
		name: 'Global warehouse',
		isDefault: true,
		villageId,
	});

	// ERP-0031 (D1): every warehouse is global; `organization_id` is frozen at
	// NULL and organization access comes from the `warehouse_organizations`
	// link, ensured below.
	const orgWarehouse = await ensureWarehouse({
		organizationId: null,
		code: 'WH-MAIN',
		name: 'Main warehouse',
		// Only one default per scope, so the organization warehouse is NOT the
		// default: the global one already is, in a different scope.
		isDefault: false,
		villageId,
	});

	if (organizationId !== null) {
		// Both seeded warehouses are linked to the dev org (ERP-0031): the
		// global one stays the default and its balances stay shared, but the
		// org can now act in it through the link.
		await ensureWarehouseOrganizationLink(globalWarehouse, organizationId);
		await ensureWarehouseOrganizationLink(orgWarehouse, organizationId);
	}

	await ensureStorage(globalWarehouse, 'A1', 'Shelf A1');
	await ensureStorage(globalWarehouse, 'A2', 'Shelf A2');
	await ensureStorage(orgWarehouse, 'B1', 'Shelf B1');

	await ensureItems(organizationId, orgWarehouse);
	await seedStock({ organizationId, globalWarehouse, orgWarehouse });

	logger.info(
		{
			organizationId,
			warehouses: 2,
			storages: 3,
			items: SEED_ITEMS.length,
		},
		'Inventory seeding complete',
	);
}

/** One opening balance: how much of an item to place into a warehouse. */
type TSeedStock = {
	sku: string;
	quantity: string;
};

/**
 * Opening stock for the global warehouse.
 *
 * @remarks
 * The global warehouse's balances carry `organization_id = NULL`, which means
 * they are **shared** by every organization — so this is the seed that proves
 * the scope rule with real data rather than only in tests.
 *
 * SKUs are the deterministic anchors of {@link generateSeedItems}: with
 * `ITEMS_PER_KIND = 4`, indices 1-4 are `product`, 5-8 `component`, 9-12
 * `material`. ITEM-005 is the first generated `component` (stock-tracked),
 * ITEM-009 the first generated `material`.
 */
const SEED_GLOBAL_STOCK: readonly TSeedStock[] = [
	{ sku: 'ITEM-005', quantity: '50.000' },
	{ sku: 'ITEM-009', quantity: '500.000' },
];

/** Opening stock for the organization-owned warehouse (per-tenant balances). */
const SEED_ORG_STOCK: readonly TSeedStock[] = [
	{ sku: 'ITEM-005', quantity: '20.000' },
	{ sku: 'ITEM-009', quantity: '150.000' },
];

/**
 * Seeds opening stock as `receipt` movements plus their balances.
 *
 * @remarks
 * Written through the ledger **and** the balance projection, exactly as
 * `StockService.postMovement` would, because the two must agree: seeding a
 * balance without a movement would make `recomputeFromLedger` erase it, and
 * seeding a movement without a balance would make the balance list empty.
 *
 * Idempotent on `(organization_id, warehouse_id, item_id, reference_type =
 * 'seed')`: a re-run finds the opening movement and does nothing, so quantities
 * are never double-counted.
 */
async function seedStock(input: {
	organizationId: string | null;
	globalWarehouse: string;
	orgWarehouse: string;
}): Promise<void> {
	const { organizationId, globalWarehouse, orgWarehouse } = input;

	// Global warehouse balances are shared: organization_id = NULL.
	for (const entry of SEED_GLOBAL_STOCK) {
		await ensureOpeningStock({
			scopeOrganizationId: null,
			warehouseId: globalWarehouse,
			sku: entry.sku,
			quantity: entry.quantity,
			itemOrganizationId: organizationId,
		});
	}

	if (organizationId === null) return;
	for (const entry of SEED_ORG_STOCK) {
		await ensureOpeningStock({
			scopeOrganizationId: organizationId,
			warehouseId: orgWarehouse,
			sku: entry.sku,
			quantity: entry.quantity,
			itemOrganizationId: organizationId,
		});
	}
}

/**
 * Records one opening receipt and its balance when absent.
 *
 * @param input - Scope, warehouse, item, and quantity
 */
async function ensureOpeningStock(input: {
	scopeOrganizationId: string | null;
	warehouseId: string;
	sku: string;
	quantity: string;
	itemOrganizationId: string | null;
}): Promise<void> {
	const {
		scopeOrganizationId,
		warehouseId,
		sku,
		quantity,
		itemOrganizationId,
	} = input;

	const itemId = await findItemId(itemOrganizationId, sku);
	if (!itemId) return;

	const balanceRepository = new BalanceRepository(drizzleDB);

	// Idempotency guard. Keyed on the warehouse scope, not the caller: the
	// opening receipt belongs to whichever scope owns the warehouse (data-model
	// "scope rule"), so a re-run finds exactly the row it would otherwise write.
	const [existing] = await drizzleDB
		.select({ id: stockMovements.id })
		.from(stockMovements)
		.where(
			sql`${stockMovements.organizationId} IS NOT DISTINCT FROM ${scopeOrganizationId} AND ${stockMovements.warehouseId} = ${warehouseId} AND ${stockMovements.itemId} = ${itemId} AND ${stockMovements.referenceType} = 'seed' AND ${stockMovements.referenceId} = ${sku}`,
		)
		.limit(1);
	if (existing) return;

	const occurredAt = new Date();

	await drizzleDB.transaction(async (tx) => {
		await tx.insert(stockMovements).values({
			organizationId: scopeOrganizationId,
			code: `MV-SEED-${warehouseId.slice(0, 8)}-${sku}`.slice(0, 32),
			movementType: 'receipt',
			itemId,
			warehouseId,
			quantity,
			referenceType: 'seed',
			referenceId: sku,
			status: 'posted',
			occurredAt,
			notes: 'Opening stock seeded by database/seeders',
			createdAt: occurredAt,
		});

		// Balance mirrors the movement — through `applyDelta`, the same
		// serialized path every other writer uses (hardening plan D7). The
		// hand-rolled select-then-update/insert previously here violated the
		// "applyDelta is the ONLY way" contract and would silently diverge if
		// the locking/enforcement logic in the repository ever changed.
		// The lookup is scoped by organization as well as warehouse: matching
		// on warehouse alone would find the *shared* row of a global
		// warehouse, or a sibling tenant's row, and add this quantity to it.
		await balanceRepository.applyDelta(
			{
				scopeOrganizationId,
				itemId,
				warehouseId,
				binId: null,
			},
			{ quantity, occurredAt },
			tx,
		);
	});

	logger.info({ sku, warehouseId, quantity }, 'Seeded opening stock');
}

/** Finds an item id by SKU within a scope. */
async function findItemId(
	organizationId: string | null,
	sku: string,
): Promise<string | null> {
	const [row] = await drizzleDB
		.select({ id: items.id })
		.from(items)
		.where(
			organizationId === null
				? sql`${items.organizationId} IS NULL AND ${items.sku} = ${sku} AND ${items.deletedAt} IS NULL`
				: sql`${items.organizationId} = ${organizationId} AND ${items.sku} = ${sku} AND ${items.deletedAt} IS NULL`,
		)
		.limit(1);
	return row?.id ?? null;
}

/**
 * Creates a warehouse (and its address) when absent.
 *
 * @returns The warehouse id, existing or newly created
 */
async function ensureWarehouse(input: {
	organizationId: string | null;
	code: string;
	name: string;
	isDefault: boolean;
	villageId: string | null;
}): Promise<string> {
	const { organizationId, code, name, isDefault, villageId } = input;

	const existing = await findWarehouse(organizationId, code);
	if (existing) return existing;

	const [created] = await drizzleDB
		.insert(warehouses)
		.values({
			organizationId,
			code,
			name,
			isDefault,
			isActive: true,
			createdAt: new Date(),
		})
		.returning({ id: warehouses.id });

	await drizzleDB.insert(warehouseAddresses).values({
		warehouseId: created.id,
		label: 'Gudang utama',
		street: 'Jl. Contoh No. 1',
		rt: '001',
		rw: '002',
		postalCode: '12345',
		villageId,
		createdAt: new Date(),
	});

	logger.info({ code, organizationId }, 'Seeded warehouse');
	return created.id;
}

/**
 * Finds a warehouse by its natural key.
 *
 * @remarks
 * `organization_id IS NULL` is matched with `isNull`, never `eq(null)`.
 */
async function findWarehouse(
	organizationId: string | null,
	code: string,
): Promise<string | null> {
	const [row] = await drizzleDB
		.select({ id: warehouses.id })
		.from(warehouses)
		.where(
			organizationId === null
				? sql`${warehouses.organizationId} IS NULL AND ${warehouses.code} = ${code} AND ${warehouses.deletedAt} IS NULL`
				: sql`${warehouses.organizationId} = ${organizationId} AND ${warehouses.code} = ${code} AND ${warehouses.deletedAt} IS NULL`,
		)
		.limit(1);
	return row?.id ?? null;
}

/**
 * Ensures the warehouse↔organization link row exists (ERP-0031).
 *
 * @remarks
 * Idempotent: an alive link for the same pair short-circuits. A soft-deleted
 * one is revived rather than duplicated — the partial unique index
 * `warehouse_organizations_uq` would reject a second alive row for the pair.
 */
async function ensureWarehouseOrganizationLink(
	warehouseId: string,
	organizationId: string,
): Promise<void> {
	const [existing] = await drizzleDB
		.select({
			id: warehouseOrganizations.id,
			deletedAt: warehouseOrganizations.deletedAt,
		})
		.from(warehouseOrganizations)
		.where(
			sql`${warehouseOrganizations.warehouseId} = ${warehouseId} AND ${warehouseOrganizations.organizationId} = ${organizationId}`,
		)
		.limit(1);

	if (existing?.deletedAt === null) return;

	if (existing) {
		await drizzleDB
			.update(warehouseOrganizations)
			.set({ deletedAt: null, updatedAt: new Date() })
			.where(eq(warehouseOrganizations.id, existing.id));
		logger.info({ warehouseId, organizationId }, 'Relinked warehouse to organization');
		return;
	}

	await drizzleDB.insert(warehouseOrganizations).values({
		warehouseId,
		organizationId,
		createdAt: new Date(),
	});
	logger.info({ warehouseId, organizationId }, 'Linked warehouse to organization');
}

/** Creates a storage (bin) when absent, keyed on `(warehouse_id, code)`. */
async function ensureStorage(
	warehouseId: string,
	code: string,
	name: string,
): Promise<void> {
	const [existing] = await drizzleDB
		.select({ id: warehouseStorages.id })
		.from(warehouseStorages)
		.where(
			sql`${warehouseStorages.warehouseId} = ${warehouseId} AND ${warehouseStorages.code} = ${code} AND ${warehouseStorages.deletedAt} IS NULL`,
		)
		.limit(1);
	if (existing) return;

	await drizzleDB.insert(warehouseStorages).values({
		warehouseId,
		code,
		name,
		isActive: true,
		createdAt: new Date(),
	});
}

/** Seeds the item master and its serialized units. */
async function ensureItems(
	organizationId: string | null,
	warehouseId: string,
): Promise<void> {
	// Categories come from `seedItemCategories`, which runs first.
	const categoryRows = await drizzleDB
		.select({ id: itemCategories.id, slug: itemCategories.slug })
		.from(itemCategories)
		.where(sql`${itemCategories.deletedAt} IS NULL`);
	const categoryIds = new Map(categoryRows.map((row) => [row.slug, row.id]));
	for (const seed of SEED_ITEMS) {
		const itemId = await ensureItem(seed, organizationId, categoryIds);
		for (const serialNumber of seed.serials ?? []) {
			await ensureUnit({
				organizationId,
				itemId,
				serialNumber,
				warehouseId,
			});
		}
	}
}

/** Creates an item when absent, keyed on `(organization_id, sku)`. */
async function ensureItem(
	seed: TSeedItem,
	organizationId: string | null,
	categoryIds: ReadonlyMap<string, string>,
): Promise<string> {
	const [existing] = await drizzleDB
		.select({ id: items.id })
		.from(items)
		.where(
			organizationId === null
				? sql`${items.organizationId} IS NULL AND ${items.sku} = ${seed.sku} AND ${items.deletedAt} IS NULL`
				: sql`${items.organizationId} = ${organizationId} AND ${items.sku} = ${seed.sku} AND ${items.deletedAt} IS NULL`,
		)
		.limit(1);
	if (existing) return existing.id;

	const [created] = await drizzleDB
		.insert(items)
		.values({
			organizationId,
			sku: seed.sku,
			name: seed.name,
			itemKind: seed.itemKind,
			categoryId: seed.categorySlug ? (categoryIds.get(seed.categorySlug) ?? null) : null,
			unitLabel: seed.unitLabel,
			isSerialized: seed.isSerialized,
			isStockTracked: seed.isStockTracked,
			minStockQty: seed.minStockQty,
			sellingPrice: seed.sellingPrice,
			purchasePrice: seed.purchasePrice,
			currencyCode: 'IDR',
			createdAt: new Date(),
		})
		.returning({ id: items.id });

	return created.id;
}

/**
 * Creates a serialized unit in stock when absent.
 *
 * @remarks
 * Keyed on the real serial number, so re-seeding is a no-op even though
 * `serial_tracked_items` also has a partial-unique index on it.
 */
async function ensureUnit(input: {
	organizationId: string | null;
	itemId: string;
	serialNumber: string;
	warehouseId: string;
}): Promise<void> {
	const { organizationId, itemId, serialNumber, warehouseId } = input;

	const [existing] = await drizzleDB
		.select({ id: serialTrackedItems.id })
		.from(serialTrackedItems)
		.where(
			organizationId === null
				? sql`${serialTrackedItems.organizationId} IS NULL AND ${serialTrackedItems.serialNumber} = ${serialNumber}`
				: sql`${serialTrackedItems.organizationId} = ${organizationId} AND ${serialTrackedItems.serialNumber} = ${serialNumber}`,
		)
		.limit(1);
	if (existing) return;

	await drizzleDB.insert(serialTrackedItems).values({
		organizationId,
		itemId,
		serialNumber,
		isProvisionalSerial: false,
		status: 'in_stock',
		warehouseId,
		acquiredOn: '2026-01-15',
		createdAt: new Date(),
	});
}
