import type { TInvoiceSelect } from '@drizzle/schemas/sales.schema';

/**
 * Sales' published contract for other modules (pattern: `Exported<Module>Service`).
 *
 * @remarks
 * Consumed by Accounting, which mirrors an invoice in its AR sub-ledger and
 * counts draft invoices in its month-end checklist. Before this facade,
 * Accounting read and wrote `sales.invoices` with its own repository — a
 * `elysia-module` rule 3.2/3.4 violation, because only Sales owns that table.
 *
 * The facade depends on Sales' invoice repository alone (no other module), so a
 * consumer cannot create a service-to-service cycle. Every method takes the
 * caller's transaction, because the AR mirror update has to commit with the
 * receipt that caused it.
 */
export interface IExportedInvoiceService {
	/** One invoice, tenant scoped and soft-delete aware. */
	findById(organizationId: string, id: string, tx?: unknown): Promise<TInvoiceSelect | null>;

	/** Updates the invoice's payment totals (the AR mirror write path). */
	updateTotals(
		organizationId: string,
		id: string,
		patch: { paidTotal?: number; outstandingTotal?: number; status?: string },
		tx?: unknown,
	): Promise<TInvoiceSelect | null>;

	/** How many invoices are still `draft` and were created inside a window. */
	countDraftsInWindow(organizationId: string, startDate: string, endDate: string): Promise<number>;
}
