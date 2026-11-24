import type { TTx } from '@drizzle/types';
import type {
	TDeferredRevenueScheduleInsert,
	TDeferredRevenueScheduleSelect,
} from '@drizzle/schemas/finance.schema';
import type { TPaginationRequest, TPaginationResult } from '@ims-erp/common';

export type TDeferredRevenuePaginationRequest = TPaginationRequest & {
	organizationId: string;
	status?: string;
};

/** Data access over `finance.deferred_revenue_schedules` (ERP-0135). */
export interface IDeferredRevenueRepository {
	insertMany(rows: Array<Omit<TDeferredRevenueScheduleInsert, 'createdAt' | 'updatedAt'>>, tx: TTx): Promise<void>;
	/** Active schedules that started on or before `monthEndDate` and are not amortised through `month`. */
	listDue(organizationId: string, month: string, monthEndDate: string): Promise<TDeferredRevenueScheduleSelect[]>;
	findById(organizationId: string, id: string, tx?: TTx): Promise<TDeferredRevenueScheduleSelect | null>;
	listByInvoice(organizationId: string, invoiceId: string, tx: TTx): Promise<TDeferredRevenueScheduleSelect[]>;
	update(
		organizationId: string,
		id: string,
		patch: Partial<Pick<TDeferredRevenueScheduleSelect, 'recognizedAmount' | 'recognizedThrough' | 'status'>>,
		tx?: TTx,
	): Promise<void>;
	paginate(request: TDeferredRevenuePaginationRequest): Promise<TPaginationResult<TDeferredRevenueScheduleSelect>>;
	/** Active schedules still owing an amortisation for `month` (lock gate). */
	countPending(organizationId: string, month: string, monthEndDate: string): Promise<number>;
}
