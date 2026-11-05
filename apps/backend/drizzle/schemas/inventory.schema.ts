/**
 * Inventory domain schema — owns the `inventory` Postgres schema.
 *
 * Items, serialized units, warehouses, warehouse addresses, warehouse
 * storages, the stock ledger and its balance projection, and borrowing with
 * its custody event trail.
 *
 * House rules honoured here:
 * - `organization_id` is **nullable** on every table (ADR-0008): global
 *   inventory is a first-class concept, not an accident.
 * - Coded tables get a **partial-unique pair** instead of one composite
 *   index, because PostgreSQL treats every NULL as distinct and a plain
 *   `(organization_id, code)` index would silently stop constraining global
 *   rows.
 * - Status vocabularies are `text` guarded by CHECK constraints, never
 *   native enums (DBML project rule).
 * - `stock_movements` is append-only: no `updated_at`, no `deleted_at`.
 * - References to other modules (`auth`, `location`, `crm`, `projects`,
 *   `hr`) are plain id columns with no FK — cross-module FKs are forbidden.
 * - Index names are prefixed where the bare name would collide with a
 *   same-named table in another schema (`catalog.items` already owns
 *   `items_org_sku_uq`, `items_org_name_idx`, `items_barcode_idx`).
 */
import { defineRelationsPart, sql } from 'drizzle-orm';
import {
	bigint,
	boolean,
	check,
	date,
	index,
	numeric,
	pgSchema,
	text,
	uniqueIndex,
	uuid,
	varchar,
} from 'drizzle-orm/pg-core';
import type { PgColumn } from 'drizzle-orm/pg-core';
import {
	unixTimestamp,
	unixTimestampNullable,
} from '@drizzle/datatypes/unix-timestamp';

export const inventorySchema = pgSchema('inventory');

/* ------------------------------------------------------------------------ *
 * Vocabularies
 * ------------------------------------------------------------------------ */

/**
 * Item kinds (ERP-0036 D9). Inventory is the **consumable** module:
 * `product`, `component` and `material` may be sold, applied to warranty,
 * borrowed as a quantity, or tested.
 *
 * Physical tools are assets (`assets.assets`), never items, and services are
 * neither stocked nor serialized, so neither kind exists here any more.
 */
export const ITEM_KINDS = ['product', 'component', 'material'] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

/**
 * Unit statuses.
 *
 * `sold` and `applied_warranty` are **product-only**; that restriction is a
 * service rule (`assertTransitionAllowed`), not a DB check, because the unit
 * row does not know its item kind without a join.
 *
 * ERP-0036 D9: `borrowed` is gone — borrowing is an asset concern now, and
 * `serial_tracked_items` serves serialized products only.
 *
 * The UI label for `in_stock` is "Siap" — `ready` is never a stored value here
 * (that is the **asset** vocabulary).
 */
export const UNIT_STATUSES = [
	'pre_order',
	'in_stock',
	'lost',
	'sold',
	'applied_warranty',
] as const;
export type UnitStatus = (typeof UNIT_STATUSES)[number];

/** Universal transitions allowed for every kind. */
export const UNIT_STATUS_TRANSITIONS: Record<UnitStatus, UnitStatus[]> = {
	pre_order: ['in_stock', 'lost'],
	in_stock: ['sold', 'applied_warranty', 'lost'],
	lost: [],
	sold: [],
	applied_warranty: ['in_stock', 'lost'],
};

/**
 * Stock movement types.
 *
 * @remarks
 * ERP-0036 D17: `borrowing_out` / `borrowing_in` are **superseded** — asset
 * borrowing writes `assets.asset_movements` instead (an asset has no item, and
 * the ledger requires one). The values stay in the vocabulary and CHECK until
 * the later cleanup migration so this slice stays reversible.
 */
export const MOVEMENT_TYPES = [
	'receipt',
	'issue',
	'transfer_in',
	'transfer_out',
	'adjustment_in',
	'adjustment_out',
	'return_in',
	'return_out',
	'consumption',
	'borrowing_out',
	'borrowing_in',
] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

/** Movement posting states. Only `posted` and `reversed` are produced today. */
export const MOVEMENT_STATUSES = ['draft', 'posted', 'reversed'] as const;
export type MovementStatus = (typeof MOVEMENT_STATUSES)[number];

