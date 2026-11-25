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
 * (`journal_templates`, `employee_advances`, `expense_settlements`) are
 * defined in `docs.dbml` only (Q22); `credit_memos` is built (ERP-0135).
 * `expense_claims` + `expense_claim_items` are built (ERP-0013).
 */
import {
	unixTimestamp,
	unixTimestampNullable,
} from '@drizzle/datatypes/unix-timestamp';
import { createCodeNumberingTable } from '@shared/numbering/table';
import { sql } from 'drizzle-orm';
import {
	type AnyPgColumn,
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

/**
 * Statuses that count in the ledger: a reversed original stays in the sums
 * and its posted mirror cancels it (ERP-0129 fix - summing `posted` only made
 * a reversal negate the original instead of cancelling it).
 */
export const LEDGER_JOURNAL_STATUSES = ['posted', 'reversed'] as const;

/** Manual-journal statuses that still block a period lock (ERP-0130). */
export const UNPOSTED_JOURNAL_STATUSES = ['draft', 'submitted', 'approved'] as const;

/** Modules allowed to post journals through the posting service. */
export const JOURNAL_SOURCE_MODULES = [
	'finance',
	'sale',
	'procurement',
	'inventory',
	'payment',
	'tax',
	'human_resource',
	'project',
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

export const EXPENSE_CLAIM_STATUSES = [
	'draft',
	'submitted',
	'approved',
	'rejected',
	'paid',
	'cancelled',
] as const;
export type ExpenseClaimStatus = (typeof EXPENSE_CLAIM_STATUSES)[number];

export const OPEN_ITEM_STATUSES = [
	'open',
	'partially_paid',
	'paid',
	'written_off',
	'void',
] as const;

/** Credit memo lifecycle (ERP-0135): `issued` is reserved, issuing applies it. */
export const CREDIT_MEMO_STATUSES = ['draft', 'issued', 'applied', 'void'] as const;
export type CreditMemoStatus = (typeof CREDIT_MEMO_STATUSES)[number];

export const DEFERRED_REVENUE_STATUSES = ['active', 'completed', 'cancelled'] as const;
export type DeferredRevenueStatus = (typeof DEFERRED_REVENUE_STATUSES)[number];
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
/** IDR is the only currency (ADR-0030, grill Q7/Q22): enforced per money table. */
const idrCheck = (tableName: string) =>
	check(`${tableName}_currency_idr_check`, sql`currency_code = 'IDR'`);

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
		/** Assigned at posting; null while a manual entry is draft/submitted/void. */
		code: varchar('code', { length: 32 }),
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
		/** Business event behind a `postBusinessEvent` entry (ERP-0128). */
		eventType: text('event_type'),
		/** Manual adjusting entry: the only kind a soft-closed period accepts. */
		isAdjusting: boolean('is_adjusting').notNull().default(false),
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
		/** On a reversal: the original entry it mirrors (ERP-0129). */
		reversesEntryId: uuid('reverses_entry_id').references(
			(): AnyPgColumn => journalEntries.id,
			{ onDelete: 'set null' },
		),
		...timestamps,
	},
	(table) => [
		idrCheck('journal_entries'),
		index('journal_entries_reverses_entry_id_idx').on(table.reversesEntryId),
		check(
			'journal_entries_code_posted_check',
			sql`code IS NOT NULL OR status IN ('draft', 'submitted', 'approved', 'void')`,
		),
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
			sql`source_module IN ('finance', 'sale', 'procurement', 'inventory', 'payment', 'tax', 'human_resource', 'project')`,
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
		/** Finance-owned cost centre (ERP-0127). */
		costCenterId: uuid('cost_center_id').references(() => costCenters.id, {
			onDelete: 'restrict',
		}),
		/** Logical reference to project.projects.id — cross-module FK omitted. */
		projectId: uuid('project_id'),
		partyType: text('party_type'),
		partyId: text('party_id'),
		/** Logical reference to product.products.id — validated by the source module. */
		productId: uuid('product_id'),
		...timestamps,
	},
	(table) => [
		idrCheck('journal_lines'),
		index('journal_lines_entry_id_idx').on(table.journalEntryId),
		index('journal_lines_account_id_idx').on(table.accountId),
		index('journal_lines_cost_center_id_idx').on(table.costCenterId),
		index('journal_lines_project_id_idx').on(table.projectId),
		uniqueIndex('journal_lines_line_no_uq')
			.on(table.journalEntryId, table.lineNo)
			.where(sql`deleted_at IS NULL`),
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
		idrCheck('opening_balances'),
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
		idrCheck('account_balances'),
		uniqueIndex('account_balances_account_period_uq').on(
			table.accountId,
			table.accountingPeriodId,
		),
		check('account_balances_debit_check', sql`debit_total >= 0`),
		check('account_balances_credit_check', sql`credit_total >= 0`),
	],
);

