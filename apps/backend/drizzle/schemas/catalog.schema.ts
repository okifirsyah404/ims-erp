/**
 * Catalog domain schema — owns the `catalog` Postgres schema. Built so far:
 * `web_listings` (M04 stage 1), what the public website shows of an
 * inventory item.
 *
 * House rules honoured here:
 * - **Company-wide, no `organization_id`** (ADR-0012).
 * - The item itself (name, category, price, photo, stock) stays in
 *   `inventory`; `item_id` is a plain id validated through the Inventory
 *   contract.
 */
import { sql } from 'drizzle-orm';
import { boolean, check, index, integer, jsonb, pgSchema, text, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { unixTimestamp, unixTimestampNullable } from '@drizzle/datatypes/unix-timestamp';

export const catalogSchema = pgSchema('catalog');

export const PRICE_MODES = ['list', 'rfq'] as const;
export type PriceMode = (typeof PRICE_MODES)[number];

/** What the website shows when nothing is available. */
export const OUT_OF_STOCK_MODES = ['out', 'preorder', 'request'] as const;
export type OutOfStockMode = (typeof OUT_OF_STOCK_MODES)[number];

export const webListings = catalogSchema.table(
	'web_listings',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		/** Logical reference to inventory.items.id. */
		itemId: uuid('item_id').notNull(),
		slug: varchar('slug', { length: 120 }).notNull(),
		isPublished: boolean('is_published').notNull().default(false),
		publishedAt: unixTimestampNullable('published_at'),
		specs: varchar('specs', { length: 400 }),
		priceMode: text('price_mode').$type<PriceMode>().notNull().default('list'),
		priceCaption: varchar('price_caption', { length: 120 }),
		outOfStockMode: text('out_of_stock_mode').$type<OutOfStockMode>().notNull().default('request'),
		leadTimeLabel: varchar('lead_time_label', { length: 60 }),
		applications: jsonb('applications').$type<string[]>().notNull().default([]),
		popularity: integer('popularity').notNull().default(0),
		createdBy: text('created_by'),
		createdAt: unixTimestamp('created_at').notNull(),
		updatedAt: unixTimestamp('updated_at')
			.notNull()
			.$onUpdate(() => new Date()),
		deletedAt: unixTimestampNullable('deleted_at'),
	},
	(table) => [
		uniqueIndex('web_listings_slug_uq').on(table.slug).where(sql`deleted_at IS NULL`),
		uniqueIndex('web_listings_item_uq').on(table.itemId).where(sql`deleted_at IS NULL`),
		index('web_listings_published_idx').on(table.isPublished),
		check('web_listings_price_mode_check', sql`${table.priceMode} IN ('list', 'rfq')`),
		check('web_listings_out_of_stock_mode_check', sql`${table.outOfStockMode} IN ('out', 'preorder', 'request')`),
		check('web_listings_popularity_check', sql`${table.popularity} >= 0`),
	],
);

export type TWebListingSelect = typeof webListings.$inferSelect;
export type TWebListingInsert = typeof webListings.$inferInsert;
