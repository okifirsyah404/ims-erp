import { z } from 'zod';

/** Manual depreciation entry for one item and one period (idempotent per period, D14). */
export const depreciationCreateSchema = z.object({
	itemId: z.uuid(),
	periodYear: z.number().int().min(2000).max(2100),
	periodMonth: z.number().int().min(1).max(12),
	depreciationAmount: z.number().int().min(0),
});

export const depreciationListQuerySchema = z.object({
	itemId: z.uuid().optional(),
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type TDepreciationCreateInput = z.output<typeof depreciationCreateSchema>;
export type TDepreciationListQuery = z.output<typeof depreciationListQuerySchema>;
