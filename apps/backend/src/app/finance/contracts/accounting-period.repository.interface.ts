import type { TTx } from '@drizzle/types';
import type { TAccountingPeriodSelect } from '@drizzle/schemas/finance.schema';
import type { TPaginationRequest, TPaginationResult } from '@ims-erp/common';

/**
 * Page settings plus the tenant of the accounting-period listing.
 *
 * @remarks
 * `organizationId` travels inside the request so every paginated finance
 * method has the same shape.
 */
export type TPeriodPaginationRequest = TPaginationRequest & {
	organizationId: string;
};

export interface IAccountingPeriodRepository {
	findPeriodByMonth(
		organizationId: string,
		year: number,
		month: number,
		tx?: TTx,
	): Promise<TAccountingPeriodSelect | null>;
	findPeriodById(organizationId: string, id: string): Promise<TAccountingPeriodSelect | null>;
	/** Fetches one page of the tenant's accounting periods. */
	paginate(
		request: TPeriodPaginationRequest,
	): Promise<TPaginationResult<TAccountingPeriodSelect>>;
	insertPeriod(
		row: {
			organizationId: string;
			code: string;
			periodYear: number;
			periodMonth: number;
			startDate: string;
			endDate: string;
			status: string;
		},
		tx?: TTx,
	): Promise<TAccountingPeriodSelect>;
	updatePeriodStatus(
		organizationId: string,
		id: string,
		patch: {
			status?: string;
			closedBy?: string | null;
			closedAt?: Date | null;
			reopenedBy?: string | null;
			reopenedAt?: Date | null;
		},
		tx?: TTx,
	): Promise<TAccountingPeriodSelect | null>;
	/** True when the period still has posted journal entries. */
	periodHasPostedEntries(organizationId: string, periodId: string): Promise<boolean>;
}
