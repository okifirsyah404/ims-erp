/**
 * Finance domain schema — owns the `finance` Postgres schema (M09 Stage 1).
 *
 * Cash/bank accounts and their transaction ledger, bank reconciliation,
 * supplier bills, payment terms, expense settlements/claims, credit memos,
 * and the AR/AP open-item sub-ledgers. The single payment ledger and its
 * allocations live in `payment` (ADR-0024); receipts/kwitansi live in `sales`.
 *
 * House rules honoured here:
 * - Money is exact integer IDR minor units in `bigint` (ADR-0002). Never a
 *   float.
 * - Status vocabularies are `text` guarded by CHECK constraints, never
 *   native enums (DBML project rule).
 * - References to other modules (`auth`, `crm`, `procurement`, `sales`,
 *   `accounting`, `hr`, `projects`, `documents`) are plain id columns with
 *   no FK — cross-module FKs are forbidden. In-schema references DO get real
 *   FKs (see the relations/refs below).
 * - Soft delete via `deleted_at bigint` (unix ms), except where the DBML says
 *   otherwise.
 * - Deferred entities (ERP plan finance.md D6): expense settlements/claims,
 *   employee advances, credit memos and journal templates are intentionally
 *   NOT built in this slice.
 * - The single payment ledger moved to `payment.payments` (ADR-0024); Finance
 *   keeps the cash/bank master and the AR/AP mirrors it settles.
 */
import { sql } from 'drizzle-orm';
import {
	bigint,
	boolean,
	check,
	date,
	index,
	integer,
	numeric,
	pgSchema,
	text,
	uniqueIndex,
	uuid,
	varchar,
} from 'drizzle-orm/pg-core';
import {
	unixTimestamp,
	unixTimestampNullable,
} from '@drizzle/datatypes/unix-timestamp';

export const financeSchema = pgSchema('finance');

/* ------------------------------------------------------------------------ *
 * Vocabularies
 * ------------------------------------------------------------------------ */

/** Payment kinds. `advance_disbursement`, `payroll` etc. are Stage 2 values. */

/** Cash/bank account kinds. `clearing` is used by gateway postings (Stage 2). */
export const CASH_BANK_ACCOUNT_TYPES = [
	'cash',
	'bank',
	'ewallet',
	'clearing',
] as const;
export type CashBankAccountType = (typeof CASH_BANK_ACCOUNT_TYPES)[number];

/** Cash/bank transaction directions. */
export const CASH_BANK_DIRECTIONS = ['in', 'out'] as const;
export type CashBankDirection = (typeof CASH_BANK_DIRECTIONS)[number];

/** Bank reconciliation lifecycle. */
export const BANK_RECONCILIATION_STATUSES = [
	'draft',
	'in_progress',
	'reconciled',
	'closed',
] as const;
export type BankReconciliationStatus =
	(typeof BANK_RECONCILIATION_STATUSES)[number];

/** Supplier bill lifecycle. `overdue` is derived by the service, not stored. */
export const SUPPLIER_BILL_STATUSES = [
	'draft',
	'approved',
	'partially_paid',
	'paid',
	'overdue',
	'void',
] as const;
export type SupplierBillStatus = (typeof SUPPLIER_BILL_STATUSES)[number];

/** Receipt (kwitansi) lifecycle — minimal stub for this slice. */
/** AR/AP open-item lifecycle (sub-ledger mirror, finance plan D3). */
export const OPEN_ITEM_STATUSES = [
	'open',
	'partially_paid',
	'paid',
	'void',
] as const;
export type OpenItemStatus = (typeof OPEN_ITEM_STATUSES)[number];

/* ------------------------------------------------------------------------ *
 * Shared column fragments
 * ------------------------------------------------------------------------ */

/** Logical reference to `auth.organizations.id`. Tenant scope. */
const organizationId = () =>
	text('organization_id').notNull();

/** Exact integer IDR minor units (ADR-0002). */
const moneyAmount = (name: string) =>
	bigint(name, { mode: 'number' }).notNull().default(0);

const currencyCode = () =>
	varchar('currency_code', { length: 3 }).notNull().default('IDR');

/* ------------------------------------------------------------------------ *
 * finance.payment_terms
 * ------------------------------------------------------------------------ */