/** Cost centre for cost accounting and management reports (ERP-0127). */
export const costCenters = financeSchema.table(
	'cost_centers',
	{
		id: uuid('id').primaryKey().default(sql`uuidv7()`),
		organizationId: organizationId(),
		code: varchar('code', { length: 32 }).notNull(),
		name: text('name').notNull(),
		parentCostCenterId: uuid('parent_cost_center_id').references(
			(): AnyPgColumn => costCenters.id,
			{ onDelete: 'restrict' },
		),
		isActive: boolean('is_active').notNull().default(true),
		description: text('description'),
		...timestamps,
	},
	(table) => [
		uniqueIndex('cost_centers_org_code_uq')
			.on(table.organizationId, table.code)
			.where(sql`deleted_at IS NULL`),
		index('cost_centers_parent_id_idx').on(table.parentCostCenterId),
	],
);

/** Discriminators a posting rule may refine on (ERP-0128). */
export const POSTING_RULE_DISCRIMINATORS = [
	'',
	'product_category',
	'tax',
	'cash_bank_account',
	'expense_category',
	'asset_category',
	'cost_category',
	/** Receipt method (cash, bank_transfer, ...) for the `cash_receipt` role (ERP-0139). */
	'payment_method',
] as const;
export type PostingRuleDiscriminator =
	(typeof POSTING_RULE_DISCRIMINATORS)[number];

/** Wildcard event type: the rule applies to every business event. */
export const ANY_POSTING_EVENT = '*';

/**
 * Account determination for `PostingService.postBusinessEvent` (ERP-0128).
 *
 * @remarks
 * `discriminator_type` / `discriminator_value` use `''` for "none" so the
 * scope unique index treats a missing discriminator as one value.
 */
export const postingRules = financeSchema.table(
	'posting_rules',
	{
		id: uuid('id').primaryKey().default(sql`uuidv7()`),
		organizationId: organizationId(),
		eventType: text('event_type').notNull().default(ANY_POSTING_EVENT),
		role: text('role').notNull(),
		discriminatorType: text('discriminator_type').notNull().default(''),
		discriminatorValue: text('discriminator_value').notNull().default(''),
		accountId: uuid('account_id')
			.notNull()
			.references(() => chartOfAccounts.id, { onDelete: 'restrict' }),
		isActive: boolean('is_active').notNull().default(true),
		description: text('description'),
		...timestamps,
	},
	(table) => [
		uniqueIndex('posting_rules_scope_uq')
			.on(
				table.organizationId,
				table.eventType,
				table.role,
				table.discriminatorType,
				table.discriminatorValue,
			)
			.where(sql`deleted_at IS NULL`),
		index('posting_rules_account_id_idx').on(table.accountId),
		check(
			'posting_rules_discriminator_type_check',
			sql`discriminator_type IN ('', 'product_category', 'tax', 'cash_bank_account', 'expense_category', 'asset_category', 'cost_category', 'payment_method')`,
		),
		check(
			'posting_rules_discriminator_pair_check',
			sql`(discriminator_type = '') = (discriminator_value = '')`,
		),
	],
);

