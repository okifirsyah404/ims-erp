import { z } from 'zod';
import { quantityToMilli } from '@utils/money.util';
import { PURCHASE_REQUEST_STATUSES } from '@drizzle/schemas/procurement.schema';

/**
 * Request schemas for purchase requests (`/purchase-requests`, M05,
 * 2026-11-15). Money is integer IDR minor units; quantities carry at most three
 * decimals; business dates are Jakarta `YYYY-MM-DD` strings.
 */

const optionalText = (max: number) =>
	z
		.string()
		.trim()
		.max(max)
		.nullish()
		.transform((value) => (value ? value : null));

const businessDate = z.iso.date();

const quantity = z
	.union([z.number(), z.string().trim()])
	.transform(String)
	.refine((value) => {
		try {
			const milli = quantityToMilli(value);
			return milli > 0n && milli <= 1_000_000_000n;
		} catch {
			return false;
		}
	}, 'Quantity must be above 0 with at most three decimals');

/**
 * One requested line: an item of the master, or free text (`name` + `unit`)
 * that purchasing maps to an item when putting it on a purchase order.
 */
export const purchaseRequestLineSchema = z
	.object({
		itemId: z.uuid().nullish().transform((value) => value ?? null),
		/** Required for a free-text line; ignored for an item (the item's name is used). */
		name: optionalText(300),
		unit: optionalText(32),
		quantity,
		/** Defaults to the item's purchase price, or 0 for free text. */
		estimatedUnitPrice: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullish(),
		specification: optionalText(4000),
		notes: optionalText(1000),
	})
	.refine((line) => line.itemId !== null || (line.name !== null && line.unit !== null), {
		message: 'A free-text line needs a name and a unit',
		path: ['name'],
	});

export const purchaseRequestBodySchema = z
	.object({
		subject: z.string().trim().min(1).max(200),
		justification: optionalText(4000),
		projectName: optionalText(200),
		/** Defaults to today (Jakarta). */
		requestDate: businessDate.nullish(),
		neededBy: businessDate.nullish().transform((value) => value ?? null),
		lines: z.array(purchaseRequestLineSchema).min(1).max(200),
	})
	.refine((body) => !body.neededBy || !body.requestDate || body.neededBy >= body.requestDate, {
		message: 'Needed by cannot be before the request date',
		path: ['neededBy'],
	});

export const purchaseRequestDecisionSchema = z
	.object({
		decision: z.enum(['approve', 'reject']),
		reason: z.string().trim().max(1000).optional(),
	})
	.refine((value) => value.decision === 'approve' || (value.reason?.length ?? 0) > 0, {
		message: 'A reason is required when rejecting',
		path: ['reason'],
	});

export const purchaseRequestCancelSchema = z.object({ reason: z.string().trim().min(1).max(1000) });

export const purchaseRequestListQuerySchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
	/** Code, subject, project or requester name. */
	search: z.string().trim().max(100).optional(),
	status: z.enum(PURCHASE_REQUEST_STATUSES).optional(),
	/** Only the caller's own requests. */
	mine: z
		.enum(['true', 'false'])
		.optional()
		.transform((value) => value === 'true'),
});

/** Item search of the request form. */
export const requestableItemsQuerySchema = z.object({ search: z.string().trim().min(1).max(100).optional() });

/** Approved lines not yet on a live purchase order (the PO form's picker). */
export const openLinesQuerySchema = z.object({
	search: z.string().trim().max(100).optional(),
	purchaseRequestId: z.uuid().optional(),
	limit: z.coerce.number().int().min(1).max(200).default(100),
});

export type TPurchaseRequestBody = z.output<typeof purchaseRequestBodySchema>;
export type TPurchaseRequestLine = z.output<typeof purchaseRequestLineSchema>;
export type TPurchaseRequestDecision = z.output<typeof purchaseRequestDecisionSchema>;
export type TPurchaseRequestListQuery = z.output<typeof purchaseRequestListQuerySchema>;
export type TOpenLinesQuery = z.output<typeof openLinesQuerySchema>;
