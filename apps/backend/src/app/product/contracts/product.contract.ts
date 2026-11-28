import { z } from 'zod';
import { ITEM_UNITS, PRODUCT_KINDS } from '@drizzle/schemas/product.schema';

/**
 * Request/response schemas for the item and unit endpoints.
 *
 * @remarks
 * Parsed at the controller boundary; the service refines. Pagination follows
 * `api-conventions.md`: 1-based `page`, `limit` capped at 100.
 */

/** Pagination shared by every list endpoint in this module. */
export const inventoryPaginationSchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
});

/** List filter for products. */
export const productListQuerySchema = inventoryPaginationSchema.extend({
	search: z.string().min(1).optional(),
	productKind: z.enum(PRODUCT_KINDS).optional(),
	productCategoryId: z.uuid().optional(),
	/** `true` = only products offered for new documents (pickers). */
	activeOnly: z
		.union([z.boolean(), z.enum(['true', 'false'])])
		.transform((value) => value === true || value === 'true')
		.optional(),
	/** Lifecycle filter; `activeOnly` is the older shorthand for `active`. */
	status: z.enum(['all', 'active', 'inactive']).optional(),
	/** Selling price range, integer IDR minor units, both ends inclusive. */
	minPrice: z.coerce.number().int().min(0).optional(),
	maxPrice: z.coerce.number().int().min(0).optional(),
	/**
	 * On-hand range: the available quantity summed over every warehouse bin.
	 * A product with no stock row counts as 0.
	 */
	minStock: z.coerce.number().min(0).optional(),
	maxStock: z.coerce.number().min(0).optional(),
	sortBy: z.enum(['name', 'code', 'price']).optional(),
	sortDir: z.enum(['asc', 'desc']).optional(),
	/**
	 * Scope the list to products with at least one live unit in this warehouse.
	 * Used by the warehouse detail page's kind tabs.
	 */
	warehouseId: z.uuid().optional(),
	includeArchived: z
		.union([z.boolean(), z.enum(['true', 'false'])])
		.transform((value) => value === true || value === 'true')
		.optional(),
});

/** Query for the slider bounds of the list filters. */
export const productRangesQuerySchema = z.object({
	productKind: z.enum(PRODUCT_KINDS).optional(),
});

/**
 * Body for creating an item.
 *
 * @remarks
 * `code` is deliberately absent: ERP-0043 allocates it from the numbering
 * authority (`PRD-`/`MAT-`/`CMP-` per kind), and `.strict()` rejects a client
 * that tries to send one. `sku` stays user-typed and required.
 */
export const createProductSchema = z
	.object({
		organizationId: z.string().min(1).nullable().optional(),
		sku: z.string().min(1).max(64),
		serialNumber: z.string().trim().max(200).nullable().optional(),
		name: z.string().min(1),
		description: z.string().nullable().optional(),
		productKind: z.enum(PRODUCT_KINDS),
		productCategoryId: z.uuid().nullable().optional(),
		brand: z.string().trim().max(100).nullable().optional(),
		specification: z.string().max(4000).nullable().optional(),
		unitLabel: z.enum(ITEM_UNITS).default('pcs'),
		isActive: z.boolean().default(true),
		isSerialized: z.boolean().default(false),
		isStockTracked: z.boolean().default(true),
		/** Stored as `numeric(18,3)`, so the insert value is a decimal string. */
		minStockQty: z.coerce
			.number()
			.min(0)
			.default(0)
			.transform((value) => value.toFixed(3)),
		/** B-30: standard customer warranty in months for a sale without a project; null = none. */
		warrantyMonths: z.coerce.number().int().min(0).max(120).nullable().optional(),
		barcode: z.string().nullable().optional(),
		sellingPrice: z.coerce.number().int().min(0).default(0),
		purchasePrice: z.coerce.number().int().min(0).default(0),
		currencyCode: z.string().length(3).default('IDR'),
	})
	.strict();

/** Body for updating an item. `code`, `sku` and `productKind` are immutable. */
export const updateProductSchema = z
	.object({
		name: z.string().min(1).optional(),
		description: z.string().nullable().optional(),
		serialNumber: z.string().trim().max(200).nullable().optional(),
		productCategoryId: z.uuid().nullable().optional(),
		brand: z.string().trim().max(100).nullable().optional(),
		specification: z.string().max(4000).nullable().optional(),
		unitLabel: z.enum(ITEM_UNITS).optional(),
		isActive: z.boolean().optional(),
		isSerialized: z.boolean().optional(),
		isStockTracked: z.boolean().optional(),
		minStockQty: z.coerce
			.number()
			.min(0)
			.optional()
			.transform((value) => value?.toFixed(3)),
		warrantyMonths: z.coerce.number().int().min(0).max(120).nullable().optional(),
		barcode: z.string().nullable().optional(),
		sellingPrice: z.coerce.number().int().min(0).optional(),
		purchasePrice: z.coerce.number().int().min(0).optional(),
		currencyCode: z.string().length(3).optional(),
	})
	.strict();

/** Path params carrying a single resource id. */
/** `PUT /products/:id/components` body: the whole composition, in order. */
export const productComponentsSchema = z.object({
	lines: z
		.array(
			z.object({
				componentId: z.uuid(),
				/** `numeric(18,3)`: positive, at most three decimals. */
				quantity: z.coerce
					.number()
					.positive()
					.refine((value) => Math.abs(value * 1000 - Math.round(value * 1000)) < 1e-6),
			}),
		)
		.max(50)
		.refine((lines) => new Set(lines.map((line) => line.componentId)).size === lines.length),
});

export { idParamSchema } from './../../inventory/contracts/pagination.contract';
