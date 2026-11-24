/**
 * Procurement module schema — owns the `procurement` Postgres schema.
 *
 * @remarks
 * Purchase requests, orders, goods receipts and purchase returns. Company-wide
 * (ADR-0011). The supplier master moved to the `supplier` schema (ADR-0024 Q17),
 * so `supplier_company_id` / `supplier_pic_id` are logical references there and
 * the intra-schema supplier FK is gone. Item references point at
 * `inventory.products`; stock movement references at `inventory.movements`.
 */
import {
	unixTimestamp,
	unixTimestampNullable,
} from '@drizzle/datatypes/unix-timestamp';
import { createCodeNumberingTable } from '@shared/numbering/table';
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
} from 'drizzle-orm/pg-core';

export const procurementSchema = pgSchema('procurement');

/* ------------------------------------------------------------------------ *
 * Vocabularies
 * ------------------------------------------------------------------------ */

/** Purchase category, printed in the PO number (`{CATEGORY}`). */
export const PURCHASE_CATEGORIES = [
	'hardware',
	'software',
	'service',
	'other',
] as const;
export type PurchaseCategory = (typeof PURCHASE_CATEGORIES)[number];
export const PURCHASE_CATEGORY_CODES: Record<PurchaseCategory, string> = {
	hardware: 'HW',
	software: 'SW',
	service: 'JS',
	other: 'LN',
};

/** How VAT applies: none, included (prices contain VAT) or added (on top). */
export const PO_VAT_MODES = ['none', 'included', 'added'] as const;
export type PoVatMode = (typeof PO_VAT_MODES)[number];

export const PURCHASE_ORDER_STATUSES = [
	'draft',
	'submitted',
	'approved',
	'sent',
	'partially_received',
	'received',
	'cancelled',
] as const;
export type PurchaseOrderStatus = (typeof PURCHASE_ORDER_STATUSES)[number];

export const PURCHASE_REQUEST_STATUSES = [
	'draft',
	'submitted',
	'approved',
	'ordered',
	'cancelled',
] as const;
export type PurchaseRequestStatus =
	(typeof PURCHASE_REQUEST_STATUSES)[number];

export const PURCHASE_RETURN_STATUSES = [
	'draft',
	'submitted',
	'approved',
	'shipped',
	'cancelled',
] as const;
export type PurchaseReturnStatus = (typeof PURCHASE_RETURN_STATUSES)[number];

/** Supplier data frozen onto the PO (printed block). */
export type TPoSupplierSnapshot = {
	code: string;
	name: string;
	address: string | null;
	taxId: string | null;
	phone: string | null;
	email: string | null;
	picName: string | null;
	picTitle: string | null;
	picPhone: string | null;
	picEmail: string | null;
};

const timestamps = {
	createdAt: unixTimestamp('created_at').notNull(),
	updatedAt: unixTimestamp('updated_at')
		.notNull()
		.$onUpdate(() => new Date()),
	deletedAt: unixTimestampNullable('deleted_at'),
};

/* ------------------------------------------------------------------------ *
 * procurement.purchase_requests / purchase_request_items
 * ------------------------------------------------------------------------ */

