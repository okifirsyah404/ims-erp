import { z } from 'zod';
import { quantityToMilli } from '@utils/money.util';

/**
 * Request schemas for goods receipts (`/goods-receipts`, ADR-0011 step 4b).
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

export const goodsReceiptLineSchema = z.object({
	purchaseOrderItemId: z.uuid(),
	quantity,
	/** One per unit for serialized items. */
	serialNumbers: z.array(z.string().trim().min(1).max(100)).max(10_000).nullish(),
});

export const createGoodsReceiptSchema = z.object({
	purchaseOrderId: z.uuid(),
	warehouseId: z.uuid(),
	binId: z.uuid().nullish(),
	/** Defaults to today (Jakarta). */
	receiptDate: z.iso.date().nullish(),
	supplierDeliveryRef: optionalText(100),
	notes: optionalText(2000),
	lines: z.array(goodsReceiptLineSchema).min(1).max(200),
});

export const goodsReceiptListQuerySchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
	search: z.string().trim().max(100).optional(),
	purchaseOrderId: z.uuid().optional(),
});

export type TCreateGoodsReceipt = z.output<typeof createGoodsReceiptSchema>;
export type TGoodsReceiptListQuery = z.output<typeof goodsReceiptListQuerySchema>;
