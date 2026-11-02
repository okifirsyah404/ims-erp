import { eq, sql } from 'drizzle-orm';
import pino from 'pino';
import { drizzleDB } from '../../../drizzle/db';
import {
	items,
	serialTrackedItems,
	stockBalances,
	stockMovements,
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
 */
const SEED_GLOBAL_STOCK: readonly TSeedStock[] = [
	{ sku: 'CMP-PSU-12V', quantity: '50.000' },
	{ sku: 'MAT-CABLE-CAT6', quantity: '500.000' },
];

/** Opening stock for the organization-owned warehouse (per-tenant balances). */
const SEED_ORG_STOCK: readonly TSeedStock[] = [
	{ sku: 'CMP-PSU-12V', quantity: '20.000' },
	{ sku: 'MAT-CABLE-CAT6', quantity: '150.000' },
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

		// Balances mirror the movement: same scope, same quantity. Reservations
		// are unbuilt, so available equals on-hand.
		//
		// The lookup is scoped by organization as well as warehouse. Matching on
		// warehouse alone would find the *shared* row of a global warehouse, or a
		// sibling tenant's row, and add this quantity to it.
		const [balance] = await tx
			.select({ id: stockBalances.id })
			.from(stockBalances)
			.where(
				sql`${stockBalances.organizationId} IS NOT DISTINCT FROM ${scopeOrganizationId} AND ${stockBalances.warehouseId} = ${warehouseId} AND ${stockBalances.itemId} = ${itemId} AND ${stockBalances.binId} IS NULL`,
			)
			.limit(1);

		if (balance) {
			await tx
				.update(stockBalances)
				.set({
					quantityOnHand: sql`${stockBalances.quantityOnHand} + ${quantity}`,
					quantityAvailable: sql`${stockBalances.quantityOnHand} + ${quantity} - ${stockBalances.quantityReserved}`,
					lastMovementAt: occurredAt,
					updatedAt: occurredAt,
				})
				.where(eq(stockBalances.id, balance.id));
			return;
		}

		await tx.insert(stockBalances).values({
			organizationId: scopeOrganizationId,
			itemId,
			warehouseId,
			quantityOnHand: quantity,
			quantityReserved: '0',
			quantityAvailable: quantity,
			lastMovementAt: occurredAt,
			createdAt: occurredAt,
		});
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
