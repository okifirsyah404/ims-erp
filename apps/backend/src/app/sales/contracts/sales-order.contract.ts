import { z } from 'zod';
import { SALES_ORDER_STATUSES } from '@drizzle/schemas/sales.schema';

/**
 * Request schemas for the sales order endpoints (`/sales/orders`, ADR-0011
 * step 3d). Business dates are Jakarta `YYYY-MM-DD` strings.
 */

const optionalText = (max: number) =>
	z
		.string()
		.trim()
		.max(max)
		.nullish()
		.transform((value) => (value ? value : null));

export const createSalesOrderSchema = z.object({
	quotationId: z.uuid(),
	customerPoNumber: optionalText(100),
	/** Defaults to today (Jakarta). */
	orderDate: z.iso.date().nullish(),
	deliveryDate: z.iso.date().nullish(),
	notes: optionalText(4000),
});

export const cancelSalesOrderSchema = z.object({
	reason: z.string().trim().min(1).max(1000),
});

export const salesOrderListQuerySchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
	search: z.string().trim().max(100).optional(),
	status: z.enum(SALES_ORDER_STATUSES).optional(),
	customerId: z.uuid().optional(),
});

export const salesOrderIdParamSchema = z.object({ id: z.uuid() });

export type TCreateSalesOrderRequest = z.output<typeof createSalesOrderSchema>;
export type TSalesOrderListQuery = z.output<typeof salesOrderListQuerySchema>;
