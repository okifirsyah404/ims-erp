/**
 * Finance module schema — owns the `finance` Postgres schema.
 *
 * @remarks
 * General ledger, periods, cash/bank, supplier bills, the AR/AP open-item
 * sub-ledgers and asset depreciation. Absorbs `accounting` (ADR-0024 Q19):
 * `accounting_settings` became `finance.settings`, `company.bank_accounts` is
 * merged into `finance.cash_bank_accounts`, and `assets.asset_depreciations`
 * moved here with `item_id` pointing at `inventory.items`. The tax tables split
 * out to the `tax` schema.
 *
 * The single payment ledger lives in `payment`. Target-only tables
 * (`journal_templates`, `credit_memos`, `expense_claims`, `employee_advances`,
 * `expense_settlements`) are defined in `docs.dbml` only (Q22).
 */
import {
	unixTimestamp,
	unixTimestampNullable,
} from '@drizzle/datatypes/unix-timestamp';
import { createCodeNumberingTable } from '@shared/numbering/table';
import { sql } from 'drizzle-orm';
import {
	bigint,
	boolean,
	check,
	date,
	index,
	integer,
	jsonb,
	numeric,
	pgSchema,
	text,
	uniqueIndex,
	uuid,
	varchar,
} from 'drizzle-orm/pg-core';

export const financeSchema = pgSchema('finance');

/* ------------------------------------------------------------------------ *
 * Vocabularies
 * ------------------------------------------------------------------------ */

export const ACCOUNT_TYPES = [
	'asset',
	'liability',
	'equity',
	'revenue',
	'expense',
] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const NORMAL_BALANCES = ['debit', 'credit'] as const;
export type NormalBalance = (typeof NORMAL_BALANCES)[number];

export const CASH_FLOW_CATEGORIES = [
	'operating',
	'investing',
	'financing',
] as const;
export type CashFlowCategory = (typeof CASH_FLOW_CATEGORIES)[number];

export const ACCOUNTING_PERIOD_STATUSES = ['open', 'closed', 'locked'] as const;
export type AccountingPeriodStatus =
	(typeof ACCOUNTING_PERIOD_STATUSES)[number];

export const JOURNAL_ENTRY_STATUSES = [
	'draft',
	'submitted',
	'approved',
	'posted',
	'reversed',
	'void',
] as const;
export type JournalEntryStatus = (typeof JOURNAL_ENTRY_STATUSES)[number];

/** Modules allowed to post journals through the posting service. */
export const JOURNAL_SOURCE_MODULES = [
	'finance',
	'sale',
	'procurement',
	'inventory',
	'payment',
	'tax',
	'human_resource',
] as const;
export type JournalSourceModule = (typeof JOURNAL_SOURCE_MODULES)[number];

export const CASH_BANK_ACCOUNT_TYPES = [
	'cash',
	'bank',
	'ewallet',
	'clearing',
] as const;
export type CashBankAccountType = (typeof CASH_BANK_ACCOUNT_TYPES)[number];

export const CASH_BANK_DIRECTIONS = ['in', 'out'] as const;
export type CashBankDirection = (typeof CASH_BANK_DIRECTIONS)[number];

export const BANK_RECONCILIATION_STATUSES = [
	'draft',
	'in_progress',
	'reconciled',
	'closed',
] as const;
export type BankReconciliationStatus =
	(typeof BANK_RECONCILIATION_STATUSES)[number];

export const SUPPLIER_BILL_STATUSES = [
	'draft',
	'approved',
	'partially_paid',
	'paid',
	'overdue',
	'void',
] as const;
export type SupplierBillStatus = (typeof SUPPLIER_BILL_STATUSES)[number];

export const OPEN_ITEM_STATUSES = [
	'open',
	'partially_paid',
	'paid',
	'void',
] as const;
export type OpenItemStatus = (typeof OPEN_ITEM_STATUSES)[number];

export const REPORT_ARCHIVE_TYPES = [
	'profit_and_loss',
	'balance_sheet',
	'cash_flow',
] as const;
export type ReportArchiveType = (typeof REPORT_ARCHIVE_TYPES)[number];

export const DEPRECIATION_METHODS = [
	'straight_line',
	'declining_balance',
	'none',
] as const;
export type DepreciationMethod = (typeof DEPRECIATION_METHODS)[number];

/** Which invoices print a bank account: with VAT and without VAT. */
export const INVOICE_USAGES = ['vat', 'non_vat'] as const;
export type InvoiceUsage = (typeof INVOICE_USAGES)[number];

