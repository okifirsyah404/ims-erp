/**
 * Seeds the inventory module (ADR-0026): the tool fleet and the opening stock.
 *
 * @remarks
 * ADR-0026 split the product master and the warehouse estate out of
 * `inventory`, so their fixtures moved with their tables. Idempotent on
 * natural keys like every other seeder: a second `drizzle:seed` inserts
 * nothing.
 */
import { and, eq, inArray, isNull, isNotNull, sql } from 'drizzle-orm';
import pino from 'pino';
import { drizzleDB } from '../../../drizzle/db';
import { products } from '../../../drizzle/schemas/product.schema';
import {
	itemCategories,
	items,
	type ItemStatus,
	itemSerials,
	movements,
	stocks,
} from '../../../drizzle/schemas/inventory.schema';

const logger = pino({
	timestamp: false,
	formatters: {
		level: (label) => ({ level: label }),
	},
});

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

/**

 * Seeds the stock-side fixtures against an already seeded product master and

 * warehouse estate.

 *

 * @param input - The warehouse ids from `seedWarehouse` and their scope

 */

export async function seedInventory(input: {

	organizationId: string | null;

	globalWarehouse: string;

	orgWarehouse: string;

}): Promise<void> {

	const { organizationId, globalWarehouse, orgWarehouse } = input;

	await ensureItemCategories(organizationId);

	await ensureItems(organizationId, orgWarehouse);

	await seedStock({ organizationId, globalWarehouse, orgWarehouse });

	logger.info({ organizationId, items: SEED_ITEMS.length }, 'Inventory seeding complete');

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
