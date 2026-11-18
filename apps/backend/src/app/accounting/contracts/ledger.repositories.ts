import type { TTx } from '@drizzle/types';
import type { TPaginationResult } from '@ims-erp/common';
import type {
	TAccountingPeriodSelect,
	TAccountBalanceSelect,
	TBankAccountLinkSelect,
	TChartOfAccountSelect,
	TJournalEntrySelect,
	TJournalLineSelect,
	TOpeningBalanceSelect,
} from '@drizzle/schemas/accounting.schema';
import type {
	TApOpenItemSelect,
	TArOpenItemSelect,
	TCashBankAccountSelect,
	TCashBankTransactionSelect,
	TSupplierBillSelect,
} from '@drizzle/schemas/finance.schema';
import type { TInvoiceSelect } from '@drizzle/schemas/sales.schema';

/**
 * Repository contracts of the accounting module, one per persisted table (or
 * one per parent/child aggregate where the child only exists with its parent).
 *
 * @remarks
 * The former `LedgerRepository` mixed fourteen tables in one class, so every
 * service depended on the whole ledger and a change to, say, bank
 * reconciliation touched the posting path. Each contract below is now the only
 * surface a service can use for its table, and each implementation lives in
 * `repositories/<table>.repository.ts`.
 *
 * Joins are allowed **inside** an aggregate contract (`journal_entries` with
 * `journal_lines`, `cash_bank_accounts` with `cash_bank_transactions`,
 * `bank_reconciliations` with their items) and in the read models documented as
 * such. They are never used to reach another module's table: `sales.invoices`
 * is visible here only through {@link IInvoiceMirrorRepository}, which records
 * the AR/AP mirror write path and is scheduled to move behind a Sales contract.
 *
 * Every read is tenant scoped and excludes soft-deleted rows; every mutation
 * accepts the caller's transaction so a use case stays one atomic unit.
 */

/* ----------------------------- chart_of_accounts ----------------------------- */

export interface IChartOfAccountRepository {
	findAccountById(organizationId: string, id: string, tx?: TTx): Promise<TChartOfAccountSelect | null>;
	findAccountByCode(
		organizationId: string,
		code: string,
		tx?: TTx,
	): Promise<TChartOfAccountSelect | null>;
	findAccountsByCodes(
		organizationId: string,
		codes: string[],
		tx?: TTx,
	): Promise<Map<string, TChartOfAccountSelect>>;
	/** Id-keyed map for the report builders. */
	listAccountsMap(organizationId: string, tx?: TTx): Promise<Map<string, TChartOfAccountSelect>>;
	listAccounts(
		organizationId: string,
		pagination: { page: number; limit: number },
		filters?: { accountType?: string; isActive?: boolean },
	): Promise<TPaginationResult<TChartOfAccountSelect>>;
	insertAccount(
		row: {
			organizationId: string;
			code: string;
			name: string;
			accountType: string;
			normalBalance: string;
			parentAccountId: string | null;
			level: number;
			isPostable: boolean;
			isSystem: boolean;
			isActive: boolean;
			cashFlowCategory: string | null;
			description: string | null;
		},
		tx?: TTx,
	): Promise<TChartOfAccountSelect>;
	updateAccount(
		organizationId: string,
		id: string,
		patch: {
			name?: string;
			isPostable?: boolean;
			isActive?: boolean;
			cashFlowCategory?: string | null;
			description?: string | null;
		},
		tx?: TTx,
	): Promise<TChartOfAccountSelect | null>;
	/** True when at least one live journal line references the account. */
	accountHasJournalLines(organizationId: string, accountId: string): Promise<boolean>;
}

/* ----------------------------- accounting_periods ----------------------------- */

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

/* --------------------- journal_entries + journal_lines (aggregate) --------------------- */

/** Aggregated journal activity of one account inside a date window. */
export type TAccountActivity = { accountId: string; debit: number; credit: number };

