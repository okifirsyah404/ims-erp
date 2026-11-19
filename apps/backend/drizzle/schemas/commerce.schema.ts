/**
 * Commerce domain schema — owns the `commerce` Postgres schema. Built so far
 * (ERP-0071 stage 1): `web_sites`, `web_menus`, `web_menu_items` — the public
 * website's identity, contact, social links, default SEO and navigation.
 *
 * House rules honoured here:
 * - **Company-wide, no `organization_id`** (ADR-0012): the public website
 *   belongs to the company, like `catalog.web_listings`.
 * - Soft delete with live-row partial unique indexes; unix-ms timestamps.
 * - `web_menu_items.web_page_id` lands with `web_pages` (stage 4).
 */
import { sql } from 'drizzle-orm';
import { boolean, foreignKey, index, integer, jsonb, pgSchema, text, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { unixTimestamp, unixTimestampNullable } from '@drizzle/datatypes/unix-timestamp';

export const commerceSchema = pgSchema('commerce');

/** Social networks the website can link to. */
export const SOCIAL_KEYS = ['instagram', 'linkedin', 'youtube', 'facebook', 'tiktok', 'x', 'whatsapp'] as const;
export type SocialKey = (typeof SOCIAL_KEYS)[number];
export type TSocialLink = { key: SocialKey; url: string };

const timestamps = {
	createdAt: unixTimestamp('created_at').notNull(),
	updatedAt: unixTimestamp('updated_at')
		.notNull()
		.$onUpdate(() => new Date()),
	deletedAt: unixTimestampNullable('deleted_at'),
};

export const webSites = commerceSchema.table(
	'web_sites',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		siteKey: varchar('site_key', { length: 32 }).notNull().default('default'),
		brandName: text('brand_name').notNull(),
		legalName: text('legal_name'),
		tagline: text('tagline'),
		address: text('address'),
		phone: varchar('phone', { length: 40 }),
		email: varchar('email', { length: 254 }),
		whatsapp: varchar('whatsapp', { length: 40 }),
		hotlineHours: text('hotline_hours'),
		supportEmail: varchar('support_email', { length: 254 }),
		supportWhatsapp: varchar('support_whatsapp', { length: 40 }),
		socialLinks: jsonb('social_links').$type<TSocialLink[]>().notNull().default([]),
		defaultSeoTitle: text('default_seo_title'),
		defaultSeoDescription: text('default_seo_description'),
		/** Logical reference to auth.users.id (ADR-0014, nullable). */
		updatedByUserId: text('updated_by_user_id'),
		...timestamps,
	},
	(table) => [uniqueIndex('web_sites_site_key_uq').on(table.siteKey).where(sql`deleted_at IS NULL`)],
);

export const webMenus = commerceSchema.table(
	'web_menus',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		code: varchar('code', { length: 32 }).notNull(),
		name: text('name').notNull(),
		parentMenuId: uuid('parent_menu_id'),
		position: integer('position').notNull().default(0),
		isActive: boolean('is_active').notNull().default(true),
		...timestamps,
	},
	(table) => [
		uniqueIndex('web_menus_code_uq').on(table.code).where(sql`deleted_at IS NULL`),
		index('web_menus_parent_menu_id_idx').on(table.parentMenuId),
		foreignKey({ columns: [table.parentMenuId], foreignColumns: [table.id], name: 'web_menus_parent_menu_id_fk' }).onDelete('set null'),
	],
);

export const webMenuItems = commerceSchema.table(
	'web_menu_items',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		webMenuId: uuid('web_menu_id')
			.notNull()
			.references(() => webMenus.id, { onDelete: 'cascade' }),
		label: text('label').notNull(),
		url: text('url'),
		position: integer('position').notNull().default(0),
		isActive: boolean('is_active').notNull().default(true),
		...timestamps,
	},
	(table) => [index('web_menu_items_menu_id_idx').on(table.webMenuId)],
);

export type TWebSiteSelect = typeof webSites.$inferSelect;
export type TWebSiteInsert = typeof webSites.$inferInsert;
export type TWebMenuSelect = typeof webMenus.$inferSelect;
export type TWebMenuInsert = typeof webMenus.$inferInsert;
export type TWebMenuItemSelect = typeof webMenuItems.$inferSelect;
export type TWebMenuItemInsert = typeof webMenuItems.$inferInsert;