export const purchaseRequests = procurementSchema.table(
	'purchase_requests',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		code: varchar('code', { length: 40 }),
		/** Logical reference to auth.organizations.id (information only). */
		organizationId: text('organization_id'),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		requestedBy: text('requested_by'),
		requestedByName: varchar('requested_by_name', { length: 120 }),
		subject: varchar('subject', { length: 200 }).notNull(),
		justification: text('justification'),
		projectName: varchar('project_name', { length: 200 }),
		requestDate: date('request_date').notNull(),
		neededBy: date('needed_by'),
		status: text('status')
			.$type<PurchaseRequestStatus>()
			.notNull()
			.default('draft'),
		estimatedTotal: bigint('estimated_total', { mode: 'number' })
			.notNull()
			.default(0),
		currencyCode: varchar('currency_code', { length: 3 })
			.notNull()
			.default('IDR'),
		rejectionReason: text('rejection_reason'),
		submittedAt: unixTimestampNullable('submitted_at'),
		/** Logical references to auth.users.id — cross-module FK omitted. */
		approvedBy: text('approved_by'),
		approvedAt: unixTimestampNullable('approved_at'),
		cancelledBy: text('cancelled_by'),
		cancelledAt: unixTimestampNullable('cancelled_at'),
		cancelledReason: text('cancelled_reason'),
		...timestamps,
	},
	(table) => [
		uniqueIndex('purchase_requests_code_uq')
			.on(table.code)
			.where(sql`deleted_at IS NULL AND code IS NOT NULL`),
		index('purchase_requests_status_idx').on(table.status),
		index('purchase_requests_requested_by_idx').on(table.requestedBy),
		check(
			'purchase_requests_status_check',
			sql`status IN ('draft', 'submitted', 'approved', 'ordered', 'cancelled')`,
		),
		check('purchase_requests_estimated_total_check', sql`estimated_total >= 0`),
		check(
			'purchase_requests_needed_by_check',
			sql`needed_by IS NULL OR needed_by >= request_date`,
		),
	],
);

