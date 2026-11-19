import {
	CONDITION_CHECK_STATUSES,
	DISPOSAL_METHODS,
	INVENTORY_DOCUMENT_TYPES,
	ITEM_CONDITIONS,
	MAINTENANCE_STATUSES,
	MAINTENANCE_TYPES,
	TOOL_SET_STATUSES,
} from '@drizzle/schemas/inventory.schema';
import { z } from 'zod';

/**
 * Request schemas of the item operation endpoints (location, movements,
 * condition checks, maintenance, disposal, documents, tool sets).
 *
 * @remarks
 * Depreciation entries are gone from this module: `finance.asset_depreciations`
 * owns them (ADR-0024 Q15) and calls `ItemService.applyDepreciation`.
 */

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const listQuery = z.object({
	page: z.coerce.number().int().positive().default(1),
	limit: z.coerce.number().int().positive().max(100).default(20),
});

/* ------------------------------ location ------------------------------- */

/** Places a ready unit into a warehouse storage. */
export const itemPlaceSchema = z.object({
	warehouseId: z.string().uuid(),
	storageId: z.string().uuid().nullish(),
	locationDescription: z.string().max(500).nullish(),
});

/** Moves a ready unit to another warehouse storage. */
export const itemTransferSchema = z.object({
	toWarehouseId: z.string().uuid(),
	toStorageId: z.string().uuid().nullish(),
	notes: z.string().max(1000).nullish(),
});

/** Records an off-site move (`project_site`). */
export const itemMoveSchema = z.object({
	movementType: z.literal('project_site'),
	fromLocation: z.string().nullish(),
	toLocation: z.string().nullish(),
	notes: z.string().nullish(),
});

/* --------------------------- condition checks -------------------------- */

export const conditionCheckSchema = z.object({
	checkDate: day,
	condition: z.enum(ITEM_CONDITIONS),
	findings: z.string().nullish(),
	nextCheckDate: day.nullish(),
	status: z.enum(CONDITION_CHECK_STATUSES).optional(),
});

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

/* ------------------------------- disposals ----------------------------- */

export const disposalCreateSchema = z.object({
	disposalDate: day.nullish(),
	disposalMethod: z.enum(DISPOSAL_METHODS).default('scrap'),
	proceedsAmount: z.number().int().min(0).default(0),
	currencyCode: z.string().length(3).optional(),
	buyerName: z.string().nullish(),
});

/* ------------------------------- documents ----------------------------- */

/** Metadata that rides next to the uploaded `file` of a document upload. */
export const itemDocumentUploadSchema = z.object({
	documentType: z.enum(INVENTORY_DOCUMENT_TYPES),
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

export const toolSetItemAddSchema = z.object({
	itemId: z.string().uuid(),
	quantity: z.number().positive().default(1),
});

export type TItemPlaceInput = z.infer<typeof itemPlaceSchema>;
export type TItemTransferInput = z.infer<typeof itemTransferSchema>;
export type TItemMoveInput = z.infer<typeof itemMoveSchema>;
export type TConditionCheckInput = z.infer<typeof conditionCheckSchema>;
export type TMaintenanceCreateInput = z.infer<typeof maintenanceCreateSchema>;
export type TDisposalCreateInput = z.infer<typeof disposalCreateSchema>;
export type TToolSetCreateInput = z.infer<typeof toolSetCreateSchema>;
export type TToolSetUpdateInput = z.infer<typeof toolSetUpdateSchema>;
