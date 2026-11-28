/**
 * Inventory module schema — owns the `inventory` Postgres schema.
 *
 * @remarks
 * Absorbs the former `assets` schema (ADR-0024 Q15). The product master and the
 * warehouse estate moved to the `product` and `warehouse` modules (ADR-0026);
 * every id that points at them is a plain nullable column checked by the owning
 * module's contract.
 *
 * - `item_serials` — serial units of a product (was `serial_tracked_items`).
 * - `items` — one row per physical tool/asset unit (was `assets.assets`).
 * - `movements` — the stock ledger and the asset location trail merged, with
 *   exactly one of `product_id` / `item_id` set (Q24).
 * - `stocks` — balance projection over product movements (was `stock_balances`).
 * - borrowing is split into the request (`borrowing_requests`) and the issue
 *   document (`borrowings`) per Q26.
 *
 * House rules: `organization_id` is nullable everywhere (ADR-0008) — NULL means
 * global/company-wide; coded tables use the partial-unique pair; statuses are
 * text guarded by CHECKs; `movements` is append-only (no updated_at/deleted_at).
 */
import {
	unixTimestamp,
	unixTimestampNullable,
} from '@drizzle/datatypes/unix-timestamp';
import { createCodeNumberingTable } from '@shared/numbering/table';
import { sql } from 'drizzle-orm';
import {
	bigint,
	boolean,
	check,
	date,
	index,
	integer,
	jsonb,
	numeric,
	pgSchema,
	text,
	uniqueIndex,
	uuid,
	varchar,
} from 'drizzle-orm/pg-core';
import type { PgColumn } from 'drizzle-orm/pg-core';

export const inventorySchema = pgSchema('inventory');

/* ------------------------------------------------------------------------ *
 * Vocabularies
 * ------------------------------------------------------------------------ */

/** Serial unit statuses. `sold` / `applied_warranty` are product-only. */
export const SERIAL_STATUSES = [
	'pre_order',
	'in_stock',
	'lost',
	'sold',
	'applied_warranty',
	'returned',
	'damaged',
	/** Out of the warehouse by a manual stock issue (project material or own use, B-29). */
	'issued',
] as const;
export type SerialStatus = (typeof SERIAL_STATUSES)[number];

/** Item (physical unit) kinds; absorbs `assets.asset_types` (Q15). */
export const ITEM_KINDS = [
	'equipment',
	'vehicle',
	'tool',
	'furniture',
	'it',
	'intangible',
] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

export const ITEM_CONDITIONS = ['new', 'good', 'fair', 'poor', 'damaged'] as const;
export type ItemCondition = (typeof ITEM_CONDITIONS)[number];

export const ITEM_STATUSES = [
	'ready',
	'borrowed',
	'maintenance',
	'inactive',
	'disposed',
	'lost',
] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

export const DEPRECIATION_METHODS = [
	'straight_line',
	'declining_balance',
	'none',
] as const;
export type DepreciationMethod = (typeof DEPRECIATION_METHODS)[number];

export const INVENTORY_DOCUMENT_TYPES = [
	'photo',
	'manual',
	'datasheet',
	'certificate',
	'invoice',
	'contract',
] as const;
export type InventoryDocumentType =
	(typeof INVENTORY_DOCUMENT_TYPES)[number];

/** Movement vocabulary: the union of the stock ledger and the asset trail. */
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
	'borrow_out',
	'borrow_return',
	'project_site',
	'disposal',
	'lost',
] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export const MOVEMENT_STATUSES = ['draft', 'posted', 'reversed'] as const;
export type MovementStatus = (typeof MOVEMENT_STATUSES)[number];

/** Movement types that only ever concern a physical item unit. */
export const ITEM_MOVEMENT_TYPES = [
	'borrow_out',
	'borrow_return',
	'project_site',
	'disposal',
	'lost',
] as const;

export const ADJUSTMENT_STATUSES = [
	'draft',
	'submitted',
	'approved',
	'rejected',
	'posted',
	'cancelled',
] as const;
export type AdjustmentStatus = (typeof ADJUSTMENT_STATUSES)[number];

export const ADJUSTMENT_TYPES = ['increase', 'decrease', 'recount'] as const;
export type AdjustmentType = (typeof ADJUSTMENT_TYPES)[number];

export const BORROWING_REQUEST_STATUSES = [
	'draft',
	'requested',
	'approved',
	'rejected',
	'cancelled',
] as const;
export type BorrowingRequestStatus =
	(typeof BORROWING_REQUEST_STATUSES)[number];

