import { z } from 'zod';
import {
	ASSET_STATUSES,
	ASSET_TYPES,
	DEPRECIATION_METHODS,
} from '@drizzle/schemas/asset.schema';

/** Shared `:id` param. */
export const assetIdParamSchema = z.object({ id: z.string().uuid() });

export const assetCategoryCreateSchema = z.object({
	organizationId: z.string().optional(),
	code: z.string().min(1).max(32),
	name: z.string().min(1),
	parentCategoryId: z.string().uuid().nullish(),
	assetType: z.enum(ASSET_TYPES).default('equipment'),
	defaultUsefulLifeMonths: z.number().int().positive().nullish(),
	defaultDepreciationMethod: z.enum(DEPRECIATION_METHODS).default('straight_line'),
	isActive: z.boolean().default(true),
});

export const assetCategoryUpdateSchema = z
	.object({
		name: z.string().min(1).optional(),
		parentCategoryId: z.string().uuid().nullable().optional(),
		assetType: z.enum(ASSET_TYPES).optional(),
		defaultUsefulLifeMonths: z.number().int().positive().nullable().optional(),
		defaultDepreciationMethod: z.enum(DEPRECIATION_METHODS).optional(),
		isActive: z.boolean().optional(),
	})
	.refine((data) => Object.keys(data).length > 0, {
		message: 'At least one field is required',
	});

export const assetCategoryListQuerySchema = z.object({
	page: z.coerce.number().int().positive().default(1),
	limit: z.coerce.number().int().positive().max(100).default(20),
	search: z.string().optional(),
	assetType: z.string().optional(),
	includeArchived: z
		.enum(['true', 'false'])
		.default('false')
		.transform((value) => value === 'true'),
});

export const assetCreateSchema = z.object({
	name: z.string().min(1),
	description: z.string().nullish(),
	categoryId: z.string().uuid().nullish(),
	assetType: z.enum(ASSET_TYPES).default('equipment'),
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
	supplierId: z.string().uuid().nullish(),
	purchaseOrderId: z.string().uuid().nullish(),
	documentId: z.string().uuid().nullish(),
});

export const assetUpdateSchema = z
	.object({
		name: z.string().min(1).optional(),
		description: z.string().nullable().optional(),
		categoryId: z.string().uuid().nullable().optional(),
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
		supplierId: z.string().uuid().nullable().optional(),
		purchaseOrderId: z.string().uuid().nullable().optional(),
		documentId: z.string().uuid().nullable().optional(),
	})
	.refine((data) => Object.keys(data).length > 0, {
		message: 'At least one field is required',
	});

export const assetListQuerySchema = z.object({
	page: z.coerce.number().int().positive().default(1),
	limit: z.coerce.number().int().positive().max(100).default(20),
	search: z.string().optional(),
	status: z.enum(ASSET_STATUSES).optional(),
	assetType: z.string().optional(),
	categoryId: z.string().uuid().optional(),
	includeArchived: z
		.enum(['true', 'false'])
		.default('false')
		.transform((value) => value === 'true'),
});

export const assetDeactivateSchema = z.object({
	reason: z.string().min(1).max(500),
});

export type TAssetCreateInput = z.infer<typeof assetCreateSchema>;
export type TAssetUpdateInput = z.infer<typeof assetUpdateSchema>;
export type TAssetListQuery = z.infer<typeof assetListQuerySchema>;
export type TAssetCategoryCreateInput = z.infer<typeof assetCategoryCreateSchema>;
export type TAssetCategoryUpdateInput = z.infer<typeof assetCategoryUpdateSchema>;
export type TAssetCategoryListQuery = z.infer<typeof assetCategoryListQuerySchema>;
