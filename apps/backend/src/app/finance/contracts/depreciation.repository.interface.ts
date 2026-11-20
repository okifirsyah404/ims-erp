import type { TAssetDepreciationInsert, TAssetDepreciationSelect } from '@drizzle/schemas/finance.schema';
import type { TTx } from '@drizzle/types';
import type { TPaginationResult } from '@ims-erp/common';

/** Persistence port of `finance.asset_depreciations` (live rows only). */
export interface IDepreciationRepository {
	/** The entry of one item for one period, or `null`. */
	findPeriod(itemId: string, periodYear: number, periodMonth: number, tx?: TTx): Promise<TAssetDepreciationSelect | null>;
	create(data: Omit<TAssetDepreciationInsert, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>, tx?: TTx): Promise<TAssetDepreciationSelect>;
	list(
		organizationId: string,
		filter: { itemId?: string },
		page: number,
		limit: number,
	): Promise<TPaginationResult<TAssetDepreciationSelect>>;
}
