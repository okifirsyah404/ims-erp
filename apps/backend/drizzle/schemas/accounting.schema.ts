/**
 * Accounting schema, tax slice (M10, ERP-0016).
 *
 * Mirrors `docs/database/docs.dbml` (`accounting.tax_types`,
 * `accounting.tax_records`, `accounting.tax_corrections`,
 * `accounting.withholding_tax_records`). The rest of the accounting module
 * (chart of accounts, journals, periods) lands in later slices.
 *
 * Rules honoured here:
 * - Money is exact integer IDR minor units in `bigint` (ADR-0002). Rates are
 *   `numeric(9,4)` percentages, never floats.
 * - Cross-module references (`organization_id`, `verified_by`,
 *   `created_by`, `evidence_document_id`) are plain text/uuid columns with no
 *   foreign key. They are validated through the owning module's contract.
 * - Rate changes are new rows. The no-overlap rule per code is enforced by
 *   the service, not by the database.
 * - Soft delete via `deleted_at`. Uniqueness on reusable codes is a partial
 *   index `WHERE deleted_at IS NULL`.
 * - Status vocabularies are text guarded by CHECK constraints.
 */
import { sql } from 'drizzle-orm';
import {
	bigint,
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
	boolean,
} from 'drizzle-orm/pg-core';
import {
	unixTimestamp,
	unixTimestampNullable,
} from '@drizzle/datatypes/unix-timestamp';

export const accountingSchema = pgSchema('accounting');

/** Tax kinds. `ppn_input` / `ppn_output` are the two PPN directions. */
export const TAX_TYPE_KINDS = [
	'ppn',
	'pph',
	'ppn_input',
	'ppn_output',
	'other',
] as const;
export type TaxTypeKind = (typeof TAX_TYPE_KINDS)[number];

/** Base the rate applies to. */
export const TAX_BASE_TYPES = ['gross', 'net', 'specific'] as const;
export type TaxBaseType = (typeof TAX_BASE_TYPES)[number];

/** Working-paper filing lifecycle. Filing itself happens outside the ERP. */
export const TAX_RECORD_STATUSES = [
	'draft',
	'verified',
	'filed',
	'corrected',
] as const;
export type TaxRecordStatus = (typeof TAX_RECORD_STATUSES)[number];

/** Withholding lifecycle. */
export const WITHHOLDING_STATUSES = [
	'recorded',
	'verified',
	'paid',
	'reversed',
] as const;
export type WithholdingStatus = (typeof WITHHOLDING_STATUSES)[number];

/** Money direction: append the general-ledger slice after the tax slice. */

/* ------------------------------------------------------------------------ *
 * Vocabularies — general ledger slice (M09 Stage 1, finance plan F2)
 * ------------------------------------------------------------------------ */

/** Account classification. Drives report placement. */
export const ACCOUNT_TYPES = [
	'asset',
	'liability',
	'equity',
	'revenue',
	'expense',
] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

/** Which side of the ledger the account naturally increases on. */
export const NORMAL_BALANCES = ['debit', 'credit'] as const;
export type NormalBalance = (typeof NORMAL_BALANCES)[number];

/**
 * Direct-method cash-flow category (finance plan D11). Only meaningful for
 * accounts whose movement is mapped into the cash-flow statement.
 */
export const CASH_FLOW_CATEGORIES = [
	'operating',
	'investing',
	'financing',
] as const;
export type CashFlowCategory = (typeof CASH_FLOW_CATEGORIES)[number];

/** Period lifecycle. `locked` is final; reopening is owner-only and audited. */
export const ACCOUNTING_PERIOD_STATUSES = ['open', 'closed', 'locked'] as const;
export type AccountingPeriodStatus = (typeof ACCOUNTING_PERIOD_STATUSES)[number];

/** Journal entry lifecycle. Posted entries are corrected only by reversal. */
export const JOURNAL_ENTRY_STATUSES = [
	'draft',
	'submitted',
	'approved',
	'posted',
	'reversed',
	'void',
] as const;
export type JournalEntryStatus = (typeof JOURNAL_ENTRY_STATUSES)[number];

/** Modules allowed to post journals via the posting service. */
export const JOURNAL_SOURCE_MODULES = [
	'accounting',
	'finance',
	'sales',
	'procurement',
	'inventory',
	'assets',
	'payroll',
	'organization',
] as const;
export type JournalSourceModule = (typeof JOURNAL_SOURCE_MODULES)[number];