export const BORROWING_STATUSES = [
	'issued',
	'partially_returned',
	'returned',
	'closed',
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
export const RETURN_CONDITIONS = ['good', 'damaged', 'incomplete'] as const;

export const BORROWING_EVENT_TYPES = [
	'issued',
	'returned',
	'marked_late',
	'marked_lost',
	'due_date_extended',
	'closed',
] as const;
export type BorrowingEventType = (typeof BORROWING_EVENT_TYPES)[number];

/** Events of a request before issue (orrowing_request_events). */
export const BORROWING_REQUEST_EVENT_TYPES = [
	'requested',
	'approved',
	'rejected',
	'cancelled',
	'due_date_extended',
] as const;
export type BorrowingRequestEventType =
	(typeof BORROWING_REQUEST_EVENT_TYPES)[number];

export const PHYSICAL_EVENT_TYPES = [
	'issued',
	'returned',
	'marked_lost',
] as const satisfies readonly BorrowingEventType[];

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

export const CONDITION_CHECK_STATUSES = [
	'recorded',
	'followed_up',
	'closed',
] as const;
export type ConditionCheckStatus = (typeof CONDITION_CHECK_STATUSES)[number];

export const TOOL_SET_STATUSES = [
	'available',
	'lent',
	'maintenance',
	'retired',
] as const;
export type ToolSetStatus = (typeof TOOL_SET_STATUSES)[number];

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

const day = (name: string) => date(name, { mode: 'string' });
const money = (name: string) => bigint(name, { mode: 'number' });

/* ------------------------------------------------------------------------ *
 * inventory.item_categories / inventory.items
 * ------------------------------------------------------------------------ */

/** Asset category with its default depreciation rule (was assets.*). */
export const itemCategories = inventorySchema.table(
	'item_categories',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		organizationId: organizationId(),
		code: varchar('code', { length: 32 }).notNull(),
		name: text('name').notNull(),
		parentCategoryId: uuid('parent_category_id'),
		itemKind: text('item_kind').notNull().default('equipment'),
		defaultUsefulLifeMonths: integer('default_useful_life_months'),
		defaultDepreciationMethod: text('default_depreciation_method')
			.notNull()
			.default('straight_line'),
		isActive: boolean('is_active').notNull().default(true),
		...softDeleteTimestamps,
	},
	(table) => [
		...scopedUnique(table.organizationId, table.code, {
			orgScoped: 'item_categories_org_code_uq',
			global: 'item_categories_global_code_uq',
		}),
		index('item_categories_parent_category_id_idx').on(
			table.parentCategoryId,
		),
		check(
			'item_categories_dep_method_check',
			sql`default_depreciation_method IN ('straight_line', 'declining_balance', 'none')`,
		),
	],
);

/**
 * Asset/tool master — ONE ROW PER PHYSICAL UNIT (was `assets.assets`).
 *
 * @remarks
 * Costs are exact integer minor units; master data referenced by financial
 * records is never hard deleted. `status` is derived by `reconcileStatus` for
 * unit-backed rows; `inactive` is item-owned and never overwritten.
 */
