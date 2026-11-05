/**
 * Finance domain schema — owns the `finance` Postgres schema.
 *
 * Customer invoices (one billing term of a sales order each) and receipts
 * (kwitansi), ADR-0011 port step 3d-2. The single payment ledger
 * (`finance.payments`) and the rest of the module land later.
 *
 * House rules honoured here:
 * - **Company-wide, no `organization_id`** (ADR-0011 §2, ADR-0012).
 * - Money is bigint IDR minor units (ADR-0002); business dates are Jakarta
 *   `date` strings; operational timestamps unix ms.
 * - References to other modules (`sales`, `crm`, `auth`) are plain id
 *   columns with no FK, validated through those modules' services.
 */
import { defineRelationsPart, sql } from 'drizzle-orm';
import {
	bigint,
	boolean,
	check,
	date,
	index,
	integer,
	jsonb,
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

/** draft (unnumbered) → issued → partially_paid → paid; unpaid → void. */
export const INVOICE_STATUSES = ['draft', 'issued', 'partially_paid', 'paid', 'void'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

/** Derived on creation: first live term = DP, the one that settles = settlement. */
export const INVOICE_TERM_KINDS = ['down_payment', 'installment', 'settlement'] as const;
export type InvoiceTermKind = (typeof INVOICE_TERM_KINDS)[number];

export const RECEIPT_STATUSES = ['posted', 'reversed'] as const;
export type ReceiptStatus = (typeof RECEIPT_STATUSES)[number];

export const RECEIPT_METHODS = ['bank_transfer', 'cash', 'card', 'e_wallet', 'cheque'] as const;
export type ReceiptMethod = (typeof RECEIPT_METHODS)[number];

/** Customer data copied from the sales order. */
export type TInvoiceCustomerSnapshot = {
	code: string;
	name: string;
	type: string;
	email: string | null;
	phone: string | null;
	whatsapp: string | null;
	taxId: string | null;
	addressLine: string | null;
	postalCode: string | null;
};

const timestamps = {
	createdAt: unixTimestamp('created_at').notNull(),
	updatedAt: unixTimestamp('updated_at')
		.notNull()
		.$onUpdate(() => new Date()),
	deletedAt: unixTimestampNullable('deleted_at'),
};

/* ------------------------------------------------------------------------ *
 * finance.invoices
 * ------------------------------------------------------------------------ */

export const invoices = financeSchema.table(
	'invoices',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		/** Assigned on issue (no gaps); null while draft. */
		code: varchar('code', { length: 32 }),
		invoiceType: text('invoice_type').notNull().default('sales'),
		termKind: text('term_kind').$type<InvoiceTermKind>().notNull(),
		/** Logical reference to crm.customers.id — cross-module FK omitted. */
		customerId: uuid('customer_id').notNull(),
		customerSnapshot: jsonb('customer_snapshot').$type<TInvoiceCustomerSnapshot>().notNull(),
		/** Logical reference to sales.sales_orders.id — cross-module FK omitted. */
		salesOrderId: uuid('sales_order_id').notNull(),
		salesOrderCode: varchar('sales_order_code', { length: 32 }).notNull(),
		quotationCode: varchar('quotation_code', { length: 40 }).notNull(),
		/** Subject (Perihal), from the order. */
		title: text('title').notNull(),
		/** Term label, e.g. "DP 30%". */
		description: text('description').notNull(),
		percentageBps: integer('percentage_bps'),
		issueDate: date('issue_date'),
		dueDate: date('due_date'),
		vatEnabled: boolean('vat_enabled').notNull(),
		vatRateBps: integer('vat_rate_bps').notNull().default(0),
		/** Tax base (DPP) of this term. */
		subtotal: bigint('subtotal', { mode: 'number' }).notNull().default(0),
		discountTotal: bigint('discount_total', { mode: 'number' }).notNull().default(0),
		taxTotal: bigint('tax_total', { mode: 'number' }).notNull().default(0),
		grandTotal: bigint('grand_total', { mode: 'number' }).notNull().default(0),
		paidTotal: bigint('paid_total', { mode: 'number' }).notNull().default(0),
		outstandingTotal: bigint('outstanding_total', { mode: 'number' }).notNull().default(0),
		currencyCode: varchar('currency_code', { length: 3 }).notNull().default('IDR'),
		status: text('status').$type<InvoiceStatus>().notNull().default('draft'),
		terms: text('terms'),
		notes: text('notes'),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		createdBy: text('created_by'),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		issuedBy: text('issued_by'),
		issuedAt: unixTimestampNullable('issued_at'),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		voidedBy: text('voided_by'),
		voidedAt: unixTimestampNullable('voided_at'),
		voidReason: text('void_reason'),
		...timestamps,
	},
	(table) => [
		uniqueIndex('invoices_code_uq')
			.on(table.code)
			.where(sql`deleted_at IS NULL AND code IS NOT NULL`),
		index('invoices_customer_id_idx').on(table.customerId),
		index('invoices_sales_order_id_idx').on(table.salesOrderId),
		index('invoices_status_idx').on(table.status),
		index('invoices_due_date_idx').on(table.dueDate),
		index('invoices_term_kind_idx').on(table.termKind),
		check('invoices_type_check', sql`${table.invoiceType} IN ('sales')`),
		check('invoices_term_kind_check', sql`${table.termKind} IN ('down_payment', 'installment', 'settlement')`),
		check(
			'invoices_status_check',
			sql`${table.status} IN ('draft', 'issued', 'partially_paid', 'paid', 'void')`,
		),
		check('invoices_vat_rate_check', sql`${table.vatRateBps} >= 0 AND ${table.vatRateBps} <= 10000`),
		check(
			'invoices_amounts_check',
			sql`${table.subtotal} >= 0 AND ${table.discountTotal} >= 0 AND ${table.taxTotal} >= 0 AND ${table.grandTotal} > 0 AND ${table.paidTotal} >= 0 AND ${table.paidTotal} <= ${table.grandTotal} AND ${table.outstandingTotal} >= 0`,
		),
		check(
			'invoices_dates_check',
			sql`${table.dueDate} IS NULL OR ${table.issueDate} IS NULL OR ${table.dueDate} >= ${table.issueDate}`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * finance.receipts (kwitansi)
 * ------------------------------------------------------------------------ */

export const receipts = financeSchema.table(
	'receipts',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		code: varchar('code', { length: 32 }).notNull(),
		invoiceId: uuid('invoice_id')
			.notNull()
			.references(() => invoices.id, { onDelete: 'restrict' }),
		receivedDate: date('received_date').notNull(),
		amount: bigint('amount', { mode: 'number' }).notNull(),
		currencyCode: varchar('currency_code', { length: 3 }).notNull().default('IDR'),
		method: text('method').$type<ReceiptMethod>().notNull().default('bank_transfer'),
		reference: varchar('reference', { length: 100 }),
		notes: text('notes'),
		status: text('status').$type<ReceiptStatus>().notNull().default('posted'),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		receivedBy: text('received_by'),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		reversedBy: text('reversed_by'),
		reversedAt: unixTimestampNullable('reversed_at'),
		reversalReason: text('reversal_reason'),
		...timestamps,
	},
	(table) => [
		uniqueIndex('receipts_code_uq')
			.on(table.code)
			.where(sql`deleted_at IS NULL`),
		index('receipts_invoice_id_idx').on(table.invoiceId),
		index('receipts_status_idx').on(table.status),
		check('receipts_status_check', sql`${table.status} IN ('posted', 'reversed')`),
		check('receipts_amount_check', sql`${table.amount} > 0`),
		check(
			'receipts_method_check',
			sql`${table.method} IN ('bank_transfer', 'cash', 'card', 'e_wallet', 'cheque')`,
		),
	],
);

export const financeRelations = defineRelationsPart({ invoices, receipts }, (r) => ({
	invoices: {
		receipts: r.many.receipts({ from: r.invoices.id, to: r.receipts.invoiceId }),
	},
	receipts: {
		invoice: r.one.invoices({ from: r.receipts.invoiceId, to: r.invoices.id }),
	},
}));

export type TInvoiceInsert = typeof invoices.$inferInsert;
export type TInvoiceSelect = typeof invoices.$inferSelect;
export type TReceiptInsert = typeof receipts.$inferInsert;
export type TReceiptSelect = typeof receipts.$inferSelect;
