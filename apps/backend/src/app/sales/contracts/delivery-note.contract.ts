import { z } from 'zod';
import { quantityToMilli } from '@utils/money.util';

/**
 * Request schemas for delivery notes (`/delivery-notes`, ADR-0011 step 5a).
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

export const deliveryNoteLineSchema = z.object({
	salesOrderItemId: z.uuid(),
	quantity,
	/** One per unit for serialized items. */
	serialNumbers: z.array(z.string().trim().min(1).max(100)).max(10_000).nullish(),
	remarks: optionalText(500),
});

export const createDeliveryNoteSchema = z.object({
	salesOrderId: z.uuid(),
	warehouseId: z.uuid(),
	binId: z.uuid().nullish(),
	/** Defaults to today (Jakarta). */
	deliveryDate: z.iso.date().nullish(),
	projectName: optionalText(300),
	projectLocation: optionalText(300),
	/** Defaults to the order's customer. */
	recipientName: optionalText(300),
	recipientAddress: optionalText(1000),
	recipientPic: optionalText(200),
	recipientContact: optionalText(200),
	driverName: optionalText(200),
	vehicleNumber: optionalText(32),
	notes: optionalText(2000),
	lines: z.array(deliveryNoteLineSchema).min(1).max(200),
});

export const deliverDeliveryNoteSchema = z.object({
	receiverName: z.string().trim().min(1).max(200),
	/** Defaults to now. */
	receivedAt: z.coerce.date().nullish(),
});

export const cancelDeliveryNoteSchema = z.object({ reason: z.string().trim().min(1).max(1000) });

export const deliveryNoteListQuerySchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
	search: z.string().trim().max(100).optional(),
	salesOrderId: z.uuid().optional(),
	status: z.enum(['prepared', 'shipped', 'delivered', 'cancelled']).optional(),
});

export type TCreateDeliveryNote = z.output<typeof createDeliveryNoteSchema>;
export type TDeliverDeliveryNote = z.output<typeof deliverDeliveryNoteSchema>;
export type TDeliveryNoteListQuery = z.output<typeof deliveryNoteListQuerySchema>;
