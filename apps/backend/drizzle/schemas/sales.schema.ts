/**
 * Sales domain schema — owns the `sales` Postgres schema.
 *
 * Quotations (SPH) with their items and status history (ADR-0011 port step
 * 3c), sales orders (step 3d), delivery notes (step 5a), plus the
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
import {
	unixTimestamp,
	unixTimestampNullable,
} from '@drizzle/datatypes/unix-timestamp';

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

export const salesRelations = defineRelationsPart(
	{ quotations, quotationItems, quotationStatusHistory, salesOrders, salesOrderItems, orderStatusHistory, deliveryNotes, deliveryNoteItems },
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
