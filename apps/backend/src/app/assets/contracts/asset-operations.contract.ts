import { z } from 'zod';
import {
	ASSET_CONDITIONS,
	MAINTENANCE_TYPES,
	MAINTENANCE_STATUSES,
	MOVEMENT_TYPES_ASSET,
	DISPOSAL_METHODS,
	DOCUMENT_TYPES_ASSET,
	CONDITION_CHECK_STATUSES,
	TOOL_SET_STATUSES,
} from '@drizzle/schemas/asset.schema';

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const listQuery = z.object({
	page: z.coerce.number().int().positive().default(1),
	limit: z.coerce.number().int().positive().max(100).default(20),
});

/* ------------------------------ location ------------------------------- */

/** Places a ready asset into a warehouse storage (D3). */
export const assetPlaceSchema = z.object({
	warehouseId: z.string().uuid(),
	storageId: z.string().uuid().nullish(),
	locationDescription: z.string().max(500).nullish(),
});

/** Moves a ready asset to another warehouse storage, clearing the source. */
export const assetTransferSchema = z.object({
	toWarehouseId: z.string().uuid(),
	toStorageId: z.string().uuid().nullish(),
	notes: z.string().max(1000).nullish(),
});

/* ------------------------------ movements ------------------------------ */

export const assetMoveSchema = z.object({
	movementType: z.enum(MOVEMENT_TYPES_ASSET),
	fromLocation: z.string().nullish(),
	toLocation: z.string().nullish(),
	notes: z.string().nullish(),
});

export const movementListQuerySchema = listQuery;

/* --------------------------- condition checks -------------------------- */

export const conditionCheckSchema = z.object({
	checkDate: day,
	condition: z.enum(ASSET_CONDITIONS),
	findings: z.string().nullish(),
	nextCheckDate: day.nullish(),
	status: z.enum(CONDITION_CHECK_STATUSES).optional(),
});

export const conditionCheckListQuerySchema = listQuery;

/* ----------------------------- maintenances ---------------------------- */

export const maintenanceCreateSchema = z.object({
	maintenanceType: z.enum(MAINTENANCE_TYPES).default('preventive'),
	scheduledDate: day.nullish(),
	performedDate: day.nullish(),
	performedByEmployeeId: z.string().uuid().nullish(),
	vendorName: z.string().nullish(),
	cost: z.number().int().min(0).default(0),
	currencyCode: z.string().length(3).default('IDR'),
	description: z.string().nullish(),
	status: z.enum(MAINTENANCE_STATUSES).default('scheduled'),
	nextServiceDate: day.nullish(),
	documentId: z.string().uuid().nullish(),
});

export const maintenanceListQuerySchema = listQuery;

/* ----------------------------- depreciations --------------------------- */

export const depreciationCreateSchema = z.object({
	periodYear: z.number().int().min(2000).max(2100),
	periodMonth: z.number().int().min(1).max(12),
	depreciationAmount: z.number().int().min(0),
});

export const depreciationListQuerySchema = listQuery;

/* ------------------------------- disposals ----------------------------- */

export const disposalCreateSchema = z.object({
	disposalDate: day.nullish(),
	disposalMethod: z.enum(DISPOSAL_METHODS).default('scrap'),
	proceedsAmount: z.number().int().min(0).default(0),
	currencyCode: z.string().length(3).optional(),
	buyerName: z.string().nullish(),
});

export const disposalListQuerySchema = listQuery;

/* ------------------------------- documents ----------------------------- */

export const documentAttachSchema = z.object({
	documentId: z.string().uuid(),
	documentType: z.enum(DOCUMENT_TYPES_ASSET),
});

/* ------------------------------- tool sets ----------------------------- */

export const toolSetCreateSchema = z.object({
	name: z.string().min(1),
	description: z.string().nullish(),
	custodianEmployeeId: z.string().uuid().nullish(),
});

export const toolSetUpdateSchema = z
	.object({
		name: z.string().min(1).optional(),
		description: z.string().nullable().optional(),
		custodianEmployeeId: z.string().uuid().nullable().optional(),
		status: z.enum(TOOL_SET_STATUSES).optional(),
	})
	.refine((d) => Object.keys(d).length > 0, {
		message: 'At least one field is required',
	});

export const toolSetListQuerySchema = listQuery;

export const toolSetItemAddSchema = z.object({
	assetId: z.string().uuid(),
	quantity: z.number().positive().default(1),
});

export type TAssetPlaceInput = z.infer<typeof assetPlaceSchema>;
export type TAssetTransferInput = z.infer<typeof assetTransferSchema>;
export type TAssetMoveInput = z.infer<typeof assetMoveSchema>;
export type TConditionCheckInput = z.infer<typeof conditionCheckSchema>;
export type TMaintenanceCreateInput = z.infer<typeof maintenanceCreateSchema>;
export type TDepreciationCreateInput = z.infer<typeof depreciationCreateSchema>;
export type TDisposalCreateInput = z.infer<typeof disposalCreateSchema>;
export type TToolSetCreateInput = z.infer<typeof toolSetCreateSchema>;
export type TToolSetUpdateInput = z.infer<typeof toolSetUpdateSchema>;
