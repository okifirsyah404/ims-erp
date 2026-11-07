/**
 * Sales domain schema — owns the `sales` Postgres schema.
 *
 * Quotations, payments (transitional scaffold — superseded by
 * `finance.payments`, see finance plan D12: untouched here), and customer
 * invoices. Invoices are owned by Sales (finance plan D2): the invoice is a
 * sales document; finance mirrors AR open items and receives journals via
 * the posting service. Other modules reference invoices by plain id (no
 * cross-schema FKs, per modular-monolith rule).
 */
import {
	pgSchema,
	text,
	integer,
	bigint,
	date,
	index,
	uniqueIndex,
	varchar,
	check,
	uuid,
	numeric,
} from 'drizzle-orm/pg-core';
import { defineRelationsPart, sql } from 'drizzle-orm';
import { unixTimestamp, unixTimestampNullable } from '@drizzle/datatypes/unix-timestamp';

export const salesSchema = pgSchema('sales');

/**
 * Quotation document states. Transitions:
 * draft -> submitted -> approved | rejected
 * Only `submitted` quotations are approvable; only `draft` are submittable.
 */
export const QUOTATION_STATUSES = [
	'draft',
	'submitted',
	'approved',
	'rejected',
] as const;
export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];

/**
 * Payment states. Transitions:
 * pending -> approved -> executed
 * Execution is allowed only from `approved` and is enforced transactionally
 * with a conditional UPDATE to prevent races/double execution.
 */