export interface IJournalRepository {
	findEntryById(organizationId: string, id: string, tx?: TTx): Promise<TJournalEntrySelect | null>;
	findPostedEntryByIdempotencyKey(
		organizationId: string,
		idempotencyKey: string,
		tx?: TTx,
	): Promise<TJournalEntrySelect | null>;
	/** Latest entry posted for a source document (F7 reversal lookup). */
	findEntryBySource(
		organizationId: string,
		sourceType: string,
		sourceId: string,
		tx?: TTx,
	): Promise<TJournalEntrySelect | null>;
	listEntries(
		organizationId: string,
		pagination: { page: number; limit: number },
		filters?: { year?: number; month?: number; status?: string },
	): Promise<TPaginationResult<TJournalEntrySelect>>;
	insertEntry(
		row: {
			organizationId: string;
			code: string;
			accountingPeriodId: string;
			entryDate: string;
			description: string | null;
			sourceType: string | null;
			sourceId: string | null;
			idempotencyKey: string | null;
			sourceModule: string;
			status: string;
			totalDebit: number;
			totalCredit: number;
			currencyCode: string;
			postedBy: string | null;
			postedAt: Date | null;
		},
		tx?: TTx,
	): Promise<TJournalEntrySelect>;
	insertLines(
		rows: Array<{
			organizationId: string;
			journalEntryId: string;
			lineNo: number;
			accountId: string;
			debit: number;
			credit: number;
			currencyCode: string;
			description: string | null;
			costCenterId: string | null;
			projectId: string | null;
			partyType: string | null;
			partyId: string | null;
		}>,
		tx?: TTx,
	): Promise<TJournalLineSelect[]>;
	findLinesByEntryId(
		organizationId: string,
		entryId: string,
		tx?: TTx,
	): Promise<TJournalLineSelect[]>;
	/** Stamps `posted_by` on a manually posted entry (HTTP actor). */
	stampPostedBy(
		organizationId: string,
		entryId: string,
		postedBy: string,
		tx?: TTx,
	): Promise<void>;
	/** Marks the entry `reversed` and points at the mirrored entry. */
	markReversed(
		organizationId: string,
		entryId: string,
		reversedByEntryId: string,
		tx?: TTx,
	): Promise<void>;
	/** Posted activity per account between two dates, inclusive (report base). */
	listAccountActivity(
		organizationId: string,
		startDate: string,
		endDate: string,
		tx?: TTx,
	): Promise<TAccountActivity[]>;
	/** Posted activity per account inside one accounting period (close snapshot). */
	accountTotalsForPeriod(
		organizationId: string,
		periodId: string,
	): Promise<TAccountActivity[]>;
}

/* ----------------------------- opening_balances ----------------------------- */

export interface IOpeningBalanceRepository {
	listOpeningBalances(organizationId: string): Promise<TOpeningBalanceSelect[]>;
	findOpeningBalanceByAccountAndDate(
		organizationId: string,
		accountId: string,
		asOfDate: string,
	): Promise<TOpeningBalanceSelect | null>;
	insertOpeningBalance(
		row: {
			organizationId: string;
			accountId: string;
			asOfDate: string;
			debitBalance: number;
			creditBalance: number;
			currencyCode: string;
			description: string | null;
		},
		tx?: TTx,
	): Promise<TOpeningBalanceSelect>;
	updateOpeningBalance(
		organizationId: string,
		id: string,
		patch: {
			debitBalance?: number;
			creditBalance?: number;
			description?: string | null;
		},
		tx?: TTx,
	): Promise<TOpeningBalanceSelect | null>;
	/** Stamps `posted_at` once a batch has been posted. */
	stampOpeningBalancePosted(organizationId: string, id: string, tx?: TTx): Promise<void>;
	/** Soft delete; false when the row was already gone. */
	deleteOpeningBalance(organizationId: string, id: string, tx?: TTx): Promise<boolean>;
}

/* ----------------------------- bank_account_links ----------------------------- */

export interface IBankAccountLinkRepository {
	findBankAccountLinkByCashAccount(
		organizationId: string,
		cashBankAccountId: string,
	): Promise<TBankAccountLinkSelect | null>;
	upsertBankAccountLink(
		row: {
			organizationId: string;
			cashBankAccountId: string;
			chartOfAccountId: string;
			isActive: boolean;
		},
		tx?: TTx,
	): Promise<TBankAccountLinkSelect>;
	deactivateBankAccountLink(organizationId: string, cashBankAccountId: string): Promise<void>;
}

/* ---------------- cash_bank_accounts + cash_bank_transactions (aggregate) ---------------- */