export const items = inventorySchema.table(
	'items',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		organizationId: organizationId(),
		code: varchar('code', { length: 32 }).notNull(),
		name: text('name').notNull(),
		description: text('description'),
		itemKind: text('item_kind').notNull().default('equipment'),
		itemCategoryId: uuid('item_category_id').references(
			() => itemCategories.id,
			{ onDelete: 'set null' },
		),
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
		deactivationReason: text('deactivation_reason'),
		locationDescription: text('location_description'),
		/** Logical reference to warehouse.warehouses.id — cross-module FK omitted (ADR-0014, ADR-0026). */
		warehouseId: uuid('warehouse_id'),
		/** Logical reference to warehouse.warehouse_storages.id — cross-module FK omitted (ADR-0014, ADR-0026). */
		storageId: uuid('storage_id'),
		/** Written only by `syncCustody`; never accepted from a request body. */
		custodianEmployeeId: uuid('custodian_employee_id'),
		borrowedSince: unixTimestampNullable('borrowed_since'),
		/** Logical reference to supplier.companies.id — cross-module FK omitted. */
		supplierCompanyId: uuid('supplier_company_id'),
		/** Logical reference to procurement.purchase_orders.id — FK omitted. */
		purchaseOrderId: uuid('purchase_order_id'),
		/** Logical reference to document.documents.id — FK omitted. */
		documentId: uuid('document_id'),
		/**
		 * Legacy plain URL, no longer written or read: superseded by
		 * `imageObjectKey`. The column is kept because migrations are append-only.
		 */
		imageUrl: text('image_url'),
		/** Object-storage key of the asset photo (WebP); never a public URL. */
		imageObjectKey: text('image_object_key'),
		...softDeleteTimestamps,
	},
	(table) => [
		uniqueIndex('items_code_uq')
			.on(table.code)
			.where(sql`deleted_at IS NULL`),
		uniqueIndex('items_serial_uq')
			.on(sql`coalesce(${table.organizationId}, '')`, table.serialNumber)
			.where(sql`${table.serialNumber} IS NOT NULL AND ${table.deletedAt} IS NULL`),
		index('items_item_kind_idx').on(table.itemKind),
		index('items_item_category_id_idx').on(table.itemCategoryId),
		index('items_custodian_employee_id_idx').on(table.custodianEmployeeId),
		index('items_status_idx').on(table.status),
		index('items_warehouse_id_idx').on(table.warehouseId),
		index('items_storage_id_idx').on(table.storageId),
		index('items_serial_number_idx').on(table.serialNumber),
		check(
			'items_status_check',
			sql`status IN ('ready', 'borrowed', 'maintenance', 'inactive', 'disposed', 'lost')`,
		),
		check(
			'items_condition_check',
			sql`condition IN ('new', 'good', 'fair', 'poor', 'damaged')`,
		),
		check(
			'items_dep_method_check',
			sql`depreciation_method IN ('straight_line', 'declining_balance', 'none')`,
		),
		check('items_acquisition_cost_check', sql`acquisition_cost >= 0`),
		check('items_salvage_value_check', sql`salvage_value >= 0`),
		check(
			'items_accumulated_depreciation_check',
			sql`accumulated_depreciation >= 0`,
		),
		check('items_book_value_check', sql`book_value >= 0`),
		check(
			'items_useful_life_check',
			sql`useful_life_months IS NULL OR useful_life_months > 0`,
		),
		check(
			'items_deactivation_reason_check',
			sql`(status = 'inactive' AND deactivation_reason IS NOT NULL) OR (status <> 'inactive' AND deactivation_reason IS NULL)`,
		),
		check(
			'items_storage_requires_warehouse_check',
			sql`storage_id IS NULL OR warehouse_id IS NOT NULL`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * inventory.item_images
 * ------------------------------------------------------------------------ */

/** Image gallery of a physical asset; the first live row is the cover. */
export const itemImages = inventorySchema.table(
	'item_images',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		itemId: uuid('item_id')
			.notNull()
			.references(() => items.id, { onDelete: 'cascade' }),
		/** Object-storage key of the WebP image; never a public URL. */
		objectKey: text('object_key').notNull(),
		caption: varchar('caption', { length: 200 }),
		sortOrder: integer('sort_order').notNull().default(0),
		...softDeleteTimestamps,
	},
	(table) => [index('item_images_item_id_sort_idx').on(table.itemId, table.sortOrder)],
);

/* ------------------------------------------------------------------------ *
 * inventory.item_serials
 * ------------------------------------------------------------------------ */

/** One physical, serialized instance of a product (was serial_tracked_items). */
export const itemSerials = inventorySchema.table(
	'item_serials',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		organizationId: organizationId(),
		/** Logical reference to product.products.id — cross-module FK omitted (ADR-0014, ADR-0026). */
		productId: uuid('product_id'),
		serialNumber: text('serial_number').notNull(),
		isProvisionalSerial: boolean('is_provisional_serial')
			.notNull()
			.default(false),
		assetTag: text('asset_tag'),
		status: text('status').notNull().default('in_stock'),
		/** Logical reference to warehouse.warehouses.id — cross-module FK omitted (ADR-0014, ADR-0026). */
		warehouseId: uuid('warehouse_id'),
		/** Logical reference to warehouse.warehouse_storages.id — cross-module FK omitted (ADR-0014, ADR-0026). */
		binId: uuid('bin_id'),
		acquiredOn: day('acquired_on'),
		warrantyExpiresOn: day('warranty_expires_on'),
		purchaseOrderLineId: uuid('purchase_order_line_id'),
		/** Logical reference to customer.customers.id — cross-module FK omitted. */
		customerId: uuid('customer_id'),
		/** Logical reference to customer.companies.id — cross-module FK omitted. */
		companyId: uuid('company_id'),
		movementId: uuid('movement_id'),
		notes: text('notes'),
		...softDeleteTimestamps,
	},
	(table) => [
		uniqueIndex('item_serials_org_serial_uq')
			.on(table.organizationId, table.serialNumber)
			.where(sql`organization_id IS NOT NULL`),
		uniqueIndex('item_serials_global_serial_uq')
			.on(table.serialNumber)
			.where(sql`organization_id IS NULL`),
		index('item_serials_product_id_idx').on(table.productId),
		index('item_serials_status_idx').on(table.status),
		index('item_serials_warehouse_id_idx').on(table.warehouseId),
		check(
			'item_serials_status_check',
			sql`status IN ('pre_order', 'in_stock', 'lost', 'sold', 'applied_warranty', 'returned', 'damaged', 'issued')`,
		),
		check(
			'item_serials_provisional_check',
			sql`is_provisional_serial = false OR status = 'pre_order'`,
		),
		check(
			'item_serials_warranty_check',
			sql`warranty_expires_on IS NULL OR acquired_on IS NULL OR warranty_expires_on >= acquired_on`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * inventory.documents
 * ------------------------------------------------------------------------ */

/** Attachment of a product or an item; exactly one owner column is set. */
export const inventoryDocuments = inventorySchema.table(
	'documents',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		organizationId: organizationId(),
		productId: uuid('product_id'),
		itemId: uuid('item_id'),
		documentType: text('document_type').notNull(),
		objectKey: text('object_key').notNull(),
		fileName: varchar('file_name', { length: 255 }).notNull(),
		mimeType: varchar('mime_type', { length: 120 }).notNull(),
		sizeBytes: money('size_bytes').notNull().default(0),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		createdBy: text('created_by'),
		...softDeleteTimestamps,
	},
	(table) => [
		index('inventory_documents_product_id_idx').on(table.productId),
		index('inventory_documents_item_id_idx').on(table.itemId),
		check(
			'inventory_documents_type_check',
			sql`document_type IN ('photo', 'manual', 'datasheet', 'certificate', 'invoice', 'contract')`,
		),
		check(
			'inventory_documents_owner_check',
			sql`(product_id IS NOT NULL AND item_id IS NULL) OR (product_id IS NULL AND item_id IS NOT NULL)`,
		),
		check('inventory_documents_size_check', sql`size_bytes >= 0`),
	],
);

/* ------------------------------------------------------------------------ *
 * inventory.movements (append-only)
 * ------------------------------------------------------------------------ */

/**
 * Authoritative, append-only movement ledger for products AND items.
 *
 * @remarks
 * One row per movement, never updated after posting; a reversal is a new row.
 * No `updated_at`, no `deleted_at`. Exactly one of `product_id` / `item_id` is
 * set (ADR-0024 Q24). Borrowing writes an item movement with
 * `reference_type = 'borrowing'`; the superseded `borrowing_out` / `borrowing_in`
 * stock movement types are gone.
 */
export const movements = inventorySchema.table(
	'movements',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		organizationId: organizationId(),
		code: varchar('code', { length: 32 }).notNull(),
		movementType: text('movement_type').notNull(),
		/** Logical reference to product.products.id — cross-module FK omitted (ADR-0014, ADR-0026). */
		productId: uuid('product_id'),
		itemId: uuid('item_id').references(() => items.id, {
			onDelete: 'restrict',
		}),
		/** Logical reference to warehouse.warehouses.id — cross-module FK omitted (ADR-0014, ADR-0026). */
		warehouseId: uuid('warehouse_id'),
		/** Logical reference to warehouse.warehouse_storages.id — cross-module FK omitted (ADR-0014, ADR-0026). */
		binId: uuid('bin_id'),
		/** Logical reference to warehouse.warehouses.id — cross-module FK omitted (ADR-0014, ADR-0026). */
		targetWarehouseId: uuid('target_warehouse_id'),
		/** Logical reference to warehouse.warehouse_storages.id — cross-module FK omitted (ADR-0014, ADR-0026). */
		targetBinId: uuid('target_bin_id'),
		fromLocation: text('from_location'),
		toLocation: text('to_location'),
		quantity: numeric('quantity', { precision: 18, scale: 3 }).notNull(),
		/** IDR minor units the movement was valued at (moving average). */
		unitCost: money('unit_cost').notNull().default(0),
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
			orgScoped: 'movements_org_code_uq',
			global: 'movements_global_code_uq',
		}),
		index('movements_product_ledger_idx').on(
			table.organizationId,
			table.productId,
			table.warehouseId,
			table.occurredAt,
		),
		index('movements_item_ledger_idx').on(
			table.organizationId,
			table.itemId,
			table.occurredAt,
		),
		index('movements_bin_id_idx').on(table.binId),
		index('movements_reference_type_idx').on(table.referenceType),
		index('movements_reference_id_idx').on(table.referenceId),
		check(
			'movements_type_check',
			sql`movement_type IN ('receipt', 'issue', 'transfer_in', 'transfer_out', 'adjustment_in', 'adjustment_out', 'return_in', 'return_out', 'consumption', 'borrow_out', 'borrow_return', 'project_site', 'disposal', 'lost')`,
		),
		check('movements_status_check', sql`status IN ('draft', 'posted', 'reversed')`),
		check('movements_quantity_check', sql`quantity <> 0`),
		check(
			'movements_owner_check',
			sql`(product_id IS NOT NULL AND item_id IS NULL) OR (product_id IS NULL AND item_id IS NOT NULL)`,
		),
		check(
			'movements_transfer_target_check',
			sql`(movement_type IN ('transfer_in', 'transfer_out') AND target_warehouse_id IS NOT NULL) OR (movement_type NOT IN ('transfer_in', 'transfer_out'))`,
		),
		check(
			'movements_item_type_check',
			sql`(movement_type IN ('borrow_out', 'borrow_return', 'project_site', 'disposal', 'lost') AND item_id IS NOT NULL) OR (movement_type NOT IN ('borrow_out', 'borrow_return', 'project_site', 'disposal', 'lost'))`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * inventory.stocks (projection)
 * ------------------------------------------------------------------------ */

/**
 * Balance projection over `inventory.movements`, products only.
 *
 * @remarks
 * Service-maintained inside the same transaction as the movement that caused it
 * — no database triggers. Scope rule: a balance's `organization_id` follows the
 * WAREHOUSE scope, not the caller's, so a global warehouse has ONE shared
 * balance row.
 */
export const stocks = inventorySchema.table(
	'stocks',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		organizationId: organizationId(),
		/** Logical reference to product.products.id — cross-module FK omitted (ADR-0014, ADR-0026). */
		productId: uuid('product_id'),
		/** Logical reference to warehouse.warehouses.id — cross-module FK omitted (ADR-0014, ADR-0026). */
		warehouseId: uuid('warehouse_id'),
		/** Logical reference to warehouse.warehouse_storages.id — cross-module FK omitted (ADR-0014, ADR-0026). */
		binId: uuid('bin_id'),
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
		/** Moving-average unit cost, IDR minor units. Restricted. */
		averageCost: money('average_cost').notNull().default(0),
		/** Value of `quantity_on_hand` at cost; the last unit out takes the rest. */
		totalValue: money('total_value').notNull().default(0),
		lastMovementAt: unixTimestampNullable('last_movement_at'),
		createdAt: unixTimestamp('created_at').notNull(),
		updatedAt: unixTimestampNullable('updated_at').$onUpdate(() => new Date()),
	},
	(table) => [
		// ERP-0166: both scope indexes are NULLS NOT DISTINCT in the database
		// (a NULL bin is one key), set by the hand-written migration
		// `20261126101626_erp0166_stocks_nulls_not_distinct`: drizzle-orm cannot
		// declare it on a partial unique index. Keep that migration when the
		// chain is squashed, or every bin-less movement duplicates a balance.
		uniqueIndex('stocks_org_scope_uq')
			.on(
				table.organizationId,
				table.warehouseId,
				table.productId,
				table.binId,
			)
			.where(sql`organization_id IS NOT NULL`),
		uniqueIndex('stocks_global_scope_uq')
			.on(table.warehouseId, table.productId, table.binId)
			.where(sql`organization_id IS NULL`),
		index('stocks_product_id_idx').on(table.productId),
		check(
			'stocks_available_check',
			sql`quantity_available = quantity_on_hand - quantity_reserved`,
		),
		check('stocks_on_hand_check', sql`quantity_on_hand >= 0`),
		check('stocks_reserved_check', sql`quantity_reserved >= 0`),
	],
);

/* ------------------------------------------------------------------------ *
 * inventory.stock_adjustments (+ items)
 * ------------------------------------------------------------------------ */

/** Stock adjustment document with an approval chain; only `posted` writes. */
export const stockAdjustments = inventorySchema.table(
	'stock_adjustments',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		organizationId: text('organization_id'),
		code: varchar('code', { length: 32 }).notNull(),
		/** Logical reference to warehouse.warehouses.id — cross-module FK omitted (ADR-0014, ADR-0026). */
		warehouseId: uuid('warehouse_id'),
		adjustmentType: text('adjustment_type').notNull(),
		status: text('status').notNull().default('draft'),
		reasonCode: text('reason_code'),
		notes: text('notes'),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
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

/** One line of a stock adjustment, storing before/after quantities. */
export const stockAdjustmentItems = inventorySchema.table(
	'stock_adjustment_items',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		organizationId: text('organization_id'),
		stockAdjustmentId: uuid('stock_adjustment_id')
			.notNull()
			.references(() => stockAdjustments.id, { onDelete: 'cascade' }),
		/** Logical reference to product.products.id — cross-module FK omitted (ADR-0014, ADR-0026). */
		productId: uuid('product_id'),
		/** Logical reference to warehouse.warehouse_storages.id — cross-module FK omitted (ADR-0014, ADR-0026). */
		binId: uuid('bin_id'),
		quantityBefore: numeric('quantity_before', { precision: 18, scale: 3 })
			.notNull()
			.default('0'),
		quantityAfter: numeric('quantity_after', { precision: 18, scale: 3 })
			.notNull()
			.default('0'),
		/** Cost an increase enters stock at; null = the current moving average. */
		unitCost: money('unit_cost'),
		note: text('note'),
		...softDeleteTimestamps,
	},
	(table) => [
		index('stock_adjustment_items_adjustment_id_idx').on(
			table.stockAdjustmentId,
		),
		check('stock_adjustment_items_before_check', sql`quantity_before >= 0`),
		check('stock_adjustment_items_after_check', sql`quantity_after >= 0`),
		check(
			'stock_adjustment_items_unit_cost_check',
			sql`unit_cost IS NULL OR unit_cost >= 0`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * inventory.borrowing_requests / borrowings / borrowing_items / events
 * ------------------------------------------------------------------------ */

/**
 * Borrowing request — the request and approval half of the old
 * `assets.borrowings` (ADR-0024 Q26).
 */
export const borrowingRequests = inventorySchema.table(
	'borrowing_requests',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		organizationId: organizationId(),
		code: varchar('code', { length: 32 }).notNull(),
		status: text('status').notNull().default('draft'),
		purpose: text('purpose').notNull().default('internal_use'),
		borrowerType: text('borrower_type').notNull(),
		toolSetId: uuid('tool_set_id'),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		borrowerUserId: text('borrower_user_id'),
		/** Logical reference to customer.customers.id — cross-module FK omitted. */
		borrowerCustomerId: uuid('borrower_customer_id'),
		guestName: text('guest_name'),
		guestPhone: text('guest_phone'),
		guestIdType: text('guest_id_type'),
		guestIdNumber: text('guest_id_number'),
		guestAddressText: text('guest_address_text'),
		guestIdDocumentRef: text('guest_id_document_ref'),
		/** Logical reference to auth.users.id. */
		requestedBy: text('requested_by'),
		requestedAt: unixTimestampNullable('requested_at'),
		/** Logical reference to auth.users.id. */
		approvedBy: text('approved_by'),
		approvedAt: unixTimestampNullable('approved_at'),
		dueAt: unixTimestamp('due_at').notNull(),
		notes: text('notes'),
		...softDeleteTimestamps,
	},
	(table) => [
		...scopedUnique(table.organizationId, table.code, {
			orgScoped: 'borrowing_requests_org_code_uq',
			global: 'borrowing_requests_global_code_uq',
		}),
		index('borrowing_requests_status_idx').on(table.status),
		index('borrowing_requests_borrower_user_id_idx').on(table.borrowerUserId),
		index('borrowing_requests_borrower_customer_id_idx').on(
			table.borrowerCustomerId,
		),
		index('borrowing_requests_due_at_idx').on(table.dueAt),
		check(
			'borrowing_requests_status_check',
			sql`status IN ('draft', 'requested', 'approved', 'rejected', 'cancelled')`,
		),
		check(
			'borrowing_requests_purpose_check',
			sql`purpose IN ('rental', 'internal_use', 'testing', 'warranty_service')`,
		),
		check(
			'borrowing_requests_borrower_type_check',
			sql`borrower_type IN ('user', 'customer', 'guest')`,
		),
		check(
			'borrowing_requests_guest_id_type_check',
			sql`guest_id_type IS NULL OR guest_id_type IN ('ktp', 'sim', 'passport', 'other')`,
		),
		check(
			'borrowing_requests_borrower_identity_check',
			sql`(borrower_type = 'user' AND borrower_user_id IS NOT NULL AND borrower_customer_id IS NULL AND guest_name IS NULL AND guest_phone IS NULL AND guest_id_number IS NULL)
				OR (borrower_type = 'customer' AND borrower_customer_id IS NOT NULL AND borrower_user_id IS NULL AND guest_name IS NULL AND guest_phone IS NULL AND guest_id_number IS NULL)
				OR (borrower_type = 'guest' AND guest_name IS NOT NULL AND guest_phone IS NOT NULL AND guest_id_number IS NOT NULL AND borrower_user_id IS NULL AND borrower_customer_id IS NULL)`,
		),
	],
);

/** Borrowing issue/return document; at most one per approved request (Q26). */
export const borrowings = inventorySchema.table(
	'borrowings',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		organizationId: organizationId(),
		code: varchar('code', { length: 32 }).notNull(),
		borrowingRequestId: uuid('borrowing_request_id')
			.notNull()
			.references(() => borrowingRequests.id, { onDelete: 'restrict' }),
		status: text('status').notNull().default('issued'),
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
		uniqueIndex('borrowings_request_uq').on(table.borrowingRequestId),
		index('borrowings_status_idx').on(table.status),
		index('borrowings_due_at_idx').on(table.dueAt),
		check(
			'borrowings_status_check',
			sql`status IN ('issued', 'partially_returned', 'returned', 'closed')`,
		),
	],
);

/** One borrowed item unit (was `assets.borrowing_lines`). */
export const borrowingItems = inventorySchema.table(
	'borrowing_items',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		organizationId: organizationId(),
		borrowingRequestId: uuid('borrowing_request_id')
			.notNull()
			.references(() => borrowingRequests.id, { onDelete: 'restrict' }),
		borrowingId: uuid('borrowing_id').references(() => borrowings.id, {
			onDelete: 'cascade',
		}),
		itemId: uuid('item_id')
			.notNull()
			.references(() => items.id, { onDelete: 'restrict' }),
		originWarehouseId: uuid('origin_warehouse_id'),
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
		/** Logical reference to project.projects.id — cross-module FK omitted. */
		projectId: uuid('project_id'),
		notes: text('notes'),
		...softDeleteTimestamps,
	},
	(table) => [
		uniqueIndex('borrowing_items_request_item_uq').on(
			table.borrowingRequestId,
			table.itemId,
		),
		index('borrowing_items_borrowing_id_idx').on(table.borrowingId),
		index('borrowing_items_item_id_idx').on(table.itemId),
		index('borrowing_items_open_idx')
			.on(table.dueAt)
			.where(sql`returned_at IS NULL AND marked_lost_at IS NULL`),
		check(
			'borrowing_items_condition_check',
			sql`returned_condition IS NULL OR returned_condition IN ('good', 'damaged', 'incomplete')`,
		),
		check(
			'borrowing_items_due_after_issue_check',
			sql`due_at IS NULL OR issued_at IS NULL OR due_at > issued_at`,
		),
		check(
			'borrowing_items_origin_storage_check',
			sql`origin_storage_id IS NULL OR origin_warehouse_id IS NOT NULL`,
		),
	],
);

/** Append-only business timeline of a borrowing. */
export const borrowingEvents = inventorySchema.table(
	'borrowing_events',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		borrowingId: uuid('borrowing_id')
			.notNull()
			.references(() => borrowings.id, { onDelete: 'cascade' }),
		borrowingItemId: uuid('borrowing_item_id').references(
			() => borrowingItems.id,
			{ onDelete: 'cascade' },
		),
		eventType: text('event_type').notNull(),
		/** Required for the physical event types, forbidden otherwise. */
		movementId: uuid('movement_id'),
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
		index('borrowing_events_item_id_idx').on(table.borrowingItemId),
		check(
			'borrowing_events_type_check',
			sql`event_type IN ('issued', 'returned', 'marked_late', 'marked_lost', 'due_date_extended', 'closed')`,
		),
		check(
			'borrowing_events_movement_check',
			sql`(event_type IN ('issued', 'returned', 'marked_lost') AND movement_id IS NOT NULL)
				OR (event_type NOT IN ('issued', 'returned', 'marked_lost') AND movement_id IS NULL)`,
		),
	],
);

