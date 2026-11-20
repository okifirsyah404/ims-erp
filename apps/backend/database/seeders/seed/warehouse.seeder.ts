/**
 * Seeds the warehouse module (ADR-0026).
 *
 * @remarks
 * ADR-0026 split the product master and the warehouse estate out of
 * `inventory`, so their fixtures moved with their tables. Idempotent on
 * natural keys like every other seeder: a second `drizzle:seed` inserts
 * nothing.
 */
import { and, eq, isNull } from 'drizzle-orm';
import pino from 'pino';
import { drizzleDB } from '../../../drizzle/db';
import { village } from '../../../drizzle/schemas/location.schema';
import {
	warehouseAddresses,
	warehouseOrganizations,
	warehouseStorages,
	warehouses,
} from '../../../drizzle/schemas/warehouse.schema';

const logger = pino({
	timestamp: false,
	formatters: {
		level: (label) => ({ level: label }),
	},
});

/**

 * Seeds the physical estate: a global default warehouse and the organization

 * warehouse, with their addresses and bins.

 *

 * @param organizationId - Scope of the sample rows; `null` seeds the global one only

 * @param villageId - Village of the seeded addresses, if locations were seeded

 */

export async function seedWarehouse(input: {

	organizationId: string | null;

	villageId: string | null;

	isProduction: boolean;

}): Promise<{ organizationId: string | null; globalWarehouse: string; orgWarehouse: string } | null> {

	const { organizationId, villageId, isProduction } = input;

	if (isProduction) {

		logger.info('Production environment; skipping warehouse sample data');

		return null;

	}



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



	logger.info({ organizationId }, 'Warehouse seeding complete');

	return { organizationId, globalWarehouse, orgWarehouse };

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