/* ------------------------------------------------------------------------ *
 * Shared column fragments
 * ------------------------------------------------------------------------ */

const organizationId = () => text('organization_id');
const moneyAmount = (name: string) =>
	bigint(name, { mode: 'number' }).notNull().default(0);
const currencyCode = () =>
	varchar('currency_code', { length: 3 }).notNull().default('IDR');

const timestamps = {
	createdAt: unixTimestamp('created_at').notNull(),
	updatedAt: unixTimestamp('updated_at').notNull(),
	deletedAt: unixTimestampNullable('deleted_at'),
};

/* ------------------------------------------------------------------------ *
 * General ledger (was accounting.*)
 * ------------------------------------------------------------------------ */

export const chartOfAccounts = financeSchema.table(
	'chart_of_accounts',
	{
		id: uuid('id').primaryKey().default(sql`uuidv7()`),
		organizationId: organizationId(),
		code: varchar('code', { length: 32 }).notNull(),
		name: text('name').notNull(),
		accountType: text('account_type').notNull(),
		normalBalance: text('normal_balance').notNull().default('debit'),
		parentAccountId: uuid('parent_account_id'),
		level: integer('level').notNull().default(1),
		isPostable: boolean('is_postable').notNull().default(true),
		isSystem: boolean('is_system').notNull().default(false),
		isActive: boolean('is_active').notNull().default(true),
		cashFlowCategory: text('cash_flow_category'),
		description: text('description'),
		...timestamps,
	},
	(table) => [
		uniqueIndex('chart_of_accounts_org_code_uq').on(
			table.organizationId,
			table.code,
		),
		index('chart_of_accounts_parent_account_id_idx').on(table.parentAccountId),
		index('chart_of_accounts_account_type_idx').on(table.accountType),
		check(
			'chart_of_accounts_type_check',
			sql`account_type IN ('asset', 'liability', 'equity', 'revenue', 'expense')`,
		),
		check(
			'chart_of_accounts_normal_balance_check',
			sql`normal_balance IN ('debit', 'credit')`,
		),
		check(
			'chart_of_accounts_cash_flow_category_check',
			sql`cash_flow_category IS NULL OR cash_flow_category IN ('operating', 'investing', 'financing')`,
		),
		check('chart_of_accounts_level_check', sql`level >= 1`),
	],
);

export const accountingPeriods = financeSchema.table(
	'accounting_periods',
	{
		id: uuid('id').primaryKey().default(sql`uuidv7()`),
		organizationId: organizationId(),
		code: varchar('code', { length: 32 }).notNull(),
		periodYear: integer('period_year').notNull(),
		periodMonth: integer('period_month').notNull(),
		startDate: date('start_date', { mode: 'string' }).notNull(),
		endDate: date('end_date', { mode: 'string' }).notNull(),
		status: text('status').notNull().default('open'),
		closedBy: text('closed_by'),
		closedAt: unixTimestampNullable('closed_at'),
		reopenedBy: text('reopened_by'),
		reopenedAt: unixTimestampNullable('reopened_at'),
		...timestamps,
	},
	(table) => [
		uniqueIndex('accounting_periods_org_code_uq').on(
			table.organizationId,
			table.code,
		),
		uniqueIndex('accounting_periods_period_uq').on(
			table.organizationId,
			table.periodYear,
			table.periodMonth,
		),
		check('accounting_periods_month_check', sql`period_month BETWEEN 1 AND 12`),
		check('accounting_periods_range_check', sql`end_date >= start_date`),
		check(
			'accounting_periods_status_check',
			sql`status IN ('open', 'closed', 'locked')`,
		),
	],
);

