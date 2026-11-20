/**
 * Sale module schema — owns the `sale` Postgres schema (was `sales`).
 *
 * @remarks
 * Quotation -> order -> delivery note -> invoice -> receipt. Company-wide
 * (ADR-0011): no `organization_id` on the quotation/order/delivery tables.
 * `sales.payments` (legacy scaffold) is gone; item references point at
 * `inventory.products` and the person on a document is `customer.customers`
 * (`customer_contact_id` is dropped, ADR-0024 Q16).
 *
 * Target-only tables (`discount_requests`, `contracts`, `targets`) are defined
 * in `docs.dbml` only (Q22).
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

export const saleSchema = pgSchema('sale');

/* ------------------------------------------------------------------------ *
 * Vocabularies
 * ------------------------------------------------------------------------ */

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

export const QUOTATION_LOST_REASONS = [
	'price',
	'competitor',
	'project_cancelled',
	'no_response',
	'other',
] as const;
export type QuotationLostReason = (typeof QUOTATION_LOST_REASONS)[number];

/** Customer data frozen onto the document at its last edit. */
export type TCustomerSnapshot = {
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

/** Planned billing term (e.g. DP 30%). Shares are basis points summing to 10000. */
export type TPaymentScheduleItem = { label: string; percentBps: number };

export const ORDER_STATUSES = [
	'confirmed',
	'in_progress',
	'delivered',
	'completed',
	'cancelled',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const FULFILLMENT_STATUSES = [
	'pending',
	'reserved',
	'partial',
	'fulfilled',
	'cancelled',
] as const;
export type FulfillmentStatus = (typeof FULFILLMENT_STATUSES)[number];

export const DELIVERY_NOTE_STATUSES = [
	'prepared',
	'shipped',
	'delivered',
	'cancelled',
] as const;
export type DeliveryNoteStatus = (typeof DELIVERY_NOTE_STATUSES)[number];

export const RETURN_STATUSES = [
	'draft',
	'submitted',
	'approved',
	'received',
	'cancelled',
] as const;
export type ReturnStatus = (typeof RETURN_STATUSES)[number];

export const RETURN_CONDITIONS = ['good', 'damaged'] as const;
export type ReturnCondition = (typeof RETURN_CONDITIONS)[number];

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

export const RECEIPT_STATUSES = [
	'draft',
	'verified',
	'posted',
	'reversed',
	'void',
] as const;
export type ReceiptStatus = (typeof RECEIPT_STATUSES)[number];

export const RECEIPT_METHODS = [
	'bank_transfer',
	'cash',
	'card',
	'e_wallet',
	'cheque',
] as const;
export type ReceiptMethod = (typeof RECEIPT_METHODS)[number];

const timestamps = {
	createdAt: unixTimestamp('created_at').notNull(),
	updatedAt: unixTimestamp('updated_at')
		.notNull()
		.$onUpdate(() => new Date()),
	deletedAt: unixTimestampNullable('deleted_at'),
};

/* ------------------------------------------------------------------------ *
 * sale.quotations / quotation_items / quotation_status_history
 * ------------------------------------------------------------------------ */

export const quotations = saleSchema.table(
	'quotations',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		code: varchar('code', { length: 40 }).notNull(),
		baseCode: varchar('base_code', { length: 32 }).notNull(),
		revision: integer('revision').notNull().default(0),
		previousRevisionId: uuid('previous_revision_id').references(
			(): AnyPgColumn => quotations.id,
			{ onDelete: 'restrict' },
		),
		title: text('title').notNull(),
		heading: varchar('heading', { length: 120 }),
		/** Logical reference to customer.customers.id — cross-module FK omitted. */
		customerId: uuid('customer_id'),
		/** Logical reference to customer.companies.id — cross-module FK omitted. */
		companyId: uuid('company_id'),
		customerSnapshot: jsonb('customer_snapshot')
			.$type<TCustomerSnapshot>()
			.notNull(),
		/** Logical reference to project.leads.id — cross-module FK omitted. */
		leadId: uuid('lead_id'),
		attention: varchar('attention', { length: 200 }),
		status: text('status').$type<QuotationStatus>().notNull().default('draft'),
		quotationDate: date('quotation_date').notNull(),
		validUntil: date('valid_until'),
		paymentTerms: varchar('payment_terms', { length: 300 }),
		paymentSchedule: jsonb('payment_schedule').$type<TPaymentScheduleItem[]>(),
		guarantee: varchar('guarantee', { length: 300 }),
		vatEnabled: boolean('vat_enabled').notNull().default(true),
		vatRateBps: integer('vat_rate_bps').notNull().default(0),
		subtotal: bigint('subtotal', { mode: 'number' }).notNull().default(0),
		discountTotal: bigint('discount_total', { mode: 'number' })
			.notNull()
			.default(0),
		taxTotal: bigint('tax_total', { mode: 'number' }).notNull().default(0),
		grandTotal: bigint('grand_total', { mode: 'number' }).notNull().default(0),
		currencyCode: varchar('currency_code', { length: 3 })
			.notNull()
			.default('IDR'),
		notes: text('notes'),
		terms: text('terms'),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		createdBy: text('created_by'),
		submittedAt: unixTimestampNullable('submitted_at'),
		approvedBy: text('approved_by'),
		approvedAt: unixTimestampNullable('approved_at'),
		rejectedReason: text('rejected_reason'),
		sentBy: text('sent_by'),
		sentAt: unixTimestampNullable('sent_at'),
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
		index('quotations_company_id_idx').on(table.companyId),
		index('quotations_status_idx').on(table.status),
		index('quotations_created_by_idx').on(table.createdBy),
		check(
			'quotations_status_check',
			sql`status IN ('draft', 'submitted', 'approved', 'rejected', 'sent', 'superseded', 'won', 'lost')`,
		),
		check(
			'quotations_lost_reason_check',
			sql`lost_reason IS NULL OR lost_reason IN ('price', 'competitor', 'project_cancelled', 'no_response', 'other')`,
		),
		check('quotations_revision_check', sql`revision >= 0`),
		check(
			'quotations_vat_rate_check',
			sql`vat_rate_bps >= 0 AND vat_rate_bps <= 10000`,
		),
		check(
			'quotations_amounts_check',
			sql`subtotal >= 0 AND discount_total >= 0 AND tax_total >= 0 AND grand_total >= 0`,
		),
	],
);

export const quotationItems = saleSchema.table(
	'quotation_items',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		quotationId: uuid('quotation_id')
			.notNull()
			.references(() => quotations.id, { onDelete: 'cascade' }),
		/** Logical reference to inventory.products.id; null = custom line. */
		productId: uuid('product_id'),
		sku: varchar('sku', { length: 64 }),
		name: text('name').notNull(),
		specification: text('specification'),
		imageObjectKey: text('image_object_key'),
		unit: varchar('unit', { length: 32 }).notNull(),
		quantity: numeric('quantity', { precision: 18, scale: 3 })
			.notNull()
			.default('1'),
		unitPrice: bigint('unit_price', { mode: 'number' }).notNull().default(0),
		discountAmount: bigint('discount_amount', { mode: 'number' })
			.notNull()
			.default(0),
		lineTotal: bigint('line_total', { mode: 'number' }).notNull().default(0),
		sortOrder: integer('sort_order').notNull().default(0),
		...timestamps,
	},
	(table) => [
		index('quotation_items_quotation_sort_idx').on(
			table.quotationId,
			table.sortOrder,
		),
		check(
			'quotation_items_amounts_check',
			sql`quantity > 0 AND unit_price >= 0 AND discount_amount >= 0 AND line_total >= 0`,
		),
	],
);

