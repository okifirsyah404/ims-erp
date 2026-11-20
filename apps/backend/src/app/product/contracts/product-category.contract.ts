import { z } from 'zod';

/**
 * Request schemas for the item category endpoints (`/item-categories`).
 *
 * @remarks
 * Categories are one level and company-wide (ADR-0011). `slug` matches the
 * public website's category slug, so it is lower-case kebab.
 */

const optionalText = (max: number) =>
	z
		.string()
		.trim()
		.max(max)
		.nullish()
		.transform((value) => (value ? value : null));

/** List filter: inactive categories are hidden unless asked for. */
export const productCategoryListQuerySchema = z.object({
	includeInactive: z
		.union([z.boolean(), z.enum(['true', 'false'])])
		.transform((value) => value === true || value === 'true')
		.optional(),
});

export const createProductCategorySchema = z
	.object({
		slug: z
			.string()
			.trim()
			.toLowerCase()
			.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
			.max(64),
		name: z.string().trim().min(1).max(120),
		shortName: optionalText(60),
		sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
		description: optionalText(2000),
		isActive: z.boolean().default(true),
	})
	.strict();

export const updateProductCategorySchema = createProductCategorySchema
	.omit({ slug: true })
	.partial()
	.strict();

export type TProductCategoryCreateInput = z.output<typeof createProductCategorySchema>;
export type TProductCategoryUpdateInput = z.output<typeof updateProductCategorySchema>;
