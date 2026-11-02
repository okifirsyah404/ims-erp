import { eq, sql } from 'drizzle-orm';
import pino from 'pino';
import { drizzleDB } from '../../../drizzle/db';
import {
	items,
	serialTrackedItems,
	warehouseAddresses,
	warehouseStorages,
	warehouses,
} from '../../../drizzle/schemas/inventory.schema';
import { organizations } from '../../../drizzle/schemas/auth.schema';
import { village } from '../../../drizzle/schemas/location.schema';
import { SEED_ORGANIZATION_SLUG } from './organization.seeder';

const logger = pino({
	timestamp: false,
	formatters: {
		level: (label) => ({ level: label }),
	},
});

/** One seeded item plus, for serialized kinds, the units to register. */
type TSeedItem = {
	sku: string;
	name: string;
	itemKind: 'product' | 'component' | 'material' | 'tool' | 'service';
	category: string | null;
	unitLabel: string | null;
	isSerialized: boolean;
	isStockTracked: boolean;
	minStockQty: string;
	sellingPrice: number;
	purchasePrice: number;
	/** Serial numbers to register as `in_stock` units. */
	serials?: readonly string[];
};

/**
 * The seeded item master.
 *
 * @remarks
 * Deliberately covers every kind, because the kind drives the unit status
 * matrix (`assertTransitionAllowed`) and the S1 seeder step was never
 * delivered — without this, a fresh database has no items and the tool
 * borrowing flow of S4 has nothing to borrow.
 *
 * `tool` items are serialized and not sellable; `material` items are
 * quantity-tracked and not serialized. That pair exercises both tracking
 * modes.
 */
const SEED_ITEMS: readonly TSeedItem[] = [
	{
		sku: 'CTRL-DOOR-01',
		name: 'Door controller',
		itemKind: 'product',
		category: 'Access control',
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
		name: 'Power supply 12V',
		itemKind: 'component',
		category: 'Access control',
		unitLabel: 'pcs',
		isSerialized: false,
		isStockTracked: true,
		minStockQty: '10.000',
		sellingPrice: 250_000,
		purchasePrice: 150_000,
	},
	{
		sku: 'MAT-CABLE-CAT6',
		name: 'Cable CAT6 (per metre)',
		itemKind: 'material',
		category: 'Cabling',
		unitLabel: 'm',
		isSerialized: false,
		isStockTracked: true,
		minStockQty: '100.000',
		sellingPrice: 12_000,
		purchasePrice: 7_500,
	},
	{
		sku: 'TOOL-DRILL-01',
		name: 'Rotary hammer drill',
		itemKind: 'tool',
		category: 'Tools',
		unitLabel: 'pcs',
		isSerialized: true,
		isStockTracked: false,
		minStockQty: '0.000',
		sellingPrice: 0,
		purchasePrice: 3_200_000,
		serials: ['RH-0001', 'RH-0002', 'RH-0003'],
	},
	{
		sku: 'SVC-INSTALL',
		name: 'Installation service',
		itemKind: 'service',
		category: null,
		unitLabel: null,
		isSerialized: false,
		isStockTracked: false,
		minStockQty: '0.000',
		sellingPrice: 750_000,
		purchasePrice: 0,
	},
];

/**
 * Seeds the inventory module: a global default warehouse, an
 * organization-scoped warehouse, their addresses and bins, and the item
 * master with a serialized tool set and a quantity-tracked material set.
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

	const orgWarehouse = await ensureWarehouse({
		organizationId,
		code: 'WH-MAIN',
		name: 'Main warehouse',
		// Only one default per scope, so the organization warehouse is NOT the
		// default: the global one already is, in a different scope.
		isDefault: false,
		villageId,
	});

	await ensureStorage(globalWarehouse, 'A1', 'Shelf A1');
	await ensureStorage(globalWarehouse, 'A2', 'Shelf A2');
	await ensureStorage(orgWarehouse, 'B1', 'Shelf B1');

	await ensureItems(organizationId, orgWarehouse);

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
	for (const seed of SEED_ITEMS) {
		const itemId = await ensureItem(seed, organizationId);
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
			category: seed.category,
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