/* ------------------------------------------------------------------------ *
 * Shared columns
 * ------------------------------------------------------------------------ */

/** Logical reference to `auth.organizations.id`. Tenant scope. */
const organizationId = () => text('organization_id').notNull();

/** Common audit and soft-delete timestamps. */
const timestamps = {
	createdAt: unixTimestamp('created_at').notNull(),
	updatedAt: unixTimestamp('updated_at').notNull(),
	deletedAt: unixTimestampNullable('deleted_at'),
};

/* ------------------------------------------------------------------------ *
 * accounting.tax_types
 * ------------------------------------------------------------------------ */

/**
 * Effective-dated tax rate. One row per code per effective period.
 * Overlap between rows of the same code is refused by the service.
 */
export const taxTypes = accountingSchema.table(
	'tax_types',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		organizationId: organizationId(),
		code: varchar('code', { length: 32 }).notNull(),
		name: text('name').notNull(),
		taxType: text('tax_type').notNull(),
		/** Percentage, e.g. 11.0000 for 11%. */
		rate: numeric('rate', { precision: 9, scale: 4 }).notNull().default('0'),
		baseType: text('base_type').notNull().default('gross'),
		isInclusive: boolean('is_inclusive').notNull().default(false),
		effectiveFrom: date('effective_from', { mode: 'string' }).notNull(),
		effectiveTo: date('effective_to', { mode: 'string' }),
		isActive: boolean('is_active').notNull().default(true),
		...timestamps,
	},
	(table) => [
		uniqueIndex('tax_types_org_code_effective_uq')
			.on(table.organizationId, table.code, table.effectiveFrom)
			.where(sql`deleted_at IS NULL`),
		index('tax_types_effective_from_idx').on(table.effectiveFrom),
		check(
			'tax_types_tax_type_check',
			sql`tax_type IN ('ppn', 'pph', 'ppn_input', 'ppn_output', 'other')`,
		),
		check(
			'tax_types_base_type_check',
			sql`base_type IN ('gross', 'net', 'specific')`,
		),
		check('tax_types_rate_check', sql`rate >= 0`),
		check(
			'tax_types_effective_range_check',
			sql`effective_to IS NULL OR effective_to >= effective_from`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * accounting.tax_records
 * ------------------------------------------------------------------------ */

/**
 * Period recap workpaper for one tax type. `tax_amount` is the recap as
 * computed when the record was prepared; corrections live in
 * `tax_corrections` and never edit it.
 */
export const taxRecords = accountingSchema.table(
	'tax_records',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		organizationId: organizationId(),
		code: varchar('code', { length: 32 }).notNull(),
		taxTypeId: uuid('tax_type_id')
			.notNull()
			.references(() => taxTypes.id, { onDelete: 'restrict' }),
		periodYear: integer('period_year').notNull(),
		periodMonth: integer('period_month').notNull(),
		/** Exact IDR minor units. */
		taxableBase: bigint('taxable_base', { mode: 'number' })
			.notNull()
			.default(0),
		taxAmount: bigint('tax_amount', { mode: 'number' }).notNull().default(0),
		currencyCode: varchar('currency_code', { length: 3 })
			.notNull()
			.default('IDR'),
		filingStatus: text('filing_status').notNull().default('draft'),
		filedOn: date('filed_on', { mode: 'string' }),
		/** Logical reference to `auth.users.id`. */
		verifiedBy: text('verified_by'),
		notes: text('notes'),
		createdAt: unixTimestamp('created_at').notNull(),
		updatedAt: unixTimestamp('updated_at').notNull(),
		deletedAt: unixTimestampNullable('deleted_at'),
	},
	(table) => [
		uniqueIndex('tax_records_org_code_uq')
			.on(table.organizationId, table.code)
			.where(sql`deleted_at IS NULL`),
		uniqueIndex('tax_records_org_type_period_uq')
			.on(
				table.organizationId,
				table.taxTypeId,
				table.periodYear,
				table.periodMonth,
			)
			.where(sql`deleted_at IS NULL`),
		index('tax_records_tax_type_id_idx').on(table.taxTypeId),
		index('tax_records_period_idx').on(
			table.organizationId,
			table.periodYear,
			table.periodMonth,
		),
		check(
			'tax_records_period_month_check',
			sql`period_month BETWEEN 1 AND 12`,
		),
		check('tax_records_taxable_base_check', sql`taxable_base >= 0`),
		check('tax_records_tax_amount_check', sql`tax_amount >= 0`),
		check(
			'tax_records_filing_status_check',
			sql`filing_status IN ('draft', 'verified', 'filed', 'corrected')`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * accounting.tax_corrections
 * ------------------------------------------------------------------------ */

/**
 * Signed correction against a recap. Net payable is the recap plus the sum
 * of active corrections, computed at read time.
 */
export const taxCorrections = accountingSchema.table(
	'tax_corrections',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		organizationId: organizationId(),
		taxRecordId: uuid('tax_record_id')
			.notNull()
			.references(() => taxRecords.id, { onDelete: 'restrict' }),
		/** Signed IDR minor units. Zero is not a correction. */
		amount: bigint('amount', { mode: 'number' }).notNull(),
		currencyCode: varchar('currency_code', { length: 3 })
			.notNull()
			.default('IDR'),
		reason: text('reason').notNull(),
		/** Logical reference to `documents.documents.id`. */
		evidenceDocumentId: uuid('evidence_document_id'),
		/** Logical reference to `auth.users.id`. */
		createdBy: text('created_by').notNull(),
		...timestamps,
	},
	(table) => [
		index('tax_corrections_tax_record_id_idx').on(table.taxRecordId),
		index('tax_corrections_evidence_document_id_idx').on(
			table.evidenceDocumentId,
		),
		check('tax_corrections_amount_check', sql`amount <> 0`),
		check(
			'tax_corrections_reason_check',
			sql`char_length(trim(reason)) > 0`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * accounting.withholding_tax_records
 * ------------------------------------------------------------------------ */

/**
 * Withholding (PPh) collected on a payment. Counterparty is a plain text
 * pair with no cross-module validation (D11).
 */
export const withholdingTaxRecords = accountingSchema.table(
	'withholding_tax_records',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		organizationId: organizationId(),
		code: varchar('code', { length: 32 }).notNull(),
		taxTypeId: uuid('tax_type_id')
			.notNull()
			.references(() => taxTypes.id, { onDelete: 'restrict' }),
		counterpartyType: text('counterparty_type'),
		counterpartyId: text('counterparty_id'),
		baseAmount: bigint('base_amount', { mode: 'number' }).notNull().default(0),
		taxAmount: bigint('tax_amount', { mode: 'number' }).notNull().default(0),
		currencyCode: varchar('currency_code', { length: 3 })
			.notNull()
			.default('IDR'),
		transactionDate: date('transaction_date', { mode: 'string' }),
		periodYear: integer('period_year'),
		periodMonth: integer('period_month'),
		status: text('status').notNull().default('recorded'),
		createdAt: unixTimestamp('created_at').notNull(),
		updatedAt: unixTimestamp('updated_at').notNull(),
		deletedAt: unixTimestampNullable('deleted_at'),
	},
	(table) => [
		uniqueIndex('withholding_tax_records_org_code_uq')
			.on(table.organizationId, table.code)
			.where(sql`deleted_at IS NULL`),
		index('withholding_tax_records_tax_type_id_idx').on(table.taxTypeId),
		index('withholding_tax_records_counterparty_idx').on(
			table.counterpartyType,
			table.counterpartyId,
		),
		check('withholding_base_amount_check', sql`base_amount >= 0`),
		check('withholding_tax_amount_check', sql`tax_amount >= 0`),
		check(
			'withholding_status_check',
			sql`status IN ('recorded', 'verified', 'paid', 'reversed')`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * accounting.chart_of_accounts
 * ------------------------------------------------------------------------ */

export const chartOfAccounts = accountingSchema.table(
	'chart_of_accounts',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		organizationId: organizationId(),
		code: varchar('code', { length: 32 }).notNull(),
		name: text('name').notNull(),
		accountType: text('account_type').notNull(),
		normalBalance: text('normal_balance').notNull().default('debit'),
		/** Plain in-schema reference (self FK is allowed; kept plain per style). */
		parentAccountId: uuid('parent_account_id'),
		level: integer('level').notNull().default(1),
		/** Only postable accounts accept journal lines. */
		isPostable: boolean('is_postable').notNull().default(true),
		/** System accounts cannot be deleted. */
		isSystem: boolean('is_system').notNull().default(false),
		isActive: boolean('is_active').notNull().default(true),
		/** Direct-method cash-flow mapping (finance plan D11). */
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

/* ------------------------------------------------------------------------ *
 * accounting.accounting_periods
 * ------------------------------------------------------------------------ */

export const accountingPeriods = accountingSchema.table(
	'accounting_periods',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
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
		check(
			'accounting_periods_range_check',
			sql`end_date >= start_date`,
		),
		check(
			'accounting_periods_status_check',
			sql`status IN ('open', 'closed', 'locked')`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * accounting.journal_entries
 * ------------------------------------------------------------------------ */

export const journalEntries = accountingSchema.table(
	'journal_entries',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		organizationId: organizationId(),
		code: varchar('code', { length: 32 }).notNull(),
		accountingPeriodId: uuid('accounting_period_id')
			.notNull()
			.references(() => accountingPeriods.id, { onDelete: 'restrict' }),
		entryDate: date('entry_date', { mode: 'string' }).notNull(),
		description: text('description'),
		/** Polymorphic source reference (e.g. ('finance','payments','<uuid>')). */
		sourceType: text('source_type'),
		sourceId: text('source_id'),
		/**
		 * Idempotency: the posting service refuses a second posted entry with
		 * the same (organization_id, idempotency_key). Null keys skip the rule.
		 */
		idempotencyKey: text('idempotency_key'),
		/** Which module produced the entry (posting service guard). */
		sourceModule: text('source_module').notNull().default('accounting'),
		status: text('status').notNull().default('draft'),
		totalDebit: bigint('total_debit', { mode: 'number' }).notNull().default(0),
		totalCredit: bigint('total_credit', { mode: 'number' })
			.notNull()
			.default(0),
		currencyCode: varchar('currency_code', { length: 3 })
			.notNull()
			.default('IDR'),
		preparedBy: text('prepared_by'),
		submittedAt: unixTimestampNullable('submitted_at'),
		approvedBy: text('approved_by'),
		approvedAt: unixTimestampNullable('approved_at'),
		postedBy: text('posted_by'),
		postedAt: unixTimestampNullable('posted_at'),
		/** Mirrored reversal entry that corrected this one (append-only rule). */
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
		index('journal_entries_source_idx').on(table.sourceType, table.sourceId),
		check(
			'journal_entries_status_check',
			sql`status IN ('draft', 'submitted', 'approved', 'posted', 'reversed', 'void')`,
		),
		check('journal_entries_total_debit_check', sql`total_debit >= 0`),
		check('journal_entries_total_credit_check', sql`total_credit >= 0`),
		check('journal_entries_balanced_check', sql`total_debit = total_credit`),
		check(
			'journal_entries_source_module_check',
			sql`source_module IN ('accounting', 'finance', 'sales', 'procurement', 'inventory', 'assets', 'payroll', 'organization')`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * accounting.journal_lines
 * ------------------------------------------------------------------------ */

export const journalLines = accountingSchema.table(
	'journal_lines',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
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
		currencyCode: varchar('currency_code', { length: 3 })
			.notNull()
			.default('IDR'),
		description: text('description'),
		/** Logical refs (no cross-module FK). */
		costCenterId: uuid('cost_center_id'),
		projectId: uuid('project_id'),
		partyType: text('party_type'),
		partyId: text('party_id'),
		createdAt: unixTimestamp('created_at').notNull(),
		updatedAt: unixTimestamp('updated_at')
			.notNull()
			.$onUpdate(() => new Date()),
		deletedAt: unixTimestampNullable('deleted_at'),
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

/* ------------------------------------------------------------------------ *
 * accounting.opening_balances
 * ------------------------------------------------------------------------ */

export const openingBalances = accountingSchema.table(
	'opening_balances',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
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
		currencyCode: varchar('currency_code', { length: 3 })
			.notNull()
			.default('IDR'),
		description: text('description'),
		/** Set once when the opening batch is posted; posted once, ever. */
		postedAt: unixTimestampNullable('posted_at'),
		createdAt: unixTimestamp('created_at').notNull(),
		updatedAt: unixTimestamp('updated_at')
			.notNull()
			.$onUpdate(() => new Date()),
		deletedAt: unixTimestampNullable('deleted_at'),
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

/* ------------------------------------------------------------------------ *
 * accounting.account_balances — period-close snapshot only (finance plan D7)
 * ------------------------------------------------------------------------ */

export const accountBalances = accountingSchema.table(
	'account_balances',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
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
		currencyCode: varchar('currency_code', { length: 3 })
			.notNull()
			.default('IDR'),
		calculatedAt: unixTimestampNullable('calculated_at'),
		createdAt: unixTimestamp('created_at').notNull(),
		updatedAt: unixTimestamp('updated_at')
			.notNull()
			.$onUpdate(() => new Date()),
		deletedAt: unixTimestampNullable('deleted_at'),
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

/* ------------------------------------------------------------------------ *
 * accounting.bank_account_links
 * ------------------------------------------------------------------------ */

export const bankAccountLinks = accountingSchema.table(
	'bank_account_links',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		organizationId: organizationId(),
		/** Logical ref to finance.cash_bank_accounts.id (cross-module, no FK). */
		cashBankAccountId: uuid('cash_bank_account_id').notNull(),
		chartOfAccountId: uuid('chart_of_account_id')
			.notNull()
			.references(() => chartOfAccounts.id, { onDelete: 'restrict' }),
		isActive: boolean('is_active').notNull().default(true),
		createdAt: unixTimestamp('created_at').notNull(),
		updatedAt: unixTimestamp('updated_at')
			.notNull()
			.$onUpdate(() => new Date()),
		deletedAt: unixTimestampNullable('deleted_at'),
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
 * accounting.report_archives
 * ------------------------------------------------------------------------ */

/** Financial statements frozen at period close (M12 T30, SOP S13). */
export const REPORT_ARCHIVE_TYPES = [
	'profit_and_loss',
	'balance_sheet',
	'cash_flow',
] as const;
export type ReportArchiveType = (typeof REPORT_ARCHIVE_TYPES)[number];

/**
 * Immutable snapshot of a statement for a closed month.
 *
 * @remarks
 * The append-only rule is enforced in the service: there is no update or
 * delete route, and `deleted_at` / `updated_at` exist only because every table
 * in this schema carries the pair (see `validate-dbml.ts`). A reopened period
 * is re-archived; the unique index keeps the write idempotent so a
 * close/reopen/close cycle cannot mint duplicates.
 */
export const reportArchives = accountingSchema.table(
	'report_archives',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		organizationId: organizationId(),
		periodYear: integer('period_year').notNull(),
		periodMonth: integer('period_month').notNull(),
		reportType: text('report_type').notNull(),
		/** The statement exactly as `ReportService` returned it. */
		payload: jsonb('payload').notNull(),
		generatedBy: text('generated_by'),
		generatedAt: unixTimestamp('generated_at').notNull(),
		createdAt: unixTimestamp('created_at').notNull(),
		updatedAt: unixTimestamp('updated_at')
			.notNull()
			.$onUpdate(() => new Date()),
		deletedAt: unixTimestampNullable('deleted_at'),
	},
	(table) => [
		uniqueIndex('report_archives_scope_uq').on(
			table.organizationId,
			table.periodYear,
			table.periodMonth,
			table.reportType,
		),
		check(
			'report_archives_month_check',
			sql`period_month BETWEEN 1 AND 12`,
		),
		check(
			'report_archives_type_check',
			sql`report_type IN ('profit_and_loss', 'balance_sheet', 'cash_flow')`,
		),
	],
);

export type TTaxTypeSelect = typeof taxTypes.$inferSelect;
export type TTaxTypeInsert = typeof taxTypes.$inferInsert;
export type TTaxRecordSelect = typeof taxRecords.$inferSelect;
export type TTaxRecordInsert = typeof taxRecords.$inferInsert;
export type TTaxCorrectionSelect = typeof taxCorrections.$inferSelect;
export type TTaxCorrectionInsert = typeof taxCorrections.$inferInsert;
export type TWithholdingTaxRecordSelect =
	typeof withholdingTaxRecords.$inferSelect;
export type TWithholdingTaxRecordInsert =
	typeof withholdingTaxRecords.$inferInsert;
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
export type TBankAccountLinkSelect = typeof bankAccountLinks.$inferSelect;
export type TBankAccountLinkInsert = typeof bankAccountLinks.$inferInsert;
export type TReportArchiveSelect = typeof reportArchives.$inferSelect;
export type TReportArchiveInsert = typeof reportArchives.$inferInsert;