export const purchaseRequestItems = procurementSchema.table(
	'purchase_request_items',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		purchaseRequestId: uuid('purchase_request_id')
			.notNull()
			.references(() => purchaseRequests.id, { onDelete: 'cascade' }),
		/** Logical reference to inventory.products.id; null for a free-text line. */
		productId: uuid('product_id'),
		sku: varchar('sku', { length: 64 }),
		name: text('name').notNull(),
		specification: text('specification'),
		unit: varchar('unit', { length: 32 }).notNull(),
		quantity: numeric('quantity', { precision: 18, scale: 3 })
			.notNull()
			.default('1'),
		estimatedUnitPrice: bigint('estimated_unit_price', { mode: 'number' })
			.notNull()
			.default(0),
		estimatedTotal: bigint('estimated_total', { mode: 'number' })
			.notNull()
			.default(0),
		notes: text('notes'),
		sortOrder: integer('sort_order').notNull().default(0),
		...timestamps,
	},
	(table) => [
		index('purchase_request_items_request_sort_idx').on(
			table.purchaseRequestId,
			table.sortOrder,
		),
		check(
			'purchase_request_items_amounts_check',
			sql`quantity > 0 AND estimated_unit_price >= 0 AND estimated_total >= 0`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * procurement.purchase_orders / purchase_order_items
 * ------------------------------------------------------------------------ */

export const purchaseOrders = procurementSchema.table(
	'purchase_orders',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		code: varchar('code', { length: 40 }),
		/** Logical reference to supplier.companies.id — cross-module FK omitted. */
		supplierCompanyId: uuid('supplier_company_id'),
		/** Logical reference to supplier.suppliers.id — cross-module FK omitted. */
		supplierPicId: uuid('supplier_pic_id'),
		supplierSnapshot: jsonb('supplier_snapshot')
			.$type<TPoSupplierSnapshot>()
			.notNull(),
		category: text('category').$type<PurchaseCategory>().notNull(),
		subject: varchar('subject', { length: 200 }).notNull(),
		status: text('status')
			.$type<PurchaseOrderStatus>()
			.notNull()
			.default('draft'),
		orderDate: date('order_date').notNull(),
		expectedDeliveryDate: date('expected_delivery_date'),
		supplierQuoteRef: varchar('supplier_quote_ref', { length: 100 }),
		supplierQuoteDate: date('supplier_quote_date'),
		projectName: varchar('project_name', { length: 200 }),
		buyerPicName: varchar('buyer_pic_name', { length: 120 }),
		vatMode: text('vat_mode').$type<PoVatMode>().notNull().default('none'),
		vatRateBps: integer('vat_rate_bps').notNull().default(0),
		subtotal: bigint('subtotal', { mode: 'number' }).notNull().default(0),
		taxTotal: bigint('tax_total', { mode: 'number' }).notNull().default(0),
		grandTotal: bigint('grand_total', { mode: 'number' }).notNull().default(0),
		currencyCode: varchar('currency_code', { length: 3 })
			.notNull()
			.default('IDR'),
		paymentTerms: varchar('payment_terms', { length: 500 }),
		terms: text('terms'),
		notes: text('notes'),
		rejectionReason: text('rejection_reason'),
		/** Logical references to auth.users.id — cross-module FK omitted. */
		createdBy: text('created_by'),
		submittedBy: text('submitted_by'),
		submittedAt: unixTimestampNullable('submitted_at'),
		approvedBy: text('approved_by'),
		approvedAt: unixTimestampNullable('approved_at'),
		sentBy: text('sent_by'),
		sentAt: unixTimestampNullable('sent_at'),
		cancelledBy: text('cancelled_by'),
		cancelledAt: unixTimestampNullable('cancelled_at'),
		cancelledReason: text('cancelled_reason'),
		...timestamps,
	},
	(table) => [
		uniqueIndex('purchase_orders_code_uq')
			.on(table.code)
			.where(sql`deleted_at IS NULL AND code IS NOT NULL`),
		index('purchase_orders_supplier_company_id_idx').on(table.supplierCompanyId),
		index('purchase_orders_status_idx').on(table.status),
		check(
			'purchase_orders_status_check',
			sql`status IN ('draft', 'submitted', 'approved', 'sent', 'partially_received', 'received', 'cancelled')`,
		),
		check(
			'purchase_orders_category_check',
			sql`category IN ('hardware', 'software', 'service', 'other')`,
		),
		check(
			'purchase_orders_vat_mode_check',
			sql`vat_mode IN ('none', 'included', 'added')`,
		),
		check(
			'purchase_orders_vat_rate_check',
			sql`vat_rate_bps >= 0 AND vat_rate_bps <= 10000`,
		),
		check(
			'purchase_orders_amounts_check',
			sql`subtotal >= 0 AND tax_total >= 0 AND grand_total >= 0`,
		),
	],
);

export const purchaseOrderItems = procurementSchema.table(
	'purchase_order_items',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		purchaseOrderId: uuid('purchase_order_id')
			.notNull()
			.references(() => purchaseOrders.id, { onDelete: 'cascade' }),
		/** Logical reference to inventory.products.id — cross-module FK omitted. */
		productId: uuid('product_id'),
		sku: varchar('sku', { length: 64 }).notNull(),
		name: text('name').notNull(),
		specification: text('specification'),
		unit: varchar('unit', { length: 32 }).notNull(),
		quantity: numeric('quantity', { precision: 18, scale: 3 })
			.notNull()
			.default('1'),
		unitPrice: bigint('unit_price', { mode: 'number' }).notNull().default(0),
		lineTotal: bigint('line_total', { mode: 'number' }).notNull().default(0),
		quantityReceived: numeric('quantity_received', {
			precision: 18,
			scale: 3,
		})
			.notNull()
			.default('0'),
		/** The purchase request line this line orders (same module). */
		purchaseRequestItemId: uuid('purchase_request_item_id').references(
			() => purchaseRequestItems.id,
			{ onDelete: 'restrict' },
		),
		sortOrder: integer('sort_order').notNull().default(0),
		...timestamps,
	},
	(table) => [
		index('purchase_order_items_order_sort_idx').on(
			table.purchaseOrderId,
			table.sortOrder,
		),
		index('purchase_order_items_purchase_request_item_id_idx').on(
			table.purchaseRequestItemId,
		),
		check(
			'purchase_order_items_amounts_check',
			sql`quantity > 0 AND unit_price >= 0 AND line_total >= 0 AND quantity_received >= 0`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * procurement.goods_receipts / goods_receipt_items
 * ------------------------------------------------------------------------ */

export const goodsReceipts = procurementSchema.table(
	'goods_receipts',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		code: varchar('code', { length: 32 }).notNull(),
		purchaseOrderId: uuid('purchase_order_id')
			.notNull()
			.references(() => purchaseOrders.id, { onDelete: 'restrict' }),
		/** Logical reference to inventory.warehouses.id — cross-module FK omitted. */
		warehouseId: uuid('warehouse_id'),
		/** Logical reference to inventory.warehouse_storages.id — FK omitted. */
		binId: uuid('bin_id'),
		status: text('status').notNull().default('posted'),
		receiptDate: date('receipt_date').notNull(),
		supplierDeliveryRef: varchar('supplier_delivery_ref', { length: 100 }),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		receivedBy: text('received_by'),
		notes: text('notes'),
		...timestamps,
	},
	(table) => [
		uniqueIndex('goods_receipts_code_uq')
			.on(table.code)
			.where(sql`deleted_at IS NULL`),
		index('goods_receipts_purchase_order_id_idx').on(table.purchaseOrderId),
		index('goods_receipts_warehouse_id_idx').on(table.warehouseId),
		check('goods_receipts_status_check', sql`status IN ('posted')`),
	],
);

export const goodsReceiptItems = procurementSchema.table(
	'goods_receipt_items',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		goodsReceiptId: uuid('goods_receipt_id')
			.notNull()
			.references(() => goodsReceipts.id, { onDelete: 'cascade' }),
		purchaseOrderItemId: uuid('purchase_order_item_id')
			.notNull()
			.references(() => purchaseOrderItems.id, { onDelete: 'restrict' }),
		/** Logical reference to inventory.products.id — cross-module FK omitted. */
		productId: uuid('product_id'),
		sku: varchar('sku', { length: 64 }).notNull(),
		name: text('name').notNull(),
		unit: varchar('unit', { length: 32 }).notNull(),
		quantity: numeric('quantity', { precision: 18, scale: 3 }).notNull(),
		unitCost: bigint('unit_cost', { mode: 'number' }).notNull().default(0),
		serialNumbers: jsonb('serial_numbers').$type<string[]>(),
		/** Logical reference to inventory.movements.id — cross-module FK omitted. */
		movementId: uuid('movement_id'),
		...timestamps,
	},
	(table) => [
		index('goods_receipt_items_goods_receipt_id_idx').on(table.goodsReceiptId),
		index('goods_receipt_items_purchase_order_item_id_idx').on(
			table.purchaseOrderItemId,
		),
		check(
			'goods_receipt_items_amounts_check',
			sql`quantity > 0 AND unit_cost >= 0`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * procurement.purchase_returns / purchase_return_items
 * ------------------------------------------------------------------------ */

export const purchaseReturns = procurementSchema.table(
	'purchase_returns',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		code: varchar('code', { length: 32 }),
		goodsReceiptId: uuid('goods_receipt_id')
			.notNull()
			.references(() => goodsReceipts.id, { onDelete: 'restrict' }),
		purchaseOrderId: uuid('purchase_order_id')
			.notNull()
			.references(() => purchaseOrders.id, { onDelete: 'restrict' }),
		/** Logical reference to supplier.companies.id — cross-module FK omitted. */
		supplierCompanyId: uuid('supplier_company_id'),
		/** Logical reference to inventory.warehouses.id — cross-module FK omitted. */
		warehouseId: uuid('warehouse_id'),
		/** Logical reference to inventory.warehouse_storages.id — FK omitted. */
		binId: uuid('bin_id'),
		status: text('status')
			.$type<PurchaseReturnStatus>()
			.notNull()
			.default('draft'),
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
		shippedBy: text('shipped_by'),
		shippedAt: unixTimestampNullable('shipped_at'),
		cancelledBy: text('cancelled_by'),
		cancelledAt: unixTimestampNullable('cancelled_at'),
		cancelledReason: text('cancelled_reason'),
		/** Logical reference to finance.journal_entries.id (ERP-0136). */
		journalEntryId: uuid('journal_entry_id'),
		...timestamps,
	},
	(table) => [
		uniqueIndex('purchase_returns_code_uq')
			.on(table.code)
			.where(sql`deleted_at IS NULL AND code IS NOT NULL`),
		index('purchase_returns_goods_receipt_id_idx').on(table.goodsReceiptId),
		index('purchase_returns_purchase_order_id_idx').on(table.purchaseOrderId),
		index('purchase_returns_status_idx').on(table.status),
		check(
			'purchase_returns_status_check',
			sql`status IN ('draft', 'submitted', 'approved', 'shipped', 'cancelled')`,
		),
		check('purchase_returns_total_check', sql`total_amount >= 0`),
	],
);

export const purchaseReturnItems = procurementSchema.table(
	'purchase_return_items',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		purchaseReturnId: uuid('purchase_return_id')
			.notNull()
			.references(() => purchaseReturns.id, { onDelete: 'cascade' }),
		goodsReceiptItemId: uuid('goods_receipt_item_id')
			.notNull()
			.references(() => goodsReceiptItems.id, { onDelete: 'restrict' }),
		purchaseOrderItemId: uuid('purchase_order_item_id')
			.notNull()
			.references(() => purchaseOrderItems.id, { onDelete: 'restrict' }),
		/** Logical reference to inventory.products.id — cross-module FK omitted. */
		productId: uuid('product_id'),
		sku: varchar('sku', { length: 64 }).notNull(),
		name: text('name').notNull(),
		unit: varchar('unit', { length: 32 }).notNull(),
		quantity: numeric('quantity', { precision: 18, scale: 3 }).notNull(),
		unitCost: bigint('unit_cost', { mode: 'number' }).notNull().default(0),
		lineTotal: bigint('line_total', { mode: 'number' }).notNull().default(0),
		serialNumbers: jsonb('serial_numbers').$type<string[]>(),
		/** Logical reference to inventory.movements.id — cross-module FK omitted. */
		movementId: uuid('movement_id'),
		sortOrder: integer('sort_order').notNull().default(0),
		...timestamps,
	},
	(table) => [
		index('purchase_return_items_purchase_return_id_idx').on(
			table.purchaseReturnId,
		),
		index('purchase_return_items_goods_receipt_item_id_idx').on(
			table.goodsReceiptItemId,
		),
		check(
			'purchase_return_items_amounts_check',
			sql`quantity > 0 AND unit_cost >= 0 AND line_total >= 0`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * procurement.code_numberings
 * ------------------------------------------------------------------------ */

export const procurementCodeNumberings =
	createCodeNumberingTable(procurementSchema);

export type TPurchaseRequestSelect = typeof purchaseRequests.$inferSelect;
export type TPurchaseRequestInsert = typeof purchaseRequests.$inferInsert;
export type TPurchaseRequestItemSelect =
	typeof purchaseRequestItems.$inferSelect;
export type TPurchaseRequestItemInsert =
	typeof purchaseRequestItems.$inferInsert;
export type TPurchaseOrderSelect = typeof purchaseOrders.$inferSelect;
export type TPurchaseOrderInsert = typeof purchaseOrders.$inferInsert;
export type TPurchaseOrderItemSelect = typeof purchaseOrderItems.$inferSelect;
export type TPurchaseOrderItemInsert = typeof purchaseOrderItems.$inferInsert;
export type TGoodsReceiptSelect = typeof goodsReceipts.$inferSelect;
export type TGoodsReceiptInsert = typeof goodsReceipts.$inferInsert;
export type TGoodsReceiptItemSelect = typeof goodsReceiptItems.$inferSelect;
export type TGoodsReceiptItemInsert = typeof goodsReceiptItems.$inferInsert;
export type TPurchaseReturnSelect = typeof purchaseReturns.$inferSelect;
export type TPurchaseReturnInsert = typeof purchaseReturns.$inferInsert;
export type TPurchaseReturnItemSelect = typeof purchaseReturnItems.$inferSelect;
export type TPurchaseReturnItemInsert = typeof purchaseReturnItems.$inferInsert;
export type TProcurementCodeNumberingSelect =
	typeof procurementCodeNumberings.$inferSelect;
export type TProcurementCodeNumberingInsert =
	typeof procurementCodeNumberings.$inferInsert;