export const quotationStatusHistory = saleSchema.table(
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
	(table) => [
		index('quotation_status_history_quotation_id_idx').on(table.quotationId),
	],
);

/* ------------------------------------------------------------------------ *
 * sale.orders / order_items / order_status_history
 * ------------------------------------------------------------------------ */

export const orders = saleSchema.table(
	'orders',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		code: varchar('code', { length: 32 }).notNull(),
		quotationId: uuid('quotation_id')
			.notNull()
			.references(() => quotations.id, { onDelete: 'restrict' }),
		quotationCode: varchar('quotation_code', { length: 40 }).notNull(),
		/** Logical reference to customer.customers.id — cross-module FK omitted. */
		customerId: uuid('customer_id'),
		/** Logical reference to customer.companies.id — cross-module FK omitted. */
		companyId: uuid('company_id'),
		/** Logical reference to project.leads.id — cross-module FK omitted. */
		leadId: uuid('lead_id'),
		customerSnapshot: jsonb('customer_snapshot')
			.$type<TCustomerSnapshot>()
			.notNull(),
		customerPoNumber: varchar('customer_po_number', { length: 100 }),
		title: text('title').notNull(),
		attention: varchar('attention', { length: 200 }),
		status: text('status').$type<OrderStatus>().notNull().default('confirmed'),
		orderDate: date('order_date').notNull(),
		deliveryDate: date('delivery_date'),
		paymentTerms: varchar('payment_terms', { length: 300 }),
		paymentSchedule: jsonb('payment_schedule').$type<TPaymentScheduleItem[]>(),
		guarantee: varchar('guarantee', { length: 300 }),
		vatEnabled: boolean('vat_enabled').notNull(),
		vatRateBps: integer('vat_rate_bps').notNull().default(0),
		subtotal: bigint('subtotal', { mode: 'number' }).notNull().default(0),
		discountTotal: bigint('discount_total', { mode: 'number' })
			.notNull()
			.default(0),
		taxTotal: bigint('tax_total', { mode: 'number' }).notNull().default(0),
		grandTotal: bigint('grand_total', { mode: 'number' }).notNull().default(0),
		currencyCode: varchar('currency_code', { length: 3 })
			.notNull()
			.default('IDR'),
		salesPersonUserId: text('sales_person_user_id'),
		notes: text('notes'),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		createdBy: text('created_by'),
		cancelledBy: text('cancelled_by'),
		cancelledAt: unixTimestampNullable('cancelled_at'),
		cancellationReason: text('cancellation_reason'),
		...timestamps,
	},
	(table) => [
		uniqueIndex('orders_code_uq')
			.on(table.code)
			.where(sql`deleted_at IS NULL`),
		uniqueIndex('orders_live_quotation_uq')
			.on(table.quotationId)
			.where(sql`deleted_at IS NULL AND status <> 'cancelled'`),
		index('orders_quotation_id_idx').on(table.quotationId),
		index('orders_customer_id_idx').on(table.customerId),
		index('orders_company_id_idx').on(table.companyId),
		index('orders_status_idx').on(table.status),
		index('orders_sales_person_idx').on(table.salesPersonUserId),
		check(
			'orders_status_check',
			sql`status IN ('confirmed', 'in_progress', 'delivered', 'completed', 'cancelled')`,
		),
		check('orders_vat_rate_check', sql`vat_rate_bps >= 0 AND vat_rate_bps <= 10000`),
		check(
			'orders_amounts_check',
			sql`subtotal >= 0 AND discount_total >= 0 AND tax_total >= 0 AND grand_total >= 0`,
		),
	],
);

