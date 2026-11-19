import { z } from 'zod';
import { OUT_OF_STOCK_MODES, PRICE_MODES } from '@drizzle/schemas/inventory.schema';

/**
 * The website catalog (M04 stage 1; listing columns live on `inventory.products` since ADR-0024 Q14): admin listing schemas, the public query
 * schemas (the website's `CatalogSource` contract). Public money is whole rupiah, as the website expects.
 */

const optionalText = (max: number) =>
	z
		.string()
		.trim()
		.max(max)
		.nullish()
		.transform((value) => (value ? value : null));

export const listingBodySchema = z.object({
	slug: z
		.string()
		.trim()
		.toLowerCase()
		.min(2)
		.max(120)
		.regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Lowercase letters, digits and single dashes'),
	specs: optionalText(400),
	priceMode: z.enum(PRICE_MODES).default('list'),
	priceCaption: optionalText(120),
	outOfStockMode: z.enum(OUT_OF_STOCK_MODES).default('request'),
	leadTimeLabel: optionalText(60),
	applications: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
	popularity: z.number().int().min(0).max(1_000_000).default(0),
});

export const publishSchema = z.object({ published: z.boolean() });
export const idParamSchema = z.object({ id: z.uuid() });
export const slugParamSchema = z.object({ slug: z.string().trim().min(1).max(120) });

const many = (inner: z.ZodType<string>) =>
	z
		.union([inner, z.array(inner)])
		.optional()
		.transform((value) => (value === undefined ? [] : Array.isArray(value) ? value : [value]));

export const STOCK_STATUSES = ['ready', 'preorder', 'request', 'out'] as const;
export type TStockStatus = (typeof STOCK_STATUSES)[number];
export const SORTS = ['popular', 'newest', 'price-asc', 'price-desc'] as const;

export const productQuerySchema = z.object({
	q: z.string().trim().max(100).optional(),
	category: many(z.string().max(120)),
	availability: many(z.enum(STOCK_STATUSES)),
	application: many(z.string().max(80)),
	min: z.coerce.number().min(0).optional(),
	max: z.coerce.number().min(0).optional(),
	sort: z.enum(SORTS).default('popular'),
	page: z.coerce.number().int().min(1).default(1),
	pageSize: z.coerce.number().int().min(1).max(60).default(12),
});

export const slugsQuerySchema = z.object({ slug: many(z.string().max(120)).pipe(z.array(z.string()).max(100)) });
export const searchQuerySchema = z.object({ q: z.string().trim().max(100).default(''), limit: z.coerce.number().int().min(1).max(20).default(6) });
export const cartSchema = z.object({
	lines: z
		.array(z.object({ productSlug: z.string().max(120), quantity: z.number().int().min(1).max(10_000), options: z.record(z.string(), z.string()).optional() }))
		.max(100),
});

export type TListingBody = z.output<typeof listingBodySchema>;
export type TProductQuery = z.output<typeof productQuerySchema>;

