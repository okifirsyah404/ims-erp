import { eq, sql } from 'drizzle-orm';
import pino from 'pino';
import { drizzleDB } from '../../../drizzle/db';
import {
	assetMovements,
	assets,
	assetTypes,
	borrowingEvents,
	borrowingLines,
	borrowings,
	toolSetItems,
	toolSets,
} from '../../../drizzle/schemas/asset.schema';
import { organizations } from '../../../drizzle/schemas/auth.schema';
import {
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
 * Deterministic anchors for the seeded asset fleet.
 *
 * @remarks
 * Every row is keyed on a fixed code/serial, never on faker output, so
 * re-running `drizzle:seed` is a no-op. The dates are fixed too: a seeder that
 * used `new Date()` would change the reconcile inputs on every run.
 */
const SEED_ASSETS = [
	{
		code: 'AST-SEED-001',
		name: 'Digital multimeter',
		assetType: 'tool',
		serialNumber: 'SN-SEED-001',
		status: 'borrowed',
		placed: true,
		borrowedSince: '2026-10-01T08:00:00.000Z',
		cost: 2_500_000,
	},
	{
		code: 'AST-SEED-002',
		name: 'Cordless drill',
		assetType: 'tool',
		serialNumber: 'SN-SEED-002',
		status: 'ready',
		placed: true,
		borrowedSince: null,
		cost: 3_200_000,
	},
	{
		code: 'AST-SEED-003',
		name: 'Cable tester',
		assetType: 'tool',
		serialNumber: 'SN-SEED-003',
		status: 'lost',
		placed: false,
		borrowedSince: null,
		cost: 1_750_000,
	},
	{
		code: 'AST-SEED-004',
		name: 'Crimping tool',
		assetType: 'tool',
		serialNumber: 'SN-SEED-004',
		status: 'ready',
		placed: true,
		borrowedSince: null,
		cost: 850_000,
	},
	{
		code: 'AST-SEED-005',
		name: 'Field toolbox',
		assetType: 'tool',
		serialNumber: 'SN-SEED-005',
		status: 'ready',
		placed: true,
		borrowedSince: null,
		cost: 1_100_000,
	},
	{
		code: 'AST-SEED-006',
		name: 'Site projector',
		assetType: 'equipment',
		serialNumber: 'SN-SEED-006',
		status: 'ready',
		placed: true,
		borrowedSince: null,
		cost: 12_000_000,
	},
] as const;

const SEED_AT = new Date('2026-01-15T00:00:00.000Z');

/**
 * Seeds the assets module: reference asset types, a small equipment fleet with
 * warehouse/storage placement and its movement trail, one tool set, and an
 * open / returned / lost borrowing.
 *
 * @remarks
 * Runs after {@link seedInventory} because it references the seeded warehouse
 * and storage. Idempotent on the deterministic codes above: every insert is
 * guarded by a lookup, so a second run changes nothing.
 */
export async function seedAssets(): Promise<void> {
	const [organization] = await drizzleDB
		.select({ id: organizations.id })
		.from(organizations)
		.where(eq(organizations.slug, SEED_ORGANIZATION_SLUG))
		.limit(1);

	const organizationId = organization?.id ?? null;

	await ensureAssetTypes();

	const [warehouse] = await drizzleDB
		.select({ id: warehouses.id })
		.from(warehouses)
		.where(
			sql`${warehouses.organizationId} = ${organizationId} AND ${warehouses.code} = 'WH-MAIN' AND ${warehouses.deletedAt} IS NULL`,
		)
		.limit(1);

	const [storage] = warehouse
		? await drizzleDB
				.select({ id: warehouseStorages.id })
				.from(warehouseStorages)
				.where(
					sql`${warehouseStorages.warehouseId} = ${warehouse.id} AND ${warehouseStorages.code} = 'B1' AND ${warehouseStorages.deletedAt} IS NULL`,
				)
				.limit(1)
		: [];

	const warehouseId = warehouse?.id ?? null;
	const storageId = storage?.id ?? null;

	const assetIds = new Map<string, string>();
	for (const seed of SEED_ASSETS) {
		const id = await ensureAsset({
			organizationId,
			warehouseId,
			storageId,
			seed,
		});
		assetIds.set(seed.code, id);
		if (seed.placed) {
			await ensureReceipt({ organizationId, assetId: id, code: seed.code });
		}
	}

	const toolSetId = await ensureToolSet(organizationId);
	if (toolSetId) {
		for (const code of ['AST-SEED-004', 'AST-SEED-005']) {
			const assetId = assetIds.get(code);
			if (assetId) await ensureToolSetItem(organizationId, toolSetId, assetId);
		}
	}

	await seedBorrowings({
		organizationId,
		warehouseId,
		storageId,
		assetIds,
	});

	logger.info(
		{
			organizationId,
			assets: SEED_ASSETS.length,
			warehouseId,
			storageId,
			borrowings: 3,
		},
		'Assets seeding complete',
	);
}

/** Ensures the six global asset types exist (the migration also inserts them). */
async function ensureAssetTypes(): Promise<void> {
	const types = [
		{ code: 'equipment', name: 'Equipment', life: 60 },
		{ code: 'vehicle', name: 'Vehicle', life: 96 },
		{ code: 'tool', name: 'Tool', life: 36 },
		{ code: 'furniture', name: 'Furniture', life: 60 },
		{ code: 'it', name: 'IT', life: 36 },
		{ code: 'intangible', name: 'Intangible', life: 120 },
	];

	for (const type of types) {
		await drizzleDB
			.insert(assetTypes)
			.values({
				code: type.code,
				name: type.name,
				defaultUsefulLifeMonths: type.life,
				createdAt: SEED_AT,
			})
			.onConflictDoNothing({ target: assetTypes.code });
	}
}

/** Creates one asset when absent, keyed on the globally unique code. */
async function ensureAsset(input: {
	organizationId: string | null;
	warehouseId: string | null;
	storageId: string | null;
	seed: (typeof SEED_ASSETS)[number];
}): Promise<string> {
	const { organizationId, warehouseId, storageId, seed } = input;

	const [existing] = await drizzleDB
		.select({ id: assets.id })
		.from(assets)
		.where(sql`${assets.code} = ${seed.code} AND ${assets.deletedAt} IS NULL`)
		.limit(1);
	if (existing) return existing.id;

	const placed = seed.placed && warehouseId !== null;

	const [created] = await drizzleDB
		.insert(assets)
		.values({
			organizationId,
			code: seed.code,
			name: seed.name,
			assetType: seed.assetType,
			serialNumber: seed.serialNumber,
			acquisitionDate: '2026-01-10',
			acquisitionCost: seed.cost,
			bookValue: seed.cost,
			currencyCode: 'IDR',
			usefulLifeMonths: 36,
			condition: 'good',
			status: seed.status,
			warehouseId: placed ? warehouseId : null,
			storageId: placed ? storageId : null,
			borrowedSince: seed.borrowedSince ? new Date(seed.borrowedSince) : null,
			createdAt: SEED_AT,
		})
		.returning({ id: assets.id });

	return created.id;
}

/** Writes the `receipt` movement that explains the asset's current location. */
async function ensureReceipt(input: {
	organizationId: string | null;
	assetId: string;
	code: string;
}): Promise<void> {
	const { organizationId, assetId, code } = input;
	const note = `seed:${code}:receipt`;

	const [existing] = await drizzleDB
		.select({ id: assetMovements.id })
		.from(assetMovements)
		.where(
			sql`${assetMovements.assetId} = ${assetId} AND ${assetMovements.notes} = ${note}`,
		)
		.limit(1);
	if (existing) return;

	const [asset] = await drizzleDB
		.select({
			warehouseId: assets.warehouseId,
			storageId: assets.storageId,
		})
		.from(assets)
		.where(eq(assets.id, assetId))
		.limit(1);

	await drizzleDB.insert(assetMovements).values({
		organizationId,
		assetId,
		movementType: 'receipt',
		toWarehouseId: asset?.warehouseId ?? null,
		toStorageId: asset?.storageId ?? null,
		movedAt: SEED_AT,
		notes: note,
		createdAt: SEED_AT,
	});
}

/** Creates the sample field toolkit when absent, keyed on `(org, code)`. */
async function ensureToolSet(
	organizationId: string | null,
): Promise<string | null> {
	const code = 'TS-SEED-01';

	const [existing] = await drizzleDB
		.select({ id: toolSets.id })
		.from(toolSets)
		.where(
			organizationId === null
				? sql`${toolSets.organizationId} IS NULL AND ${toolSets.code} = ${code} AND ${toolSets.deletedAt} IS NULL`
				: sql`${toolSets.organizationId} = ${organizationId} AND ${toolSets.code} = ${code} AND ${toolSets.deletedAt} IS NULL`,
		)
		.limit(1);
	if (existing) return existing.id;

	const [created] = await drizzleDB
		.insert(toolSets)
		.values({
			organizationId,
			code,
			name: 'Field toolkit A',
			description: 'Crimping tool plus the field toolbox',
			status: 'available',
			createdAt: SEED_AT,
		})
		.returning({ id: toolSets.id });

	return created.id;
}

/** Adds one asset to the toolkit when the line is absent. */
async function ensureToolSetItem(
	organizationId: string | null,
	toolSetId: string,
	assetId: string,
): Promise<void> {
	const [existing] = await drizzleDB
		.select({ id: toolSetItems.id })
		.from(toolSetItems)
		.where(
			sql`${toolSetItems.toolSetId} = ${toolSetId} AND ${toolSetItems.assetId} = ${assetId} AND ${toolSetItems.deletedAt} IS NULL`,
		)
		.limit(1);
	if (existing) return;

	await drizzleDB.insert(toolSetItems).values({
		organizationId,
		toolSetId,
		assetId,
		createdAt: SEED_AT,
	});
}

/**
 * Seeds three borrowings that exercise every custody state:
 *
 * - `BRW-202611-9001` — open, `issued`, asset 001 is out and has no location;
 * - `BRW-202611-9002` — `returned`, asset 002 is back in storage;
 * - `BRW-202611-9003` — `issued` with a `marked_lost` line for asset 003.
 */
async function seedBorrowings(input: {
	organizationId: string | null;
	warehouseId: string | null;
	storageId: string | null;
	assetIds: Map<string, string>;
}): Promise<void> {
	const { organizationId, warehouseId, storageId, assetIds } = input;

	const requestedAt = new Date('2026-10-01T07:00:00.000Z');
	const approvedAt = new Date('2026-10-01T07:30:00.000Z');
	const issuedAt = new Date('2026-10-01T08:00:00.000Z');
	const returnedAt = new Date('2026-10-10T09:00:00.000Z');
	const lostAt = new Date('2026-10-12T09:00:00.000Z');
	const dueAt = new Date('2026-12-01T00:00:00.000Z');

	await seedBorrowing({
		organizationId,
		code: 'BRW-202611-9001',
		status: 'issued',
		assetId: assetIds.get('AST-SEED-001'),
		warehouseId,
		storageId,
		requestedAt,
		approvedAt,
		issuedAt,
		dueAt,
	});
	await seedBorrowing({
		organizationId,
		code: 'BRW-202611-9002',
		status: 'returned',
		assetId: assetIds.get('AST-SEED-002'),
		warehouseId,
		storageId,
		requestedAt,
		approvedAt,
		issuedAt,
		returnedAt,
		dueAt,
	});
	await seedBorrowing({
		organizationId,
		code: 'BRW-202611-9003',
		status: 'issued',
		assetId: assetIds.get('AST-SEED-003'),
		warehouseId,
		storageId,
		requestedAt,
		approvedAt,
		issuedAt,
		markedLostAt: lostAt,
		dueAt,
	});
}

/** Inserts one borrowing, its line, its movements and its event timeline. */
async function seedBorrowing(input: {
	organizationId: string | null;
	code: string;
	status: 'issued' | 'returned';
	assetId: string | undefined;
	warehouseId: string | null;
	storageId: string | null;
	requestedAt: Date;
	approvedAt: Date;
	issuedAt: Date;
	returnedAt?: Date;
	markedLostAt?: Date;
	dueAt: Date;
}): Promise<void> {
	const {
		organizationId,
		code,
		status,
		assetId,
		warehouseId,
		storageId,
		requestedAt,
		approvedAt,
		issuedAt,
		returnedAt,
		markedLostAt,
		dueAt,
	} = input;

	if (!assetId) return;

	const [existing] = await drizzleDB
		.select({ id: borrowings.id })
		.from(borrowings)
		.where(
			organizationId === null
				? sql`${borrowings.organizationId} IS NULL AND ${borrowings.code} = ${code} AND ${borrowings.deletedAt} IS NULL`
				: sql`${borrowings.organizationId} = ${organizationId} AND ${borrowings.code} = ${code} AND ${borrowings.deletedAt} IS NULL`,
		)
		.limit(1);
	if (existing) return;

	const [header] = await drizzleDB
		.insert(borrowings)
		.values({
			organizationId,
			code,
			status,
			purpose: 'internal_use',
			borrowerType: 'guest',
			guestName: 'Budi Santoso',
			guestPhone: '081200000000',
			guestIdType: 'ktp',
			guestIdNumber: `SEED-${code}`,
			guestAddressText: 'Jl. Contoh No. 1',
			requestedAt,
			approvedAt,
			issuedAt,
			dueAt,
			notes: 'Seeded by database/seeders',
			createdAt: requestedAt,
		})
		.returning({ id: borrowings.id });

	const [line] = await drizzleDB
		.insert(borrowingLines)
		.values({
			borrowingId: header.id,
			assetId,
			originWarehouseId: warehouseId,
			originStorageId: storageId,
			issuedAt,
			dueAt,
			returnedAt: returnedAt ?? null,
			returnedCondition: returnedAt ? 'good' : null,
			markedLostAt: markedLostAt ?? null,
			lostReportedBy: markedLostAt ? 'seed-user' : null,
			createdAt: requestedAt,
		})
		.returning({ id: borrowingLines.id });

	const issueMovement = await ensureBorrowMovement({
		organizationId,
		assetId,
		code,
		type: 'borrow_out',
		fromWarehouseId: warehouseId,
		fromStorageId: storageId,
		at: issuedAt,
	});

	await drizzleDB.insert(borrowingEvents).values({
		borrowingId: header.id,
		borrowingLineId: line.id,
		eventType: 'requested',
		occurredAt: requestedAt,
	});

	await drizzleDB.insert(borrowingEvents).values({
		borrowingId: header.id,
		borrowingLineId: line.id,
		eventType: 'approved',
		occurredAt: approvedAt,
	});

	await drizzleDB.insert(borrowingEvents).values({
		borrowingId: header.id,
		borrowingLineId: line.id,
		eventType: 'issued',
		assetMovementId: issueMovement,
		occurredAt: issuedAt,
	});

	if (returnedAt) {
		const returnMovement = await ensureBorrowMovement({
			organizationId,
			assetId,
			code,
			type: 'borrow_return',
			toWarehouseId: warehouseId,
			toStorageId: storageId,
			at: returnedAt,
		});
		await drizzleDB.insert(borrowingEvents).values({
			borrowingId: header.id,
			borrowingLineId: line.id,
			eventType: 'returned',
			assetMovementId: returnMovement,
			occurredAt: returnedAt,
		});
	}

	if (markedLostAt) {
		const lossMovement = await ensureBorrowMovement({
			organizationId,
			assetId,
			code,
			type: 'lost',
			at: markedLostAt,
		});
		await drizzleDB.insert(borrowingEvents).values({
			borrowingId: header.id,
			borrowingLineId: line.id,
			eventType: 'marked_lost',
			assetMovementId: lossMovement,
			occurredAt: markedLostAt,
		});
	}
}

/** Writes one borrowing movement (guarded by its seed note) and returns its id. */
async function ensureBorrowMovement(input: {
	organizationId: string | null;
	assetId: string;
	code: string;
	type: 'borrow_out' | 'borrow_return' | 'lost';
	fromWarehouseId?: string | null;
	fromStorageId?: string | null;
	toWarehouseId?: string | null;
	toStorageId?: string | null;
	at: Date;
}): Promise<string> {
	const { organizationId, assetId, code, type, at } = input;
	const note = `seed:${code}:${type}`;

	const [existing] = await drizzleDB
		.select({ id: assetMovements.id })
		.from(assetMovements)
		.where(
			sql`${assetMovements.assetId} = ${assetId} AND ${assetMovements.notes} = ${note}`,
		)
		.limit(1);
	if (existing) return existing.id;

	const [created] = await drizzleDB
		.insert(assetMovements)
		.values({
			organizationId,
			assetId,
			movementType: type,
			fromWarehouseId: input.fromWarehouseId ?? null,
			fromStorageId: input.fromStorageId ?? null,
			toWarehouseId: input.toWarehouseId ?? null,
			toStorageId: input.toStorageId ?? null,
			movedAt: at,
			movedByUserId: 'seed-user',
			notes: note,
			createdAt: at,
		})
		.returning({ id: assetMovements.id });

	return created.id;
}