export interface ICashBankRepository {
	findCashBankAccountByCode(
		organizationId: string,
		code: string,
		tx?: TTx,
	): Promise<TCashBankAccountSelect | null>;
	findCashBankAccountById(
		organizationId: string,
		id: string,
		tx?: TTx,
	): Promise<TCashBankAccountSelect | null>;
	listCashBankAccounts(organizationId: string): Promise<TCashBankAccountSelect[]>;
	insertCashBankAccount(
		row: {
			organizationId: string;
			code: string;
			name: string;
			accountType: string;
			bankName: string | null;
			accountNumber: string | null;
			accountHolder: string | null;
			openingBalance: number;
			currentBalance: number;
		},
		tx?: TTx,
	): Promise<TCashBankAccountSelect>;
	updateCashBankAccount(
		organizationId: string,
		id: string,
		patch: {
			name?: string;
			bankName?: string | null;
			accountNumber?: string | null;
			accountHolder?: string | null;
			isActive?: boolean;
			currentBalance?: number;
		},
		tx?: TTx,
	): Promise<TCashBankAccountSelect | null>;
	insertCashBankTransaction(
		row: {
			organizationId: string;
			code: string;
			cashBankAccountId: string;
			transactionDate: string;
			direction: string;
			amount: number;
			description: string | null;
			referenceNumber: string | null;
			status: string;
			balanceAfter: number;
			postedBy: string | null;
			postedAt: Date | null;
		},
		tx?: TTx,
	): Promise<TCashBankTransactionSelect>;
	listCashBankTransactions(
		organizationId: string,
		cashBankAccountId: string | undefined,
		pagination: { page: number; limit: number },
	): Promise<TPaginationResult<TCashBankTransactionSelect>>;
	/** Balance recomputed from the posted movements (tests and ops). */
	cashBankAccountBalance(organizationId: string, id: string): Promise<number>;
}

/* ----------------------------- ar_open_items ----------------------------- */

export interface IArOpenItemRepository {
	insertArOpenItem(
		row: {
			organizationId: string;
			salesInvoiceId: string;
			customerId: string | null;
			invoiceDate: string | null;
			dueDate: string | null;
			originalAmount: number;
			paidAmount: number;
			outstandingAmount: number;
			currencyCode: string;
			status: string;
		},
		tx?: TTx,
	): Promise<TArOpenItemSelect>;
	findArOpenItemByInvoice(
		organizationId: string,
		salesInvoiceId: string,
		tx?: TTx,
	): Promise<TArOpenItemSelect | null>;
	updateArOpenItem(
		organizationId: string,
		salesInvoiceId: string,
		patch: { paidAmount?: number; outstandingAmount?: number; status?: string },
		tx?: TTx,
	): Promise<TArOpenItemSelect | null>;
	/** Aging source: open and partially paid items, optionally per customer. */
	listArOpenItemsForAging(
		organizationId: string,
		customerId?: string,
		tx?: TTx,
	): Promise<TArOpenItemSelect[]>;
}

/* ----------------------------- ap_open_items ----------------------------- */

export interface IApOpenItemRepository {
	insertApOpenItem(
		row: {
			organizationId: string;
			supplierBillId: string;
			supplierId: string | null;
			billDate: string | null;
			dueDate: string | null;
			originalAmount: number;
			paidAmount: number;
			outstandingAmount: number;
			currencyCode: string;
			status: string;
		},
		tx?: TTx,
	): Promise<TApOpenItemSelect>;
	findApOpenItemByBill(
		organizationId: string,
		supplierBillId: string,
		tx?: TTx,
	): Promise<TApOpenItemSelect | null>;
	updateApOpenItem(
		organizationId: string,
		supplierBillId: string,
		patch: { paidAmount?: number; outstandingAmount?: number; status?: string },
		tx?: TTx,
	): Promise<TApOpenItemSelect | null>;
	/** Aging source: open and partially paid items, optionally per supplier. */
	listApOpenItemsForAging(
		organizationId: string,
		supplierId?: string,
		tx?: TTx,
	): Promise<TApOpenItemSelect[]>;
}

/* ----------------------------- supplier_bills ----------------------------- */

