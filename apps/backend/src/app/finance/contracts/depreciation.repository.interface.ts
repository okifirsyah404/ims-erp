import type { TAssetDepreciationInsert, TAssetDepreciationSelect } from '@drizzle/schemas/finance.schema';
import type { TTx } from '@drizzle/types';
import type { TPaginationRequest, TPaginationResult } from '@ims-erp/common';

/** Page settings, tenant and the optional item filter of the depreciation listing. */
export type TDepreciationPaginationRequest = TPaginationRequest & {
	organizationId: string;
	itemId?: string;
};

/** Persistence port of `finance.asset_depreciations` (live rows only). */
export interface IDepreciationRepository {
	/** The entry of one item for one period, or `null`. */
	findPeriod(itemId: string, periodYear: number, periodMonth: number, tx?: TTx): Promise<TAssetDepreciationSelect | null>;
	create(data: Omit<TAssetDepreciationInsert, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>, tx?: TTx): Promise<TAssetDepreciationSelect>;
	/** Fetches one page of depreciation entries, newest period first. */
	paginate(
		request: TDepreciationPaginationRequest,
	): Promise<TPaginationResult<TAssetDepreciationSelect>>;
}