/**
 * Timeline of a borrowing request before issue (ADR-0024 Q26 review): the
 * request half has no `borrowings` row yet, so its events cannot point at one.
 */
export const borrowingRequestEvents = inventorySchema.table(
	'borrowing_request_events',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		borrowingRequestId: uuid('borrowing_request_id')
			.notNull()
			.references(() => borrowingRequests.id, { onDelete: 'cascade' }),
		eventType: text('event_type').notNull(),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		actorUserId: text('actor_user_id'),
		occurredAt: unixTimestamp('occurred_at').notNull(),
		note: text('note'),
	},
	(table) => [
		index('borrowing_request_events_request_occurred_idx').on(
			table.borrowingRequestId,
			table.occurredAt,
		),
		check(
			'borrowing_request_events_type_check',
			sql`event_type IN ('requested', 'approved', 'rejected', 'cancelled', 'due_date_extended')`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * inventory.maintenances / condition_checks / disposals
 * ------------------------------------------------------------------------ */

/** Maintenance record of an item (was `assets.asset_maintenances`). */
export const maintenances = inventorySchema.table(
	'maintenances',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		organizationId: organizationId(),
		code: varchar('code', { length: 32 }).notNull(),
		itemId: uuid('item_id')
			.notNull()
			.references(() => items.id, { onDelete: 'cascade' }),
		maintenanceType: text('maintenance_type').notNull().default('preventive'),
		scheduledDate: day('scheduled_date'),
		performedDate: day('performed_date'),
		/** Logical reference to human_resource.employees.id — FK omitted. */
		performedByEmployeeId: uuid('performed_by_employee_id'),
		vendorName: text('vendor_name'),
		cost: money('cost').notNull().default(0),
		currencyCode: varchar('currency_code', { length: 3 })
			.notNull()
			.default('IDR'),
		description: text('description'),
		status: text('status').notNull().default('scheduled'),
		nextServiceDate: day('next_service_date'),
		/** Logical reference to document.documents.id — cross-module FK omitted. */
		documentId: uuid('document_id'),
		...softDeleteTimestamps,
	},
	(table) => [
		...scopedUnique(table.organizationId, table.code, {
			orgScoped: 'maintenances_org_code_uq',
			global: 'maintenances_global_code_uq',
		}),
		index('maintenances_item_id_idx').on(table.itemId),
		index('maintenances_status_idx').on(table.status),
		index('maintenances_next_service_date_idx').on(table.nextServiceDate),
		check(
			'maintenances_type_check',
			sql`maintenance_type IN ('preventive', 'corrective', 'calibration', 'inspection')`,
		),
		check(
			'maintenances_status_check',
			sql`status IN ('scheduled', 'in_progress', 'completed', 'cancelled')`,
		),
		check('maintenances_cost_check', sql`cost >= 0`),
	],
);

/** Periodic condition check of an item. */
export const conditionChecks = inventorySchema.table(
	'condition_checks',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		organizationId: organizationId(),
		itemId: uuid('item_id')
			.notNull()
			.references(() => items.id, { onDelete: 'cascade' }),
		checkDate: day('check_date').notNull(),
		condition: text('condition').notNull(),
		findings: text('findings'),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		checkedByUserId: text('checked_by_user_id'),
		nextCheckDate: day('next_check_date'),
		status: text('status').notNull().default('recorded'),
		...softDeleteTimestamps,
	},
	(table) => [
		index('condition_checks_item_id_idx').on(table.itemId),
		index('condition_checks_check_date_idx').on(table.checkDate),
		check(
			'condition_checks_condition_check',
			sql`condition IN ('new', 'good', 'fair', 'poor', 'damaged')`,
		),
		check(
			'condition_checks_status_check',
			sql`status IN ('recorded', 'followed_up', 'closed')`,
		),
	],
);