export const journalEntries = financeSchema.table(
	'journal_entries',
	{
		id: uuid('id').primaryKey().default(sql`uuidv7()`),
		organizationId: organizationId(),
		code: varchar('code', { length: 32 }).notNull(),
		accountingPeriodId: uuid('accounting_period_id')
			.notNull()
			.references(() => accountingPeriods.id, { onDelete: 'restrict' }),
		entryDate: date('entry_date', { mode: 'string' }).notNull(),
		description: text('description'),
		sourceType: text('source_type'),
		sourceId: text('source_id'),
		/** Posting-service idempotency; null keys skip the rule. */
		idempotencyKey: text('idempotency_key'),
		sourceModule: text('source_module').notNull().default('finance'),
		status: text('status').notNull().default('draft'),
		totalDebit: bigint('total_debit', { mode: 'number' }).notNull().default(0),
		totalCredit: bigint('total_credit', { mode: 'number' })
			.notNull()
			.default(0),
		currencyCode: currencyCode(),
		preparedBy: text('prepared_by'),
		submittedAt: unixTimestampNullable('submitted_at'),
		approvedBy: text('approved_by'),
		approvedAt: unixTimestampNullable('approved_at'),
		postedBy: text('posted_by'),
		postedAt: unixTimestampNullable('posted_at'),
		reversedByEntryId: uuid('reversed_by_entry_id'),
		...timestamps,
	},
	(table) => [
		uniqueIndex('journal_entries_org_code_uq').on(
			table.organizationId,
			table.code,
		),
		uniqueIndex('journal_entries_idempotency_uq')
			.on(table.organizationId, table.idempotencyKey)
			.where(sql`idempotency_key IS NOT NULL AND status <> 'void'`),
		index('journal_entries_period_id_idx').on(table.accountingPeriodId),
		index('journal_entries_status_idx').on(table.status),
		index('journal_entries_entry_date_idx').on(table.entryDate),
		index('journal_entries_source_type_idx').on(table.sourceType),
		index('journal_entries_source_id_idx').on(table.sourceId),
		check(
			'journal_entries_status_check',
			sql`status IN ('draft', 'submitted', 'approved', 'posted', 'reversed', 'void')`,
		),
		check('journal_entries_total_debit_check', sql`total_debit >= 0`),
		check('journal_entries_total_credit_check', sql`total_credit >= 0`),
		check('journal_entries_balanced_check', sql`total_debit = total_credit`),
		check(
			'journal_entries_source_module_check',
			sql`source_module IN ('finance', 'sale', 'procurement', 'inventory', 'payment', 'tax', 'human_resource')`,
		),
	],
);

export const journalLines = financeSchema.table(
	'journal_lines',
	{
		id: uuid('id').primaryKey().default(sql`uuidv7()`),
		organizationId: organizationId(),
		journalEntryId: uuid('journal_entry_id')
			.notNull()
			.references(() => journalEntries.id, { onDelete: 'cascade' }),
		lineNo: integer('line_no').notNull(),
		accountId: uuid('account_id')
			.notNull()
			.references(() => chartOfAccounts.id, { onDelete: 'restrict' }),
		debit: bigint('debit', { mode: 'number' }).notNull().default(0),
		credit: bigint('credit', { mode: 'number' }).notNull().default(0),
		currencyCode: currencyCode(),
		description: text('description'),
		/** Legacy column: the organization schema's cost centres are gone (Q4). */
		costCenterId: uuid('cost_center_id'),
		/** Logical reference to project.projects.id — cross-module FK omitted. */
		projectId: uuid('project_id'),
		partyType: text('party_type'),
		partyId: text('party_id'),
		...timestamps,
	},
	(table) => [
		index('journal_lines_entry_id_idx').on(table.journalEntryId),
		index('journal_lines_account_id_idx').on(table.accountId),
		uniqueIndex('journal_lines_line_no_uq').on(
			table.journalEntryId,
			table.lineNo,
		),
		check('journal_lines_debit_check', sql`debit >= 0`),
		check('journal_lines_credit_check', sql`credit >= 0`),
		check(
			'journal_lines_one_side_check',
			sql`(debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0)`,
		),
	],
);

export const openingBalances = financeSchema.table(
	'opening_balances',
	{
		id: uuid('id').primaryKey().default(sql`uuidv7()`),
		organizationId: organizationId(),
		accountId: uuid('account_id')
			.notNull()
			.references(() => chartOfAccounts.id, { onDelete: 'restrict' }),
		asOfDate: date('as_of_date', { mode: 'string' }).notNull(),
		debitBalance: bigint('debit_balance', { mode: 'number' })
			.notNull()
			.default(0),
		creditBalance: bigint('credit_balance', { mode: 'number' })
			.notNull()
			.default(0),
		currencyCode: currencyCode(),
		description: text('description'),
		postedAt: unixTimestampNullable('posted_at'),
		...timestamps,
	},
	(table) => [
		uniqueIndex('opening_balances_account_date_uq').on(
			table.accountId,
			table.asOfDate,
		),
		check('opening_balances_debit_check', sql`debit_balance >= 0`),
		check('opening_balances_credit_check', sql`credit_balance >= 0`),
	],
);

