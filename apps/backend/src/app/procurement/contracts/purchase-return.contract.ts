import { PURCHASE_RETURN_STATUSES } from '@drizzle/schemas/procurement.schema';
import { quantityToMilli } from '@utils/money.util';
import { z } from 'zod';

/**
 * Request schemas for purchase returns (`/purchase-returns`, ERP-0064).
 * Quantities carry at most three decimals; business dates are Jakarta
 * `YYYY-MM-DD` strings.
 */

const optionalText = (max: number) =>
	z
		.string()
		.trim()
		.max(max)
		.nullish()
		.transform((value) => (value ? value : null));

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

export const purchaseReturnLineSchema = z.object({
	goodsReceiptItemId: z.uuid(),
	quantity,
	/** One per unit for serialized items, taken from the goods receipt line. */
	serialNumbers: z.array(z.string().trim().min(1).max(100)).max(10_000).nullish(),
});

export const purchaseReturnBodySchema = z.object({
	goodsReceiptId: z.uuid(),
	/** Defaults to today (Jakarta). */
	returnDate: z.iso.date().nullish(),
	reason: z.string().trim().min(1).max(2000),
	notes: optionalText(2000),
	lines: z.array(purchaseReturnLineSchema).min(1).max(200),
});

export const purchaseReturnDecisionSchema = z
	.object({
		decision: z.enum(['approve', 'reject']),
		reason: z.string().trim().max(1000).optional(),
	})
	.refine((value) => value.decision === 'approve' || (value.reason?.length ?? 0) > 0, {
		message: 'A reason is required when rejecting',
		path: ['reason'],
	});

export const purchaseReturnShipSchema = z.object({
	/** The day the goods left; defaults to today (Jakarta). */
	shipDate: z.iso.date().nullish(),
});

export const purchaseReturnCancelSchema = z.object({ reason: z.string().trim().min(1).max(1000) });

export const purchaseReturnListQuerySchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
	search: z.string().trim().max(100).optional(),
	status: z.enum(PURCHASE_RETURN_STATUSES).optional(),
	goodsReceiptId: z.uuid().optional(),
});

export type TPurchaseReturnBody = z.output<typeof purchaseReturnBodySchema>;
export type TPurchaseReturnDecision = z.output<typeof purchaseReturnDecisionSchema>;
export type TPurchaseReturnListQuery = z.output<typeof purchaseReturnListQuerySchema>;