export interface ISupplierBillRepository {
	insertSupplierBill(
		row: {
			organizationId: string;
			code: string;
			supplierId: string;
			purchaseOrderId: string | null;
			billDate: string | null;
			dueDate: string | null;
			subtotal: number;
			taxTotal: number;
			grandTotal: number;
			paidTotal: number;
			outstandingTotal: number;
			currencyCode: string;
			status: string;
			approvedBy: string | null;
			approvedAt: Date | null;
		},
		tx?: TTx,
	): Promise<TSupplierBillSelect>;
	findSupplierBillById(
		organizationId: string,
		id: string,
		tx?: TTx,
	): Promise<TSupplierBillSelect | null>;
	updateSupplierBill(
		organizationId: string,
		id: string,
		patch: Record<string, unknown>,
		tx?: TTx,
	): Promise<TSupplierBillSelect | null>;
	listSupplierBills(
		organizationId: string,
		filters: { status?: string; supplierId?: string },
		pagination: { page: number; limit: number },
	): Promise<TPaginationResult<TSupplierBillSelect>>;
}

/* ------------- bank_reconciliations + bank_reconciliation_items (aggregate) ------------- */

export interface IBankReconciliationRepository {
	insertBankReconciliation(
		row: {
			organizationId: string;
			code: string;
			cashBankAccountId: string;
			reconciliationDate: string;
			statementBalance: number;
			bookBalance: number;
			difference: number;
			status: string;
			notes: string | null;
		},
		tx?: TTx,
	): Promise<unknown>;
	findBankReconciliationById(
		organizationId: string,
		id: string,
		tx?: TTx,
	): Promise<unknown | null>;
	listBankReconciliations(
		organizationId: string,
		filters: { cashBankAccountId?: string; status?: string },
		pagination: { page: number; limit: number },
	): Promise<TPaginationResult<unknown>>;
	updateBankReconciliation(
		organizationId: string,
		id: string,
		patch: Record<string, unknown>,
		tx?: TTx,
	): Promise<unknown | null>;
	insertBankReconciliationItems(
		rows: Array<{
			organizationId: string;
			bankReconciliationId: string;
			cashBankTransactionId: string | null;
			statementReference: string | null;
			statementAmount: number | null;
			isMatched: boolean;
			notes: string | null;
		}>,
		tx?: TTx,
	): Promise<unknown[]>;
	listBankReconciliationItems(
		organizationId: string,
		bankReconciliationId: string,
		tx?: TTx,
	): Promise<unknown[]>;
	updateBankReconciliationItem(
		organizationId: string,
		id: string,
		patch: Record<string, unknown>,
		tx?: TTx,
	): Promise<unknown | null>;
}

/* ----------------------------- account_balances ----------------------------- */

export interface IAccountBalanceRepository {
	upsertAccountBalance(
		row: {
			organizationId: string;
			accountId: string;
			accountingPeriodId: string;
			balanceDate: string;
			debitTotal: number;
			creditTotal: number;
			closingBalance: number;
			currencyCode: string;
			calculatedAt: Date;
		},
		tx?: TTx,
	): Promise<TAccountBalanceSelect>;
}

/* --------------------- sales.invoices mirror (known cross-module debt) --------------------- */

/**
 * Reads and writes the `sales.invoices` totals the AR sub-ledger mirrors.
 *
 * @remarks
 * This is the one place in the module that touches another module's table, and
 * it is a known `elysia-module` rule 3.2/3.4 deviation inherited from the
 * AR/AP sub-ledger design: executing a receipt updates the invoice's
 * `paid_total` / `outstanding_total` in the same transaction. The target shape
 * is a Sales-owned contract (like `IInvoicePaymentPort`), tracked in
 * `docs/plan/backlog.md`; until then it stays isolated in its own repository so
 * no other accounting repository can reach `sales`.
 */
export interface IInvoiceMirrorRepository {
	findSalesInvoiceById(
		organizationId: string,
		invoiceId: string,
		tx?: TTx,
	): Promise<TInvoiceSelect | null>;
	updateSalesInvoiceTotals(
		organizationId: string,
		invoiceId: string,
		patch: { paidTotal?: number; outstandingTotal?: number; status?: string },
		tx?: TTx,
	): Promise<TInvoiceSelect | null>;
}

/* ----------------------------- close checklist (read model) ----------------------------- */

/** The month-end close checklist counts, one cheap pass over several tables. */
export type TCloseChecklistCounts = {
	draftInvoicesInRange: number;
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