/** Disposal of an item; the record stays as the financial proof. */
export const disposals = inventorySchema.table(
	'disposals',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		organizationId: organizationId(),
		code: varchar('code', { length: 32 }).notNull(),
		itemId: uuid('item_id')
			.notNull()
			.references(() => items.id, { onDelete: 'restrict' }),
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
		/** Logical reference to auth.users.id. */
		requestedBy: text('requested_by'),
		/** Logical reference to auth.users.id. */
		approvedBy: text('approved_by'),
		approvedAt: unixTimestampNullable('approved_at'),
		executedAt: unixTimestampNullable('executed_at'),
		...softDeleteTimestamps,
	},
	(table) => [
		...scopedUnique(table.organizationId, table.code, {
			orgScoped: 'disposals_org_code_uq',
			global: 'disposals_global_code_uq',
		}),
		index('disposals_item_id_idx').on(table.itemId),
		index('disposals_status_idx').on(table.status),
		check(
			'disposals_method_check',
			sql`disposal_method IN ('sale', 'scrap', 'donation', 'transfer', 'trade_in')`,
		),
		check(
			'disposals_status_check',
			sql`status IN ('draft', 'submitted', 'approved', 'executed', 'cancelled')`,
		),
		check('disposals_proceeds_check', sql`proceeds_amount >= 0`),
		check('disposals_book_value_check', sql`book_value_at_disposal >= 0`),
	],
);