export const orderItems = saleSchema.table(
	'order_items',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		orderId: uuid('order_id')
			.notNull()
			.references(() => orders.id, { onDelete: 'cascade' }),
		quotationItemId: uuid('quotation_item_id').references(
			() => quotationItems.id,
			{ onDelete: 'restrict' },
		),
		/** Logical reference to inventory.products.id; null = custom line. */
		productId: uuid('product_id'),
		sku: varchar('sku', { length: 64 }),
		name: text('name').notNull(),
		specification: text('specification'),
		unit: varchar('unit', { length: 32 }).notNull(),
		quantity: numeric('quantity', { precision: 18, scale: 3 })
			.notNull()
			.default('1'),
		unitPrice: bigint('unit_price', { mode: 'number' }).notNull().default(0),
		discountAmount: bigint('discount_amount', { mode: 'number' })
			.notNull()
			.default(0),
		lineTotal: bigint('line_total', { mode: 'number' }).notNull().default(0),
		quantityDelivered: numeric('quantity_delivered', {
			precision: 18,
			scale: 3,
		})
			.notNull()
			.default('0'),
		fulfillmentStatus: text('fulfillment_status')
			.$type<FulfillmentStatus>()
			.notNull()
			.default('pending'),
		sortOrder: integer('sort_order').notNull().default(0),
		...timestamps,
	},
	(table) => [
		index('order_items_order_sort_idx').on(table.orderId, table.sortOrder),
		index('order_items_fulfillment_status_idx').on(table.fulfillmentStatus),
		check(
			'order_items_amounts_check',
			sql`quantity > 0 AND unit_price >= 0 AND discount_amount >= 0 AND line_total >= 0 AND quantity_delivered >= 0`,
		),
		check(
			'order_items_fulfillment_status_check',
			sql`fulfillment_status IN ('pending', 'reserved', 'partial', 'fulfilled', 'cancelled')`,
		),
	],
);

