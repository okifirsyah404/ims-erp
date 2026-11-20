

/**
 * The month-end close checklist counts, one cheap pass over several tables.
 * Draft invoices are not here: they belong to Sales and come from
 * `IExportedInvoiceService.countDraftsInWindow`.
 */
export type TCloseChecklistCounts = {
	postedInPeriod: number;
	draftBills: number;
	unreconciledReconciliations: number;
};

/**
 * Read model behind the month-end close checklist (F7).
 *
 * @remarks
 * The checklist is a report, not an entity: it counts rows across four tables
 * in one round trip. It lives in its own repository so the entity repositories
 * above stay single-table. Open payments are NOT counted here — the payment
 * module owns `payment.payments` and answers that through its gateway
 * (ADR-0024).
 */
export interface ICloseChecklistRepository {
	closeChecklistCounts(
		organizationId: string,
		startDate: string,
		endDate: string,
	): Promise<TCloseChecklistCounts>;
}