/**
 * Stock adjustment document states.
 *
 * @remarks
 * The approval chain is real: `draft → submitted → approved → posted`. `draft`
 * and `submitted` are cancellable, `approved` posts; `rejected` is terminal.
 * Only `posted` writes movements.
 */
export const ADJUSTMENT_STATUSES = [
	'draft',
	'submitted',
	'approved',
	'rejected',
	'posted',
	'cancelled',
] as const;
export type AdjustmentStatus = (typeof ADJUSTMENT_STATUSES)[number];

/**
 * Why a document adjusts stock.
 *
 * @remarks
 * This is a **document** type, not a movement type. The direction of each line
 * is derived from `quantity_after - quantity_before`, so a `recount` may go
 * either way and a `recount` with no delta posts nothing at all.
 */
export const ADJUSTMENT_TYPES = ['increase', 'decrease', 'recount'] as const;
export type AdjustmentType = (typeof ADJUSTMENT_TYPES)[number];

/* ------------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------------ */

/**
 * Builds the partial-unique pair for a tenant-scoped coded value.
 *
 * Emits `UNIQUE(organization_id, column) WHERE organization_id IS NOT NULL`
 * and `UNIQUE(column) WHERE organization_id IS NULL`. Without the second
 * index, PostgreSQL's NULL-is-distinct rule lets every global row reuse the
 * same code.
 *
 * @param orgColumn - The `organization_id` column of the table
 * @param scopedColumn - The column carrying the per-tenant unique value
 * @param names - Index names for the tenant-scoped and global variants
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

/** Shared nullable-organization column. */
const organizationId = () => text('organization_id');

/** Shared soft-delete + audit columns. */
const softDeleteTimestamps = {
	createdAt: unixTimestamp('created_at').notNull(),
	updatedAt: unixTimestampNullable('updated_at').$onUpdate(() => new Date()),
	deletedAt: unixTimestampNullable('deleted_at'),
};

/* ------------------------------------------------------------------------ *
 * inventory.warehouses
 * ------------------------------------------------------------------------ */

/**
 * Warehouse master.
 *
 * Address fields are **not** here: they live in `warehouse_addresses` as a
 * strict 1:1 (ADR-0008). Writes are application-admin-only.
 */
export const warehouses = inventorySchema.table(
	'warehouses',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		organizationId: organizationId(),
		code: varchar('code', { length: 32 }).notNull(),
		name: text('name').notNull(),
		/** Logical reference to hr.employees.id — cross-module FK omitted. */
		responsibleEmployeeId: uuid('responsible_employee_id'),
		isDefault: boolean('is_default').notNull().default(false),
		isActive: boolean('is_active').notNull().default(true),
		...softDeleteTimestamps,
	},
	(table) => [
		...scopedUnique(table.organizationId, table.code, {
			orgScoped: 'warehouses_org_code_uq',
			global: 'warehouses_global_code_uq',
		}),
		index('warehouses_is_default_idx').on(table.isDefault),
		index('warehouses_is_active_idx').on(table.isActive),
		/**
		 * Exactly one **alive** default warehouse per scope, expressed as two
		 * partial unique indexes (the house pattern — same as the
		 * `stock_balances` scope indexes, because a plain unique index treats
		 * two NULL `organization_id`s as distinct and would allow a global
		 * default to collide with itself).
		 *
		 * `clearDefaultExcept` enforces this in the service; the indexes are
		 * the backstop. Soft-deleted warehouses are excluded — they no longer
		 * hold the flag.
		 */
		uniqueIndex('warehouses_org_default_uq')
			.on(table.organizationId)
			.where(sql`organization_id IS NOT NULL AND is_default AND deleted_at IS NULL`),
		/**
		 * Global scope: `organization_id` is NULL, and Postgres unique indexes
		 * treat NULLs as distinct — so the org index above cannot cover it.
		 * `coalesce` maps NULL to a sentinel, making the NULL-scope default
		 * collide with itself.
		 */
		uniqueIndex('warehouses_global_default_uq')
			.on(sql`coalesce(${table.organizationId}, '00000000-0000-0000-0000-000000000000')`)
			.where(sql`organization_id IS NULL AND is_default AND deleted_at IS NULL`),
	],
);

