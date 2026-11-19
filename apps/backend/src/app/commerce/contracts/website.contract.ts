import { z } from 'zod';
import {
	SOCIAL_KEYS,
	type TWebMenuItemSelect,
	type TWebMenuSelect,
	type TWebSiteInsert,
	type TWebSiteSelect,
} from '@drizzle/schemas/commerce.schema';

/**
 * Contracts of the public website's identity and navigation (ERP-0071
 * stage 1, `commerce` module): what the web admin edits and what the website
 * reads through `/public/v1/site`.
 */

/** Menu codes the website asks for: the header and the footer (its child menus are columns). */
export const WEB_MENU_CODES = ['main', 'footer'] as const;
export type TWebMenuCode = (typeof WEB_MENU_CODES)[number];

const optionalText = (max: number) =>
	z
		.string()
		.trim()
		.max(max)
		.nullish()
		.transform((value) => (value ? value : null));

/** A site path (`/products?category=x`) or an absolute https URL; never `javascript:` or `//host`. */
export const webUrlSchema = z
	.string()
	.trim()
	.min(1)
	.max(500)
	.refine((value) => (value.startsWith('/') && !value.startsWith('//')) || /^https:\/\/[^\s]+$/i.test(value) || /^(mailto|tel):[^\s]+$/i.test(value), {
		message: 'Use a site path starting with "/" or an https:// link',
	});

const phone = z
	.string()
	.trim()
	.max(40)
	.regex(/^[0-9+()\-\s]*$/)
	.nullish()
	.transform((value) => (value ? value : null));
const email = z
	.string()
	.trim()
	.toLowerCase()
	.max(254)
	.pipe(z.email())
	.nullish()
	.or(z.literal('').transform(() => null))
	.transform((value) => (value ? value : null));

export const webSiteBodySchema = z.object({
	brandName: z.string().trim().min(1).max(120),
	legalName: optionalText(200),
	tagline: optionalText(200),
	address: optionalText(500),
	phone,
	email,
	whatsapp: phone,
	hotlineHours: optionalText(120),
	supportEmail: email,
	supportWhatsapp: phone,
	socialLinks: z
		.array(z.object({ key: z.enum(SOCIAL_KEYS), url: z.string().trim().max(500).regex(/^https:\/\/[^\s]+$/i, 'Use an https:// link') }))
		.max(SOCIAL_KEYS.length)
		.default([])
		.refine((links) => new Set(links.map((link) => link.key)).size === links.length, { message: 'Each network once' }),
	defaultSeoTitle: optionalText(120),
	defaultSeoDescription: optionalText(320),
});

const menuItemSchema = z.object({
	label: z.string().trim().min(1).max(80),
	url: webUrlSchema,
	isActive: z.boolean().default(true),
});

/**
 * A whole menu, replaced at once: its items and (footer) its child menus,
 * each with its own items. Order is the array order.
 */
export const webMenuBodySchema = z.object({
	name: z.string().trim().min(1).max(80),
	items: z.array(menuItemSchema).max(30).default([]),
	children: z
		.array(z.object({ name: z.string().trim().min(1).max(80), isActive: z.boolean().default(true), items: z.array(menuItemSchema).max(30) }))
		.max(8)
		.default([]),
});

export const webMenuCodeParamSchema = z.object({ code: z.enum(WEB_MENU_CODES) });

export const websiteKeyCreateSchema = z.object({ name: z.string().trim().min(1).max(80) });
export const websiteKeyIdParamSchema = z.object({ id: z.string().trim().min(1).max(128) });

export type TWebSiteBody = z.output<typeof webSiteBodySchema>;
export type TWebMenuBody = z.output<typeof webMenuBodySchema>;

/** One menu as both the web admin and the website read it. */
export type TWebMenuView = {
	code: string;
	name: string;
	items: { label: string; url: string; isActive: boolean }[];
	children: { name: string; isActive: boolean; items: { label: string; url: string; isActive: boolean }[] }[];
};

/** A website API key as the web admin lists it; the secret is shown once, at creation. */
export type TWebsiteKeyView = { id: string; name: string | null; start: string | null; enabled: boolean; createdAt: string; lastRequest: string | null };

/** A whole menu tree to store: the root menu, its items, and child menus with their items. */
export type TMenuTreeWrite = {
	root: { code: string; name: string };
	items: { label: string; url: string; isActive: boolean }[];
	children: { name: string; isActive: boolean; items: { label: string; url: string; isActive: boolean }[] }[];
};

/** Persistence port for `commerce.web_sites`, `web_menus`, `web_menu_items` (live rows only). */
export interface IWebsiteRepository {
	findSite(siteKey: string): Promise<TWebSiteSelect | null>;
	/** Creates or updates the live site row of `siteKey`. */
	upsertSite(siteKey: string, data: Omit<TWebSiteInsert, 'id' | 'siteKey' | 'createdAt' | 'updatedAt' | 'deletedAt'>): Promise<TWebSiteSelect>;
	/** A root menu (no parent) by code, its child menus and every live item of both. */
	findMenuTree(code: string): Promise<{ root: TWebMenuSelect; children: TWebMenuSelect[]; items: TWebMenuItemSelect[] } | null>;
	/**
	 * Replaces a root menu's items and child menus in one transaction: the old
	 * children and items are soft-deleted, the new ones inserted in order.
	 */
	replaceMenuTree(tree: TMenuTreeWrite): Promise<void>;
}

/** Website API keys (Better Auth API key plugin, config `website`, prefix `ewk_`). */
export interface IWebsiteKeyIssuer {
	/** Creates an organization-owned key as the acting member; the plaintext is returned once. */
	issue(input: { organizationId: string; issuerUserId: string; name: string }): Promise<{ id: string; key: string; start: string | null }>;
	/** The organization's website keys, read with the caller's session. */
	list(input: { organizationId: string; headers: Headers }): Promise<TWebsiteKeyView[]>;
	/** Disables a key for good, as the acting member. */
	disable(input: { apiKeyId: string; actorUserId: string }): Promise<void>;
}