/** Credit note against an issued invoice (ERP-0135). */
export const creditMemos = financeSchema.table(
	'credit_memos',
	{
		id: uuid('id').primaryKey().default(sql`uuidv7()`),
		organizationId: organizationId(),
		code: varchar('code', { length: 32 }).notNull(),
		/** Logical reference to sale.invoices.id — cross-module FK omitted. */
		invoiceId: uuid('invoice_id'),
		/** Logical reference to customer.customers.id — cross-module FK omitted. */
		customerId: uuid('customer_id'),
		memoDate: date('memo_date', { mode: 'string' }),
		amount: moneyAmount('amount'),
		taxAmount: moneyAmount('tax_amount'),
		currencyCode: currencyCode(),
		reason: text('reason'),
		status: text('status').notNull().default('draft'),
		journalEntryId: uuid('journal_entry_id').references(() => journalEntries.id, {
			onDelete: 'set null',
		}),
		createdBy: text('created_by'),
		issuedBy: text('issued_by'),
		issuedAt: unixTimestampNullable('issued_at'),
		...timestamps,
	},
	(table) => [
		idrCheck('credit_memos'),
		uniqueIndex('credit_memos_org_code_uq').on(table.organizationId, table.code),
		index('credit_memos_invoice_id_idx').on(table.invoiceId),
		index('credit_memos_status_idx').on(table.status),
		check('credit_memos_status_check', sql`status IN ('draft', 'issued', 'applied', 'void')`),
		check('credit_memos_amount_check', sql`amount > 0`),
		check('credit_memos_tax_check', sql`tax_amount >= 0 AND tax_amount <= amount`),
	],
);

