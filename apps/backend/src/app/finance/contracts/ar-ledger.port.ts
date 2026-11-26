import type { TJournalEntrySelect } from '@drizzle/schemas/finance.schema';

/**
 * Accounting's published contract for the AR sub-ledger (ADR-0024 follow-up).
 *
 * @remarks
 * Sales owns invoices and receipts, but the AR open-item mirror is Accounting's
 * (`finance.ar_open_items`) and the journal entry that backs an invoice is
 * Accounting's too. Sales therefore reaches them through this port — a DI token
 * plus this interface — and never through Accounting's repository
 * (`elysia-module` rules 3.4 and 3.5). Before this port, `sales` imported
 * `LedgerRepository` directly, which was a boundary violation.
 *
 * Every method takes the caller's transaction so the invoice write and its AR
 * mirror stay one unit.
 */
export interface IArLedgerPort {
	/** Opens the AR open-item row for a freshly issued invoice (D3). */
	openItem(
		organizationId: string,
		input: {
			invoiceId: string;
			customerId: string | null;
			invoiceDate: string | null;
			dueDate: string | null;
			originalAmount: number;
			paidAmount: number;
			outstandingAmount: number;
			currencyCode: string;
			status: string;
		},
		tx?: unknown,
	): Promise<void>;

	/** Moves the AR mirror of an invoice (e.g. `void` when the invoice is voided). */
	setOpenItemStatus(
		organizationId: string,
		invoiceId: string,
		patch: { paidAmount?: number; outstandingAmount?: number; status?: string },
		tx?: unknown,
	): Promise<void>;

	/** The latest posted journal entry that names this source document. */
	/**
	 * Applies a kuitansi to the open item (ERP-0139): `delta` > 0 records a
	 * receipt, < 0 its reversal. Paid and outstanding move together, so
	 * `outstanding = original - paid` keeps holding.
	 */
	applyReceipt(organizationId: string, invoiceId: string, delta: number, tx?: unknown): Promise<void>;

	findPostedEntryForSource(
		organizationId: string,
		sourceType: string,
		sourceId: string,
		tx?: unknown,
	): Promise<TJournalEntrySelect | null>;
}
