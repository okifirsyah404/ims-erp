/**
 * Asset module schema (assets schema, ERP-owned) — M06 build, extended by
 * ERP-0036 (asset location + borrowing ownership).
 *
 * Mirrors `docs/database/docs.dbml` (`assets.*`, 14 tables).
 *
 * ERP-0036 rules honoured here:
 * - **One row per physical unit** (D1): an asset is a serialized, borrowable
 *   object; quantity is always 1.
 * - **Location** (D2/D3): `warehouse_id` + `storage_id` name the unit's current
 *   place and `asset_movements` keeps the trail. Both are logical references
 *   into `inventory` — cross-schema FKs are forbidden, so they are plain uuid
 *   columns validated through the Inventory contract.
 * - **Borrowing is the only custody mechanism** (D6): `asset_assignments` is
 *   gone and `borrowings` / `borrowing_lines` / `borrowing_events` live here.
 * - **Tenancy** (D11): `organization_id` is nullable on every table except the
 *   global `asset_types` lookup; NULL means company-wide.
 * - `assets.code` is **globally unique** (D13) and serial numbers are unique
 *   per *scope* through an expression index, because PostgreSQL treats every
 *   NULL as distinct in a unique index.
 *
 * Money columns are exact integer minor units (ADR-0002, never floats).
 * Status vocabularies are text guarded by application code, per the DBML
 * project rule; the CHECKs here are the DB-level backstop.
 */
import { sql } from 'drizzle-orm';
import {
	boolean,
	check,
	date,
	index,
	integer,
	numeric,
	pgSchema,
	text,
	uniqueIndex,
	uuid,
	varchar,
} from 'drizzle-orm/pg-core';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { bigint } from 'drizzle-orm/pg-core';
import {
	unixTimestamp,
	unixTimestampNullable,
} from '@drizzle/datatypes/unix-timestamp';

export const assetsSchema = pgSchema('assets');

/* ------------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------------ */

/**
 * Shared tenant column. NULL means global/company-wide (ADR-0008 scope rule);
 * global rows are app-admin write, org read (D11).
 */
const organizationId = () => text('organization_id');

/** Shared soft-delete + audit columns. */
const softDeleteTimestamps = {
	createdAt: unixTimestamp('created_at').notNull(),
	updatedAt: unixTimestampNullable('updated_at').$onUpdate(() => new Date()),
	deletedAt: unixTimestampNullable('deleted_at'),
};

/**
 * Builds the partial-unique pair for a tenant-scoped coded value.
 *
 * Emits `UNIQUE(organization_id, column) WHERE organization_id IS NOT NULL`
 * and `UNIQUE(column) WHERE organization_id IS NULL`. Without the second
 * index, PostgreSQL's NULL-is-distinct rule lets every global row reuse the
 * same code.
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

/** `date` columns arrive as `YYYY-MM-DD` strings. */
const day = (name: string) => date(name, { mode: 'string' });

/** Exact integer IDR minor units (ADR-0002). Never a float. */
const money = (name: string) => bigint(name, { mode: 'number' });

/* ------------------------------------------------------------------------ *
 * Vocabularies (application-guarded text; CHECKs are the DB backstop)
 * ------------------------------------------------------------------------ */

/**
 * The six seeded `asset_types.code` values (D10). The lookup table is the
 * source of truth at runtime; this tuple seeds it and validates categories
 * before a row exists.
 */
export const ASSET_TYPES = [
	'equipment',
	'vehicle',
	'tool',
	'furniture',
	'it',
	'intangible',
] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

/**
 * Lifecycle statuses (D7). For unit-backed assets the value is derived by
 * `reconcileStatus`: open borrowing ⇒ `borrowed`, in-progress maintenance ⇒
 * `maintenance`, terminal writes `disposed`/`lost`, otherwise `ready`.
 * `inactive` is the only asset-owned state and survives a reconcile.
 * (`in_stock` → `ready`, `in_use` → `borrowed` in the ERP-0036 migration.)
 */
export const ASSET_STATUSES = [
	'ready',
	'borrowed',
	'maintenance',
	'inactive',
	'disposed',
	'lost',
] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];

export const ASSET_CONDITIONS = ['new', 'good', 'fair', 'poor', 'damaged'] as const;
export type AssetCondition = (typeof ASSET_CONDITIONS)[number];

export const DEPRECIATION_METHODS = [
	'straight_line',
	'declining_balance',
	'none',
] as const;
export type DepreciationMethod = (typeof DEPRECIATION_METHODS)[number];

/** Movement vocabulary (D3). Superseded values: `loan`, `return`. */
export const MOVEMENT_TYPES_ASSET = [
	'receipt',
	'transfer',
	'borrow_out',
	'borrow_return',
	'project_site',
	'disposal',
	'lost',
] as const;
export type AssetMovementType = (typeof MOVEMENT_TYPES_ASSET)[number];

export const MAINTENANCE_TYPES = [
	'preventive',
	'corrective',
	'calibration',
	'inspection',
] as const;
export type MaintenanceType = (typeof MAINTENANCE_TYPES)[number];

