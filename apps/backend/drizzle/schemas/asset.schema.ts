/**
 * Asset module schema (assets schema, ERP-owned) — M06 full build,
 * hardening plan Phase A-1 / D11.
 *
 * Mirrors `docs/database/docs.dbml` (`assets.*`, 11 tables) with these
 * documented deviations:
 * - `assets.status` gains `'inactive'` (D18): an asset temporarily out of
 *   circulation that is neither disposed nor in service; the deactivation
 *   reason is recorded on the row.
 * - All references to not-yet-existing modules (hr, procurement, documents,
 *   accounting) are nullable logical columns — cross-module FKs are
 *   intentionally omitted and validated at the module contract level (D13).
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
	uuid,
	varchar,
} from 'drizzle-orm/pg-core';
import { bigint } from 'drizzle-orm/pg-core';
import {
	unixTimestamp,
	unixTimestampNullable,
} from '@drizzle/datatypes/unix-timestamp';

export const assetsSchema = pgSchema('assets');

/** Shared logical tenant column (never NULL in this module). */
const organizationId = () => text('organization_id').notNull();

/** Shared soft-delete + audit columns. */
const softDeleteTimestamps = {
	createdAt: unixTimestamp('created_at').notNull(),
	updatedAt: unixTimestampNullable('updated_at').$onUpdate(() => new Date()),
	deletedAt: unixTimestampNullable('deleted_at'),
};

/* ------------------------------------------------------------------------ *
 * Vocabularies (application-guarded text; CHECKs are the DB backstop)
 * ------------------------------------------------------------------------ */

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
 * Lifecycle statuses. `'inactive'` is the D18 deviation: parked, not
 * disposed, with a recorded reason. `'lost'` keeps the DBML vocabulary.
 */
