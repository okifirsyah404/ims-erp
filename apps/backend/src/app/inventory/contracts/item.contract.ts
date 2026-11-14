import { z } from 'zod';
import {
	ITEM_KINDS,
	ITEM_UNITS,
	UNIT_STATUSES,
} from '@drizzle/schemas/inventory.schema';

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

/** List filter for items. */
export const itemListQuerySchema = inventoryPaginationSchema.extend({
	search: z.string().min(1).optional(),
	itemKind: z.enum(ITEM_KINDS).optional(),
	categoryId: z.uuid().optional(),
	/** `true` = only items offered for new documents (pickers). */
	activeOnly: z
		.union([z.boolean(), z.enum(['true', 'false'])])
		.transform((value) => value === true || value === 'true')
		.optional(),
	/**
	 * Scope the list to items with at least one live unit in this warehouse.
	 * Used by the warehouse detail page's kind tabs.
	 */
	warehouseId: z.uuid().optional(),
	includeArchived: z
		.union([z.boolean(), z.enum(['true', 'false'])])
		.transform((value) => value === true || value === 'true')
		.optional(),
});

/**
 * Body for creating an item.
 *
 * @remarks
 * `code` is deliberately absent: ERP-0043 allocates it from the numbering
 * authority (`PRD-`/`MAT-`/`CMP-` per kind), and `.strict()` rejects a client
 * that tries to send one. `sku` stays user-typed and required.
 */
export const createItemSchema = z
	.object({
		organizationId: z.string().min(1).nullable().optional(),
		sku: z.string().min(1).max(64),
		serialNumber: z.string().trim().max(200).nullable().optional(),
		name: z.string().min(1),
		description: z.string().nullable().optional(),
		itemKind: z.enum(ITEM_KINDS),
		categoryId: z.uuid().nullable().optional(),
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
		barcode: z.string().nullable().optional(),
		sellingPrice: z.coerce.number().int().min(0).default(0),
		purchasePrice: z.coerce.number().int().min(0).default(0),
		currencyCode: z.string().length(3).default('IDR'),
	})
	.strict();

/** Body for updating an item. `code`, `sku` and `itemKind` are immutable. */
export const updateItemSchema = z
	.object({
		name: z.string().min(1).optional(),
		description: z.string().nullable().optional(),
		serialNumber: z.string().trim().max(200).nullable().optional(),
		categoryId: z.uuid().nullable().optional(),
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
		barcode: z.string().nullable().optional(),
		sellingPrice: z.coerce.number().int().min(0).optional(),
		purchasePrice: z.coerce.number().int().min(0).optional(),
		currencyCode: z.string().length(3).optional(),
	})
	.strict();

/** List filter for units. */
export const unitListQuerySchema = inventoryPaginationSchema.extend({
	itemId: z.uuid().optional(),
	status: z.enum(UNIT_STATUSES).optional(),
	warehouseId: z.uuid().optional(),
});

/** Body for registering a unit. */
export const createUnitSchema = z
	.object({
		serialNumber: z.string().min(1),
		organizationId: z.string().min(1).nullable().optional(),
		status: z.enum(UNIT_STATUSES).default('in_stock'),
		warehouseId: z.uuid().nullable().optional(),
		binId: z.uuid().nullable().optional(),
		assetTag: z.string().nullable().optional(),
		acquiredOn: z.iso.date().nullable().optional(),
		warrantyExpiresOn: z.iso.date().nullable().optional(),
		notes: z.string().nullable().optional(),
	})
	.strict();

/** Body for replacing a provisional serial. */
export const replaceSerialSchema = z
	.object({ serialNumber: z.string().min(1) })
	.strict();

/** Path params carrying a uuid id. */
export const idParamSchema = z.object({ id: z.uuid() });
