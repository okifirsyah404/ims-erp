/**
 * Warehouse module schema — owns the `warehouse` Postgres schema (ADR-0026).
 *
 * @remarks
 * Split out of `inventory`: warehouses, their address, storages (bins), the
 * person-in-charge and organization links, per-warehouse and module settings,
 * and the warehouse code series.
 *
 * Stock lives in `inventory`, which points at warehouses and storages through
 * plain nullable ids (ADR-0014). Warehouses are global (ADR-0010).
 */
import {
	unixTimestamp,
	unixTimestampNullable,
} from '@drizzle/datatypes/unix-timestamp';
import { createCodeNumberingTable } from '@shared/numbering/table';
import { sql } from 'drizzle-orm';
import {
	boolean,
	check,
	index,
	numeric,
	pgSchema,
	text,
	uniqueIndex,
	uuid,
	varchar,
} from 'drizzle-orm/pg-core';
import type { PgColumn } from 'drizzle-orm/pg-core';

export const warehouseSchema = pgSchema('warehouse');

/* ------------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------------ */

/**
 * Builds the partial-unique pair for a tenant-scoped coded value.
 *
 * @remarks
 * Emits `UNIQUE(organization_id, column) WHERE organization_id IS NOT NULL`
 * and `UNIQUE(column) WHERE organization_id IS NULL`, because PostgreSQL treats
 * every NULL as distinct and a plain composite index would let every global row
 * reuse the same code.
 */
function scopedUnique(
	orgColumn: PgColumn,
	scopedColumn: PgColumn,
	names: { orgScoped: string; global: string },
) {
	return [
		uniqueIndex(names.orgScoped)
			.on(orgColumn, scopedColumn)
			.where(sql`organization_id IS NOT NULL`),
		uniqueIndex(names.global)
			.on(scopedColumn)
			.where(sql`organization_id IS NULL`),
	];
}

const organizationId = () => text('organization_id');

const softDeleteTimestamps = {
	createdAt: unixTimestamp('created_at').notNull(),
	updatedAt: unixTimestampNullable('updated_at').$onUpdate(() => new Date()),
	deletedAt: unixTimestampNullable('deleted_at'),
};

/* ------------------------------------------------------------------------ *
 * warehouse.warehouses (+ address, storage, manager, organization, settings)
 * ------------------------------------------------------------------------ */

/**
 * Warehouse master. Address fields live in `warehouse_addresses` (strict 1:1).
 *
 * @remarks
 * `organization_id` is frozen at NULL (ADR-0010): every warehouse is global and
 * organization access comes from `warehouse_organizations`. Writes are
 * application-admin-only.
 */
export const warehouses = warehouseSchema.table(
	'warehouses',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		organizationId: organizationId(),
		code: varchar('code', { length: 32 }).notNull(),
		name: text('name').notNull(),
		/** Display-only person in charge; grants no access (ADR-0010). */
		responsibleEmployeeId: uuid('responsible_employee_id'),
		isDefault: boolean('is_default').notNull().default(false),
		isActive: boolean('is_active').notNull().default(true),
		imageUrl: text('image_url'),
		...softDeleteTimestamps,
	},
	(table) => [
		...scopedUnique(table.organizationId, table.code, {
			orgScoped: 'warehouses_org_code_uq',
			global: 'warehouses_global_code_uq',
		}),
		index('warehouses_is_default_idx').on(table.isDefault),
		index('warehouses_is_active_idx').on(table.isActive),
		uniqueIndex('warehouses_org_default_uq')
			.on(table.organizationId)
			.where(
				sql`organization_id IS NOT NULL AND is_default AND deleted_at IS NULL`,
			),
		uniqueIndex('warehouses_global_default_uq')
			.on(
				sql`coalesce(${table.organizationId}, '00000000-0000-0000-0000-000000000000')`,
			)
			.where(sql`organization_id IS NULL AND is_default AND deleted_at IS NULL`),
	],
);

/** Warehouse address, strictly 1:1. Only `village_id` is stored (Q10). */
export const warehouseAddresses = warehouseSchema.table(
	'warehouse_addresses',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		warehouseId: uuid('warehouse_id')
			.notNull()
			.references(() => warehouses.id, { onDelete: 'cascade' }),
		label: text('label'),
		addressLine: text('address_line').notNull(),
		rt: varchar('rt', { length: 8 }),
		rw: varchar('rw', { length: 8 }),
		postalCode: varchar('postal_code', { length: 10 }),
		/** Logical reference to location.villages.id — cross-module FK omitted. */
		villageId: uuid('village_id'),
		latitude: numeric('latitude', { precision: 10, scale: 7 }),
		longitude: numeric('longitude', { precision: 10, scale: 7 }),
		...softDeleteTimestamps,
	},
	(table) => [
		uniqueIndex('warehouse_addresses_warehouse_uq').on(table.warehouseId),
		index('warehouse_addresses_village_id_idx').on(table.villageId),
	],
);