export const ASSET_STATUSES = [
	'in_stock',
	'in_use',
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

export const MOVEMENT_TYPES_ASSET = [
	'transfer',
	'loan',
	'return',
	'project_site',
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

/** `date` columns arrive as `YYYY-MM-DD` strings. */
const day = (name: string) => date(name, { mode: 'string' });

/** Exact integer IDR minor units (ADR-0002). Never a float. */
const money = (name: string) => bigint(name, { mode: 'number' });

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
		assetType: text('asset_type').notNull().default('equipment'),
		defaultUsefulLifeMonths: integer('default_useful_life_months'),
		defaultDepreciationMethod: text('default_depreciation_method')
			.notNull()
			.default('straight_line'),
		isActive: boolean('is_active').notNull().default(true),
		...softDeleteTimestamps,
	},
	(table) => [
		index('asset_categories_org_code_uq')
			.on(table.organizationId, table.code),
		index('asset_categories_parent_category_id_idx').on(
			table.parentCategoryId,
		),
		check(
			'asset_categories_asset_type_check',
			sql`${table.assetType} IN ('equipment', 'vehicle', 'tool', 'furniture', 'it', 'intangible')`,
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
 * Asset master. Costs are exact integer minor units; `book_value` is
 * derived (cost − accumulated depreciation) and maintained by the service
 * on every depreciation entry. Master data referenced by financial records
 * is never hard deleted — soft delete only (Phase A-3).
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
		assetType: text('asset_type').notNull().default('equipment'),
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
		status: text('status').notNull().default('in_stock'),
		/**
		 * D18: why the asset was parked in `'inactive'`. NULL for every other
		 * status — the CHECK enforces that.
		 */
		deactivationReason: text('deactivation_reason'),
		locationDescription: text('location_description'),
		/** Logical reference to hr.employees.id — cross-module FK omitted. */
		custodianEmployeeId: uuid('custodian_employee_id'),
		assignedAt: unixTimestampNullable('assigned_at'),
		/** Logical reference to procurement.suppliers.id — FK omitted (D13). */
		supplierId: uuid('supplier_id'),
		/** Logical reference to procurement.purchase_orders.id — FK omitted. */
		purchaseOrderId: uuid('purchase_order_id'),
		/** Logical reference to documents.documents.id — FK omitted (D19). */
		documentId: uuid('document_id'),
		...softDeleteTimestamps,
	},
	(table) => [
		// DBML declares (organization_id, code) unique; alive rows only, so a
		// soft-deleted code can be reused.
		index('assets_org_code_uq')
			.on(table.organizationId, table.code)
			.where(sql`deleted_at IS NULL`),
		index('assets_category_id_idx').on(table.categoryId),
		index('assets_custodian_employee_id_idx').on(table.custodianEmployeeId),
		index('assets_status_idx').on(table.status),
		index('assets_serial_number_idx').on(table.serialNumber),
		check(
			'assets_asset_type_check',
			sql`${table.assetType} IN ('equipment', 'vehicle', 'tool', 'furniture', 'it', 'intangible')`,
		),
		check(
			'assets_status_check',
			sql`${table.status} IN ('in_stock', 'in_use', 'maintenance', 'inactive', 'disposed', 'lost')`,
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
	],
);

/* ------------------------------------------------------------------------ *
 * assets.asset_assignments
 * ------------------------------------------------------------------------ */

/**
 * Custody of an asset. An open assignment (`returned_at IS NULL`) keeps the
 * asset `in_use`; the return writes condition in/out on the same row
 * (D12 full loan flow). Employees are logical HR refs; `assigned_to_user_id`
 * covers holders picked from existing users (no HR module yet).
 */
export const assetAssignments = assetsSchema.table(
	'asset_assignments',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		organizationId: organizationId(),
		assetId: uuid('asset_id')
			.notNull()
			.references(() => assets.id, { onDelete: 'cascade' }),
		/** Logical reference to hr.employees.id — cross-module FK omitted. */
		assignedToEmployeeId: uuid('assigned_to_employee_id'),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		assignedToUserId: text('assigned_to_user_id'),
		assignedAt: unixTimestamp('assigned_at').notNull(),
		returnedAt: unixTimestampNullable('returned_at'),
		conditionOnAssign: text('condition_on_assign'),
		conditionOnReturn: text('condition_on_return'),
		notes: text('notes'),
		createdAt: unixTimestamp('created_at').notNull(),
		updatedAt: unixTimestampNullable('updated_at').$onUpdate(() => new Date()),
		deletedAt: unixTimestampNullable('deleted_at'),
	},
	(table) => [
		index('asset_assignments_asset_id_idx').on(table.assetId),
		index('asset_assignments_employee_id_idx').on(table.assignedToEmployeeId),
		index('asset_assignments_open_idx')
			.on(table.assetId)
			.where(sql`returned_at IS NULL AND deleted_at IS NULL`),
		check(
			'asset_assignments_returned_check',
			sql`${table.returnedAt} IS NULL OR ${table.returnedAt} >= ${table.assignedAt}`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * assets.asset_movements
 * ------------------------------------------------------------------------ */

/**
 * Movement of an asset between locations or projects — the custody/
 * location trail written by assign/return/transfer.
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
		check(
			'asset_movements_type_check',
			sql`${table.movementType} IN ('transfer', 'loan', 'return', 'project_site')`,
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
		index('asset_maintenances_org_code_uq')
			.on(table.organizationId, table.code)
			.where(sql`deleted_at IS NULL`),
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
		index('asset_disposals_org_code_uq')
			.on(table.organizationId, table.code)
			.where(sql`deleted_at IS NULL`),
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
		index('tool_sets_org_code_uq')
			.on(table.organizationId, table.code)
			.where(sql`deleted_at IS NULL`),
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
 * Select types
 * ------------------------------------------------------------------------ */

export type TAssetCategorySelect = typeof assetCategories.$inferSelect;
export type TAssetCategoryInsert = typeof assetCategories.$inferInsert;
export type TAssetSelect = typeof assets.$inferSelect;
export type TAssetInsert = typeof assets.$inferInsert;
export type TAssetAssignmentSelect = typeof assetAssignments.$inferSelect;
export type TAssetAssignmentInsert = typeof assetAssignments.$inferInsert;
export type TAssetMovementSelect = typeof assetMovements.$inferSelect;
export type TAssetMaintenanceSelect = typeof assetMaintenances.$inferSelect;
export type TAssetMaintenanceInsert = typeof assetMaintenances.$inferInsert;
export type TAssetDepreciationSelect = typeof assetDepreciations.$inferSelect;
export type TAssetDisposalSelect = typeof assetDisposals.$inferSelect;
export type TAssetDisposalInsert = typeof assetDisposals.$inferInsert;
export type TAssetDocumentSelect = typeof assetDocuments.$inferSelect;
export type TAssetConditionCheckSelect = typeof assetConditionChecks.$inferSelect;
export type TToolSetSelect = typeof toolSets.$inferSelect;
export type TToolSetItemSelect = typeof toolSetItems.$inferSelect;
