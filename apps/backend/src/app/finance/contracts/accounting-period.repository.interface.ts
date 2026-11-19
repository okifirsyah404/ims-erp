import type { TTx } from '@drizzle/types';
import type { TAccountingPeriodSelect } from '@drizzle/schemas/finance.schema';
import type { TPaginationResult } from '@ims-erp/common';

export interface IAccountingPeriodRepository {
	findPeriodByMonth(
		organizationId: string,
		year: number,
		month: number,
		tx?: TTx,
	): Promise<TAccountingPeriodSelect | null>;
	findPeriodById(organizationId: string, id: string): Promise<TAccountingPeriodSelect | null>;
	listPeriods(
		organizationId: string,
		pagination: { page: number; limit: number },
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