export const orderStatusHistory = saleSchema.table(
	'order_status_history',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		orderId: uuid('order_id')
			.notNull()
			.references(() => orders.id, { onDelete: 'cascade' }),
		fromStatus: text('from_status'),
		toStatus: text('to_status').notNull(),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		changedBy: text('changed_by'),
		changedAt: unixTimestamp('changed_at').notNull(),
		note: text('note'),
		...timestamps,
	},
	(table) => [index('order_status_history_order_id_idx').on(table.orderId)],
);

/* ------------------------------------------------------------------------ *
 * sale.delivery_notes / delivery_note_items
 * ------------------------------------------------------------------------ */

export const deliveryNotes = saleSchema.table(
	'delivery_notes',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		code: varchar('code', { length: 32 }).notNull(),
		orderId: uuid('order_id')
			.notNull()
			.references(() => orders.id, { onDelete: 'restrict' }),
		/** Logical reference to inventory.warehouses.id — cross-module FK omitted. */
		warehouseId: uuid('warehouse_id'),
		/** Logical reference to inventory.warehouse_storages.id — FK omitted. */
		binId: uuid('bin_id'),
		status: text('status')
			.$type<DeliveryNoteStatus>()
			.notNull()
			.default('prepared'),
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
		shippedBy: text('shipped_by'),
		receivedAt: unixTimestampNullable('received_at'),
		receiverName: text('receiver_name'),
		cancelledAt: unixTimestampNullable('cancelled_at'),
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
		index('delivery_notes_order_id_idx').on(table.orderId),
		index('delivery_notes_status_idx').on(table.status),
		check(
			'delivery_notes_status_check',
			sql`status IN ('prepared', 'shipped', 'delivered', 'cancelled')`,
		),
	],
);

