/**
 * Sales domain schema — owns the `sales` Postgres schema.
 *
 * Quotations (SPH) with their items and status history (ADR-0011 port step
 * 3c), sales orders (step 3d), delivery notes (step 5a), customer invoices
 * and their receipts (kwitansi, owned by Sales per finance plan D2), online
 * payment checkouts of invoices (`gateway_payments`, ERP-0020), plus the
 * transitional `payments` scaffold.
 *
 * House rules honoured here:
 * - **Company-wide, no `organization_id`** on the quotation tables
 *   (ADR-0011 §2, ADR-0012), like the customers they reference.
 * - Money is bigint IDR minor units (ADR-0002); quantities `numeric(18,3)`.
 * - Business dates (`quotation_date`, `valid_until`) are Jakarta `date`
 *   strings; operational timestamps are unix ms.
 * - References to other modules (`crm`, `inventory`, `auth`) are plain id
 *   columns with no FK, validated through those modules' services.
 * Finance mirrors AR open items in `finance.ar_open_items` and receives
 * journals via the posting service; other modules reference invoices by plain
 * id (no cross-schema FKs, per modular-monolith rule).
 */
import { defineRelationsPart, sql } from 'drizzle-orm';
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
import { unixTimestamp, unixTimestampNullable } from '@drizzle/datatypes/unix-timestamp';

export const salesSchema = pgSchema('sales');

/**
 * Quotation (SPH) statuses (owner-approved M02 flow):
 * draft -> submitted -> approved | rejected; approved -> sent.
 * Any open status -> lost ("Batal", with a reason). `won` ("Deal") is
 * reached only by creating its sales order. Revising a non-draft SPH marks
 * it `superseded` and creates the next draft revision. Expiry is shown,
 * never a status.
 */
export const QUOTATION_STATUSES = [
	'draft',
	'submitted',
	'approved',
	'rejected',
	'sent',
	'superseded',
	'won',
	'lost',
] as const;
export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];

/** Statuses that can still be closed as lost. */
export const QUOTATION_OPEN_STATUSES = ['draft', 'submitted', 'approved', 'rejected', 'sent'] as const;

/** Why a quotation was lost ("Batal"); `other` needs a note. */
export const QUOTATION_LOST_REASONS = [
	'price',
	'competitor',
	'project_cancelled',
	'no_response',
	'other',
] as const;
export type QuotationLostReason = (typeof QUOTATION_LOST_REASONS)[number];

