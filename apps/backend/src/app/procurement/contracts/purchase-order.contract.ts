import { z } from 'zod';
import { quantityToMilli } from '@utils/money.util';
import {
	PO_VAT_MODES,
	PURCHASE_CATEGORIES,
	PURCHASE_ORDER_STATUSES,
} from '@drizzle/schemas/procurement.schema';

/**
 * Request schemas for purchase orders (`/purchase-orders`, ADR-0011 step
 * 4a). Money is integer IDR minor units; quantities carry at most three
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

export const purchaseOrderLineSchema = z.object({
	productId: z.uuid(),
	quantity,
	/** Defaults to the item's purchase price. */
	unitPrice: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullish(),
	/** Overrides the item specification printed on the PO. */
	specification: optionalText(4000),
	/** The approved purchase request line this line orders (PR → PO). */
	purchaseRequestItemId: z.uuid().nullish().transform((value) => value ?? null),
});

export const purchaseOrderBodySchema = z.object({
	supplierCompanyId: z.uuid(),
	supplierPicId: z.uuid().nullish(),
	category: z.enum(PURCHASE_CATEGORIES),
	subject: z.string().trim().min(1).max(200),
	/** Defaults to today (Jakarta). */
	orderDate: businessDate.nullish(),
	expectedDeliveryDate: businessDate.nullish(),
	supplierQuoteRef: optionalText(100),
	supplierQuoteDate: businessDate.nullish(),
	projectName: optionalText(200),
	/** ERP-0146: the project the order is bought for (budget commitment). */
	projectId: z.uuid().nullish().transform((v) => v ?? null),
	buyerPicName: optionalText(120),
	vatMode: z.enum(PO_VAT_MODES),
	/** Basis points; defaults to 11% when VAT applies. */
	vatRateBps: z.number().int().min(0).max(10_000).nullish(),
	paymentTerms: optionalText(500),
	/** One term per line; `{{placeholders}}` are resolved when printed (ERP-0165). */
	terms: optionalText(8000),
	notes: optionalText(4000),
	/** ERP-0165: the letterhead (kop surat) it prints with; null uses the default. */
	letterheadId: z.uuid().nullish().transform((v) => v ?? null),
	lines: z.array(purchaseOrderLineSchema).min(1).max(200),
});

export const purchaseOrderDecisionSchema = z
	.object({
		decision: z.enum(['approve', 'reject']),
		reason: z.string().trim().max(1000).optional(),
	})
	.refine((value) => value.decision === 'approve' || (value.reason?.length ?? 0) > 0, {
		message: 'A reason is required when rejecting',
		path: ['reason'],
	});

export const purchaseOrderCancelSchema = z.object({ reason: z.string().trim().min(1).max(1000) });

export const purchaseOrderListQuerySchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
	search: z.string().trim().max(100).optional(),
	status: z.enum(PURCHASE_ORDER_STATUSES).optional(),
	supplierCompanyId: z.uuid().optional(),
});

export type TPurchaseOrderBody = z.output<typeof purchaseOrderBodySchema>;
export type TPurchaseOrderDecision = z.output<typeof purchaseOrderDecisionSchema>;
export type TPurchaseOrderListQuery = z.output<typeof purchaseOrderListQuerySchema>;
