import { FISCAL_GROUPS, type TFixedAssetBookSelect, type fixedAssetBooks } from '@drizzle/schemas/finance.schema';
import type { TTx } from '@drizzle/types';
import { z } from 'zod';

export const capitalizeSchema = z.object({
	capitalizedOn: z.iso.date(),
	counterpartAccountId: z.uuid(),
	fiscalGroup: z.enum(FISCAL_GROUPS).nullish().transform((v) => v ?? null),
});

export const fiscalGroupSchema = z.object({ fiscalGroup: z.enum(FISCAL_GROUPS).nullable() });

export const depreciationRunSchema = z.object({
	year: z.number().int().min(2000).max(2100),
	month: z.number().int().min(1).max(12),
});

/** Persistence port of `finance.fixed_asset_books` (ERP-0145). */
export interface IFixedAssetBookRepository {
	list(organizationId: string, tx?: TTx): Promise<TFixedAssetBookSelect[]>;
	findByItem(organizationId: string, itemId: string, tx?: TTx): Promise<TFixedAssetBookSelect | null>;
	insert(row: Omit<typeof fixedAssetBooks.$inferInsert, 'createdAt' | 'updatedAt'>, tx?: TTx): Promise<TFixedAssetBookSelect>;
	update(organizationId: string, id: string, patch: Partial<TFixedAssetBookSelect>, tx?: TTx): Promise<TFixedAssetBookSelect | null>;
}