/* ------------------------------------------------------------------------ *
 * inventory.tool_sets (+ items)
 * ------------------------------------------------------------------------ */

/** Tool kit lent to a technician as one unit (ADR-0024 Q37). */
export const toolSets = inventorySchema.table(
	'tool_sets',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		organizationId: organizationId(),
		code: varchar('code', { length: 32 }).notNull(),
		name: text('name').notNull(),
		description: text('description'),
		/** Logical reference to human_resource.employees.id — FK omitted. */
		custodianEmployeeId: uuid('custodian_employee_id'),
		status: text('status').notNull().default('available'),
		...softDeleteTimestamps,
	},
	(table) => [
		...scopedUnique(table.organizationId, table.code, {
			orgScoped: 'tool_sets_org_code_uq',
			global: 'tool_sets_global_code_uq',
		}),
		index('tool_sets_custodian_employee_id_idx').on(table.custodianEmployeeId),
		check(
			'tool_sets_status_check',
			sql`status IN ('available', 'lent', 'maintenance', 'retired')`,
		),
	],
);

/** Line of a tool set: which item unit composes the kit. */
export const toolSetItems = inventorySchema.table(
	'tool_set_items',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		organizationId: organizationId(),
		toolSetId: uuid('tool_set_id')
			.notNull()
			.references(() => toolSets.id, { onDelete: 'cascade' }),
		itemId: uuid('item_id')
			.notNull()
			.references(() => items.id, { onDelete: 'restrict' }),
		quantity: numeric('quantity', { precision: 18, scale: 3 })
			.notNull()
			.default('1'),
		...softDeleteTimestamps,
	},
	(table) => [
		index('tool_set_items_tool_set_id_idx').on(table.toolSetId),
		index('tool_set_items_item_id_idx').on(table.itemId),
		uniqueIndex('tool_set_items_uq')
			.on(table.toolSetId, table.itemId)
			.where(sql`deleted_at IS NULL`),
		check('tool_set_items_quantity_check', sql`quantity > 0`),
	],
);