export const deliveryNoteItems = saleSchema.table(
	'delivery_note_items',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		deliveryNoteId: uuid('delivery_note_id')
			.notNull()
			.references(() => deliveryNotes.id, { onDelete: 'cascade' }),
		orderItemId: uuid('order_item_id')
			.notNull()
			.references(() => orderItems.id, { onDelete: 'restrict' }),
		/** Logical reference to inventory.products.id; null = custom order line. */
		productId: uuid('product_id'),
		sku: varchar('sku', { length: 64 }),
		name: text('name').notNull(),
		unit: varchar('unit', { length: 32 }).notNull(),
		quantity: numeric('quantity', { precision: 18, scale: 3 }).notNull(),
		unitPrice: bigint('unit_price', { mode: 'number' }).notNull().default(0),
		unitCost: bigint('unit_cost', { mode: 'number' }),
		serialNumbers: jsonb('serial_numbers').$type<string[]>(),
		remarks: text('remarks'),
		/** Logical reference to inventory.movements.id — cross-module FK omitted. */
		movementId: uuid('movement_id'),
		sortOrder: integer('sort_order').notNull().default(0),
		...timestamps,
	},
	(table) => [
		index('delivery_note_items_delivery_note_id_idx').on(table.deliveryNoteId),
		index('delivery_note_items_order_item_id_idx').on(table.orderItemId),
		check(
			'delivery_note_items_amounts_check',
			sql`quantity > 0 AND unit_price >= 0`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * sale.returns / return_items
 * ------------------------------------------------------------------------ */

export const returns = saleSchema.table(
	'returns',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		code: varchar('code', { length: 32 }),
		deliveryNoteId: uuid('delivery_note_id')
			.notNull()
			.references(() => deliveryNotes.id, { onDelete: 'restrict' }),
		orderId: uuid('order_id')
			.notNull()
			.references(() => orders.id, { onDelete: 'restrict' }),
		/** Logical reference to customer.customers.id — cross-module FK omitted. */
		customerId: uuid('customer_id'),
		/** Logical reference to inventory.warehouses.id — cross-module FK omitted. */
		warehouseId: uuid('warehouse_id'),
		status: text('status').$type<ReturnStatus>().notNull().default('draft'),
		returnDate: date('return_date').notNull(),
		reason: text('reason').notNull(),
		notes: text('notes'),
		totalAmount: bigint('total_amount', { mode: 'number' })
			.notNull()
			.default(0),
		currencyCode: varchar('currency_code', { length: 3 })
			.notNull()
			.default('IDR'),
		rejectionReason: text('rejection_reason'),
		/** Logical references to auth.users.id — cross-module FK omitted. */
		createdBy: text('created_by'),
		submittedBy: text('submitted_by'),
		submittedAt: unixTimestampNullable('submitted_at'),
		approvedBy: text('approved_by'),
		approvedAt: unixTimestampNullable('approved_at'),
		receivedBy: text('received_by'),
		receivedAt: unixTimestampNullable('received_at'),
		cancelledBy: text('cancelled_by'),
		cancelledAt: unixTimestampNullable('cancelled_at'),
		cancelledReason: text('cancelled_reason'),
		...timestamps,
	},
	(table) => [
		uniqueIndex('returns_code_uq')
			.on(table.code)
			.where(sql`deleted_at IS NULL AND code IS NOT NULL`),
		index('returns_delivery_note_id_idx').on(table.deliveryNoteId),
		index('returns_order_id_idx').on(table.orderId),
		index('returns_status_idx').on(table.status),
		check(
			'returns_status_check',
			sql`status IN ('draft', 'submitted', 'approved', 'received', 'cancelled')`,
		),
		check('returns_total_check', sql`total_amount >= 0`),
	],
);

export const returnItems = saleSchema.table(
	'return_items',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		returnId: uuid('return_id')
			.notNull()
			.references(() => returns.id, { onDelete: 'cascade' }),
		deliveryNoteItemId: uuid('delivery_note_item_id')
			.notNull()
			.references(() => deliveryNoteItems.id, { onDelete: 'restrict' }),
		orderItemId: uuid('order_item_id')
			.notNull()
			.references(() => orderItems.id, { onDelete: 'restrict' }),
		/** Logical reference to inventory.products.id — cross-module FK omitted. */
		productId: uuid('product_id'),
		sku: varchar('sku', { length: 64 }),
		name: text('name').notNull(),
		unit: varchar('unit', { length: 32 }).notNull(),
		quantity: numeric('quantity', { precision: 18, scale: 3 }).notNull(),
		unitPrice: bigint('unit_price', { mode: 'number' }).notNull().default(0),
		unitCost: bigint('unit_cost', { mode: 'number' }).notNull().default(0),
		lineTotal: bigint('line_total', { mode: 'number' }).notNull().default(0),
		serialNumbers: jsonb('serial_numbers').$type<string[]>(),
		condition: text('condition').$type<ReturnCondition>(),
		/** Logical reference to inventory.warehouse_storages.id — FK omitted. */
		binId: uuid('bin_id'),
		/** Logical reference to inventory.movements.id — cross-module FK omitted. */
		movementId: uuid('movement_id'),
		sortOrder: integer('sort_order').notNull().default(0),
		...timestamps,
	},
	(table) => [
		index('return_items_return_id_idx').on(table.returnId),
		index('return_items_delivery_note_item_id_idx').on(table.deliveryNoteItemId),
		check(
			'return_items_amounts_check',
			sql`quantity > 0 AND unit_price >= 0 AND unit_cost >= 0 AND line_total >= 0`,
		),
		check(
			'return_items_condition_check',
			sql`condition IS NULL OR condition IN ('good', 'damaged')`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * sale.invoices / invoice_items / receipts
 * ------------------------------------------------------------------------ */

export const invoices = saleSchema.table(
	'invoices',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		/** Logical reference to auth.organizations.id — cross-module FK omitted. */
		organizationId: text('organization_id'),
		code: varchar('code', { length: 32 }),
		invoiceType: text('invoice_type').notNull().default('sales'),
		termKind: text('term_kind'),
		/** Logical reference to customer.customers.id — cross-module FK omitted. */
		customerId: uuid('customer_id'),
		/** Logical reference to customer.companies.id — cross-module FK omitted. */
		companyId: uuid('company_id'),
		customerSnapshot: jsonb('customer_snapshot').$type<TCustomerSnapshot | null>(),
		/** Plain id of a row in sale.orders (same module). */
		orderId: uuid('order_id'),
		orderCode: varchar('order_code', { length: 32 }),
		quotationCode: varchar('quotation_code', { length: 40 }),
		title: text('title'),
		description: text('description'),
		percentageBps: integer('percentage_bps'),
		/** Logical reference to finance.payment_terms.id — cross-module FK omitted. */
		paymentTermId: uuid('payment_term_id'),
		issueDate: date('issue_date', { mode: 'string' }),
		dueDate: date('due_date', { mode: 'string' }),
		vatEnabled: boolean('vat_enabled').notNull().default(true),
		vatRateBps: integer('vat_rate_bps').notNull().default(0),
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
		terms: text('terms'),
		notes: text('notes'),
		/** Logical references to auth.users.id — cross-module FK omitted. */
		createdBy: text('created_by'),
		issuedBy: text('issued_by'),
		issuedAt: unixTimestampNullable('issued_at'),
		approvedBy: text('approved_by'),
		approvedAt: unixTimestampNullable('approved_at'),
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
		index('invoices_company_id_idx').on(table.companyId),
		index('invoices_order_id_idx').on(table.orderId),
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

export const invoiceItems = saleSchema.table(
	'invoice_items',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		organizationId: text('organization_id'),
		invoiceId: uuid('invoice_id')
			.notNull()
			.references(() => invoices.id, { onDelete: 'cascade' }),
		/** Logical reference to inventory.products.id — cross-module FK omitted. */
		productId: uuid('product_id'),
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
		sortOrder: integer('sort_order').notNull().default(0),
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
		index('invoice_items_product_id_idx').on(table.productId),
		check('invoice_items_quantity_check', sql`quantity >= 0`),
		check('invoice_items_unit_price_check', sql`unit_price >= 0`),
		check('invoice_items_discount_check', sql`discount_amount >= 0`),
		check('invoice_items_tax_check', sql`tax_amount >= 0`),
		check('invoice_items_line_total_check', sql`line_total >= 0`),
	],
);

export const receipts = saleSchema.table(
	'receipts',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		/** Logical reference to auth.organizations.id — cross-module FK omitted. */
		organizationId: text('organization_id'),
		code: varchar('code', { length: 32 }).notNull(),
		/** Plain id of a row in sale.invoices (same module). */
		invoiceId: uuid('invoice_id').notNull(),
		/** Logical reference to payment.payments.id — cross-module FK omitted. */
		paymentId: uuid('payment_id'),
		receivedDate: date('received_date', { mode: 'string' }),
		amount: bigint('amount', { mode: 'number' }).notNull().default(0),
		currencyCode: varchar('currency_code', { length: 3 })
			.notNull()
			.default('IDR'),
		method: text('method').notNull().default('bank_transfer'),
		reference: varchar('reference', { length: 100 }),
		notes: text('notes'),
		status: text('status').notNull().default('draft'),
		/** Logical reference to auth.users.id. */
		receivedBy: text('received_by'),
		postedAt: unixTimestampNullable('posted_at'),
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
		index('receipts_invoice_id_idx').on(table.invoiceId),
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
 * sale.settings / sale.code_numberings
 * ------------------------------------------------------------------------ */

export const saleSettings = saleSchema.table(
	'settings',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		settingGroup: text('setting_group').notNull(),
		settingKey: text('setting_key').notNull(),
		settingValue: text('setting_value'),
		valueType: text('value_type').notNull().default('string'),
		description: text('description'),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		updatedBy: text('updated_by'),
		...timestamps,
	},
	(table) => [
		uniqueIndex('sale_settings_scope_uq')
			.on(table.settingGroup, table.settingKey)
			.where(sql`deleted_at IS NULL`),
		check(
			'sale_settings_value_type_check',
			sql`value_type IN ('string', 'number', 'boolean', 'json', 'date')`,
		),
	],
);

export const saleCodeNumberings = createCodeNumberingTable(saleSchema);

export type TQuotationSelect = typeof quotations.$inferSelect;
export type TQuotationInsert = typeof quotations.$inferInsert;
export type TQuotationItemSelect = typeof quotationItems.$inferSelect;
export type TQuotationItemInsert = typeof quotationItems.$inferInsert;
export type TQuotationStatusHistorySelect =
	typeof quotationStatusHistory.$inferSelect;
export type TOrderSelect = typeof orders.$inferSelect;
export type TOrderInsert = typeof orders.$inferInsert;
export type TOrderItemSelect = typeof orderItems.$inferSelect;
export type TOrderItemInsert = typeof orderItems.$inferInsert;
export type TOrderStatusHistorySelect = typeof orderStatusHistory.$inferSelect;
export type TDeliveryNoteSelect = typeof deliveryNotes.$inferSelect;
export type TDeliveryNoteInsert = typeof deliveryNotes.$inferInsert;
export type TDeliveryNoteItemSelect = typeof deliveryNoteItems.$inferSelect;
export type TDeliveryNoteItemInsert = typeof deliveryNoteItems.$inferInsert;
export type TReturnSelect = typeof returns.$inferSelect;
export type TReturnInsert = typeof returns.$inferInsert;
export type TReturnItemSelect = typeof returnItems.$inferSelect;
export type TReturnItemInsert = typeof returnItems.$inferInsert;
export type TInvoiceSelect = typeof invoices.$inferSelect;
export type TInvoiceInsert = typeof invoices.$inferInsert;
export type TInvoiceItemSelect = typeof invoiceItems.$inferSelect;
export type TInvoiceItemInsert = typeof invoiceItems.$inferInsert;
export type TReceiptSelect = typeof receipts.$inferSelect;
export type TReceiptInsert = typeof receipts.$inferInsert;
export type TSaleSettingSelect = typeof saleSettings.$inferSelect;
export type TSaleSettingInsert = typeof saleSettings.$inferInsert;
export type TSaleCodeNumberingSelect = typeof saleCodeNumberings.$inferSelect;
export type TSaleCodeNumberingInsert = typeof saleCodeNumberings.$inferInsert;