export const MAINTENANCE_STATUSES = [
	'scheduled',
	'in_progress',
	'completed',
	'cancelled',
] as const;
export type MaintenanceStatus = (typeof MAINTENANCE_STATUSES)[number];

export const DISPOSAL_METHODS = [
	'sale',
	'scrap',
	'donation',
	'transfer',
	'trade_in',
] as const;
export type DisposalMethod = (typeof DISPOSAL_METHODS)[number];

export const DISPOSAL_STATUSES = [
	'draft',
	'submitted',
	'approved',
	'executed',
	'cancelled',
] as const;
export type DisposalStatus = (typeof DISPOSAL_STATUSES)[number];

export const DOCUMENT_TYPES_ASSET = [
	'invoice',
	'manual',
	'certificate',
	'photo',
	'contract',
] as const;
export type AssetDocumentType = (typeof DOCUMENT_TYPES_ASSET)[number];

export const CONDITION_CHECK_STATUSES = ['recorded', 'followed_up', 'closed'] as const;
export type ConditionCheckStatus = (typeof CONDITION_CHECK_STATUSES)[number];

export const TOOL_SET_STATUSES = ['available', 'lent', 'maintenance', 'retired'] as const;
export type ToolSetStatus = (typeof TOOL_SET_STATUSES)[number];

/** Borrowing document states (ported from inventory unchanged). */
export const BORROWING_STATUSES = [
	'draft',
	'requested',
	'approved',
	'rejected',
	'issued',
	'partially_returned',
	'returned',
	'closed',
	'cancelled',
] as const;
export type BorrowingStatus = (typeof BORROWING_STATUSES)[number];

export const BORROWING_PURPOSES = [
	'rental',
	'internal_use',
	'testing',
	'warranty_service',
] as const;
export type BorrowingPurpose = (typeof BORROWING_PURPOSES)[number];

export const BORROWER_TYPES = ['user', 'customer', 'guest'] as const;
export type BorrowerType = (typeof BORROWER_TYPES)[number];

export const GUEST_ID_TYPES = ['ktp', 'sim', 'passport', 'other'] as const;

/** Condition recorded when a borrowed asset comes back. */
export const RETURN_CONDITIONS = ['good', 'damaged', 'incomplete'] as const;

/**
 * Borrowing event types. The three **physical** ones must carry the
 * `asset_movement_id` that recorded the movement; every other type must not.
 */
export const BORROWING_EVENT_TYPES = [
	'requested',
	'approved',
	'rejected',
	'issued',
	'returned',
	'marked_late',
	'marked_lost',
	'due_date_extended',
	'cancelled',
	'closed',
] as const;
export type BorrowingEventType = (typeof BORROWING_EVENT_TYPES)[number];

export const PHYSICAL_EVENT_TYPES = [
	'issued',
	'returned',
	'marked_lost',
] as const satisfies readonly BorrowingEventType[];

/* ------------------------------------------------------------------------ *
 * assets.asset_types
 * ------------------------------------------------------------------------ */

/**
 * Asset type lookup (D10). Global reference data — **no** `organization_id`.
 * `code` is the stable identity referenced by `assets.asset_type` and
 * `asset_categories.asset_type`; `name` is the editable label. Writes are
 * application-admin-only; `is_active` is the "stop offering it" switch and a
 * type cannot be soft deleted while something references it.
 */
