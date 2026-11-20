/**
 * Product module schema — owns the `product` Postgres schema (ADR-0026).
 *
 * @remarks
 * Split out of `inventory`: the product (SKU) master with its website listing
 * columns (ADR-0024 Q14), the product categories, the module settings and the
 * code series of products, materials and components.
 *
 * Stock balances, the stock ledger and serial units stay in `inventory`, which
 * points at `product.products` through plain nullable ids (ADR-0014).
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

export const productSchema = pgSchema('product');

/* ------------------------------------------------------------------------ *
 * Vocabularies
 * ------------------------------------------------------------------------ */

/** Product kinds: consumables only. Tools are `items`, services neither. */
export const PRODUCT_KINDS = ['product', 'component', 'material'] as const;
export type ProductKind = (typeof PRODUCT_KINDS)[number];

/** Fixed unit list (ADR-0011), guarded by a CHECK. */
export const ITEM_UNITS = [
	'pcs',
	'unit',
	'set',
	'paket',
	'titik',
	'm',
	'roll',
	'kg',
	'jam',
	'bulan',
	'tahun',
	'lic',
	'lot',
	'pulau',
] as const;
export type ItemUnit = (typeof ITEM_UNITS)[number];

/** What the public website shows when nothing is available. */
export const PRICE_MODES = ['list', 'rfq'] as const;
export type PriceMode = (typeof PRICE_MODES)[number];
export const OUT_OF_STOCK_MODES = ['out', 'preorder', 'request'] as const;
export type OutOfStockMode = (typeof OUT_OF_STOCK_MODES)[number];

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

const money = (name: string) => bigint(name, { mode: 'number' });

/* ------------------------------------------------------------------------ *
 * product.products
 * ------------------------------------------------------------------------ */

/**
 * Product (SKU) master, plus its website listing (ADR-0024 Q14).
 *
 * @remarks
 * One product master for the whole ERP; `catalog.items` is superseded
 * (ADR-0008). `product_kind` is product|component|material only — physical tools
 * are `inventory.items` and services are neither stocked nor serialized.
 */
export const products = productSchema.table(
	'products',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		organizationId: organizationId(),
		/** Human reference from the numbering authority; immutable. */
		code: varchar('code', { length: 32 }).notNull(),
		/** Manufacturer/business SKU, typed by the user; immutable. */
		sku: varchar('sku', { length: 64 }).notNull(),
		serialNumber: text('serial_number'),
		name: text('name').notNull(),
		description: text('description'),
		productKind: text('product_kind').notNull(),
		productCategoryId: uuid('product_category_id').references(
			() => productCategories.id,
			{ onDelete: 'restrict' },
		),
		brand: varchar('brand', { length: 100 }),
		specification: text('specification'),
		imageObjectKey: text('image_object_key'),
		unitLabel: varchar('unit_label', { length: 32 }).notNull().default('pcs'),
		isActive: boolean('is_active').notNull().default(true),
		isSerialized: boolean('is_serialized').notNull().default(false),
		isStockTracked: boolean('is_stock_tracked').notNull().default(true),
		minStockQty: numeric('min_stock_qty', { precision: 18, scale: 3 })
			.notNull()
			.default('0'),
		barcode: text('barcode'),
		/** Exact integer IDR minor units (ADR-0002). Never a float. */
		sellingPrice: money('selling_price').notNull().default(0),
		purchasePrice: money('purchase_price').notNull().default(0),
		currencyCode: varchar('currency_code', { length: 3 })
			.notNull()
			.default('IDR'),
		// --- website listing (was catalog.web_listings) ---
		slug: varchar('slug', { length: 120 }),
		isPublished: boolean('is_published').notNull().default(false),
		publishedAt: unixTimestampNullable('published_at'),
		listingSpecs: varchar('listing_specs', { length: 400 }),
		priceMode: text('price_mode').notNull().default('list'),
		priceCaption: varchar('price_caption', { length: 120 }),
		outOfStockMode: text('out_of_stock_mode').notNull().default('request'),
		leadTimeLabel: varchar('lead_time_label', { length: 60 }),
		applications: jsonb('applications')
			.$type<string[]>()
			.notNull()
			.default([]),
		popularity: integer('popularity').notNull().default(0),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		createdBy: text('created_by'),
		...softDeleteTimestamps,
	},
	(table) => [
		...scopedUnique(table.organizationId, table.code, {
			orgScoped: 'products_org_code_uq',
			global: 'products_global_code_uq',
		}),
		...scopedUnique(table.organizationId, table.sku, {
			orgScoped: 'products_org_sku_uq',
			global: 'products_global_sku_uq',
		}),
		uniqueIndex('products_slug_uq')
			.on(table.slug)
			.where(sql`deleted_at IS NULL AND slug IS NOT NULL`),
		index('products_kind_idx').on(table.productKind),
		index('products_org_name_idx').on(table.organizationId, table.name),
		index('products_barcode_idx').on(table.barcode),
		check(
			'products_kind_check',
			sql`product_kind IN ('product', 'component', 'material')`,
		),
		check('products_prices_check', sql`selling_price >= 0 AND purchase_price >= 0`),
		check('products_min_stock_check', sql`min_stock_qty >= 0`),
		check(
			'products_unit_label_check',
			sql`unit_label IN ('pcs', 'unit', 'set', 'paket', 'titik', 'm', 'roll', 'kg', 'jam', 'bulan', 'tahun', 'lic', 'lot', 'pulau')`,
		),
		check('products_price_mode_check', sql`price_mode IN ('list', 'rfq')`),
		check(
			'products_out_of_stock_mode_check',
			sql`out_of_stock_mode IN ('out', 'preorder', 'request')`,
		),
		check('products_popularity_check', sql`popularity >= 0`),
	],
);