/* ------------------------------------------------------------------------ *
 * inventory.warehouse_addresses
 * ------------------------------------------------------------------------ */

/**
 * Warehouse address, strictly 1:1 with `warehouses`.
 *
 * Structured per ADR-0003: free-text street detail plus a village-level
 * logical reference into `location.villages`, cascaded in the UI.
 */
export const warehouseAddresses = inventorySchema.table(
	'warehouse_addresses',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		warehouseId: uuid('warehouse_id')
			.notNull()
			.references(() => warehouses.id, { onDelete: 'cascade' }),
		label: text('label'),
		street: text('street').notNull(),
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

/* ------------------------------------------------------------------------ *
 * inventory.warehouse_storages
 * ------------------------------------------------------------------------ */

/** Storage location (bin) inside a warehouse. No zone level (ADR-0008). */
export const warehouseStorages = inventorySchema.table(
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

/* ------------------------------------------------------------------------ *
 * inventory.items
 * ------------------------------------------------------------------------ */

/**
 * Item master — SKU level.
 *
 * One item master for the whole ERP. `catalog.items` is superseded by this
 * table (ADR-0008).
 */
export const items = inventorySchema.table(
	'items',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		organizationId: organizationId(),
		sku: varchar('sku', { length: 64 }).notNull(),
		name: text('name').notNull(),
		description: text('description'),
		itemKind: text('item_kind').notNull(),
		/** Free text until `catalog.item_categories` is adopted (OPEN-1). */
		category: text('category'),
		/** Free text until `catalog.units` is adopted (OPEN-1). */
		unitLabel: varchar('unit_label', { length: 32 }),
		isSerialized: boolean('is_serialized').notNull().default(false),
		isStockTracked: boolean('is_stock_tracked').notNull().default(true),
		minStockQty: numeric('min_stock_qty', { precision: 18, scale: 3 })
			.notNull()
			.default('0'),
		barcode: text('barcode'),
		/** Exact integer IDR minor units (ADR-0002). Never a float. */
		sellingPrice: bigint('selling_price', { mode: 'number' })
			.notNull()
			.default(0),
		purchasePrice: bigint('purchase_price', { mode: 'number' })
			.notNull()
			.default(0),
		currencyCode: varchar('currency_code', { length: 3 })
			.notNull()
			.default('IDR'),
		...softDeleteTimestamps,
	},
	(table) => [
		...scopedUnique(table.organizationId, table.sku, {
			orgScoped: 'inventory_items_org_sku_uq',
			global: 'inventory_items_global_sku_uq',
		}),
		index('inventory_items_kind_idx').on(table.itemKind),
		index('inventory_items_org_name_idx').on(table.organizationId, table.name),
		index('inventory_items_barcode_idx').on(table.barcode),
		check(
			'inventory_items_kind_check',
			sql`item_kind IN ('product', 'component', 'material')`,
		),
		check(
			'inventory_items_prices_check',
			sql`selling_price >= 0 AND purchase_price >= 0`,
		),
		check('inventory_items_min_stock_check', sql`min_stock_qty >= 0`),
	],
);

/* ------------------------------------------------------------------------ *
 * inventory.stock_movements
 * ------------------------------------------------------------------------ */

/**
 * Authoritative, append-only stock ledger.
 *
 * One row per movement. Never updated after posting except for a reversal
 * row; no `updated_at`, no `deleted_at`. Valuations (`unit_cost`) are carried
 * but not computed by this module — quantity tracking only, for now.
 */
export const stockMovements = inventorySchema.table(
	'stock_movements',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		organizationId: organizationId(),
		code: varchar('code', { length: 32 }).notNull(),
		movementType: text('movement_type').notNull(),
		itemId: uuid('item_id')
			.notNull()
			.references(() => items.id, { onDelete: 'restrict' }),
		warehouseId: uuid('warehouse_id')
			.notNull()
			.references(() => warehouses.id, { onDelete: 'restrict' }),
		binId: uuid('bin_id').references(() => warehouseStorages.id, {
			onDelete: 'set null',
		}),
		targetWarehouseId: uuid('target_warehouse_id').references(
			() => warehouses.id,
			{ onDelete: 'restrict' },
		),
		quantity: numeric('quantity', { precision: 18, scale: 3 }).notNull(),
		/** e.g. 'manual_adjustment' | 'borrowing' | 'receipt'. */
		referenceType: text('reference_type'),
		referenceId: text('reference_id'),
		status: text('status').notNull().default('posted'),
		occurredAt: unixTimestamp('occurred_at').notNull(),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		createdBy: text('created_by'),
		notes: text('notes'),
		createdAt: unixTimestamp('created_at').notNull(),
	},
	(table) => [
		...scopedUnique(table.organizationId, table.code, {
			orgScoped: 'stock_movements_org_code_uq',
			global: 'stock_movements_global_code_uq',
		}),
		index('stock_movements_ledger_idx').on(
			table.organizationId,
			table.itemId,
			table.warehouseId,
			table.occurredAt,
		),
		index('stock_movements_bin_id_idx').on(table.binId),
		index('stock_movements_reference_type_idx').on(table.referenceType),
		index('stock_movements_reference_id_idx').on(table.referenceId),
		check(
			'stock_movements_type_check',
			sql`movement_type IN ('receipt', 'issue', 'transfer_in', 'transfer_out', 'adjustment_in', 'adjustment_out', 'return_in', 'return_out', 'consumption', 'borrowing_out', 'borrowing_in')`,
		),
		check(
			'stock_movements_status_check',
			sql`status IN ('draft', 'posted', 'reversed')`,
		),
		check('stock_movements_quantity_check', sql`quantity <> 0`),
		// A transfer always names both ends.
		check(
			'stock_movements_transfer_target_check',
			sql`(movement_type IN ('transfer_in', 'transfer_out') AND target_warehouse_id IS NOT NULL) OR (movement_type NOT IN ('transfer_in', 'transfer_out'))`,
		),
		// Borrowing movements are only ever written by the borrowing flow.
		check(
			'stock_movements_borrowing_reference_check',
			sql`(movement_type IN ('borrowing_out', 'borrowing_in') AND reference_type = 'borrowing') OR (movement_type NOT IN ('borrowing_out', 'borrowing_in'))`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * inventory.stock_balances
 * ------------------------------------------------------------------------ */

/**
 * Balance projection over `stock_movements`.
 *
 * Service-maintained inside the same transaction as the movement that
 * caused it (ADR-0008) — no database triggers. `recomputeFromLedger` is the
 * repair operation.
 *
 * **No valuation.** `average_cost` / `total_value` / `currency_code` were
 * removed: they were guaranteed to hold `0` forever and a cost field that is
 * never written is worse than an absent one, because it invites trust.
 * Valuation is owned by the (future) accounting module; the base price lives
 * on `items.selling_price` / `items.purchase_price`. `quantity_reserved` stays
 * 0 until reservations are built, so `quantity_available` equals
 * `quantity_on_hand` throughout.
 *
 * **Scope rule (see {@link import('../services/stock.service')}).** A
 * balance's `organization_id` follows the WAREHOUSE's scope, not the caller's:
 * an organization-owned warehouse keeps per-organization balances, while a
 * global warehouse (`warehouses.organization_id IS NULL`) has a single shared
 * balance row with `organization_id = NULL` that every organization sees. That
 * is deliberate — a global warehouse is one shared physical space, so its
 * quantity is shared too. It is the one place in this codebase where isolation
 * is intentionally NOT by caller.
 */
export const stockBalances = inventorySchema.table(
	'stock_balances',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		organizationId: organizationId(),
		itemId: uuid('item_id')
			.notNull()
			.references(() => items.id, { onDelete: 'restrict' }),
		warehouseId: uuid('warehouse_id')
			.notNull()
			.references(() => warehouses.id, { onDelete: 'restrict' }),
		binId: uuid('bin_id').references(() => warehouseStorages.id, {
			onDelete: 'set null',
		}),
		quantityOnHand: numeric('quantity_on_hand', { precision: 18, scale: 3 })
			.notNull()
			.default('0'),
		quantityReserved: numeric('quantity_reserved', {
			precision: 18,
			scale: 3,
		})
			.notNull()
			.default('0'),
		quantityAvailable: numeric('quantity_available', {
			precision: 18,
			scale: 3,
		})
			.notNull()
			.default('0'),
		lastMovementAt: unixTimestampNullable('last_movement_at'),
		createdAt: unixTimestamp('created_at').notNull(),
		updatedAt: unixTimestampNullable('updated_at').$onUpdate(() => new Date()),
	},
	(table) => [
		uniqueIndex('stock_balances_org_scope_uq')
			.on(
				table.organizationId,
				table.warehouseId,
				table.itemId,
				table.binId,
			)
			.where(sql`organization_id IS NOT NULL`),
		uniqueIndex('stock_balances_global_scope_uq')
			.on(table.warehouseId, table.itemId, table.binId)
			.where(sql`organization_id IS NULL`),
		index('stock_balances_item_id_idx').on(table.itemId),
		check(
			'stock_balances_available_check',
			sql`quantity_available = quantity_on_hand - quantity_reserved`,
		),
		// Stock can never go negative — enforced by the database, not just the
		// service. This is the backstop that makes the TOCTOU race in the
		// outbound pre-check harmless: two concurrent posts may both pass the
		// service check, but only the first update wins; the second violates
		// this constraint and rolls back (mapped to InsufficientStockError).
		check(
			'stock_balances_on_hand_check',
			sql`quantity_on_hand >= 0`,
		),
		check(
			'stock_balances_reserved_check',
			sql`quantity_reserved >= 0`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * inventory.stock_adjustments
 * ------------------------------------------------------------------------ */

/**
 * Stock adjustment document.
 *
 * @remarks
 * Adjustments are **documents, not bare movements**: they carry an approval
 * chain (`draft → submitted → approved → posted`) so a stock-take correction is
 * attributable and reviewable before it moves quantities.
 *
 * `organization_id` is **not null** here, unlike the rest of `inventory.*`: an
 * adjustment is always raised by a specific tenant, even against a global
 * warehouse. Which balance it moves still follows the warehouse's scope.
 *
 * Only `posted` documents write `stock_movements`. Posting is idempotent —
 * `posted_at IS NOT NULL` is the guard — so a retried request cannot
 * double-count.
 */
export const stockAdjustments = inventorySchema.table(
	'stock_adjustments',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		organizationId: text('organization_id').notNull(),
		code: varchar('code', { length: 32 }).notNull(),
		warehouseId: uuid('warehouse_id')
			.notNull()
			.references(() => warehouses.id, { onDelete: 'restrict' }),
		adjustmentType: text('adjustment_type').notNull(),
		status: text('status').notNull().default('draft'),
		reasonCode: text('reason_code'),
		notes: text('notes'),
		/** Logical reference to `auth.users.id`. */
		requestedBy: text('requested_by'),
		requestedAt: unixTimestamp('requested_at').notNull(),
		approvedBy: text('approved_by'),
		approvedAt: unixTimestampNullable('approved_at'),
		postedAt: unixTimestampNullable('posted_at'),
		...softDeleteTimestamps,
	},
	(table) => [
		uniqueIndex('stock_adjustments_org_code_uq')
			.on(table.organizationId, table.code)
			.where(sql`deleted_at IS NULL`),
		index('stock_adjustments_warehouse_id_idx').on(table.warehouseId),
		index('stock_adjustments_status_idx').on(table.status),
		check(
			'stock_adjustments_status_check',
			sql`status IN ('draft', 'submitted', 'approved', 'rejected', 'posted', 'cancelled')`,
		),
		check(
			'stock_adjustments_type_check',
			sql`adjustment_type IN ('increase', 'decrease', 'recount')`,
		),
		// Approval and posting are attributable: a document cannot reach those
		// states without recording who and when.
		check(
			'stock_adjustments_approval_check',
			sql`(status NOT IN ('approved', 'posted') OR (approved_by IS NOT NULL AND approved_at IS NOT NULL))`,
		),
		check(
			'stock_adjustments_posted_check',
			sql`(status <> 'posted' OR posted_at IS NOT NULL)`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * inventory.stock_adjustment_items
 * ------------------------------------------------------------------------ */

/**
 * One line of a stock adjustment.
 *
 * @remarks
 * The line stores the **before and after quantities**, not a delta: it is the
 * record of what the count said, which is what makes a recount auditable. The
 * movement direction is derived from `quantity_after - quantity_before`, and a
 * line where the two are equal writes no movement at all.
 *
 * Both quantities are `>= 0`. Combined with the service refusing negative
 * balances, a decrease can never take stock below zero at either layer.
 */
export const stockAdjustmentItems = inventorySchema.table(
	'stock_adjustment_items',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		organizationId: text('organization_id').notNull(),
		stockAdjustmentId: uuid('stock_adjustment_id')
			.notNull()
			.references(() => stockAdjustments.id, { onDelete: 'cascade' }),
		itemId: uuid('item_id')
			.notNull()
			.references(() => items.id, { onDelete: 'restrict' }),
		binId: uuid('bin_id').references(() => warehouseStorages.id, {
			onDelete: 'set null',
		}),
		quantityBefore: numeric('quantity_before', { precision: 18, scale: 3 })
			.notNull()
			.default('0'),
		quantityAfter: numeric('quantity_after', { precision: 18, scale: 3 })
			.notNull()
			.default('0'),
		note: text('note'),
		...softDeleteTimestamps,
	},
	(table) => [
		index('stock_adjustment_items_adjustment_id_idx').on(
			table.stockAdjustmentId,
		),
		check('stock_adjustment_items_before_check', sql`quantity_before >= 0`),
		check('stock_adjustment_items_after_check', sql`quantity_after >= 0`),
	],
);

/* ------------------------------------------------------------------------ *
 * inventory.serial_tracked_items
 * ------------------------------------------------------------------------ */

/**
 * One physical, serialized instance of an item.
 *
 * The table keeps its contract name (`serial_tracked_items`) rather than
 * becoming `item_units`: renaming would churn 33 documented logical
 * references for no gain (ADR-0009).
 *
 * `warehouse_id` is NULL while the unit is lost. `current_borrowing_line_id`
 * is **superseded** (ERP-0036 D17): borrowing moved to `assets`, nothing writes
 * it, and it stays only until the later cleanup migration. Its FK to
 * `inventory.borrowing_lines` was dropped with that table in ERP-0036 Slice 3.
 *
 * **No FK is declared here.** The former `serial_tracked_items →
 * borrowing_lines` cycle is gone; the leftover column is a plain uuid with no
 * constraint.
 */
export const serialTrackedItems = inventorySchema.table(
	'serial_tracked_items',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		organizationId: organizationId(),
		itemId: uuid('item_id')
			.notNull()
			.references(() => items.id, { onDelete: 'restrict' }),
		serialNumber: text('serial_number').notNull(),
		/**
		 * A pre-ordered unit carries a provisional serial (`PO-…`) until it is
		 * received. Replacement happens exactly once, guarded in the service.
		 */
		isProvisionalSerial: boolean('is_provisional_serial')
			.notNull()
			.default(false),
		assetTag: text('asset_tag'),
		status: text('status').notNull().default('in_stock'),
		warehouseId: uuid('warehouse_id').references(() => warehouses.id, {
			onDelete: 'set null',
		}),
		binId: uuid('bin_id').references(() => warehouseStorages.id, {
			onDelete: 'set null',
		}),
		acquiredOn: date('acquired_on'),
		warrantyExpiresOn: date('warranty_expires_on'),
		/**
		 * Logical reference to the procurement line this unit was ordered on.
		 * Procurement does not exist yet, so this is **unvalidated**.
		 */
		purchaseOrderLineId: text('purchase_order_line_id'),
		/** Logical reference to crm.customers.id — set when sold. */
		customerId: uuid('customer_id'),
		/** Logical reference to inventory.stock_movements.id (last touch). */
		stockMovementId: uuid('stock_movement_id'),
		/**
		 * Superseded (ERP-0036 D17). The open borrowing line this unit was out
		 * on under the retired inventory borrowing flow. No FK; nothing writes
		 * it. Removed in the later cleanup migration.
		 */
		currentBorrowingLineId: uuid('current_borrowing_line_id'),
		notes: text('notes'),
		...softDeleteTimestamps,
	},
	(table) => [
		uniqueIndex('serial_tracked_items_org_serial_uq')
			.on(table.organizationId, table.serialNumber)
			.where(sql`organization_id IS NOT NULL`),
		uniqueIndex('serial_tracked_items_global_serial_uq')
			.on(table.serialNumber)
			.where(sql`organization_id IS NULL`),
		index('serial_tracked_items_item_id_idx').on(table.itemId),
		index('serial_tracked_items_status_idx').on(table.status),
		index('serial_tracked_items_warehouse_id_idx').on(table.warehouseId),
		index('serial_tracked_items_asset_tag_idx').on(table.assetTag),
		index('serial_tracked_items_current_borrowing_line_id_idx').on(
			table.currentBorrowingLineId,
		),
		check(
			'serial_tracked_items_status_check',
			sql`status IN ('pre_order', 'in_stock', 'lost', 'sold', 'applied_warranty')`,
		),
		// A provisional serial only ever exists on a not-yet-received unit.
		check(
			'serial_tracked_items_provisional_check',
			sql`is_provisional_serial = false OR status = 'pre_order'`,
		),
		check(
			'serial_tracked_items_warranty_check',
			sql`warranty_expires_on IS NULL OR acquired_on IS NULL OR warranty_expires_on >= acquired_on`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * Relations (Relational v2)
 * ------------------------------------------------------------------------ */

/**
 * Relations are declared per schema file and combined in `db.ts`.
 */
export const inventoryRelations = defineRelationsPart(
	{
		warehouses,
		warehouseAddresses,
		warehouseStorages,
		items,
		stockMovements,
		stockBalances,
		serialTrackedItems,
	},
	(r) => ({
		warehouses: {
			address: r.one.warehouseAddresses({
				from: r.warehouses.id,
				to: r.warehouseAddresses.warehouseId,
			}),
			storages: r.many.warehouseStorages({
				from: r.warehouses.id,
				to: r.warehouseStorages.warehouseId,
			}),
		},
		warehouseAddresses: {
			warehouse: r.one.warehouses({
				from: r.warehouseAddresses.warehouseId,
				to: r.warehouses.id,
			}),
		},
		warehouseStorages: {
			warehouse: r.one.warehouses({
				from: r.warehouseStorages.warehouseId,
				to: r.warehouses.id,
			}),
		},
		items: {
			units: r.many.serialTrackedItems({
				from: r.items.id,
				to: r.serialTrackedItems.itemId,
			}),
		},
		serialTrackedItems: {
			item: r.one.items({
				from: r.serialTrackedItems.itemId,
				to: r.items.id,
			}),
			warehouse: r.one.warehouses({
				from: r.serialTrackedItems.warehouseId,
				to: r.warehouses.id,
			}),
		},
	}),
);

/* ------------------------------------------------------------------------ *
 * Inferred types
 * ------------------------------------------------------------------------ */

export type TItemSelect = typeof items.$inferSelect;
export type TItemInsert = typeof items.$inferInsert;

export type TSerialTrackedItemSelect = typeof serialTrackedItems.$inferSelect;
export type TSerialTrackedItemInsert = typeof serialTrackedItems.$inferInsert;

export type TWarehouseSelect = typeof warehouses.$inferSelect;
export type TWarehouseInsert = typeof warehouses.$inferInsert;

export type TWarehouseAddressSelect = typeof warehouseAddresses.$inferSelect;
export type TWarehouseAddressInsert = typeof warehouseAddresses.$inferInsert;

export type TWarehouseStorageSelect = typeof warehouseStorages.$inferSelect;
export type TWarehouseStorageInsert = typeof warehouseStorages.$inferInsert;

export type TStockMovementSelect = typeof stockMovements.$inferSelect;
export type TStockMovementInsert = typeof stockMovements.$inferInsert;

export type TStockBalanceSelect = typeof stockBalances.$inferSelect;
export type TStockBalanceInsert = typeof stockBalances.$inferInsert;

export type TStockAdjustmentSelect = typeof stockAdjustments.$inferSelect;
export type TStockAdjustmentInsert = typeof stockAdjustments.$inferInsert;

export type TStockAdjustmentItemSelect =
	typeof stockAdjustmentItems.$inferSelect;
export type TStockAdjustmentItemInsert =
	typeof stockAdjustmentItems.$inferInsert;
