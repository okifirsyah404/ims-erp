import { z } from 'zod';
import {
	ITEM_STATUSES,
	ITEM_KINDS,
	DEPRECIATION_METHODS,
} from '@drizzle/schemas/inventory.schema';

/** Shared `:id` param. */
export const itemIdParamSchema = z.object({ id: z.string().uuid() });

export const itemCategoryCreateSchema = z.object({
	organizationId: z.string().optional(),
	code: z.string().min(1).max(32),
	name: z.string().min(1),
	parentCategoryId: z.string().uuid().nullish(),
	itemKind: z.enum(ITEM_KINDS).default('equipment'),
	defaultUsefulLifeMonths: z.number().int().positive().nullish(),
	defaultDepreciationMethod: z.enum(DEPRECIATION_METHODS).default('straight_line'),
	isActive: z.boolean().default(true),
});

export const itemCategoryUpdateSchema = z
	.object({
		name: z.string().min(1).optional(),
		parentCategoryId: z.string().uuid().nullable().optional(),
		itemKind: z.enum(ITEM_KINDS).optional(),
		defaultUsefulLifeMonths: z.number().int().positive().nullable().optional(),
		defaultDepreciationMethod: z.enum(DEPRECIATION_METHODS).optional(),
		isActive: z.boolean().optional(),
	})
	.refine((data) => Object.keys(data).length > 0, {
		message: 'At least one field is required',
	});

export const itemCategoryListQuerySchema = z.object({
	page: z.coerce.number().int().positive().default(1),
	limit: z.coerce.number().int().positive().max(100).default(20),
	search: z.string().optional(),
	itemKind: z.string().optional(),
	includeArchived: z
		.enum(['true', 'false'])
		.default('false')
		.transform((value) => value === 'true'),
});

export const createItemSchema = z.object({
	name: z.string().min(1),
	description: z.string().nullish(),
	itemCategoryId: z.string().uuid().nullish(),
	itemKind: z.enum(ITEM_KINDS).default('equipment'),
	serialNumber: z.string().nullish(),
	barcode: z.string().nullish(),
	acquisitionDate: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/)
		.nullish(),
	acquisitionCost: z.number().int().min(0).default(0),
	salvageValue: z.number().int().min(0).default(0),
	currencyCode: z.string().length(3).default('IDR'),
	usefulLifeMonths: z.number().int().positive().nullish(),
	depreciationMethod: z.enum(DEPRECIATION_METHODS).default('straight_line'),
	depreciationStartedOn: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/)
		.nullish(),
	condition: z.enum(['new', 'good', 'fair', 'poor', 'damaged']).default('good'),
	locationDescription: z.string().nullish(),
	/** Optional display image URL for the asset card. */
	imageUrl: z.url().max(2048).nullish(),
	custodianEmployeeId: z.string().uuid().nullish(),
	supplierCompanyId: z.string().uuid().nullish(),
	purchaseOrderId: z.string().uuid().nullish(),
	documentId: z.string().uuid().nullish(),
});

export const updateItemSchema = z
	.object({
		name: z.string().min(1).optional(),
		description: z.string().nullable().optional(),
		itemCategoryId: z.string().uuid().nullable().optional(),
		serialNumber: z.string().nullable().optional(),
		barcode: z.string().nullable().optional(),
		acquisitionDate: z
			.string()
			.regex(/^\d{4}-\d{2}-\d{2}$/)
			.nullable()
			.optional(),
		acquisitionCost: z.number().int().min(0).optional(),
		salvageValue: z.number().int().min(0).optional(),
		currencyCode: z.string().length(3).optional(),
		usefulLifeMonths: z.number().int().positive().nullable().optional(),
		depreciationMethod: z.enum(DEPRECIATION_METHODS).optional(),
		depreciationStartedOn: z
			.string()
			.regex(/^\d{4}-\d{2}-\d{2}$/)
			.nullable()
			.optional(),
		locationDescription: z.string().nullable().optional(),
		/** Optional display image URL for the asset card. */
		imageUrl: z.url().max(2048).nullable().optional(),
		custodianEmployeeId: z.string().uuid().nullable().optional(),
		supplierCompanyId: z.string().uuid().nullable().optional(),
		purchaseOrderId: z.string().uuid().nullable().optional(),
		documentId: z.string().uuid().nullable().optional(),
	})
	.refine((data) => Object.keys(data).length > 0, {
		message: 'At least one field is required',
	});

export const itemListQuerySchema = z.object({
	page: z.coerce.number().int().positive().default(1),
	limit: z.coerce.number().int().positive().max(100).default(20),
	search: z.string().optional(),
	status: z.enum(ITEM_STATUSES).optional(),
	itemKind: z.string().optional(),
	itemCategoryId: z.string().uuid().optional(),
	includeArchived: z
		.enum(['true', 'false'])
		.default('false')
		.transform((value) => value === 'true'),
});

export const itemDeactivateSchema = z.object({
	reason: z.string().min(1).max(500),
});

export type TItemCreateInput = z.infer<typeof createItemSchema>;
export type TItemUpdateInput = z.infer<typeof updateItemSchema>;
export type TItemListQuery = z.infer<typeof itemListQuerySchema>;
export type TItemCategoryCreateInput = z.infer<typeof itemCategoryCreateSchema>;
export type TItemCategoryUpdateInput = z.infer<typeof itemCategoryUpdateSchema>;
export type TItemCategoryListQuery = z.infer<typeof itemCategoryListQuerySchema>;
