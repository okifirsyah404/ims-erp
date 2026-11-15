import { SALES_RETURN_CONDITIONS, SALES_RETURN_STATUSES } from '@drizzle/schemas/sales.schema';
import { quantityToMilli } from '@utils/money.util';
import { z } from 'zod';

/**
 * Request schemas for sales returns (`/sales-returns`, ERP-0065).
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

export const salesReturnLineSchema = z.object({
	deliveryNoteItemId: z.uuid(),
	quantity,
	/** One per unit for serialized items, taken from the delivery line. */
	serialNumbers: z.array(z.string().trim().min(1).max(100)).max(10_000).nullish(),
});

export const salesReturnBodySchema = z.object({
	deliveryNoteId: z.uuid(),
	/** Where the goods come back to; defaults to the delivery note's warehouse. */
	warehouseId: z.uuid().nullish(),
	/** Defaults to today (Jakarta). */
	returnDate: z.iso.date().nullish(),
	reason: z.string().trim().min(1).max(2000),
	notes: optionalText(2000),
	lines: z.array(salesReturnLineSchema).min(1).max(200),
});

export const salesReturnDecisionSchema = z
	.object({
		decision: z.enum(['approve', 'reject']),
		reason: z.string().trim().max(1000).optional(),
	})
	.refine((value) => value.decision === 'approve' || (value.reason?.length ?? 0) > 0, {
		message: 'A reason is required when rejecting',
		path: ['reason'],
	});

export const salesReturnReceiveSchema = z.object({
	/** The day the goods arrived; defaults to today (Jakarta). */
	receivedDate: z.iso.date().nullish(),
	/** One entry per return line: its condition and, optionally, the storage it goes into. */
	lines: z
		.array(
			z.object({
				salesReturnItemId: z.uuid(),
				condition: z.enum(SALES_RETURN_CONDITIONS),
				binId: z.uuid().nullish(),
			}),
		)
		.min(1)
		.max(200),
});

export const salesReturnCancelSchema = z.object({ reason: z.string().trim().min(1).max(1000) });

export const salesReturnListQuerySchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
	search: z.string().trim().max(100).optional(),
	status: z.enum(SALES_RETURN_STATUSES).optional(),
	deliveryNoteId: z.uuid().optional(),
});

export type TSalesReturnBody = z.output<typeof salesReturnBodySchema>;
export type TSalesReturnDecision = z.output<typeof salesReturnDecisionSchema>;
export type TSalesReturnReceive = z.output<typeof salesReturnReceiveSchema>;
export type TSalesReturnListQuery = z.output<typeof salesReturnListQuerySchema>;