export const assetTypes = assetsSchema.table(
	'asset_types',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		code: varchar('code', { length: 32 }).notNull(),
		name: text('name').notNull(),
		defaultUsefulLifeMonths: integer('default_useful_life_months'),
		defaultDepreciationMethod: text('default_depreciation_method')
			.notNull()
			.default('straight_line'),
		isActive: boolean('is_active').notNull().default(true),
		...softDeleteTimestamps,
	},
	(table) => [
		uniqueIndex('asset_types_code_uq').on(table.code),
		index('asset_types_is_active_idx').on(table.isActive),
		check(
			'asset_types_dep_method_check',
			sql`default_depreciation_method IN ('straight_line', 'declining_balance', 'none')`,
		),
		check(
			'asset_types_useful_life_check',
			sql`default_useful_life_months IS NULL OR default_useful_life_months > 0`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * assets.asset_categories
 * ------------------------------------------------------------------------ */

/**
 * Asset category with its default depreciation rule. Self-referencing
 * parent for a category tree (FK `set null`).
 */
export const assetCategories = assetsSchema.table(
	'asset_categories',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		organizationId: organizationId(),
		code: varchar('code', { length: 32 }).notNull(),
		name: text('name').notNull(),
		parentCategoryId: uuid('parent_category_id'),
		assetType: text('asset_type')
			.notNull()
			.default('equipment')
			.references(() => assetTypes.code, { onDelete: 'restrict' }),
		defaultUsefulLifeMonths: integer('default_useful_life_months'),
		defaultDepreciationMethod: text('default_depreciation_method')
			.notNull()
			.default('straight_line'),
		isActive: boolean('is_active').notNull().default(true),
		...softDeleteTimestamps,
	},
	(table) => [
		...scopedUnique(table.organizationId, table.code, {
			orgScoped: 'asset_categories_org_code_uq',
			global: 'asset_categories_global_code_uq',
		}),
		index('asset_categories_parent_category_id_idx').on(
			table.parentCategoryId,
		),
		check(
			'asset_categories_dep_method_check',
			sql`${table.defaultDepreciationMethod} IN ('straight_line', 'declining_balance', 'none')`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * assets.assets
 * ------------------------------------------------------------------------ */

/**
 * Asset master — ONE ROW PER PHYSICAL UNIT (D1); quantity is always 1.
 * Costs are exact integer minor units. Master data referenced by financial
 * records is never hard deleted. `status` is derived by `reconcileStatus` for
 * unit-backed rows (D7); `inactive` is asset-owned (D18).
 */
export const assets = assetsSchema.table(
	'assets',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		organizationId: organizationId(),
		code: varchar('code', { length: 32 }).notNull(),
		name: text('name').notNull(),
		description: text('description'),
		categoryId: uuid('category_id'),
		assetType: text('asset_type')
			.notNull()
			.default('equipment')
			.references(() => assetTypes.code, { onDelete: 'restrict' }),
		serialNumber: text('serial_number'),
		barcode: text('barcode'),
		acquisitionDate: day('acquisition_date'),
		acquisitionCost: money('acquisition_cost').notNull().default(0),
		salvageValue: money('salvage_value').notNull().default(0),
		accumulatedDepreciation: money('accumulated_depreciation')
			.notNull()
			.default(0),
		bookValue: money('book_value').notNull().default(0),
		currencyCode: varchar('currency_code', { length: 3 })
			.notNull()
			.default('IDR'),
		usefulLifeMonths: integer('useful_life_months'),
		depreciationMethod: text('depreciation_method')
			.notNull()
			.default('straight_line'),
		depreciationStartedOn: day('depreciation_started_on'),
		condition: text('condition').notNull().default('good'),
		status: text('status').notNull().default('ready'),
		/**
		 * D18: why the asset was parked in `'inactive'`. NULL for every other
		 * status — the CHECK enforces that.
		 */
		deactivationReason: text('deactivation_reason'),
		/** Off-site / non-warehouse detail (D19); may sit beside warehouse ids. */
		locationDescription: text('location_description'),
		/** Logical reference to inventory.warehouses.id — cross-module FK omitted (D2). */
		warehouseId: uuid('warehouse_id'),
		/** Logical reference to inventory.warehouse_storages.id — FK omitted (D2). */
		storageId: uuid('storage_id'),
		/** Logical reference to hr.employees.id — cross-module FK omitted. */
		custodianEmployeeId: uuid('custodian_employee_id'),
		/** D8: written only by `syncCustody`; renamed from `assigned_at`. */
		borrowedSince: unixTimestampNullable('borrowed_since'),
		/** Logical reference to procurement.suppliers.id — FK omitted (D13). */
		supplierId: uuid('supplier_id'),
		/** Logical reference to procurement.purchase_orders.id — FK omitted. */
		purchaseOrderId: uuid('purchase_order_id'),
		/** Logical reference to documents.documents.id — FK omitted (D19). */
		documentId: uuid('document_id'),
		/** Optional display image URL for the asset card. */
		imageUrl: text('image_url'),
		...softDeleteTimestamps,
	},
	(table) => [
		// D13: global across scopes so an org asset and a global asset can never
		// share a code. Alive rows only, so a soft-deleted code can be reused.
		uniqueIndex('assets_code_uq')
			.on(table.code)
			.where(sql`deleted_at IS NULL`),
		// Serials are unique per scope: `NULL` never conflicts in a unique index,
		// so a plain (organization_id, serial_number) index would let every
		// global asset repeat.
		uniqueIndex('assets_serial_uq')
			.on(sql`coalesce(${table.organizationId}, '')`, table.serialNumber)
			.where(sql`${table.serialNumber} IS NOT NULL AND ${table.deletedAt} IS NULL`),
		index('assets_asset_type_idx').on(table.assetType),
		index('assets_category_id_idx').on(table.categoryId),
		index('assets_custodian_employee_id_idx').on(table.custodianEmployeeId),
		index('assets_status_idx').on(table.status),
		index('assets_warehouse_id_idx').on(table.warehouseId),
		index('assets_storage_id_idx').on(table.storageId),
		index('assets_serial_number_idx').on(table.serialNumber),
		check(
			'assets_status_check',
			sql`${table.status} IN ('ready', 'borrowed', 'maintenance', 'inactive', 'disposed', 'lost')`,
		),
		check(
			'assets_condition_check',
			sql`${table.condition} IN ('new', 'good', 'fair', 'poor', 'damaged')`,
		),
		check(
			'assets_dep_method_check',
			sql`${table.depreciationMethod} IN ('straight_line', 'declining_balance', 'none')`,
		),
		check('assets_acquisition_cost_check', sql`${table.acquisitionCost} >= 0`),
		check('assets_salvage_value_check', sql`${table.salvageValue} >= 0`),
		check(
			'assets_accumulated_depreciation_check',
			sql`${table.accumulatedDepreciation} >= 0`,
		),
		check('assets_book_value_check', sql`${table.bookValue} >= 0`),
		check(
			'assets_useful_life_check',
			sql`${table.usefulLifeMonths} IS NULL OR ${table.usefulLifeMonths} > 0`,
		),
		// D18: an inactive asset must say why; no other status may.
		check(
			'assets_deactivation_reason_check',
			sql`(${table.status} = 'inactive' AND ${table.deactivationReason} IS NOT NULL) OR (${table.status} <> 'inactive' AND ${table.deactivationReason} IS NULL)`,
		),
		// A storage always belongs to a warehouse.
		check(
			'assets_storage_requires_warehouse_check',
			sql`${table.storageId} IS NULL OR ${table.warehouseId} IS NOT NULL`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * assets.asset_movements
 * ------------------------------------------------------------------------ */

/**
 * Movement of an asset between warehouses/storages or off-site — the
 * location/custody trail (D3). Asset borrowing does **not** write the stock
 * ledger (D4): issue/return write rows here instead. Append-only history; one
 * direction only — `borrowing_events` points at a movement, never the reverse.
 */
export const assetMovements = assetsSchema.table(
	'asset_movements',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		organizationId: organizationId(),
		assetId: uuid('asset_id')
			.notNull()
			.references(() => assets.id, { onDelete: 'cascade' }),
		movementType: text('movement_type').notNull().default('transfer'),
		/** Logical reference to inventory.warehouses.id — FK omitted (D2). */
		fromWarehouseId: uuid('from_warehouse_id'),
		/** Logical reference to inventory.warehouse_storages.id — FK omitted. */
		fromStorageId: uuid('from_storage_id'),
		/** Logical reference to inventory.warehouses.id — FK omitted. */
		toWarehouseId: uuid('to_warehouse_id'),
		/** Logical reference to inventory.warehouse_storages.id — FK omitted. */
		toStorageId: uuid('to_storage_id'),
		/** Free-text off-site detail, kept alongside the location ids (D3). */
		fromLocation: text('from_location'),
		toLocation: text('to_location'),
		movedAt: unixTimestamp('moved_at').notNull(),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		movedByUserId: text('moved_by_user_id'),
		condition: text('condition'),
		notes: text('notes'),
		createdAt: unixTimestamp('created_at').notNull(),
		updatedAt: unixTimestampNullable('updated_at').$onUpdate(() => new Date()),
		deletedAt: unixTimestampNullable('deleted_at'),
	},
	(table) => [
		index('asset_movements_asset_id_idx').on(table.assetId),
		index('asset_movements_moved_at_idx').on(table.movedAt),
		index('asset_movements_movement_type_idx').on(table.movementType),
		index('asset_movements_from_warehouse_id_idx').on(
			table.fromWarehouseId,
		),
		index('asset_movements_to_warehouse_id_idx').on(table.toWarehouseId),
		check(
			'asset_movements_type_check',
			sql`${table.movementType} IN ('receipt', 'transfer', 'borrow_out', 'borrow_return', 'project_site', 'disposal', 'lost')`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * assets.asset_condition_checks
 * ------------------------------------------------------------------------ */

/** Periodic condition check of an asset (append-style log). */
export const assetConditionChecks = assetsSchema.table(
	'asset_condition_checks',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		organizationId: organizationId(),
		assetId: uuid('asset_id')
			.notNull()
			.references(() => assets.id, { onDelete: 'cascade' }),
		checkDate: day('check_date').notNull(),
		condition: text('condition').notNull(),
		findings: text('findings'),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		checkedByUserId: text('checked_by_user_id'),
		nextCheckDate: day('next_check_date'),
		status: text('status').notNull().default('recorded'),
		createdAt: unixTimestamp('created_at').notNull(),
		updatedAt: unixTimestampNullable('updated_at').$onUpdate(() => new Date()),
		deletedAt: unixTimestampNullable('deleted_at'),
	},
	(table) => [
		index('asset_condition_checks_asset_id_idx').on(table.assetId),
		index('asset_condition_checks_check_date_idx').on(table.checkDate),
		check(
			'asset_condition_checks_condition_check',
			sql`${table.condition} IN ('new', 'good', 'fair', 'poor', 'damaged')`,
		),
		check(
			'asset_condition_checks_status_check',
			sql`${table.status} IN ('recorded', 'followed_up', 'closed')`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * assets.asset_maintenances
 * ------------------------------------------------------------------------ */

/**
 * Maintenance (service) record. `next_service_date` drives the maintenance
 * schedule; codes come from ERP-0009 (D15).
 */
export const assetMaintenances = assetsSchema.table(
	'asset_maintenances',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		organizationId: organizationId(),
		code: varchar('code', { length: 32 }).notNull(),
		assetId: uuid('asset_id')
			.notNull()
			.references(() => assets.id, { onDelete: 'cascade' }),
		maintenanceType: text('maintenance_type').notNull().default('preventive'),
		scheduledDate: day('scheduled_date'),
		performedDate: day('performed_date'),
		/** Logical reference to hr.employees.id — cross-module FK omitted. */
		performedByEmployeeId: uuid('performed_by_employee_id'),
		vendorName: text('vendor_name'),
		cost: money('cost').notNull().default(0),
		currencyCode: varchar('currency_code', { length: 3 })
			.notNull()
			.default('IDR'),
		description: text('description'),
		status: text('status').notNull().default('scheduled'),
		nextServiceDate: day('next_service_date'),
		/** Logical reference to documents.documents.id — FK omitted (D19). */
		documentId: uuid('document_id'),
		...softDeleteTimestamps,
	},
	(table) => [
		...scopedUnique(table.organizationId, table.code, {
			orgScoped: 'asset_maintenances_org_code_uq',
			global: 'asset_maintenances_global_code_uq',
		}),
		index('asset_maintenances_asset_id_idx').on(table.assetId),
		index('asset_maintenances_status_idx').on(table.status),
		index('asset_maintenances_next_service_date_idx').on(
			table.nextServiceDate,
		),
		check(
			'asset_maintenances_type_check',
			sql`${table.maintenanceType} IN ('preventive', 'corrective', 'calibration', 'inspection')`,
		),
		check(
			'asset_maintenances_status_check',
			sql`${table.status} IN ('scheduled', 'in_progress', 'completed', 'cancelled')`,
		),
		check('asset_maintenances_cost_check', sql`${table.cost} >= 0`),
	],
);

/* ------------------------------------------------------------------------ *
 * assets.asset_depreciations
 * ------------------------------------------------------------------------ */

/**
 * Monthly depreciation run — the audit trail of the book value. Manual
 * entry only for now (D14: no automatic scheduler); the service derives
 * opening/closing book value and updates the asset row in the same
 * transaction. One entry per asset per period, enforced by the unique
 * index.
 */
export const assetDepreciations = assetsSchema.table(
	'asset_depreciations',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		organizationId: organizationId(),
		assetId: uuid('asset_id')
			.notNull()
			.references(() => assets.id, { onDelete: 'cascade' }),
		periodYear: integer('period_year').notNull(),
		periodMonth: integer('period_month').notNull(),
		depreciationMethod: text('depreciation_method')
			.notNull()
			.default('straight_line'),
		depreciationAmount: money('depreciation_amount').notNull().default(0),
		openingBookValue: money('opening_book_value').notNull().default(0),
		closingBookValue: money('closing_book_value').notNull().default(0),
		currencyCode: varchar('currency_code', { length: 3 })
			.notNull()
			.default('IDR'),
		calculatedAt: unixTimestampNullable('calculated_at'),
		/** Logical reference to accounting.journal_entries.id — FK omitted. */
		journalEntryId: uuid('journal_entry_id'),
		createdAt: unixTimestamp('created_at').notNull(),
		updatedAt: unixTimestampNullable('updated_at').$onUpdate(() => new Date()),
		deletedAt: unixTimestampNullable('deleted_at'),
	},
	(table) => [
		index('asset_depreciations_period_uq').on(
			table.assetId,
			table.periodYear,
			table.periodMonth,
		),
		index('asset_depreciations_period_year_idx').on(table.periodYear),
		check(
			'asset_depreciations_period_month_check',
			sql`${table.periodMonth} BETWEEN 1 AND 12`,
		),
		check(
			'asset_depreciations_method_check',
			sql`${table.depreciationMethod} IN ('straight_line', 'declining_balance', 'none')`,
		),
		check(
			'asset_depreciations_amount_check',
			sql`${table.depreciationAmount} >= 0`,
		),
		check(
			'asset_depreciations_closing_check',
			sql`${table.closingBookValue} >= 0`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * assets.asset_disposals
 * ------------------------------------------------------------------------ */

/**
 * Disposal of an asset (D21 workflow): draft → submitted → approved →
 * executed; the executing step flips the asset to `disposed` in the same
 * transaction. The disposal record stays as the financial proof even
 * though the asset row is soft-deleted on execution.
 */
export const assetDisposals = assetsSchema.table(
	'asset_disposals',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		organizationId: organizationId(),
		code: varchar('code', { length: 32 }).notNull(),
		assetId: uuid('asset_id')
			.notNull()
			.references(() => assets.id, { onDelete: 'restrict' }),
		disposalDate: day('disposal_date'),
		disposalMethod: text('disposal_method').notNull().default('scrap'),
		proceedsAmount: money('proceeds_amount').notNull().default(0),
		bookValueAtDisposal: money('book_value_at_disposal').notNull().default(0),
		gainLoss: money('gain_loss').notNull().default(0),
		currencyCode: varchar('currency_code', { length: 3 })
			.notNull()
			.default('IDR'),
		buyerName: text('buyer_name'),
		status: text('status').notNull().default('draft'),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		requestedBy: text('requested_by'),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		approvedBy: text('approved_by'),
		approvedAt: unixTimestampNullable('approved_at'),
		executedAt: unixTimestampNullable('executed_at'),
		...softDeleteTimestamps,
	},
	(table) => [
		...scopedUnique(table.organizationId, table.code, {
			orgScoped: 'asset_disposals_org_code_uq',
			global: 'asset_disposals_global_code_uq',
		}),
		index('asset_disposals_asset_id_idx').on(table.assetId),
		index('asset_disposals_status_idx').on(table.status),
		check(
			'asset_disposals_method_check',
			sql`${table.disposalMethod} IN ('sale', 'scrap', 'donation', 'transfer', 'trade_in')`,
		),
		check(
			'asset_disposals_status_check',
			sql`${table.status} IN ('draft', 'submitted', 'approved', 'executed', 'cancelled')`,
		),
		check(
			'asset_disposals_proceeds_check',
			sql`${table.proceedsAmount} >= 0`,
		),
		check(
			'asset_disposals_book_value_check',
			sql`${table.bookValueAtDisposal} >= 0`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * assets.asset_documents
 * ------------------------------------------------------------------------ */

/**
 * Attachment of an invoice, manual, certificate, photo or contract to an
 * asset — logical document references only until the Documents module
 * exists (D19).
 */
export const assetDocuments = assetsSchema.table(
	'asset_documents',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		organizationId: organizationId(),
		assetId: uuid('asset_id')
			.notNull()
			.references(() => assets.id, { onDelete: 'cascade' }),
		/** Logical reference to documents.documents.id — FK omitted (D19). */
		documentId: uuid('document_id').notNull(),
		documentType: text('document_type').notNull(),
		createdAt: unixTimestamp('created_at').notNull(),
		updatedAt: unixTimestampNullable('updated_at').$onUpdate(() => new Date()),
		deletedAt: unixTimestampNullable('deleted_at'),
	},
	(table) => [
		index('asset_documents_asset_id_idx').on(table.assetId),
		index('asset_documents_document_id_uq')
			.on(table.documentId)
			.where(sql`deleted_at IS NULL`),
		check(
			'asset_documents_type_check',
			sql`${table.documentType} IN ('invoice', 'manual', 'certificate', 'photo', 'contract')`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * assets.tool_sets
 * ------------------------------------------------------------------------ */

/** Tool kit lent to a technician as one unit. */
export const toolSets = assetsSchema.table(
	'tool_sets',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		organizationId: organizationId(),
		code: varchar('code', { length: 32 }).notNull(),
		name: text('name').notNull(),
		description: text('description'),
		/** Logical reference to hr.employees.id — cross-module FK omitted. */
		custodianEmployeeId: uuid('custodian_employee_id'),
		status: text('status').notNull().default('available'),
		...softDeleteTimestamps,
	},
	(table) => [
		...scopedUnique(table.organizationId, table.code, {
			orgScoped: 'tool_sets_org_code_uq',
			global: 'tool_sets_global_code_uq',
		}),
		index('tool_sets_custodian_employee_id_idx').on(
			table.custodianEmployeeId,
		),
		check(
			'tool_sets_status_check',
			sql`${table.status} IN ('available', 'lent', 'maintenance', 'retired')`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * assets.tool_set_items
 * ------------------------------------------------------------------------ */

/** Line of a tool set: which asset (serialized tool) composes the kit. */
export const toolSetItems = assetsSchema.table(
	'tool_set_items',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		organizationId: organizationId(),
		toolSetId: uuid('tool_set_id')
			.notNull()
			.references(() => toolSets.id, { onDelete: 'cascade' }),
		assetId: uuid('asset_id')
			.notNull()
			.references(() => assets.id, { onDelete: 'restrict' }),
		quantity: numeric('quantity', { precision: 18, scale: 3 })
			.notNull()
			.default('1'),
		createdAt: unixTimestamp('created_at').notNull(),
		updatedAt: unixTimestampNullable('updated_at').$onUpdate(() => new Date()),
		deletedAt: unixTimestampNullable('deleted_at'),
	},
	(table) => [
		index('tool_set_items_tool_set_id_idx').on(table.toolSetId),
		index('tool_set_items_asset_id_idx').on(table.assetId),
		// One alive line per (set, asset); deleted_at excluded so a removed
		// line can be re-added.
		index('tool_set_items_uq')
			.on(table.toolSetId, table.assetId)
			.where(sql`deleted_at IS NULL`),
		check('tool_set_items_quantity_check', sql`${table.quantity} > 0`),
	],
);

/* ------------------------------------------------------------------------ *
 * assets.borrowings
 * ------------------------------------------------------------------------ */

/**
 * Borrowing header (ported from inventory, D5).
 *
 * A borrower is one of three things and the identity path is fixed by
 * `borrower_type`: a registered user, a registered customer, or a guest
 * whose identity is **snapshotted here** because there is no row to point
 * at. Guest PII (`guest_id_number`, `guest_id_document_ref`,
 * `guest_address_text`) is access-restricted and expired by the retention
 * sweep.
 */
export const borrowings = assetsSchema.table(
	'borrowings',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		organizationId: organizationId(),
		code: varchar('code', { length: 32 }).notNull(),
		status: text('status').notNull().default('requested'),
		purpose: text('purpose').notNull().default('internal_use'),
		borrowerType: text('borrower_type').notNull(),
		/**
		 * Logical reference to `assets.tool_sets.id` (same module). Set when
		 * the borrowing lends a whole kit (D6), so return can restore the set
		 * to `available`.
		 */
		toolSetId: uuid('tool_set_id'),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		borrowerUserId: text('borrower_user_id'),
		/** Logical reference to crm.customers.id — cross-module FK omitted. */
		borrowerCustomerId: uuid('borrower_customer_id'),
		guestName: text('guest_name'),
		guestPhone: text('guest_phone'),
		guestIdType: text('guest_id_type'),
		guestIdNumber: text('guest_id_number'),
		guestAddressText: text('guest_address_text'),
		/** Plain text until a Documents module exists. */
		guestIdDocumentRef: text('guest_id_document_ref'),
		/** Logical reference to auth.users.id. */
		requestedBy: text('requested_by'),
		requestedAt: unixTimestampNullable('requested_at'),
		/** Logical reference to auth.users.id. */
		approvedBy: text('approved_by'),
		approvedAt: unixTimestampNullable('approved_at'),
		/** Logical reference to auth.users.id. */
		issuedBy: text('issued_by'),
		issuedAt: unixTimestampNullable('issued_at'),
		dueAt: unixTimestamp('due_at').notNull(),
		/** Logical reference to auth.users.id. */
		closedBy: text('closed_by'),
		closedAt: unixTimestampNullable('closed_at'),
		notes: text('notes'),
		...softDeleteTimestamps,
	},
	(table) => [
		...scopedUnique(table.organizationId, table.code, {
			orgScoped: 'borrowings_org_code_uq',
			global: 'borrowings_global_code_uq',
		}),
		index('borrowings_status_idx').on(table.status),
		index('borrowings_borrower_user_id_idx').on(table.borrowerUserId),
		index('borrowings_borrower_customer_id_idx').on(
			table.borrowerCustomerId,
		),
		index('borrowings_due_at_idx').on(table.dueAt),
		check(
			'borrowings_status_check',
			sql`status IN ('draft', 'requested', 'approved', 'rejected', 'issued', 'partially_returned', 'returned', 'closed', 'cancelled')`,
		),
		check(
			'borrowings_purpose_check',
			sql`purpose IN ('rental', 'internal_use', 'testing', 'warranty_service')`,
		),
		check(
			'borrowings_borrower_type_check',
			sql`borrower_type IN ('user', 'customer', 'guest')`,
		),
		check(
			'borrowings_guest_id_type_check',
			sql`guest_id_type IS NULL OR guest_id_type IN ('ktp', 'sim', 'passport', 'other')`,
		),
		// Exactly one identity path is populated, and it matches the type.
		check(
			'borrowings_borrower_identity_check',
			sql`(borrower_type = 'user' AND borrower_user_id IS NOT NULL AND borrower_customer_id IS NULL AND guest_name IS NULL AND guest_phone IS NULL AND guest_id_number IS NULL)
				OR (borrower_type = 'customer' AND borrower_customer_id IS NOT NULL AND borrower_user_id IS NULL AND guest_name IS NULL AND guest_phone IS NULL AND guest_id_number IS NULL)
				OR (borrower_type = 'guest' AND guest_name IS NOT NULL AND guest_phone IS NOT NULL AND guest_id_number IS NOT NULL AND borrower_user_id IS NULL AND borrower_customer_id IS NULL)`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * assets.borrowing_lines
 * ------------------------------------------------------------------------ */

/**
 * One borrowed asset (D1). Borrowing is serialized-only: a line always names
 * a specific asset, never a quantity.
 *
 * `origin_warehouse_id` / `origin_storage_id` snapshot where the unit left
 * from, because the asset loses its location while it is out — the return and
 * loss flows need the exact bin to restore or reduce.
 */
export const borrowingLines = assetsSchema.table(
	'borrowing_lines',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		borrowingId: uuid('borrowing_id')
			.notNull()
			.references(() => borrowings.id, { onDelete: 'cascade' }),
		assetId: uuid('asset_id')
			.notNull()
			.references(() => assets.id, { onDelete: 'restrict' }),
		/** Logical reference to inventory.warehouses.id — FK omitted. */
		originWarehouseId: uuid('origin_warehouse_id'),
		/** Logical reference to inventory.warehouse_storages.id — FK omitted. */
		originStorageId: uuid('origin_storage_id'),
		issuedAt: unixTimestampNullable('issued_at'),
		dueAt: unixTimestampNullable('due_at'),
		returnedAt: unixTimestampNullable('returned_at'),
		returnedCondition: text('returned_condition'),
		markedLateAt: unixTimestampNullable('marked_late_at'),
		markedLostAt: unixTimestampNullable('marked_lost_at'),
		/** Logical reference to auth.users.id. */
		lostReportedBy: text('lost_reported_by'),
		siteAddressText: text('site_address_text'),
		/** Logical reference to projects.projects.id — cross-module FK omitted. */
		projectId: uuid('project_id'),
		notes: text('notes'),
		...softDeleteTimestamps,
	},
	(table) => [
		uniqueIndex('borrowing_lines_borrowing_asset_uq').on(
			table.borrowingId,
			table.assetId,
		),
		index('borrowing_lines_asset_id_idx').on(table.assetId),
		index('borrowing_lines_open_idx')
			.on(table.dueAt)
			.where(sql`returned_at IS NULL AND marked_lost_at IS NULL`),
		check(
			'borrowing_lines_condition_check',
			sql`returned_condition IS NULL OR returned_condition IN ('good', 'damaged', 'incomplete')`,
		),
		check(
			'borrowing_lines_due_after_issue_check',
			sql`due_at IS NULL OR issued_at IS NULL OR due_at > issued_at`,
		),
		check(
			'borrowing_lines_origin_storage_check',
			sql`origin_storage_id IS NULL OR origin_warehouse_id IS NOT NULL`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * assets.borrowing_events
 * ------------------------------------------------------------------------ */

/**
 * Business timeline of a borrowing. Append-only: no `updated_at`, no
 * `deleted_at`.
 *
 * The three physical event types must carry the `asset_movement_id` that
 * recorded the movement; every other type must not. Movements never point back
 * here — one direction only.
 */
export const borrowingEvents = assetsSchema.table(
	'borrowing_events',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		borrowingId: uuid('borrowing_id')
			.notNull()
			.references(() => borrowings.id, { onDelete: 'cascade' }),
		borrowingLineId: uuid('borrowing_line_id').references(
			() => borrowingLines.id,
			{ onDelete: 'cascade' },
		),
		eventType: text('event_type').notNull(),
		/** Logical reference to assets.asset_movements.id (journal, FK-free). */
		assetMovementId: uuid('asset_movement_id'),
		/** Logical reference to auth.users.id — NULL for automated sweeps. */
		actorUserId: text('actor_user_id'),
		occurredAt: unixTimestamp('occurred_at').notNull(),
		note: text('note'),
	},
	(table) => [
		index('borrowing_events_borrowing_occurred_idx').on(
			table.borrowingId,
			table.occurredAt,
		),
		index('borrowing_events_line_id_idx').on(table.borrowingLineId),
		check(
			'borrowing_events_type_check',
			sql`event_type IN ('requested', 'approved', 'rejected', 'issued', 'returned', 'marked_late', 'marked_lost', 'due_date_extended', 'cancelled', 'closed')`,
		),
		check(
			'borrowing_events_movement_check',
			sql`(event_type IN ('issued', 'returned', 'marked_lost') AND asset_movement_id IS NOT NULL)
				OR (event_type NOT IN ('issued', 'returned', 'marked_lost') AND asset_movement_id IS NULL)`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * Select types
 * ------------------------------------------------------------------------ */

export type TAssetTypeSelect = typeof assetTypes.$inferSelect;
export type TAssetTypeInsert = typeof assetTypes.$inferInsert;
export type TAssetCategorySelect = typeof assetCategories.$inferSelect;
export type TAssetCategoryInsert = typeof assetCategories.$inferInsert;
export type TAssetSelect = typeof assets.$inferSelect;
export type TAssetInsert = typeof assets.$inferInsert;
export type TAssetMovementSelect = typeof assetMovements.$inferSelect;
export type TAssetMovementInsert = typeof assetMovements.$inferInsert;
export type TAssetMaintenanceSelect = typeof assetMaintenances.$inferSelect;
export type TAssetMaintenanceInsert = typeof assetMaintenances.$inferInsert;
export type TAssetDepreciationSelect = typeof assetDepreciations.$inferSelect;
export type TAssetDisposalSelect = typeof assetDisposals.$inferSelect;
export type TAssetDisposalInsert = typeof assetDisposals.$inferInsert;
export type TAssetDocumentSelect = typeof assetDocuments.$inferSelect;
export type TAssetConditionCheckSelect = typeof assetConditionChecks.$inferSelect;
export type TToolSetSelect = typeof toolSets.$inferSelect;
export type TToolSetItemSelect = typeof toolSetItems.$inferSelect;
export type TBorrowingSelect = typeof borrowings.$inferSelect;
export type TBorrowingInsert = typeof borrowings.$inferInsert;
export type TBorrowingLineSelect = typeof borrowingLines.$inferSelect;
export type TBorrowingLineInsert = typeof borrowingLines.$inferInsert;
export type TBorrowingEventSelect = typeof borrowingEvents.$inferSelect;
export type TBorrowingEventInsert = typeof borrowingEvents.$inferInsert;
