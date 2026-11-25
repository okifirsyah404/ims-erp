import type { TTx } from '@drizzle/types';

/** One invoice line whose revenue is deferred over a service period. */
export type TDeferredScheduleInput = {
	invoiceItemId: string;
	amount: number;
	startDate: string;
	endDate: string;
	discriminatorType: string;
	discriminatorValue: string;
};

/**
 * Finance's deferred-revenue contract for the sale module (ERP-0135).
 *
 * @remarks
 * Sale opens the schedules inside its issue transaction and cancels them
 * inside its void transaction. Finance owns `deferred_revenue_schedules`
 * and the amortisation journals; sale never reads them.
 */
export interface IDeferredRevenuePort {
	createSchedules(
		tx: TTx,
		input: {
			organizationId: string;
			invoiceId: string;
			issueEntryId: string;
			schedules: TDeferredScheduleInput[];
		},
	): Promise<void>;
	/** Reverses posted amortisations and cancels the invoice's schedules. */
	cancelForInvoice(tx: TTx, organizationId: string, invoiceId: string, actorUserId: string): Promise<void>;
}