/* ------------------------------------------------------------------------ *
 * product.product_categories
 * ------------------------------------------------------------------------ */

/** Product category, one level, company-wide. Was `inventory.item_categories`. */
export const productCategories = productSchema.table(
	'product_categories',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		slug: varchar('slug', { length: 64 }).notNull(),
		name: varchar('name', { length: 120 }).notNull(),
		shortName: varchar('short_name', { length: 60 }),
		sortOrder: integer('sort_order').notNull().default(0),
		description: text('description'),
		isActive: boolean('is_active').notNull().default(true),
		createdAt: unixTimestamp('created_at').notNull(),
		updatedAt: unixTimestamp('updated_at')
			.notNull()
			.$onUpdate(() => new Date()),
		deletedAt: unixTimestampNullable('deleted_at'),
	},
	(table) => [
		uniqueIndex('product_categories_slug_uq')
			.on(table.slug)
			.where(sql`deleted_at IS NULL`),
	],
);

/* ------------------------------------------------------------------------ *
 * product.settings / product.code_numberings
 * ------------------------------------------------------------------------ */

/** Product module configuration key value store (ADR-0024 Q27). */
export const productSettings = productSchema.table(
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
		uniqueIndex('product_settings_scope_uq')
			.on(table.settingGroup, table.settingKey)
			.where(sql`deleted_at IS NULL`),
		check(
			'product_settings_value_type_check',
			sql`value_type IN ('string', 'number', 'boolean', 'json', 'date')`,
		),
	],
);

export const productCodeNumberings = createCodeNumberingTable(productSchema);

/* ------------------------------------------------------------------------ *
 * Inferred types
 * ------------------------------------------------------------------------ */

export type TProductSelect = typeof products.$inferSelect;
export type TProductInsert = typeof products.$inferInsert;
export type TProductCategorySelect = typeof productCategories.$inferSelect;
export type TProductCategoryInsert = typeof productCategories.$inferInsert;
export type TProductSettingSelect = typeof productSettings.$inferSelect;
export type TProductSettingInsert = typeof productSettings.$inferInsert;
export type TProductCodeNumberingSelect =
	typeof productCodeNumberings.$inferSelect;
export type TProductCodeNumberingInsert =
	typeof productCodeNumberings.$inferInsert;