/** Deferred revenue of one invoice line with a service period (ERP-0135). */
export const deferredRevenueSchedules = financeSchema.table(
	'deferred_revenue_schedules',
	{
		id: uuid('id').primaryKey().default(sql`uuidv7()`),
		organizationId: organizationId(),
		/** Logical reference to sale.invoices.id — cross-module FK omitted. */
		invoiceId: uuid('invoice_id'),
		/** Logical reference to sale.invoice_items.id — cross-module FK omitted. */
		invoiceItemId: uuid('invoice_item_id'),
		issueEntryId: uuid('issue_entry_id').references(() => journalEntries.id, {
			onDelete: 'set null',
		}),
		discriminatorType: text('discriminator_type').notNull().default(''),
		discriminatorValue: text('discriminator_value').notNull().default(''),
		totalAmount: bigint('total_amount', { mode: 'number' }).notNull(),
		recognizedAmount: moneyAmount('recognized_amount'),
		startDate: date('start_date', { mode: 'string' }).notNull(),
		endDate: date('end_date', { mode: 'string' }).notNull(),
		recognizedThrough: varchar('recognized_through', { length: 7 }),
		status: text('status').notNull().default('active'),
		...timestamps,
	},
	(table) => [
		index('deferred_revenue_schedules_invoice_id_idx').on(table.invoiceId),
		index('deferred_revenue_schedules_status_idx').on(table.status),
		check(
			'deferred_revenue_schedules_status_check',
			sql`status IN ('active', 'completed', 'cancelled')`,
		),
		check('deferred_revenue_schedules_total_check', sql`total_amount > 0`),
		check(
			'deferred_revenue_schedules_recognized_check',
			sql`recognized_amount >= 0 AND recognized_amount <= total_amount`,
		),
		check('deferred_revenue_schedules_range_check', sql`end_date >= start_date`),
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
		/** Bank statement CSV layout (ERP-0143); null until mapped. */
		statementMapping: jsonb('statement_mapping').$type<Record<string, unknown>>(),
		isPrimary: boolean('is_primary').notNull().default(false),
		isActive: boolean('is_active').notNull().default(true),
		/**
		 * An employee's salary payee account (ERP-0119); NULL on every company
		 * cash or bank account. Logical reference to human_resource.employees.id
		 * — cross-module FK omitted.
		 */
		employeeId: uuid('employee_id'),
		...timestamps,
	},
	(table) => [
		idrCheck('cash_bank_accounts'),
		uniqueIndex('cash_bank_accounts_org_code_uq').on(
			table.organizationId,
			table.code,
		),
		index('cash_bank_accounts_account_number_idx').on(table.accountNumber),
		index('cash_bank_accounts_employee_id_idx').on(table.employeeId),
		uniqueIndex('cash_bank_accounts_employee_primary_uq')
			.on(table.employeeId)
			.where(sql`is_primary AND employee_id IS NOT NULL AND deleted_at IS NULL`),
		check(
			'cash_bank_accounts_employee_check',
			sql`employee_id IS NULL OR (account_type IN ('bank', 'ewallet') AND opening_balance = 0 AND current_balance = 0 AND invoice_usage IS NULL)`,
		),
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
		idrCheck('cash_bank_transactions'),
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
		/** ERP-0143: imported statement line facts. */
		statementDate: date('statement_date'),
		description: text('description'),
		direction: text('direction').$type<'in' | 'out'>(),
		matchMethod: text('match_method').$type<'auto' | 'manual' | 'created'>(),
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
		check('bank_reconciliation_items_direction_check', sql`direction IS NULL OR direction IN ('in', 'out')`),
		check(
			'bank_reconciliation_items_match_method_check',
			sql`match_method IS NULL OR match_method IN ('auto', 'manual', 'created')`,
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
		idrCheck('supplier_bills'),
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
		/** GR/IR value of these units at the receipt cost (ERP-0136). */
		grirAmount: moneyAmount('grir_amount'),
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

export const expenseClaims = financeSchema.table(
	'expense_claims',
	{
		id: uuid('id').primaryKey().default(sql`uuidv7()`),
		organizationId: organizationId(),
		code: varchar('code', { length: 32 }).notNull(),
		/** Logical reference to human_resource.employees.id — cross-module FK omitted. */
		employeeId: uuid('employee_id'),
		claimDate: date('claim_date'),
		totalAmount: moneyAmount('total_amount'),
		currencyCode: currencyCode(),
		status: text('status').notNull().default('draft'),
		submittedBy: text('submitted_by'),
		submittedAt: unixTimestampNullable('submitted_at'),
		approvedBy: text('approved_by'),
		approvedAt: unixTimestampNullable('approved_at'),
		/** Logical reference to payment.payments.id — FK omitted (ERP-0013 defers paying). */
		paymentId: uuid('payment_id'),
		notes: text('notes'),
		...timestamps,
	},
	(table) => [
		idrCheck('expense_claims'),
		uniqueIndex('expense_claims_org_code_uq').on(
			table.organizationId,
			table.code,
		),
		index('expense_claims_employee_id_idx').on(table.employeeId),
		index('expense_claims_status_idx').on(table.status),
		check(
			'expense_claims_status_check',
			sql`status IN ('draft', 'submitted', 'approved', 'rejected', 'paid', 'cancelled')`,
		),
		check('expense_claims_total_amount_check', sql`total_amount >= 0`),
	],
);

export const expenseClaimItems = financeSchema.table(
	'expense_claim_items',
	{
		id: uuid('id').primaryKey().default(sql`uuidv7()`),
		organizationId: organizationId(),
		expenseClaimId: uuid('expense_claim_id')
			.notNull()
			.references(() => expenseClaims.id, { onDelete: 'cascade' }),
		expenseDate: date('expense_date'),
		/** `chart_of_accounts.code` of an active expense account (ERP-0013 Q5). */
		categoryCode: text('category_code'),
		description: text('description'),
		amount: moneyAmount('amount'),
		taxAmount: moneyAmount('tax_amount'),
		currencyCode: currencyCode(),
		/** Logical reference to document.documents.id — FK omitted (receipts deferred). */
		receiptDocumentId: uuid('receipt_document_id'),
		...timestamps,
	},
	(table) => [
		idrCheck('expense_claim_items'),
		index('expense_claim_items_claim_id_idx').on(table.expenseClaimId),
		check('expense_claim_items_amount_check', sql`amount >= 0`),
		check('expense_claim_items_tax_amount_check', sql`tax_amount >= 0`),
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
		/** Credit memos + write-offs taken off; `originalAmount` is net of it. */
		adjustedAmount: moneyAmount('adjusted_amount'),
		currencyCode: currencyCode(),
		status: text('status').notNull().default('open'),
		writeOffReason: text('write_off_reason'),
		writeOffRequestedBy: text('write_off_requested_by'),
		writeOffRequestedAt: unixTimestampNullable('write_off_requested_at'),
		writtenOffBy: text('written_off_by'),
		writtenOffAt: unixTimestampNullable('written_off_at'),
		writeOffEntryId: uuid('write_off_entry_id').references(() => journalEntries.id, {
			onDelete: 'set null',
		}),
		createdAt: unixTimestamp('created_at').notNull(),
		updatedAt: unixTimestamp('updated_at')
			.notNull()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		idrCheck('ar_open_items'),
		check('ar_open_items_adjusted_check', sql`adjusted_amount >= 0`),
		uniqueIndex('ar_open_items_org_invoice_uq').on(
			table.organizationId,
			table.invoiceId,
		),
		index('ar_open_items_customer_id_idx').on(table.customerId),
		index('ar_open_items_status_idx').on(table.status),
		index('ar_open_items_due_date_idx').on(table.dueDate),
		check(
			'ar_open_items_status_check',
			sql`status IN ('open', 'partially_paid', 'paid', 'written_off', 'void')`,
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
		idrCheck('ap_open_items'),
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

/** Sub-ledger detail behind the AR/AP opening balances (ERP-0142). */
export const openingSubledgerItems = financeSchema.table(
	'opening_subledger_items',
	{
		id: uuid('id').primaryKey().default(sql`uuidv7()`),
		organizationId: organizationId(),
		ledger: text('ledger').$type<'ar' | 'ap'>().notNull(),
		/** Logical reference to customer.customers.id — cross-module FK omitted. */
		customerId: uuid('customer_id'),
		/** Logical reference to supplier.companies.id — cross-module FK omitted. */
		supplierCompanyId: uuid('supplier_company_id'),
		partyCode: varchar('party_code', { length: 32 }).notNull(),
		partyName: text('party_name').notNull(),
		documentNumber: varchar('document_number', { length: 100 }).notNull(),
		documentDate: date('document_date').notNull(),
		dueDate: date('due_date'),
		amount: bigint('amount', { mode: 'number' }).notNull(),
		currencyCode: currencyCode(),
		asOfDate: date('as_of_date').notNull(),
		arOpenItemId: uuid('ar_open_item_id').references(() => arOpenItems.id, { onDelete: 'set null' }),
		supplierBillId: uuid('supplier_bill_id').references(() => supplierBills.id, { onDelete: 'set null' }),
		apOpenItemId: uuid('ap_open_item_id').references(() => apOpenItems.id, { onDelete: 'set null' }),
		postedAt: unixTimestampNullable('posted_at'),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		createdBy: text('created_by'),
		...timestamps,
	},
	(table) => [
		idrCheck('opening_subledger_items'),
		uniqueIndex('opening_subledger_items_document_uq')
			.on(table.organizationId, table.ledger, table.documentNumber)
			.where(sql`deleted_at IS NULL`),
		index('opening_subledger_items_ledger_idx').on(table.organizationId, table.ledger, table.postedAt),
		check('opening_subledger_items_ledger_check', sql`ledger IN ('ar', 'ap')`),
		check('opening_subledger_items_amount_check', sql`amount > 0`),
	],
);

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
		idrCheck('asset_depreciations'),
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
export type TCostCenterSelect = typeof costCenters.$inferSelect;
export type TCostCenterInsert = typeof costCenters.$inferInsert;
export type TPostingRuleSelect = typeof postingRules.$inferSelect;
export type TPostingRuleInsert = typeof postingRules.$inferInsert;
export type TCreditMemoSelect = typeof creditMemos.$inferSelect;
export type TCreditMemoInsert = typeof creditMemos.$inferInsert;
export type TDeferredRevenueScheduleSelect = typeof deferredRevenueSchedules.$inferSelect;
export type TDeferredRevenueScheduleInsert = typeof deferredRevenueSchedules.$inferInsert;
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

export type TExpenseClaimSelect = typeof expenseClaims.$inferSelect;

export type TExpenseClaimItemSelect = typeof expenseClaimItems.$inferSelect;
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

export type TOpeningSubledgerItemSelect = typeof openingSubledgerItems.$inferSelect;
export type TOpeningSubledgerItemInsert = typeof openingSubledgerItems.$inferInsert;
