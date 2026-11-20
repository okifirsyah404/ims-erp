import pino from 'pino';
import { and, eq, isNull } from 'drizzle-orm';
import { drizzleDB } from '../../../drizzle/db';
import {
	warehouseManagers,
	warehouses,
} from '../../../drizzle/schemas/warehouse.schema';
import { users } from '../../../drizzle/schemas/auth.schema';
import { isProductionEnv } from '../../../config/providers/env';

const logger = pino({
	timestamp: false,
	formatters: {
		level: (label) => ({ level: label }),
	},
});

/**
 * Deterministic anchor for the seeded person in charge.
 *
 * @remarks
 * This is the `warehouse` role account created by `organization-members.seeder`
 * (`warehouse.seed@entragate.local`, dev password `warehouse123456`). The email
 * is an identity anchor, never faker-generated, so re-runs resolve the same row.
 */
const SEED_PIC_EMAIL = 'warehouse.seed@entragate.local';

/**
 * Seeds one person in charge per live warehouse (ADR-0017).
 *
 * @remarks
 * Dev-only: the account it attaches has a guessable password, so production is
 * skipped the same way `organization-members.seeder` skips its role accounts.
 *
 * Idempotent on `(warehouse_id, user_id) WHERE deleted_at IS NULL` — the same
 * key the table's partial unique index enforces, so a second run is a no-op and
 * an archived assignment does not block a fresh one.
 *
 * The PIC rows exist so Phase 2 (`warehouseGuard`) can be exercised against real
 * data, not only against mocks. They grant no stock operation.
 */
export async function seedWarehouseManagers(): Promise<void> {
	if (isProductionEnv()) {
		logger.info('Production environment; skipping warehouse PIC assignments');
		return;
	}

	const [pic] = await drizzleDB
		.select({ id: users.id })
		.from(users)
		.where(eq(users.email, SEED_PIC_EMAIL))
		.limit(1);

	if (!pic) {
		logger.info(
			{ email: SEED_PIC_EMAIL },
			'Seed PIC account not found (role account seeding skipped); skipping warehouse PIC assignments',
		);
		return;
	}

	const liveWarehouses = await drizzleDB
		.select({ id: warehouses.id })
		.from(warehouses)
		.where(isNull(warehouses.deletedAt));

	let created = 0;
	for (const warehouse of liveWarehouses) {
		const [existing] = await drizzleDB
			.select({ id: warehouseManagers.id })
			.from(warehouseManagers)
			.where(
				and(
					eq(warehouseManagers.warehouseId, warehouse.id),
					eq(warehouseManagers.userId, pic.id),
					isNull(warehouseManagers.deletedAt),
				),
			)
			.limit(1);
		if (existing) continue;

		await drizzleDB.insert(warehouseManagers).values({
			warehouseId: warehouse.id,
			userId: pic.id,
			// Self-attributed: the seeder runs without an acting admin session.
			assignedBy: pic.id,
			createdAt: new Date(),
		});
		created++;
	}

	logger.info(
		{ created, warehouses: liveWarehouses.length, pic: pic.id },
		'Warehouse PIC seeding complete',
	);
}
