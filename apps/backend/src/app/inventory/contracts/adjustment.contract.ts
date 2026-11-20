import { z } from 'zod';
import {
	ADJUSTMENT_STATUSES,
	ADJUSTMENT_TYPES,
} from '@drizzle/schemas/inventory.schema';
import { inventoryPaginationSchema } from './pagination.contract';

/**
 * Request schemas for the stock adjustment document workflow.
 *
 * @remarks
 * The body never carries `organizationId`, `requestedBy`, `approvedBy`, or
 * `status`: all four are decided by the service from the guard-resolved
 * context, because a client that could set them could approve its own
 * adjustment and defeat the workflow.
 */

/**
 * A non-negative counted quantity, at the column's `numeric(18,3)` scale.
 *
 * @remarks
 * Zero is **allowed** — unlike a movement quantity — because a recount line
 * legitimately records "the count is still 0". Such a line posts no movement,
 * which is the service's job, not the schema's.
 */
export const countedQuantitySchema = z.coerce
	.number()
	.min(0)
	.transform((value) => value.toFixed(3));

/**
 * One adjustment line.
 *
 * @remarks
 * `quantityAfter` is the counted **total**, not a delta. The service snapshots
 * the current on-hand as `quantityBefore` and derives direction from their
 * difference, so a client never states which way stock moves.
 */
export const adjustmentLineSchema = z.object({
	productId: z.uuid(),
	binId: z.uuid().nullable().optional(),
	quantityAfter: countedQuantitySchema,
	/**
	 * Cost an increase enters stock at, IDR minor units (opening stock,
	 * ADR-0011 §6). Absent = the current moving average.
	 */
	unitCost: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable().optional(),
	note: z.string().max(1000).nullable().optional(),
});

/**
 * Body for raising an adjustment.
 *
 * @remarks
 * `lines` is required and non-empty: a document with no lines could be approved
 * and posted while doing nothing, which would be an audit dead end.
 */
export const createAdjustmentSchema = z.object({
	warehouseId: z.uuid(),
	adjustmentType: z.enum(ADJUSTMENT_TYPES),
	reasonCode: z.string().max(64).nullable().optional(),
	notes: z.string().max(2000).nullable().optional(),
	lines: z.array(adjustmentLineSchema).min(1),
});

/** Body for replacing a draft's lines. */
export const setAdjustmentLinesSchema = z.object({
	lines: z.array(adjustmentLineSchema).min(1),
});

/** List filter for adjustment documents. */
export const adjustmentListQuerySchema = inventoryPaginationSchema.extend({
	warehouseId: z.uuid().optional(),
	status: z.enum(ADJUSTMENT_STATUSES).optional(),
	adjustmentType: z.enum(ADJUSTMENT_TYPES).optional(),
	search: z.string().min(1).optional(),
});

/** Request types inferred from the schemas above. */
export type TCreateAdjustmentRequest = z.infer<
	typeof createAdjustmentSchema
>;
export type TSetAdjustmentLinesRequest = z.infer<
	typeof setAdjustmentLinesSchema
>;
export type TAdjustmentListQuery = z.infer<typeof adjustmentListQuerySchema>;
