import type { TTx } from '@drizzle/types';
import type { TCostCenterSelect } from '@drizzle/schemas/finance.schema';
import type { TPaginationRequest, TPaginationResult } from '@ims-erp/common';

export type TCostCenterPaginationRequest = TPaginationRequest & {
	organizationId: string;
	search?: string;
	isActive?: boolean;
};

/** Data access over `finance.cost_centers` (ERP-0127). */
export interface ICostCenterRepository {
	findById(organizationId: string, id: string, tx?: TTx): Promise<TCostCenterSelect | null>;
	findByCode(organizationId: string, code: string): Promise<TCostCenterSelect | null>;
	paginate(request: TCostCenterPaginationRequest): Promise<TPaginationResult<TCostCenterSelect>>;
	insert(row: {
		organizationId: string;
		code: string;
		name: string;
		parentCostCenterId: string | null;
		description: string | null;
	}): Promise<TCostCenterSelect>;
	update(
		organizationId: string,
		id: string,
		patch: {
			name?: string;
			parentCostCenterId?: string | null;
			isActive?: boolean;
			description?: string | null;
		},
	): Promise<TCostCenterSelect | null>;
}