export const paymentTerms = financeSchema.table(
	'payment_terms',
	{
		id: uuid('id').primaryKey().default(sql`uuidv7()`),
		organizationId: organizationId(),
		code: varchar('code', { length: 32 }).notNull(),
		name: text('name').notNull(),
		/** Days until due, 0 = immediate. */
		days: integer('days').notNull().default(0),
		discountPercent: numeric('discount_percent', { precision: 5, scale: 2 }),
		discountDays: integer('discount_days'),
		isActive: boolean('is_active').notNull().default(true),
		createdAt: unixTimestamp('created_at').notNull(),
		updatedAt: unixTimestamp('updated_at')
			.notNull()
			.$onUpdate(() => new Date()),
		deletedAt: unixTimestampNullable('deleted_at'),
	},
	(table) => [
		uniqueIndex('payment_terms_org_code_uq').on(table.organizationId, table.code),
		check('payment_terms_days_check', sql`days >= 0`),
		check(
			'payment_terms_discount_check',
			sql`discount_percent IS NULL OR (discount_percent >= 0 AND discount_percent <= 100)`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * finance.cash_bank_accounts
 * ------------------------------------------------------------------------ */

export const cashBankAccounts = financeSchema.table(
	'cash_bank_accounts',
	{
		id: uuid('id').primaryKey().default(sql`uuidv7()`),
		organizationId: organizationId(),
		code: varchar('code', { length: 32 }).notNull(),
		name: text('name').notNull(),
		accountType: text('account_type').notNull().default('bank'),
		bankName: text('bank_name'),
		accountNumber: text('account_number'),
		accountHolder: text('account_holder'),
		currencyCode: currencyCode(),
		openingBalance: moneyAmount('opening_balance'),
		/** Denormalized running balance, maintained transactionally by the service. */
		currentBalance: moneyAmount('current_balance'),
		isActive: boolean('is_active').notNull().default(true),
		createdAt: unixTimestamp('created_at').notNull(),
		updatedAt: unixTimestamp('updated_at')
			.notNull()
			.$onUpdate(() => new Date()),
		deletedAt: unixTimestampNullable('deleted_at'),
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
	],
);

/* ------------------------------------------------------------------------ *
 * finance.cash_bank_transactions
 * ------------------------------------------------------------------------ */

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
		/** Plain (source_type, source_id) polymorphic reference. */
		sourceType: text('source_type'),
		sourceId: text('source_id'),
		description: text('description'),
		referenceNumber: text('reference_number'),
		status: text('status').notNull().default('posted'),
		balanceAfter: moneyAmount('balance_after'),
		postedBy: text('posted_by'),
		postedAt: unixTimestampNullable('posted_at'),
		createdAt: unixTimestamp('created_at').notNull(),
		updatedAt: unixTimestamp('updated_at')
			.notNull()
			.$onUpdate(() => new Date()),
		deletedAt: unixTimestampNullable('deleted_at'),
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
		check('cash_bank_transactions_direction_check', sql`direction IN ('in', 'out')`),
		check('cash_bank_transactions_amount_check', sql`amount > 0`),
		check('cash_bank_transactions_status_check', sql`status IN ('posted', 'reversed')`),
	],
);

/* ------------------------------------------------------------------------ *
 * finance.bank_reconciliations + items
 * ------------------------------------------------------------------------ */

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
		createdAt: unixTimestamp('created_at').notNull(),
		updatedAt: unixTimestamp('updated_at')
			.notNull()
			.$onUpdate(() => new Date()),
		deletedAt: unixTimestampNullable('deleted_at'),
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
		createdAt: unixTimestamp('created_at').notNull(),
		updatedAt: unixTimestamp('updated_at')
			.notNull()
			.$onUpdate(() => new Date()),
		deletedAt: unixTimestampNullable('deleted_at'),
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

/* ------------------------------------------------------------------------ *
 * finance.supplier_bills
 * ------------------------------------------------------------------------ */

export const supplierBills = financeSchema.table(
	'supplier_bills',
	{
		id: uuid('id').primaryKey().default(sql`uuidv7()`),
		organizationId: organizationId(),
		code: varchar('code', { length: 32 }).notNull(),
		/** Logical ref to procurement.suppliers.id. Validated via contract. */
		supplierId: uuid('supplier_id').notNull(),
		/** Logical ref to procurement.purchase_orders.id. */
		purchaseOrderId: uuid('purchase_order_id'),
		/** The supplier's own invoice number the bill was matched to (ERP-0012). */
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
		createdAt: unixTimestamp('created_at').notNull(),
		updatedAt: unixTimestamp('updated_at')
			.notNull()
			.$onUpdate(() => new Date()),
		deletedAt: unixTimestampNullable('deleted_at'),
	},
	(table) => [
		uniqueIndex('supplier_bills_org_code_uq').on(
			table.organizationId,
			table.code,
		),
		index('supplier_bills_supplier_id_idx').on(table.supplierId),
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

/* ------------------------------------------------------------------------ *
 * finance.supplier_bill_items (ERP-0012): bills made from a purchase order
 * ------------------------------------------------------------------------ */

export const supplierBillItems = financeSchema.table(
	'supplier_bill_items',
	{
		id: uuid('id').primaryKey().default(sql`uuidv7()`),
		organizationId: organizationId(),
		supplierBillId: uuid('supplier_bill_id')
			.notNull()
			.references(() => supplierBills.id, { onDelete: 'cascade' }),
		/** Logical ref to procurement.purchase_order_items.id. Validated via contract. */
		purchaseOrderItemId: uuid('purchase_order_item_id'),
		/** Logical ref to inventory.items.id. */
		itemId: uuid('item_id'),
		name: text('name').notNull(),
		unit: varchar('unit', { length: 32 }).notNull(),
		quantity: numeric('quantity', { precision: 18, scale: 3 }).notNull(),
		/** The purchase order unit price, VAT as the order states it. */
		unitPrice: moneyAmount('unit_price'),
		/** round(quantity × unit_price). */
		lineTotal: moneyAmount('line_total'),
		/** Ex-VAT part of the line total; what the line debits. */
		taxBase: moneyAmount('tax_base'),
		/** Stock-tracked item: debits inventory instead of expense. */
		isStock: boolean('is_stock').notNull().default(false),
		sortOrder: integer('sort_order').notNull().default(0),
		createdAt: unixTimestamp('created_at').notNull(),
		updatedAt: unixTimestamp('updated_at')
			.notNull()
			.$onUpdate(() => new Date()),
		deletedAt: unixTimestampNullable('deleted_at'),
	},
	(table) => [
		index('supplier_bill_items_supplier_bill_id_idx').on(table.supplierBillId),
		index('supplier_bill_items_purchase_order_item_id_idx').on(table.purchaseOrderItemId),
		check('supplier_bill_items_quantity_check', sql`quantity > 0`),
		check('supplier_bill_items_amounts_check', sql`unit_price >= 0 AND line_total >= 0 AND tax_base >= 0`),
	],
);

/* ------------------------------------------------------------------------ *
 * finance.ar_open_items / finance.ap_open_items — sub-ledger mirror (D3)
 *
 * New tables, not in the original DBML. Finance's own record of what is
 * still owed, updated through the posting flow — never computed by reading
 * sales/procurement tables.
 * ------------------------------------------------------------------------ */

export const arOpenItems = financeSchema.table(
	'ar_open_items',
	{
		id: uuid('id').primaryKey().default(sql`uuidv7()`),
		organizationId: organizationId(),
		/** Logical ref to sales.invoices.id. Validated via the Sales contract. */
		salesInvoiceId: uuid('sales_invoice_id').notNull(),
		/** Logical ref to crm.customers.id. */
		customerId: uuid('customer_id'),
		invoiceDate: date('invoice_date'),
		dueDate: date('due_date'),
		originalAmount: bigint('original_amount', { mode: 'number' }).notNull(),
		paidAmount: moneyAmount('paid_amount'),
		outstandingAmount: bigint('outstanding_amount', { mode: 'number' }).notNull(),
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
			table.salesInvoiceId,
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
		/** Logical ref to finance.supplier_bills.id (same schema, but kept as a mirror row). */
		supplierBillId: uuid('supplier_bill_id').notNull(),
		/** Logical ref to procurement.suppliers.id. */
		supplierId: uuid('supplier_id'),
		billDate: date('bill_date'),
		dueDate: date('due_date'),
		originalAmount: bigint('original_amount', { mode: 'number' }).notNull(),
		paidAmount: moneyAmount('paid_amount'),
		outstandingAmount: bigint('outstanding_amount', { mode: 'number' }).notNull(),
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
		index('ap_open_items_supplier_id_idx').on(table.supplierId),
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
 * Types
 * ------------------------------------------------------------------------ */

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
export type TSupplierBillSelect = typeof supplierBills.$inferSelect;
export type TSupplierBillInsert = typeof supplierBills.$inferInsert;
export type TSupplierBillItemSelect = typeof supplierBillItems.$inferSelect;
export type TSupplierBillItemInsert = typeof supplierBillItems.$inferInsert;
export type TArOpenItemSelect = typeof arOpenItems.$inferSelect;
export type TArOpenItemInsert = typeof arOpenItems.$inferInsert;
export type TApOpenItemSelect = typeof apOpenItems.$inferSelect;
export type TApOpenItemInsert = typeof apOpenItems.$inferInsert;