export const accountBalances = financeSchema.table(
	'account_balances',
	{
		id: uuid('id').primaryKey().default(sql`uuidv7()`),
		organizationId: organizationId(),
		accountId: uuid('account_id')
			.notNull()
			.references(() => chartOfAccounts.id, { onDelete: 'restrict' }),
		accountingPeriodId: uuid('accounting_period_id')
			.notNull()
			.references(() => accountingPeriods.id, { onDelete: 'restrict' }),
		balanceDate: date('balance_date', { mode: 'string' }).notNull(),
		debitTotal: bigint('debit_total', { mode: 'number' }).notNull().default(0),
		creditTotal: bigint('credit_total', { mode: 'number' })
			.notNull()
			.default(0),
		closingBalance: bigint('closing_balance', { mode: 'number' })
			.notNull()
			.default(0),
		currencyCode: currencyCode(),
		calculatedAt: unixTimestampNullable('calculated_at'),
		...timestamps,
	},
	(table) => [
		uniqueIndex('account_balances_account_period_uq').on(
			table.accountId,
			table.accountingPeriodId,
		),
		check('account_balances_debit_check', sql`debit_total >= 0`),
		check('account_balances_credit_check', sql`credit_total >= 0`),
	],
);

export const reportArchives = financeSchema.table(
	'report_archives',
	{
		id: uuid('id').primaryKey().default(sql`uuidv7()`),
		organizationId: organizationId(),
		periodYear: integer('period_year').notNull(),
		periodMonth: integer('period_month').notNull(),
		reportType: text('report_type').notNull(),
		payload: jsonb('payload').notNull(),
		generatedBy: text('generated_by'),
		generatedAt: unixTimestamp('generated_at').notNull(),
		...timestamps,
	},
	(table) => [
		uniqueIndex('report_archives_scope_uq').on(
			table.organizationId,
			table.periodYear,
			table.periodMonth,
			table.reportType,
		),
		check('report_archives_month_check', sql`period_month BETWEEN 1 AND 12`),
		check(
			'report_archives_type_check',
			sql`report_type IN ('profit_and_loss', 'balance_sheet', 'cash_flow')`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * Cash / bank
 * ------------------------------------------------------------------------ */

export const paymentTerms = financeSchema.table(
	'payment_terms',
	{
		id: uuid('id').primaryKey().default(sql`uuidv7()`),
		organizationId: organizationId(),
		code: varchar('code', { length: 32 }).notNull(),
		name: text('name').notNull(),
		days: integer('days').notNull().default(0),
		discountPercent: numeric('discount_percent', { precision: 5, scale: 2 }),
		discountDays: integer('discount_days'),
		isActive: boolean('is_active').notNull().default(true),
		...timestamps,
	},
	(table) => [
		uniqueIndex('payment_terms_org_code_uq').on(
			table.organizationId,
			table.code,
		),
		check('payment_terms_days_check', sql`days >= 0`),
		check(
			'payment_terms_discount_check',
			sql`discount_percent IS NULL OR (discount_percent >= 0 AND discount_percent <= 100)`,
		),
	],
);

/**
 * Operational cash and bank account, merged from `finance.cash_bank_accounts`
 * and `company.bank_accounts` (ADR-0024 Q19).
 */
export const cashBankAccounts = financeSchema.table(
	'cash_bank_accounts',
	{
		id: uuid('id').primaryKey().default(sql`uuidv7()`),
		organizationId: organizationId(),
		code: varchar('code', { length: 32 }).notNull(),
		name: text('name').notNull(),
		accountType: text('account_type').notNull().default('bank'),
		bankName: text('bank_name'),
		bankCode: varchar('bank_code', { length: 20 }),
		branchName: varchar('branch_name', { length: 100 }),
		accountNumber: text('account_number'),
		accountHolder: text('account_holder'),
		currencyCode: currencyCode(),
		openingBalance: moneyAmount('opening_balance'),
		currentBalance: moneyAmount('current_balance'),
		/** Account printed on invoices with VAT (vat) or without VAT (non_vat). */
		invoiceUsage: text('invoice_usage'),
		isPrimary: boolean('is_primary').notNull().default(false),
		isActive: boolean('is_active').notNull().default(true),
		...timestamps,
	},
	(table) => [
		uniqueIndex('cash_bank_accounts_org_code_uq').on(
			table.organizationId,
			table.code,
		),
		index('cash_bank_accounts_account_number_idx').on(table.accountNumber),
		check(
			'cash_bank_accounts_type_check',
			sql`account_type IN ('cash', 'bank', 'ewallet', 'clearing')`,
		),
		check('cash_bank_accounts_opening_check', sql`opening_balance >= 0`),
		check(
			'cash_bank_accounts_invoice_usage_check',
			sql`invoice_usage IS NULL OR invoice_usage IN ('vat', 'non_vat')`,
		),
	],
);

export const cashBankTransactions = financeSchema.table(
	'cash_bank_transactions',
	{
		id: uuid('id').primaryKey().default(sql`uuidv7()`),
		organizationId: organizationId(),
		code: varchar('code', { length: 32 }).notNull(),
		cashBankAccountId: uuid('cash_bank_account_id')
			.notNull()
			.references(() => cashBankAccounts.id, { onDelete: 'restrict' }),
		transactionDate: date('transaction_date').notNull(),
		direction: text('direction').notNull(),
		amount: bigint('amount', { mode: 'number' }).notNull(),
		currencyCode: currencyCode(),
		sourceType: text('source_type'),
		sourceId: text('source_id'),
		description: text('description'),
		referenceNumber: text('reference_number'),
		status: text('status').notNull().default('posted'),
		balanceAfter: moneyAmount('balance_after'),
		postedBy: text('posted_by'),
		postedAt: unixTimestampNullable('posted_at'),
		...timestamps,
	},
	(table) => [
		uniqueIndex('cash_bank_transactions_org_code_uq').on(
			table.organizationId,
			table.code,
		),
		index('cash_bank_transactions_account_id_idx').on(table.cashBankAccountId),
		index('cash_bank_transactions_date_idx').on(table.transactionDate),
		index('cash_bank_transactions_source_idx').on(
			table.sourceType,
			table.sourceId,
		),
		check(
			'cash_bank_transactions_direction_check',
			sql`direction IN ('in', 'out')`,
		),
		check('cash_bank_transactions_amount_check', sql`amount > 0`),
		check(
			'cash_bank_transactions_status_check',
			sql`status IN ('draft', 'posted', 'reversed')`,
		),
	],
);

export const bankReconciliations = financeSchema.table(
	'bank_reconciliations',
	{
		id: uuid('id').primaryKey().default(sql`uuidv7()`),
		organizationId: organizationId(),
		code: varchar('code', { length: 32 }).notNull(),
		cashBankAccountId: uuid('cash_bank_account_id')
			.notNull()
			.references(() => cashBankAccounts.id, { onDelete: 'restrict' }),
		reconciliationDate: date('reconciliation_date').notNull(),
		statementBalance: moneyAmount('statement_balance'),
		bookBalance: moneyAmount('book_balance'),
		difference: moneyAmount('difference'),
		status: text('status').notNull().default('draft'),
		reconciledBy: text('reconciled_by'),
		reconciledAt: unixTimestampNullable('reconciled_at'),
		notes: text('notes'),
		...timestamps,
	},
	(table) => [
		uniqueIndex('bank_reconciliations_org_code_uq').on(
			table.organizationId,
			table.code,
		),
		index('bank_reconciliations_account_id_idx').on(table.cashBankAccountId),
		index('bank_reconciliations_date_idx').on(table.reconciliationDate),
		check(
			'bank_reconciliations_status_check',
			sql`status IN ('draft', 'in_progress', 'reconciled', 'closed')`,
		),
	],
);

export const bankReconciliationItems = financeSchema.table(
	'bank_reconciliation_items',
	{
		id: uuid('id').primaryKey().default(sql`uuidv7()`),
		organizationId: organizationId(),
		bankReconciliationId: uuid('bank_reconciliation_id')
			.notNull()
			.references(() => bankReconciliations.id, { onDelete: 'cascade' }),
		cashBankTransactionId: uuid('cash_bank_transaction_id').references(
			() => cashBankTransactions.id,
			{ onDelete: 'set null' },
		),
		statementReference: text('statement_reference'),
		statementAmount: bigint('statement_amount', { mode: 'number' }),
		isMatched: boolean('is_matched').notNull().default(false),
		notes: text('notes'),
		...timestamps,
	},
	(table) => [
		index('bank_reconciliation_items_reconciliation_id_idx').on(
			table.bankReconciliationId,
		),
		index('bank_reconciliation_items_transaction_id_idx').on(
			table.cashBankTransactionId,
		),
	],
);

export const bankAccountLinks = financeSchema.table(
	'bank_account_links',
	{
		id: uuid('id').primaryKey().default(sql`uuidv7()`),
		organizationId: organizationId(),
		cashBankAccountId: uuid('cash_bank_account_id')
			.notNull()
			.references(() => cashBankAccounts.id, { onDelete: 'cascade' }),
		chartOfAccountId: uuid('chart_of_account_id')
			.notNull()
			.references(() => chartOfAccounts.id, { onDelete: 'restrict' }),
		isActive: boolean('is_active').notNull().default(true),
		...timestamps,
	},
	(table) => [
		uniqueIndex('bank_account_links_cash_bank_account_id_uq').on(
			table.cashBankAccountId,
		),
		index('bank_account_links_chart_of_account_id_idx').on(
			table.chartOfAccountId,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * Supplier bills + AR/AP open items
 * ------------------------------------------------------------------------ */

export const supplierBills = financeSchema.table(
	'supplier_bills',
	{
		id: uuid('id').primaryKey().default(sql`uuidv7()`),
		organizationId: organizationId(),
		code: varchar('code', { length: 32 }).notNull(),
		/** Logical reference to supplier.companies.id — cross-module FK omitted. */
		supplierCompanyId: uuid('supplier_company_id'),
		/** Logical reference to procurement.purchase_orders.id — FK omitted. */
		purchaseOrderId: uuid('purchase_order_id'),
		supplierInvoiceNumber: varchar('supplier_invoice_number', { length: 100 }),
		billDate: date('bill_date'),
		dueDate: date('due_date'),
		subtotal: moneyAmount('subtotal'),
		taxTotal: moneyAmount('tax_total'),
		grandTotal: moneyAmount('grand_total'),
		paidTotal: moneyAmount('paid_total'),
		outstandingTotal: moneyAmount('outstanding_total'),
		currencyCode: currencyCode(),
		status: text('status').notNull().default('draft'),
		approvedBy: text('approved_by'),
		approvedAt: unixTimestampNullable('approved_at'),
		...timestamps,
	},
	(table) => [
		uniqueIndex('supplier_bills_org_code_uq').on(
			table.organizationId,
			table.code,
		),
		index('supplier_bills_supplier_company_id_idx').on(table.supplierCompanyId),
		index('supplier_bills_purchase_order_id_idx').on(table.purchaseOrderId),
		index('supplier_bills_status_idx').on(table.status),
		index('supplier_bills_due_date_idx').on(table.dueDate),
		check(
			'supplier_bills_status_check',
			sql`status IN ('draft', 'approved', 'partially_paid', 'paid', 'overdue', 'void')`,
		),
		check('supplier_bills_subtotal_check', sql`subtotal >= 0`),
		check('supplier_bills_tax_total_check', sql`tax_total >= 0`),
		check('supplier_bills_grand_total_check', sql`grand_total >= 0`),
		check('supplier_bills_paid_total_check', sql`paid_total >= 0`),
		check('supplier_bills_outstanding_total_check', sql`outstanding_total >= 0`),
	],
);

export const supplierBillItems = financeSchema.table(
	'supplier_bill_items',
	{
		id: uuid('id').primaryKey().default(sql`uuidv7()`),
		organizationId: organizationId(),
		supplierBillId: uuid('supplier_bill_id')
			.notNull()
			.references(() => supplierBills.id, { onDelete: 'cascade' }),
		/** Logical reference to procurement.purchase_order_items.id — FK omitted. */
		purchaseOrderItemId: uuid('purchase_order_item_id'),
		/** Logical reference to inventory.products.id — cross-module FK omitted. */
		productId: uuid('product_id'),
		name: text('name').notNull(),
		unit: varchar('unit', { length: 32 }).notNull(),
		quantity: numeric('quantity', { precision: 18, scale: 3 }).notNull(),
		unitPrice: moneyAmount('unit_price'),
		lineTotal: moneyAmount('line_total'),
		taxBase: moneyAmount('tax_base'),
		isStock: boolean('is_stock').notNull().default(false),
		sortOrder: integer('sort_order').notNull().default(0),
		...timestamps,
	},
	(table) => [
		index('supplier_bill_items_supplier_bill_id_idx').on(table.supplierBillId),
		index('supplier_bill_items_purchase_order_item_id_idx').on(
			table.purchaseOrderItemId,
		),
		check('supplier_bill_items_quantity_check', sql`quantity > 0`),
		check(
			'supplier_bill_items_amounts_check',
			sql`unit_price >= 0 AND line_total >= 0 AND tax_base >= 0`,
		),
	],
);

export const arOpenItems = financeSchema.table(
	'ar_open_items',
	{
		id: uuid('id').primaryKey().default(sql`uuidv7()`),
		organizationId: organizationId(),
		/** Logical reference to sale.invoices.id — cross-module FK omitted. */
		invoiceId: uuid('invoice_id'),
		/** Logical reference to customer.customers.id — cross-module FK omitted. */
		customerId: uuid('customer_id'),
		invoiceDate: date('invoice_date'),
		dueDate: date('due_date'),
		originalAmount: bigint('original_amount', { mode: 'number' }).notNull(),
		paidAmount: moneyAmount('paid_amount'),
		outstandingAmount: bigint('outstanding_amount', {
			mode: 'number',
		}).notNull(),
		currencyCode: currencyCode(),
		status: text('status').notNull().default('open'),
		createdAt: unixTimestamp('created_at').notNull(),
		updatedAt: unixTimestamp('updated_at')
			.notNull()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		uniqueIndex('ar_open_items_org_invoice_uq').on(
			table.organizationId,
			table.invoiceId,
		),
		index('ar_open_items_customer_id_idx').on(table.customerId),
		index('ar_open_items_status_idx').on(table.status),
		index('ar_open_items_due_date_idx').on(table.dueDate),
		check(
			'ar_open_items_status_check',
			sql`status IN ('open', 'partially_paid', 'paid', 'void')`,
		),
		check('ar_open_items_original_check', sql`original_amount >= 0`),
		check('ar_open_items_paid_check', sql`paid_amount >= 0`),
		check('ar_open_items_outstanding_check', sql`outstanding_amount >= 0`),
		check(
			'ar_open_items_consistency_check',
			sql`outstanding_amount = original_amount - paid_amount`,
		),
	],
);

export const apOpenItems = financeSchema.table(
	'ap_open_items',
	{
		id: uuid('id').primaryKey().default(sql`uuidv7()`),
		organizationId: organizationId(),
		supplierBillId: uuid('supplier_bill_id')
			.notNull()
			.references(() => supplierBills.id, { onDelete: 'restrict' }),
		/** Logical reference to supplier.companies.id — cross-module FK omitted. */
		supplierCompanyId: uuid('supplier_company_id'),
		billDate: date('bill_date'),
		dueDate: date('due_date'),
		originalAmount: bigint('original_amount', { mode: 'number' }).notNull(),
		paidAmount: moneyAmount('paid_amount'),
		outstandingAmount: bigint('outstanding_amount', {
			mode: 'number',
		}).notNull(),
		currencyCode: currencyCode(),
		status: text('status').notNull().default('open'),
		createdAt: unixTimestamp('created_at').notNull(),
		updatedAt: unixTimestamp('updated_at')
			.notNull()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		uniqueIndex('ap_open_items_org_bill_uq').on(
			table.organizationId,
			table.supplierBillId,
		),
		index('ap_open_items_supplier_company_id_idx').on(table.supplierCompanyId),
		index('ap_open_items_status_idx').on(table.status),
		index('ap_open_items_due_date_idx').on(table.dueDate),
		check(
			'ap_open_items_status_check',
			sql`status IN ('open', 'partially_paid', 'paid', 'void')`,
		),
		check('ap_open_items_original_check', sql`original_amount >= 0`),
		check('ap_open_items_paid_check', sql`paid_amount >= 0`),
		check('ap_open_items_outstanding_check', sql`outstanding_amount >= 0`),
		check(
			'ap_open_items_consistency_check',
			sql`outstanding_amount = original_amount - paid_amount`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * Asset depreciation (was assets.asset_depreciations)
 * ------------------------------------------------------------------------ */

export const assetDepreciations = financeSchema.table(
	'asset_depreciations',
	{
		id: uuid('id').primaryKey().default(sql`uuidv7()`),
		organizationId: text('organization_id'),
		/** Logical reference to inventory.items.id — cross-module FK omitted. */
		itemId: uuid('item_id'),
		periodYear: integer('period_year').notNull(),
		periodMonth: integer('period_month').notNull(),
		depreciationMethod: text('depreciation_method')
			.notNull()
			.default('straight_line'),
		depreciationAmount: moneyAmount('depreciation_amount'),
		openingBookValue: moneyAmount('opening_book_value'),
		closingBookValue: moneyAmount('closing_book_value'),
		currencyCode: currencyCode(),
		calculatedAt: unixTimestampNullable('calculated_at'),
		journalEntryId: uuid('journal_entry_id').references(
			() => journalEntries.id,
			{ onDelete: 'set null' },
		),
		...timestamps,
	},
	(table) => [
		uniqueIndex('asset_depreciations_period_uq').on(
			table.itemId,
			table.periodYear,
			table.periodMonth,
		),
		index('asset_depreciations_period_year_idx').on(table.periodYear),
		check(
			'asset_depreciations_period_month_check',
			sql`period_month BETWEEN 1 AND 12`,
		),
		check(
			'asset_depreciations_method_check',
			sql`depreciation_method IN ('straight_line', 'declining_balance', 'none')`,
		),
		check(
			'asset_depreciations_amount_check',
			sql`depreciation_amount >= 0`,
		),
		check(
			'asset_depreciations_closing_check',
			sql`closing_book_value >= 0`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * finance.settings / finance.code_numberings
 * ------------------------------------------------------------------------ */

export const financeSettings = financeSchema.table(
	'settings',
	{
		id: uuid('id').primaryKey().default(sql`uuidv7()`),
		organizationId: organizationId(),
		settingGroup: text('setting_group').notNull(),
		settingKey: text('setting_key').notNull(),
		settingValue: text('setting_value'),
		description: text('description'),
		...timestamps,
	},
	(table) => [
		uniqueIndex('finance_settings_scope_uq').on(
			table.organizationId,
			table.settingGroup,
			table.settingKey,
		),
	],
);

export const financeCodeNumberings = createCodeNumberingTable(financeSchema);

export type TChartOfAccountSelect = typeof chartOfAccounts.$inferSelect;
export type TChartOfAccountInsert = typeof chartOfAccounts.$inferInsert;
export type TAccountingPeriodSelect = typeof accountingPeriods.$inferSelect;
export type TAccountingPeriodInsert = typeof accountingPeriods.$inferInsert;
export type TJournalEntrySelect = typeof journalEntries.$inferSelect;
export type TJournalEntryInsert = typeof journalEntries.$inferInsert;
export type TJournalLineSelect = typeof journalLines.$inferSelect;
export type TJournalLineInsert = typeof journalLines.$inferInsert;
export type TOpeningBalanceSelect = typeof openingBalances.$inferSelect;
export type TOpeningBalanceInsert = typeof openingBalances.$inferInsert;
export type TAccountBalanceSelect = typeof accountBalances.$inferSelect;
export type TAccountBalanceInsert = typeof accountBalances.$inferInsert;
export type TReportArchiveSelect = typeof reportArchives.$inferSelect;
export type TReportArchiveInsert = typeof reportArchives.$inferInsert;
export type TPaymentTermSelect = typeof paymentTerms.$inferSelect;
export type TPaymentTermInsert = typeof paymentTerms.$inferInsert;
export type TCashBankAccountSelect = typeof cashBankAccounts.$inferSelect;
export type TCashBankAccountInsert = typeof cashBankAccounts.$inferInsert;
export type TCashBankTransactionSelect =
	typeof cashBankTransactions.$inferSelect;
export type TCashBankTransactionInsert =
	typeof cashBankTransactions.$inferInsert;
export type TBankReconciliationSelect =
	typeof bankReconciliations.$inferSelect;
export type TBankReconciliationInsert =
	typeof bankReconciliations.$inferInsert;
export type TBankReconciliationItemSelect =
	typeof bankReconciliationItems.$inferSelect;
export type TBankReconciliationItemInsert =
	typeof bankReconciliationItems.$inferInsert;
export type TBankAccountLinkSelect = typeof bankAccountLinks.$inferSelect;
export type TBankAccountLinkInsert = typeof bankAccountLinks.$inferInsert;
export type TSupplierBillSelect = typeof supplierBills.$inferSelect;
export type TSupplierBillInsert = typeof supplierBills.$inferInsert;
export type TSupplierBillItemSelect = typeof supplierBillItems.$inferSelect;
export type TSupplierBillItemInsert = typeof supplierBillItems.$inferInsert;
export type TArOpenItemSelect = typeof arOpenItems.$inferSelect;
export type TArOpenItemInsert = typeof arOpenItems.$inferInsert;
export type TApOpenItemSelect = typeof apOpenItems.$inferSelect;
export type TApOpenItemInsert = typeof apOpenItems.$inferInsert;
export type TAssetDepreciationSelect = typeof assetDepreciations.$inferSelect;
export type TAssetDepreciationInsert = typeof assetDepreciations.$inferInsert;
export type TFinanceSettingSelect = typeof financeSettings.$inferSelect;
export type TFinanceSettingInsert = typeof financeSettings.$inferInsert;
export type TFinanceCodeNumberingSelect =
	typeof financeCodeNumberings.$inferSelect;
export type TFinanceCodeNumberingInsert =
	typeof financeCodeNumberings.$inferInsert;