/* ------------------------------------------------------------------------ *
 * inventory.settings / inventory.code_numberings
 * ------------------------------------------------------------------------ */

/** Inventory module configuration key value store (ADR-0024 Q27). */
export const inventorySettings = inventorySchema.table(
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
		uniqueIndex('inventory_settings_scope_uq')
			.on(table.settingGroup, table.settingKey)
			.where(sql`deleted_at IS NULL`),
		check(
			'inventory_settings_value_type_check',
			sql`value_type IN ('string', 'number', 'boolean', 'json', 'date')`,
		),
	],
);

export const inventoryCodeNumberings =
	createCodeNumberingTable(inventorySchema);

/* ------------------------------------------------------------------------ *
 * Inferred types
 * ------------------------------------------------------------------------ */

export type TItemSerialSelect = typeof itemSerials.$inferSelect;
export type TItemSerialInsert = typeof itemSerials.$inferInsert;
export type TItemSelect = typeof items.$inferSelect;
export type TItemImageSelect = typeof itemImages.$inferSelect;
export type TItemInsert = typeof items.$inferInsert;
export type TItemCategorySelect = typeof itemCategories.$inferSelect;
export type TItemCategoryInsert = typeof itemCategories.$inferInsert;
export type TInventoryDocumentSelect = typeof inventoryDocuments.$inferSelect;
export type TInventoryDocumentInsert = typeof inventoryDocuments.$inferInsert;
export type TMovementSelect = typeof movements.$inferSelect;
export type TMovementInsert = typeof movements.$inferInsert;
export type TStockSelect = typeof stocks.$inferSelect;
export type TStockInsert = typeof stocks.$inferInsert;
export type TStockAdjustmentSelect = typeof stockAdjustments.$inferSelect;
export type TStockAdjustmentInsert = typeof stockAdjustments.$inferInsert;
export type TStockAdjustmentItemSelect =
	typeof stockAdjustmentItems.$inferSelect;