/** Customer data frozen onto the document at its last edit. */
export type TQuotationCustomerSnapshot = {
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

/**
 * Planned billing term (e.g. DP 30%). Shares are basis points and always
 * sum to 10000. A plan only: each invoice still chooses its own term.
 */
export type TPaymentScheduleItem = { label: string; percentBps: number };

/**
 * Payment states. Transitions:
 * pending -> approved -> executed
 * Execution is allowed only from `approved` and is enforced transactionally
 * with a conditional UPDATE to prevent races/double execution.
 */
export const PAYMENT_STATUSES = ['pending', 'approved', 'executed'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

const timestamps = {
	createdAt: unixTimestamp('created_at').notNull(),
	updatedAt: unixTimestamp('updated_at')
		.notNull()
		.$onUpdate(() => new Date()),
	deletedAt: unixTimestampNullable('deleted_at'),
};

/**
 * Invoice states (finance plan D2). `overdue` is derived from due_date at read
 * time, never stored (docs.dbml). Voiding is an append-only mark.
 */
export const INVOICE_TYPES = ['sales', 'proforma', 'recurring'] as const;
export type InvoiceType = (typeof INVOICE_TYPES)[number];

export const INVOICE_STATUSES = [
	'draft',
	'issued',
	'partially_paid',
	'paid',
	'void',
	'cancelled',
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

/* ------------------------------------------------------------------------ *
 * sales.quotations
 * ------------------------------------------------------------------------ */

export const quotations = salesSchema.table(
	'quotations',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		/** Base number, plus "-R<n>" for revision n >= 1. Unique among live rows. */
		code: varchar('code', { length: 40 }).notNull(),
		/** Number shared by every revision of the same SPH. */
		baseCode: varchar('base_code', { length: 32 }).notNull(),
		/** 0 = original, 1..n = revisions. */
		revision: integer('revision').notNull().default(0),
		/** The revision this one replaced (now superseded). */
		previousRevisionId: uuid('previous_revision_id').references((): AnyPgColumn => quotations.id, {
			onDelete: 'restrict',
		}),
		/** Subject ("Perihal"). */
		title: text('title').notNull(),
		/** Title in the coloured bar of the printed SPH; null prints "QUOTATION". */
		heading: varchar('heading', { length: 120 }),
		/** Logical reference to crm.customers.id — cross-module FK omitted. */
		customerId: uuid('customer_id').notNull(),
		/** Logical reference to crm.customer_contacts.id — cross-module FK omitted. */
		customerContactId: uuid('customer_contact_id'),
		customerSnapshot: jsonb('customer_snapshot').$type<TQuotationCustomerSnapshot>().notNull(),
		/** Logical reference to crm.leads.id — cross-module FK omitted. */
		leadId: uuid('lead_id'),
		/** Attention person ("Up"). */
		attention: varchar('attention', { length: 200 }),
		status: text('status').$type<QuotationStatus>().notNull().default('draft'),
		/** Jakarta business date, `YYYY-MM-DD`. */
		quotationDate: date('quotation_date').notNull(),
		/** Valid through the end of this Jakarta day; null = open-ended. */
		validUntil: date('valid_until'),
		/** Printed payment line, e.g. "DP 50% - 50% BAST". */
		paymentTerms: varchar('payment_terms', { length: 300 }),
		/** Planned billing terms; null = billed in one term. */
		paymentSchedule: jsonb('payment_schedule').$type<TPaymentScheduleItem[]>(),
		/** e.g. "1 Year Exclude Visit Location". */
		guarantee: varchar('guarantee', { length: 300 }),
		vatEnabled: boolean('vat_enabled').notNull().default(true),
		/** VAT rate snapshot in basis points (1100 = 11%); 0 when VAT is off. */
		vatRateBps: integer('vat_rate_bps').notNull().default(0),
		subtotal: bigint('subtotal', { mode: 'number' }).notNull().default(0),
		discountTotal: bigint('discount_total', { mode: 'number' }).notNull().default(0),
		taxTotal: bigint('tax_total', { mode: 'number' }).notNull().default(0),
		/** Grand total incl. VAT, IDR minor units (ADR-0002). */
		grandTotal: bigint('grand_total', { mode: 'number' }).notNull().default(0),
		currencyCode: varchar('currency_code', { length: 3 }).notNull().default('IDR'),
		notes: text('notes'),
		terms: text('terms'),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		createdBy: text('created_by'),
		submittedAt: unixTimestampNullable('submitted_at'),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		approvedBy: text('approved_by'),
		approvedAt: unixTimestampNullable('approved_at'),
		rejectedReason: text('rejected_reason'),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		sentBy: text('sent_by'),
		sentAt: unixTimestampNullable('sent_at'),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		closedBy: text('closed_by'),
		closedAt: unixTimestampNullable('closed_at'),
		lostReason: text('lost_reason').$type<QuotationLostReason>(),
		lostNote: text('lost_note'),
		...timestamps,
	},
	(table) => [
		uniqueIndex('quotations_code_uq')
			.on(table.code)
			.where(sql`deleted_at IS NULL`),
		index('quotations_base_code_idx').on(table.baseCode),
		index('quotations_customer_id_idx').on(table.customerId),
		index('quotations_status_idx').on(table.status),
		index('quotations_created_by_idx').on(table.createdBy),
		check(
			'quotations_status_check',
			sql`${table.status} IN ('draft', 'submitted', 'approved', 'rejected', 'sent', 'superseded', 'won', 'lost')`,
		),
		check(
			'quotations_lost_reason_check',
			sql`${table.lostReason} IS NULL OR ${table.lostReason} IN ('price', 'competitor', 'project_cancelled', 'no_response', 'other')`,
		),
		check('quotations_revision_check', sql`${table.revision} >= 0`),
		check('quotations_vat_rate_check', sql`${table.vatRateBps} >= 0 AND ${table.vatRateBps} <= 10000`),
		check(
			'quotations_amounts_check',
			sql`${table.subtotal} >= 0 AND ${table.discountTotal} >= 0 AND ${table.taxTotal} >= 0 AND ${table.grandTotal} >= 0`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * sales.quotation_items
 * ------------------------------------------------------------------------ */

export const quotationItems = salesSchema.table(
	'quotation_items',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		quotationId: uuid('quotation_id')
			.notNull()
			.references(() => quotations.id, { onDelete: 'cascade' }),
		/** Logical reference to inventory.items.id; null = custom line. */
		itemId: uuid('item_id'),
		sku: varchar('sku', { length: 64 }),
		/** Item name snapshot (printed bold). */
		name: text('name').notNull(),
		/** Multi-line specification printed under the name. */
		specification: text('specification'),
		/** Snapshot of the item's document photo (keys are never overwritten). */
		imageObjectKey: text('image_object_key'),
		/** One of the fixed item units. */
		unit: varchar('unit', { length: 32 }).notNull(),
		quantity: numeric('quantity', { precision: 18, scale: 3 }).notNull().default('1'),
		unitPrice: bigint('unit_price', { mode: 'number' }).notNull().default(0),
		discountAmount: bigint('discount_amount', { mode: 'number' }).notNull().default(0),
		/** round(quantity × unit_price) − discount_amount. */
		lineTotal: bigint('line_total', { mode: 'number' }).notNull().default(0),
		sortOrder: integer('sort_order').notNull().default(0),
		...timestamps,
	},
	(table) => [
		index('quotation_items_quotation_sort_idx').on(table.quotationId, table.sortOrder),
		check(
			'quotation_items_amounts_check',
			sql`${table.quantity} > 0 AND ${table.unitPrice} >= 0 AND ${table.discountAmount} >= 0 AND ${table.lineTotal} >= 0`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * sales.quotation_status_history (append-only)
 * ------------------------------------------------------------------------ */

export const quotationStatusHistory = salesSchema.table(
	'quotation_status_history',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		quotationId: uuid('quotation_id')
			.notNull()
			.references(() => quotations.id, { onDelete: 'cascade' }),
		fromStatus: text('from_status'),
		toStatus: text('to_status').notNull(),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		changedBy: text('changed_by'),
		changedAt: unixTimestamp('changed_at').notNull(),
		note: text('note'),
		...timestamps,
	},
	(table) => [index('quotation_status_history_quotation_id_idx').on(table.quotationId)],
);

/**
 * Sales order statuses. `confirmed` = active: an order is created from an
 * approved or sent SPH and needs no further approval. `in_progress`,
 * `delivered` and `completed` are reserved for fulfilment (steps 4-5).
 */
export const SALES_ORDER_STATUSES = ['confirmed', 'in_progress', 'delivered', 'completed', 'cancelled'] as const;
export type SalesOrderStatus = (typeof SALES_ORDER_STATUSES)[number];

export const FULFILLMENT_STATUSES = ['pending', 'reserved', 'partial', 'fulfilled', 'cancelled'] as const;
export type FulfillmentStatus = (typeof FULFILLMENT_STATUSES)[number];

/* ------------------------------------------------------------------------ *
 * sales.sales_orders
 * ------------------------------------------------------------------------ */

export const salesOrders = salesSchema.table(
	'sales_orders',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		code: varchar('code', { length: 32 }).notNull(),
		/** The SPH this order closed as Deal; one live order per SPH. */
		quotationId: uuid('quotation_id')
			.notNull()
			.references(() => quotations.id, { onDelete: 'restrict' }),
		/** Number of that SPH revision. */
		quotationCode: varchar('quotation_code', { length: 40 }).notNull(),
		/** Logical reference to crm.customers.id — cross-module FK omitted. */
		customerId: uuid('customer_id').notNull(),
		customerSnapshot: jsonb('customer_snapshot').$type<TQuotationCustomerSnapshot>().notNull(),
		customerPoNumber: varchar('customer_po_number', { length: 100 }),
		title: text('title').notNull(),
		attention: varchar('attention', { length: 200 }),
		status: text('status').$type<SalesOrderStatus>().notNull().default('confirmed'),
		/** Jakarta business date, `YYYY-MM-DD`. */
		orderDate: date('order_date').notNull(),
		deliveryDate: date('delivery_date'),
		paymentTerms: varchar('payment_terms', { length: 300 }),
		paymentSchedule: jsonb('payment_schedule').$type<TPaymentScheduleItem[]>(),
		guarantee: varchar('guarantee', { length: 300 }),
		vatEnabled: boolean('vat_enabled').notNull(),
		vatRateBps: integer('vat_rate_bps').notNull().default(0),
		subtotal: bigint('subtotal', { mode: 'number' }).notNull().default(0),
		discountTotal: bigint('discount_total', { mode: 'number' }).notNull().default(0),
		taxTotal: bigint('tax_total', { mode: 'number' }).notNull().default(0),
		grandTotal: bigint('grand_total', { mode: 'number' }).notNull().default(0),
		currencyCode: varchar('currency_code', { length: 3 }).notNull().default('IDR'),
		/** Logical reference to auth.users.id — the SPH owner (visibility). */
		salesPersonUserId: text('sales_person_user_id'),
		notes: text('notes'),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		createdBy: text('created_by'),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		cancelledBy: text('cancelled_by'),
		cancelledAt: unixTimestampNullable('cancelled_at'),
		cancellationReason: text('cancellation_reason'),
		...timestamps,
	},
	(table) => [
		uniqueIndex('sales_orders_code_uq')
			.on(table.code)
			.where(sql`deleted_at IS NULL`),
		uniqueIndex('sales_orders_live_quotation_uq')
			.on(table.quotationId)
			.where(sql`deleted_at IS NULL AND status <> 'cancelled'`),
		index('sales_orders_quotation_id_idx').on(table.quotationId),
		index('sales_orders_customer_id_idx').on(table.customerId),
		index('sales_orders_status_idx').on(table.status),
		index('sales_orders_sales_person_idx').on(table.salesPersonUserId),
		check(
			'sales_orders_status_check',
			sql`${table.status} IN ('confirmed', 'in_progress', 'delivered', 'completed', 'cancelled')`,
		),
		check('sales_orders_vat_rate_check', sql`${table.vatRateBps} >= 0 AND ${table.vatRateBps} <= 10000`),
		check(
			'sales_orders_amounts_check',
			sql`${table.subtotal} >= 0 AND ${table.discountTotal} >= 0 AND ${table.taxTotal} >= 0 AND ${table.grandTotal} >= 0`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * sales.sales_order_items
 * ------------------------------------------------------------------------ */

export const salesOrderItems = salesSchema.table(
	'sales_order_items',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		salesOrderId: uuid('sales_order_id')
			.notNull()
			.references(() => salesOrders.id, { onDelete: 'cascade' }),
		quotationItemId: uuid('quotation_item_id').references(() => quotationItems.id, { onDelete: 'restrict' }),
		/** Logical reference to inventory.items.id; null = custom line. */
		itemId: uuid('item_id'),
		sku: varchar('sku', { length: 64 }),
		name: text('name').notNull(),
		specification: text('specification'),
		unit: varchar('unit', { length: 32 }).notNull(),
		quantity: numeric('quantity', { precision: 18, scale: 3 }).notNull().default('1'),
		unitPrice: bigint('unit_price', { mode: 'number' }).notNull().default(0),
		discountAmount: bigint('discount_amount', { mode: 'number' }).notNull().default(0),
		lineTotal: bigint('line_total', { mode: 'number' }).notNull().default(0),
		quantityDelivered: numeric('quantity_delivered', { precision: 18, scale: 3 }).notNull().default('0'),
		fulfillmentStatus: text('fulfillment_status').$type<FulfillmentStatus>().notNull().default('pending'),
		sortOrder: integer('sort_order').notNull().default(0),
		...timestamps,
	},
	(table) => [
		index('sales_order_items_order_sort_idx').on(table.salesOrderId, table.sortOrder),
		index('sales_order_items_fulfillment_status_idx').on(table.fulfillmentStatus),
		check(
			'sales_order_items_amounts_check',
			sql`${table.quantity} > 0 AND ${table.unitPrice} >= 0 AND ${table.discountAmount} >= 0 AND ${table.lineTotal} >= 0 AND ${table.quantityDelivered} >= 0`,
		),
		check(
			'sales_order_items_fulfillment_status_check',
			sql`${table.fulfillmentStatus} IN ('pending', 'reserved', 'partial', 'fulfilled', 'cancelled')`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * sales.order_status_history (append-only)
 * ------------------------------------------------------------------------ */

export const orderStatusHistory = salesSchema.table(
	'order_status_history',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		salesOrderId: uuid('sales_order_id')
			.notNull()
			.references(() => salesOrders.id, { onDelete: 'cascade' }),
		fromStatus: text('from_status'),
		toStatus: text('to_status').notNull(),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		changedBy: text('changed_by'),
		changedAt: unixTimestamp('changed_at').notNull(),
		note: text('note'),
		...timestamps,
	},
	(table) => [index('order_status_history_sales_order_id_idx').on(table.salesOrderId)],
);

/* ------------------------------------------------------------------------ *
 * sales.delivery_notes / sales.delivery_note_items (step 5a)
 * ------------------------------------------------------------------------ */

/**
 * Delivery note (surat jalan) states. `prepared` is numbered and printable;
 * shipping posts the stock issue and sells the serial units; `delivered`
 * records who received it. Only `prepared` may be cancelled.
 */
export const DELIVERY_NOTE_STATUSES = ['prepared', 'shipped', 'delivered', 'cancelled'] as const;
export type DeliveryNoteStatus = (typeof DELIVERY_NOTE_STATUSES)[number];

export const deliveryNotes = salesSchema.table(
	'delivery_notes',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		code: varchar('code', { length: 32 }).notNull(),
		salesOrderId: uuid('sales_order_id')
			.notNull()
			.references(() => salesOrders.id, { onDelete: 'restrict' }),
		/** Logical reference to inventory.warehouses.id — cross-module FK omitted. */
		warehouseId: uuid('warehouse_id').notNull(),
		/** Logical reference to inventory.warehouse_storages.id — cross-module FK omitted. */
		binId: uuid('bin_id'),
		status: text('status').$type<DeliveryNoteStatus>().notNull().default('prepared'),
		/** Jakarta business date, `YYYY-MM-DD`. */
		deliveryDate: date('delivery_date').notNull(),
		projectName: text('project_name'),
		projectLocation: text('project_location'),
		recipientName: text('recipient_name').notNull(),
		recipientAddress: text('recipient_address'),
		recipientPic: varchar('recipient_pic', { length: 200 }),
		recipientContact: varchar('recipient_contact', { length: 200 }),
		driverName: varchar('driver_name', { length: 200 }),
		vehicleNumber: varchar('vehicle_number', { length: 32 }),
		notes: text('notes'),
		shippedAt: unixTimestampNullable('shipped_at'),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		shippedBy: text('shipped_by'),
		receivedAt: unixTimestampNullable('received_at'),
		receiverName: text('receiver_name'),
		cancelledAt: unixTimestampNullable('cancelled_at'),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		cancelledBy: text('cancelled_by'),
		cancellationReason: text('cancellation_reason'),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		createdBy: text('created_by'),
		...timestamps,
	},
	(table) => [
		uniqueIndex('delivery_notes_code_uq')
			.on(table.code)
			.where(sql`deleted_at IS NULL`),
		index('delivery_notes_sales_order_id_idx').on(table.salesOrderId),
		index('delivery_notes_status_idx').on(table.status),
		check('delivery_notes_status_check', sql`${table.status} IN ('prepared', 'shipped', 'delivered', 'cancelled')`),
	],
);

export const deliveryNoteItems = salesSchema.table(
	'delivery_note_items',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		deliveryNoteId: uuid('delivery_note_id')
			.notNull()
			.references(() => deliveryNotes.id, { onDelete: 'cascade' }),
		salesOrderItemId: uuid('sales_order_item_id')
			.notNull()
			.references(() => salesOrderItems.id, { onDelete: 'restrict' }),
		/** Logical reference to inventory.items.id; null = custom order line. */
		itemId: uuid('item_id'),
		sku: varchar('sku', { length: 64 }),
		name: text('name').notNull(),
		unit: varchar('unit', { length: 32 }).notNull(),
		quantity: numeric('quantity', { precision: 18, scale: 3 }).notNull(),
		/** Order unit price, printed as Harga. */
		unitPrice: bigint('unit_price', { mode: 'number' }).notNull().default(0),
		/** Moving-average cost the issue took; null until shipped or for non-stock lines. */
		unitCost: bigint('unit_cost', { mode: 'number' }),
		serialNumbers: jsonb('serial_numbers').$type<string[]>(),
		remarks: text('remarks'),
		/** Logical reference to inventory.stock_movements.id — cross-module FK omitted. */
		stockMovementId: uuid('stock_movement_id'),
		sortOrder: integer('sort_order').notNull().default(0),
		...timestamps,
	},
	(table) => [
		index('delivery_note_items_delivery_note_id_idx').on(table.deliveryNoteId),
		index('delivery_note_items_sales_order_item_id_idx').on(table.salesOrderItemId),
		check('delivery_note_items_amounts_check', sql`${table.quantity} > 0 AND ${table.unitPrice} >= 0`),
	],
);

/* ------------------------------------------------------------------------ *
 * sales.payments (transitional scaffold, dropped in S7)
 * ------------------------------------------------------------------------ */

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
		/** Numbering authority (INV-…). Nullable: a draft may exist without a code. */
		code: varchar('code', { length: 32 }),
		invoiceType: text('invoice_type').notNull().default('sales'),
		/**
		 * down_payment = first live invoice of its order that does not settle
		 * it; settlement = the one that settles it; installment otherwise.
		 * Null when the invoice is not billed against an order term.
		 */
		termKind: text('term_kind'),
		/** Logical ref to crm.customers.id. Validated via the CRM contract. */
		customerId: uuid('customer_id'),
		/** Customer data copied from the sales order. Null when no order. */
		customerSnapshot: jsonb('customer_snapshot').$type<TQuotationCustomerSnapshot | null>(),
		/** Logical ref to sales.sales_orders.id. */
		salesOrderId: uuid('sales_order_id'),
		salesOrderCode: varchar('sales_order_code', { length: 32 }),
		/** The SPH number printed as No. Ref. */
		quotationCode: varchar('quotation_code', { length: 40 }),
		/** Subject (Perihal), from the order. */
		title: text('title'),
		/** Term label, e.g. DP 30% or Pelunasan. */
		description: text('description'),
		/** Share of the order tax base when billed by percentage. */
		percentageBps: integer('percentage_bps'),
		/** Logical ref to finance.payment_terms.id. */
		paymentTermId: uuid('payment_term_id'),
		issueDate: date('issue_date', { mode: 'string' }),
		dueDate: date('due_date', { mode: 'string' }),
		vatEnabled: boolean('vat_enabled').notNull().default(true),
		vatRateBps: integer('vat_rate_bps').notNull().default(0),
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
		/** Terms and conditions printed on the invoice, from company profile. */
		terms: text('terms'),
		notes: text('notes'),
		/** Logical ref to auth.users.id. */
		createdBy: text('created_by'),
		issuedBy: text('issued_by'),
		issuedAt: unixTimestampNullable('issued_at'),
		approvedBy: text('approved_by'),
		approvedAt: unixTimestampNullable('approved_at'),
		/** Logical ref to auth.users.id. */
		voidedBy: text('voided_by'),
		voidedAt: unixTimestampNullable('voided_at'),
		voidReason: text('void_reason'),
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
		index('invoices_term_kind_idx').on(table.termKind),
		check(
			'invoices_type_check',
			sql`invoice_type IN ('sales', 'proforma', 'recurring')`,
		),
		check(
			'invoices_term_kind_check',
			sql`term_kind IS NULL OR term_kind IN ('down_payment', 'installment', 'settlement')`,
		),
		check(
			'invoices_status_check',
			sql`status IN ('draft', 'issued', 'partially_paid', 'paid', 'void', 'cancelled')`,
		),
		check(
			'invoices_vat_rate_check',
			sql`vat_rate_bps >= 0 AND vat_rate_bps <= 10000`,
		),
		check('invoices_subtotal_check', sql`subtotal >= 0`),
		check('invoices_discount_total_check', sql`discount_total >= 0`),
		check('invoices_tax_total_check', sql`tax_total >= 0`),
		check('invoices_grand_total_check', sql`grand_total >= 0`),
		check(
			'invoices_paid_total_check',
			sql`paid_total >= 0 AND paid_total <= grand_total`,
		),
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

/* ------------------------------------------------------------------------ *
 * sales.receipts (kwitansi, owned by Sales; moved from finance.receipts)
 * ------------------------------------------------------------------------ */

export const RECEIPT_STATUSES = ['draft', 'verified', 'posted', 'reversed', 'void'] as const;
export type ReceiptStatus = (typeof RECEIPT_STATUSES)[number];

export const RECEIPT_METHODS = ['bank_transfer', 'cash', 'card', 'e_wallet', 'cheque'] as const;
export type ReceiptMethod = (typeof RECEIPT_METHODS)[number];

export const receipts = salesSchema.table(
	'receipts',
	{
		id: uuid('id').primaryKey().default(sql`uuidv7()`),
		organizationId: text('organization_id').notNull(),
		code: varchar('code', { length: 32 }).notNull(),
		/** Plain id of a row in sales.invoices (same module). */
		salesInvoiceId: uuid('sales_invoice_id').notNull(),
		/** Logical reference to finance.payments.id; validated via the Finance contract. */
		paymentId: uuid('payment_id'),
		receivedDate: date('received_date', { mode: 'string' }),
		amount: bigint('amount', { mode: 'number' }).notNull().default(0),
		currencyCode: varchar('currency_code', { length: 3 }).notNull().default('IDR'),
		method: text('method').notNull().default('bank_transfer'),
		reference: varchar('reference', { length: 100 }),
		notes: text('notes'),
		status: text('status').notNull().default('draft'),
		/** Logical reference to auth.users.id. */
		receivedBy: text('received_by'),
		postedAt: unixTimestampNullable('posted_at'),
		/** Logical reference to auth.users.id. */
		reversedBy: text('reversed_by'),
		reversedAt: unixTimestampNullable('reversed_at'),
		reversalReason: text('reversal_reason'),
		createdAt: unixTimestamp('created_at').notNull(),
		updatedAt: unixTimestamp('updated_at')
			.notNull()
			.$onUpdate(() => new Date()),
		deletedAt: unixTimestampNullable('deleted_at'),
	},
	(table) => [
		uniqueIndex('receipts_org_code_uq').on(table.organizationId, table.code),
		index('receipts_sales_invoice_id_idx').on(table.salesInvoiceId),
		index('receipts_payment_id_idx').on(table.paymentId),
		index('receipts_status_idx').on(table.status),
		check(
			'receipts_status_check',
			sql`status IN ('draft', 'verified', 'posted', 'reversed', 'void')`,
		),
		check('receipts_amount_check', sql`amount > 0`),
		check(
			'receipts_method_check',
			sql`method IN ('bank_transfer', 'cash', 'card', 'e_wallet', 'cheque')`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * sales.gateway_payments — online checkouts of invoices (ERP-0020, ADR-0021)
 * ------------------------------------------------------------------------ */

export const GATEWAY_PROVIDERS = ['xendit', 'singapay', 'fake'] as const;
export type TGatewayProvider = (typeof GATEWAY_PROVIDERS)[number];

export const GATEWAY_PAYMENT_STATUSES = ['pending', 'paid', 'expired', 'failed'] as const;
export type TGatewayPaymentStatus = (typeof GATEWAY_PAYMENT_STATUSES)[number];

export const gatewayPayments = salesSchema.table(
	'gateway_payments',
	{
		/** Also the merchant reference sent to the provider. */
		id: uuid('id').primaryKey().default(sql`uuidv7()`),
		/** Logical reference to auth.organizations.id; nullable per ADR-0014. */
		organizationId: text('organization_id'),
		salesInvoiceId: uuid('sales_invoice_id')
			.notNull()
			.references(() => invoices.id, { onDelete: 'restrict' }),
		provider: text('provider').$type<TGatewayProvider>().notNull(),
		providerReference: varchar('provider_reference', { length: 100 }),
		paymentUrl: text('payment_url'),
		/** IDR minor units, the outstanding rounded up to whole rupiah. */
		amount: bigint('amount', { mode: 'number' }).notNull(),
		currencyCode: varchar('currency_code', { length: 3 }).notNull().default('IDR'),
		status: text('status').$type<TGatewayPaymentStatus>().notNull().default('pending'),
		expiresAt: unixTimestampNullable('expires_at'),
		paidAt: unixTimestampNullable('paid_at'),
		paidAmount: bigint('paid_amount', { mode: 'number' }),
		paymentChannel: text('payment_channel'),
		providerTransactionId: varchar('provider_transaction_id', { length: 100 }),
		receiptId: uuid('receipt_id').references(() => receipts.id, { onDelete: 'restrict' }),
		settlementNote: text('settlement_note'),
		lastEvent: jsonb('last_event'),
		/** Logical reference to auth.users.id. */
		requestedBy: text('requested_by'),
		createdAt: unixTimestamp('created_at').notNull(),
		updatedAt: unixTimestamp('updated_at')
			.notNull()
			.$onUpdate(() => new Date()),
		deletedAt: unixTimestampNullable('deleted_at'),
	},
	(table) => [
		index('gateway_payments_sales_invoice_id_idx').on(table.salesInvoiceId),
		index('gateway_payments_status_idx').on(table.status),
		uniqueIndex('gateway_payments_provider_reference_uq')
			.on(table.provider, table.providerReference)
			.where(sql`provider_reference IS NOT NULL`),
		uniqueIndex('gateway_payments_receipt_id_uq')
			.on(table.receiptId)
			.where(sql`receipt_id IS NOT NULL`),
		check('gateway_payments_provider_check', sql`provider IN ('xendit', 'singapay', 'fake')`),
		check('gateway_payments_status_check', sql`status IN ('pending', 'paid', 'expired', 'failed')`),
		check('gateway_payments_amount_check', sql`amount > 0`),
		check('gateway_payments_paid_amount_check', sql`paid_amount IS NULL OR paid_amount >= 0`),
	],
);

export const salesRelations = defineRelationsPart(
	{ quotations, quotationItems, quotationStatusHistory, salesOrders, salesOrderItems, orderStatusHistory, deliveryNotes, deliveryNoteItems, payments, invoices, invoiceItems, receipts, gatewayPayments },
	(r) => ({
		quotations: {
			items: r.many.quotationItems({
				from: r.quotations.id,
				to: r.quotationItems.quotationId,
			}),
			history: r.many.quotationStatusHistory({
				from: r.quotations.id,
				to: r.quotationStatusHistory.quotationId,
			}),
		},
		quotationItems: {
			quotation: r.one.quotations({
				from: r.quotationItems.quotationId,
				to: r.quotations.id,
			}),
		},
		salesOrders: {
			items: r.many.salesOrderItems({
				from: r.salesOrders.id,
				to: r.salesOrderItems.salesOrderId,
			}),
		},
		salesOrderItems: {
			order: r.one.salesOrders({
				from: r.salesOrderItems.salesOrderId,
				to: r.salesOrders.id,
			}),
		},
		deliveryNotes: {
			items: r.many.deliveryNoteItems({
				from: r.deliveryNotes.id,
				to: r.deliveryNoteItems.deliveryNoteId,
			}),
		},
		quotationStatusHistory: {
			quotation: r.one.quotations({
				from: r.quotationStatusHistory.quotationId,
				to: r.quotations.id,
			}),
		},
		invoices: {
			items: r.many.invoiceItems({
				from: r.invoices.id,
				to: r.invoiceItems.invoiceId,
			}),
			receipts: r.many.receipts({
				from: r.invoices.id,
				to: r.receipts.salesInvoiceId,
			}),
		},
		invoiceItems: {
			invoice: r.one.invoices({
				from: r.invoiceItems.invoiceId,
				to: r.invoices.id,
			}),
		},
		receipts: {
			invoice: r.one.invoices({
				from: r.receipts.salesInvoiceId,
				to: r.invoices.id,
			}),
		},
		gatewayPayments: {
			invoice: r.one.invoices({
				from: r.gatewayPayments.salesInvoiceId,
				to: r.invoices.id,
			}),
		},
	}),
);

export type TQuotationInsert = typeof quotations.$inferInsert;
export type TQuotationSelect = typeof quotations.$inferSelect;
export type TQuotationItemInsert = typeof quotationItems.$inferInsert;
export type TQuotationItemSelect = typeof quotationItems.$inferSelect;
export type TQuotationStatusHistorySelect = typeof quotationStatusHistory.$inferSelect;
export type TSalesOrderInsert = typeof salesOrders.$inferInsert;
export type TSalesOrderSelect = typeof salesOrders.$inferSelect;
export type TSalesOrderItemInsert = typeof salesOrderItems.$inferInsert;
export type TSalesOrderItemSelect = typeof salesOrderItems.$inferSelect;
export type TOrderStatusHistorySelect = typeof orderStatusHistory.$inferSelect;
export type TDeliveryNoteInsert = typeof deliveryNotes.$inferInsert;
export type TDeliveryNoteSelect = typeof deliveryNotes.$inferSelect;
export type TDeliveryNoteItemInsert = typeof deliveryNoteItems.$inferInsert;
export type TDeliveryNoteItemSelect = typeof deliveryNoteItems.$inferSelect;
export type TPaymentInsert = typeof payments.$inferInsert;
export type TPaymentSelect = typeof payments.$inferSelect;
export type TInvoiceInsert = typeof invoices.$inferInsert;

export type TReceiptInsert = typeof receipts.$inferInsert;
export type TReceiptSelect = typeof receipts.$inferSelect;
export type TInvoiceSelect = typeof invoices.$inferSelect;
export type TInvoiceItemInsert = typeof invoiceItems.$inferInsert;
export type TInvoiceItemSelect = typeof invoiceItems.$inferSelect;
export type TGatewayPaymentInsert = typeof gatewayPayments.$inferInsert;
export type TGatewayPaymentSelect = typeof gatewayPayments.$inferSelect;