/** Storage location (bin) inside a warehouse. No zone level (ADR-0008). */
export const warehouseStorages = warehouseSchema.table(
	'warehouse_storages',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		warehouseId: uuid('warehouse_id')
			.notNull()
			.references(() => warehouses.id, { onDelete: 'cascade' }),
		code: varchar('code', { length: 32 }).notNull(),
		name: text('name'),
		binType: text('bin_type'),
		capacity: numeric('capacity', { precision: 18, scale: 3 }),
		isActive: boolean('is_active').notNull().default(true),
		...softDeleteTimestamps,
	},
	(table) => [
		index('warehouse_storages_warehouse_id_idx').on(table.warehouseId),
		uniqueIndex('warehouse_storages_warehouse_code_uq')
			.on(table.warehouseId, table.code)
			.where(sql`deleted_at IS NULL`),
	],
);

/** Per-user, per-warehouse person-in-charge grant (ADR-0017). */
export const warehouseManagers = warehouseSchema.table(
	'warehouse_managers',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		warehouseId: uuid('warehouse_id')
			.notNull()
			.references(() => warehouses.id, { onDelete: 'cascade' }),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		userId: text('user_id'),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		assignedBy: text('assigned_by'),
		...softDeleteTimestamps,
	},
	(table) => [
		uniqueIndex('warehouse_managers_uq')
			.on(table.warehouseId, table.userId)
			.where(sql`deleted_at IS NULL`),
		index('warehouse_managers_user_id_idx').on(table.userId),
	],
);

/** Link granting an organization access to a global warehouse (ADR-0010). */
export const warehouseOrganizations = warehouseSchema.table(
	'warehouse_organizations',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		warehouseId: uuid('warehouse_id')
			.notNull()
			.references(() => warehouses.id, { onDelete: 'cascade' }),
		/** Logical reference to auth.organizations.id — cross-module FK omitted. */
		organizationId: text('organization_id'),
		...softDeleteTimestamps,
	},
	(table) => [
		index('warehouse_organizations_warehouse_id_idx').on(table.warehouseId),
		index('warehouse_organizations_organization_id_idx').on(
			table.organizationId,
		),
		uniqueIndex('warehouse_organizations_uq')
			.on(table.warehouseId, table.organizationId)
			.where(sql`deleted_at IS NULL`),
	],
);

/** Per-warehouse configuration key value store (ADR-0024 Q27). */
export const warehouseSettings = warehouseSchema.table(
	'warehouse_settings',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		warehouseId: uuid('warehouse_id')
			.notNull()
			.references(() => warehouses.id, { onDelete: 'cascade' }),
		settingKey: text('setting_key').notNull(),
		settingValue: text('setting_value'),
		valueType: text('value_type').notNull().default('string'),
		description: text('description'),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		updatedBy: text('updated_by'),
		...softDeleteTimestamps,
	},
	(table) => [
		uniqueIndex('warehouse_settings_uq')
			.on(table.warehouseId, table.settingKey)
			.where(sql`deleted_at IS NULL`),
		check(
			'warehouse_settings_value_type_check',
			sql`value_type IN ('string', 'number', 'boolean', 'json', 'date')`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * warehouse.settings / warehouse.code_numberings
 * ------------------------------------------------------------------------ */

/** Warehouse module configuration key value store (ADR-0024 Q27). */
export const warehouseModuleSettings = warehouseSchema.table(
	'settings',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		settingGroup: text('setting_group').notNull(),
		settingKey: text('setting_key').notNull(),
		settingValue: text('setting_value'),
		valueType: text('value_type').notNull().default('string'),
		description: text('description'),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		updatedBy: text('updated_by'),
		...softDeleteTimestamps,
	},
	(table) => [
		uniqueIndex('warehouse_settings_scope_uq')
			.on(table.settingGroup, table.settingKey)
			.where(sql`deleted_at IS NULL`),
		check(
			'warehouse_module_settings_value_type_check',
			sql`value_type IN ('string', 'number', 'boolean', 'json', 'date')`,
		),
	],
);

export const warehouseCodeNumberings =
	createCodeNumberingTable(warehouseSchema);

/* ------------------------------------------------------------------------ *
 * Inferred types
 * ------------------------------------------------------------------------ */

export type TWarehouseSelect = typeof warehouses.$inferSelect;
export type TWarehouseInsert = typeof warehouses.$inferInsert;
export type TWarehouseAddressSelect = typeof warehouseAddresses.$inferSelect;
export type TWarehouseAddressInsert = typeof warehouseAddresses.$inferInsert;
export type TWarehouseStorageSelect = typeof warehouseStorages.$inferSelect;
export type TWarehouseStorageInsert = typeof warehouseStorages.$inferInsert;
export type TWarehouseManagerSelect = typeof warehouseManagers.$inferSelect;
export type TWarehouseManagerInsert = typeof warehouseManagers.$inferInsert;
export type TWarehouseOrganizationSelect =
	typeof warehouseOrganizations.$inferSelect;
export type TWarehouseOrganizationInsert =
	typeof warehouseOrganizations.$inferInsert;
export type TWarehouseSettingSelect = typeof warehouseSettings.$inferSelect;
export type TWarehouseSettingInsert = typeof warehouseSettings.$inferInsert;
export type TWarehouseModuleSettingSelect =
	typeof warehouseModuleSettings.$inferSelect;
export type TWarehouseModuleSettingInsert =
	typeof warehouseModuleSettings.$inferInsert;
export type TWarehouseCodeNumberingSelect =
	typeof warehouseCodeNumberings.$inferSelect;
export type TWarehouseCodeNumberingInsert =
	typeof warehouseCodeNumberings.$inferInsert;