export type TStockAdjustmentItemInsert =
	typeof stockAdjustmentItems.$inferInsert;
export type TBorrowingRequestSelect = typeof borrowingRequests.$inferSelect;
export type TBorrowingRequestInsert = typeof borrowingRequests.$inferInsert;
export type TBorrowingSelect = typeof borrowings.$inferSelect;
export type TBorrowingInsert = typeof borrowings.$inferInsert;
export type TBorrowingItemSelect = typeof borrowingItems.$inferSelect;
export type TBorrowingItemInsert = typeof borrowingItems.$inferInsert;
export type TBorrowingEventSelect = typeof borrowingEvents.$inferSelect;
export type TBorrowingEventInsert = typeof borrowingEvents.$inferInsert;
export type TBorrowingRequestEventSelect = typeof borrowingRequestEvents.$inferSelect;
export type TBorrowingRequestEventInsert = typeof borrowingRequestEvents.$inferInsert;
export type TMaintenanceSelect = typeof maintenances.$inferSelect;
export type TMaintenanceInsert = typeof maintenances.$inferInsert;
export type TConditionCheckSelect = typeof conditionChecks.$inferSelect;
export type TConditionCheckInsert = typeof conditionChecks.$inferInsert;
export type TDisposalSelect = typeof disposals.$inferSelect;
export type TDisposalInsert = typeof disposals.$inferInsert;
export type TToolSetSelect = typeof toolSets.$inferSelect;
export type TToolSetInsert = typeof toolSets.$inferInsert;
export type TToolSetItemSelect = typeof toolSetItems.$inferSelect;
export type TToolSetItemInsert = typeof toolSetItems.$inferInsert;
export type TInventorySettingSelect = typeof inventorySettings.$inferSelect;
export type TInventorySettingInsert = typeof inventorySettings.$inferInsert;
export type TInventoryCodeNumberingSelect =
	typeof inventoryCodeNumberings.$inferSelect;
export type TInventoryCodeNumberingInsert =
	typeof inventoryCodeNumberings.$inferInsert;