export const PAYMENT_STATUSES = ['pending', 'approved', 'executed'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/**
 * Invoice states (finance plan D2). `overdue` is derived by the service
 * from due_date, not a user-set state. Voiding is an append-only mark.
 */
export const INVOICE_TYPES = ['sales', 'proforma', 'recurring'] as const;
export type InvoiceType = (typeof INVOICE_TYPES)[number];

export const INVOICE_STATUSES = [
	'draft',
	'issued',
	'partially_paid',
	'paid',
	'overdue',
	'void',
	'cancelled',
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const quotations = salesSchema.table(
	'quotations',
	{
		id: text('id').primaryKey(),
		organizationId: text('organization_id').notNull(),
		code: text('code').notNull(),
		title: text('title').notNull(),
		/** Exact integer IDR minor units (ADR-0002). Never a float. */
		amount: integer('amount').notNull(),
		status: text('status').notNull().default('draft'),
		createdBy: text('created_by').notNull(),
		createdAt: unixTimestamp('created_at').notNull(),
		updatedAt: unixTimestamp('updated_at')
			.notNull()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		uniqueIndex('quotations_org_code_uq').on(table.organizationId, table.code),
		index('quotations_org_idx').on(table.organizationId),
	],
);

export const payments = salesSchema.table(
	'payments',
	{
		id: text('id').primaryKey(),
		organizationId: text('organization_id').notNull(),
		/** Plain id reference (no cross-schema FK): sales.quotations.id */
		quotationId: text('quotation_id').notNull(),
		/** Exact integer IDR minor units (ADR-0002). */
		amount: integer('amount').notNull(),
		status: text('status').notNull().default('pending'),
		createdBy: text('created_by').notNull(),
		/** Audit columns for the executed state. */
		approvedBy: text('approved_by'),
		approvedAt: unixTimestamp('approved_at'),
		executedBy: text('executed_by'),
		executedAt: unixTimestamp('executed_at'),
		createdAt: unixTimestamp('created_at').notNull(),
		updatedAt: unixTimestamp('updated_at')
			.notNull()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index('payments_org_idx').on(table.organizationId),
		index('payments_quotation_idx').on(table.quotationId),
	],
);

/* ------------------------------------------------------------------------ *
 * sales.invoices — customer invoices (finance plan D2, moved from finance.*)
 * ------------------------------------------------------------------------ */

export const invoices = salesSchema.table(
	'invoices',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		/** Logical ref to auth.organizations.id. No cross-schema FK. */
		organizationId: text('organization_id').notNull(),
		code: varchar('code', { length: 32 }).notNull(),
		invoiceType: text('invoice_type').notNull().default('sales'),
		/** Logical ref to crm.customers.id. Validated via the CRM contract. */
		customerId: uuid('customer_id'),
		/** Logical ref to sales.sales_orders.id. */
		salesOrderId: uuid('sales_order_id'),
		/** Logical ref to finance.payment_terms.id. */
		paymentTermId: uuid('payment_term_id'),
		issueDate: date('issue_date', { mode: 'string' }),
		dueDate: date('due_date', { mode: 'string' }),
		/** Exact integer IDR minor units (ADR-0002). */
		subtotal: bigint('subtotal', { mode: 'number' }).notNull().default(0),
		discountTotal: bigint('discount_total', { mode: 'number' })
			.notNull()
			.default(0),
		taxTotal: bigint('tax_total', { mode: 'number' }).notNull().default(0),
		grandTotal: bigint('grand_total', { mode: 'number' }).notNull().default(0),
		paidTotal: bigint('paid_total', { mode: 'number' }).notNull().default(0),
		outstandingTotal: bigint('outstanding_total', { mode: 'number' })
			.notNull()
			.default(0),
		currencyCode: varchar('currency_code', { length: 3 })
			.notNull()
			.default('IDR'),
		status: text('status').notNull().default('draft'),
		issuedBy: text('issued_by'),
		issuedAt: unixTimestampNullable('issued_at'),
		approvedBy: text('approved_by'),
		approvedAt: unixTimestampNullable('approved_at'),
		voidedAt: unixTimestampNullable('voided_at'),
		voidReason: text('void_reason'),
		notes: text('notes'),
		createdAt: unixTimestamp('created_at').notNull(),
		updatedAt: unixTimestamp('updated_at')
			.notNull()
			.$onUpdate(() => new Date()),
		deletedAt: unixTimestampNullable('deleted_at'),
	},
	(table) => [
		uniqueIndex('invoices_org_code_uq').on(table.organizationId, table.code),
		index('invoices_customer_id_idx').on(table.customerId),
		index('invoices_sales_order_id_idx').on(table.salesOrderId),
		index('invoices_status_idx').on(table.status),
		index('invoices_due_date_idx').on(table.dueDate),
		check(
			'invoices_type_check',
			sql`invoice_type IN ('sales', 'proforma', 'recurring')`,
		),
		check(
			'invoices_status_check',
			sql`status IN ('draft', 'issued', 'partially_paid', 'paid', 'overdue', 'void', 'cancelled')`,
		),
		check('invoices_subtotal_check', sql`subtotal >= 0`),
		check('invoices_discount_total_check', sql`discount_total >= 0`),
		check('invoices_tax_total_check', sql`tax_total >= 0`),
		check('invoices_grand_total_check', sql`grand_total >= 0`),
		check('invoices_paid_total_check', sql`paid_total >= 0`),
		check('invoices_outstanding_total_check', sql`outstanding_total >= 0`),
		check(
			'invoices_due_after_issue_check',
			sql`due_date IS NULL OR issue_date IS NULL OR due_date >= issue_date`,
		),
	],
);

export const invoiceItems = salesSchema.table(
	'invoice_items',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		organizationId: text('organization_id').notNull(),
		invoiceId: uuid('invoice_id')
			.notNull()
			.references(() => invoices.id, { onDelete: 'cascade' }),
		/** Logical refs, no cross-schema FKs. */
		itemId: uuid('item_id'),
		itemVariantId: uuid('item_variant_id'),
		description: text('description'),
		quantity: numeric('quantity', { precision: 18, scale: 4 })
			.notNull()
			.default('0'),
		unitPrice: bigint('unit_price', { mode: 'number' }).notNull().default(0),
		discountAmount: bigint('discount_amount', { mode: 'number' })
			.notNull()
			.default(0),
		taxAmount: bigint('tax_amount', { mode: 'number' }).notNull().default(0),
		lineTotal: bigint('line_total', { mode: 'number' }).notNull().default(0),
		currencyCode: varchar('currency_code', { length: 3 })
			.notNull()
			.default('IDR'),
		createdAt: unixTimestamp('created_at').notNull(),
		updatedAt: unixTimestamp('updated_at')
			.notNull()
			.$onUpdate(() => new Date()),
		deletedAt: unixTimestampNullable('deleted_at'),
	},
	(table) => [
		index('invoice_items_invoice_id_idx').on(table.invoiceId),
		index('invoice_items_item_id_idx').on(table.itemId),
		check('invoice_items_quantity_check', sql`quantity >= 0`),
		check('invoice_items_unit_price_check', sql`unit_price >= 0`),
		check('invoice_items_discount_check', sql`discount_amount >= 0`),
		check('invoice_items_tax_check', sql`tax_amount >= 0`),
		check('invoice_items_line_total_check', sql`line_total >= 0`),
	],
);

export const salesRelations = defineRelationsPart(
	{ quotations, payments, invoices, invoiceItems },
	(r) => ({
		payments: {
			quotation: r.one.quotations({
				from: r.payments.quotationId,
				to: r.quotations.id,
			}),
		},
		quotations: {
			payments: r.many.payments({
				from: r.quotations.id,
				to: r.payments.quotationId,
			}),
		},
		invoices: {
			items: r.many.invoiceItems({
				from: r.invoices.id,
				to: r.invoiceItems.invoiceId,
			}),
		},
		invoiceItems: {
			invoice: r.one.invoices({
				from: r.invoiceItems.invoiceId,
				to: r.invoices.id,
			}),
		},
	}),
);

export type TQuotationInsert = typeof quotations.$inferInsert;
export type TQuotationSelect = typeof quotations.$inferSelect;
export type TPaymentInsert = typeof payments.$inferInsert;
export type TPaymentSelect = typeof payments.$inferSelect;
export type TInvoiceInsert = typeof invoices.$inferInsert;
export type TInvoiceSelect = typeof invoices.$inferSelect;
export type TInvoiceItemInsert = typeof invoiceItems.$inferInsert;
export type TInvoiceItemSelect = typeof invoiceItems.$inferSelect;
