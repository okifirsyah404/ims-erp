/**
 * Procurement domain schema — owns the `procurement` Postgres schema.
 *
 * Suppliers and purchase orders (ADR-0011 port step 4a), goods receipts
 * (step 4b) and purchase returns (ERP-0061).
 *
 * House rules honoured here:
 * - **Company-wide, no `organization_id`** (ADR-0011 §2, ADR-0012).
 * - Money is bigint IDR minor units (ADR-0002); quantities `numeric(18,3)`;
 *   business dates are Jakarta `date` strings; operational timestamps unix ms.
 * - References to other modules (`inventory`, `location`, `auth`) are plain
 *   id columns with no FK, validated through those modules' services.
 */
import { defineRelationsPart, sql } from 'drizzle-orm';
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
import {
	unixTimestamp,
	unixTimestampNullable,
} from '@drizzle/datatypes/unix-timestamp';

export const procurementSchema = pgSchema('procurement');

export const SUPPLIER_TYPES = ['company', 'individual', 'government'] as const;
export type SupplierType = (typeof SUPPLIER_TYPES)[number];

/** Inactive suppliers stay readable but cannot be used on new POs. */
export const SUPPLIER_STATUSES = ['active', 'inactive'] as const;
export type SupplierStatus = (typeof SUPPLIER_STATUSES)[number];

/** Purchase category, printed in the PO number (`{CATEGORY}`). */
export const PURCHASE_CATEGORIES = ['hardware', 'software', 'service', 'other'] as const;
export type PurchaseCategory = (typeof PURCHASE_CATEGORIES)[number];
export const PURCHASE_CATEGORY_CODES: Record<PurchaseCategory, string> = {
	hardware: 'HW',
	software: 'SW',
	service: 'JS',
	other: 'LN',
};

/**
 * How VAT applies (the company sample says "PPN Included"):
 * `none` no VAT; `included` prices contain VAT (DPP derived);
 * `added` VAT on top of the subtotal.
 */
export const PO_VAT_MODES = ['none', 'included', 'added'] as const;
export type PoVatMode = (typeof PO_VAT_MODES)[number];

/**
 * draft → submitted → approved → sent → partially_received → received;
 * rejection returns to draft; cancelled while nothing was received.
 */
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

/**
 * Purchase returns (ERP-0061): draft → submitted → approved → shipped;
 * rejection returns to draft; cancelled before shipped.
 */
export const PURCHASE_RETURN_STATUSES = ['draft', 'submitted', 'approved', 'shipped', 'cancelled'] as const;
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
 * procurement.suppliers
 * ------------------------------------------------------------------------ */

export const suppliers = procurementSchema.table(
	'suppliers',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		/** Upper-case; the `{SUPPLIER}` token of PO numbers. */
		code: varchar('code', { length: 32 }).notNull(),
		name: text('name').notNull(),
		legalName: text('legal_name'),
		supplierType: text('supplier_type').$type<SupplierType>().notNull().default('company'),
		/** NPWP digits only (15 or 16). */
		taxId: varchar('tax_id', { length: 16 }),
		email: text('email'),
		phone: varchar('phone', { length: 30 }),
		whatsapp: varchar('whatsapp', { length: 30 }),
		website: varchar('website', { length: 200 }),
		addressLine: text('address_line'),
		/** Logical reference to location.villages.id — cross-module FK omitted. */
		villageId: uuid('village_id'),
		postalCode: varchar('postal_code', { length: 10 }),
		picName: varchar('pic_name', { length: 120 }),
		picTitle: varchar('pic_title', { length: 100 }),
		picPhone: varchar('pic_phone', { length: 30 }),
		picEmail: text('pic_email'),
		paymentTermsDays: integer('payment_terms_days').notNull().default(0),
		paymentTermNote: varchar('payment_term_note', { length: 300 }),
		// Restricted (`supplier:read_bank`).
		bankName: text('bank_name'),
		bankAccountNumber: text('bank_account_number'),
		bankAccountHolder: text('bank_account_holder'),
		status: text('status').$type<SupplierStatus>().notNull().default('active'),
		notes: text('notes'),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		createdBy: text('created_by'),
		...timestamps,
	},
	(table) => [
		uniqueIndex('suppliers_code_uq')
			.on(table.code)
			.where(sql`deleted_at IS NULL`),
		index('suppliers_name_idx').on(table.name),
		index('suppliers_status_idx').on(table.status),
		index('suppliers_tax_id_idx').on(table.taxId),
		check('suppliers_type_check', sql`${table.supplierType} IN ('company', 'individual', 'government')`),
		check('suppliers_status_check', sql`${table.status} IN ('active', 'inactive')`),
		check('suppliers_payment_terms_check', sql`${table.paymentTermsDays} >= 0`),
	],
);

/* ------------------------------------------------------------------------ *
 * procurement.purchase_orders
 * ------------------------------------------------------------------------ */

export const purchaseOrders = procurementSchema.table(
	'purchase_orders',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		/** e.g. PO/IMS-HIT/HW/1026/001; null until approved. */
		code: varchar('code', { length: 40 }),
		supplierId: uuid('supplier_id')
			.notNull()
			.references(() => suppliers.id, { onDelete: 'restrict' }),
		supplierSnapshot: jsonb('supplier_snapshot').$type<TPoSupplierSnapshot>().notNull(),
		category: text('category').$type<PurchaseCategory>().notNull(),
		/** "Perihal". */
		subject: varchar('subject', { length: 200 }).notNull(),
		status: text('status').$type<PurchaseOrderStatus>().notNull().default('draft'),
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
		currencyCode: varchar('currency_code', { length: 3 }).notNull().default('IDR'),
		/** First purchase term ("Pembayaran"). */
		paymentTerms: varchar('payment_terms', { length: 500 }),
		/** Further terms, one per line ("Title: text"). */
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
		index('purchase_orders_supplier_id_idx').on(table.supplierId),
		index('purchase_orders_status_idx').on(table.status),
		check(
			'purchase_orders_status_check',
			sql`${table.status} IN ('draft', 'submitted', 'approved', 'sent', 'partially_received', 'received', 'cancelled')`,
		),
		check('purchase_orders_category_check', sql`${table.category} IN ('hardware', 'software', 'service', 'other')`),
		check('purchase_orders_vat_mode_check', sql`${table.vatMode} IN ('none', 'included', 'added')`),
		check('purchase_orders_vat_rate_check', sql`${table.vatRateBps} >= 0 AND ${table.vatRateBps} <= 10000`),
		check(
			'purchase_orders_amounts_check',
			sql`${table.subtotal} >= 0 AND ${table.taxTotal} >= 0 AND ${table.grandTotal} >= 0`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * procurement.purchase_order_items
 * ------------------------------------------------------------------------ */

export const purchaseOrderItems = procurementSchema.table(
	'purchase_order_items',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		purchaseOrderId: uuid('purchase_order_id')
			.notNull()
			.references(() => purchaseOrders.id, { onDelete: 'cascade' }),
		/** Logical reference to inventory.items.id — cross-module FK omitted. */
		itemId: uuid('item_id').notNull(),
		sku: varchar('sku', { length: 64 }).notNull(),
		name: text('name').notNull(),
		specification: text('specification'),
		unit: varchar('unit', { length: 32 }).notNull(),
		quantity: numeric('quantity', { precision: 18, scale: 3 }).notNull().default('1'),
		unitPrice: bigint('unit_price', { mode: 'number' }).notNull().default(0),
		/** round(quantity × unit_price). */
		lineTotal: bigint('line_total', { mode: 'number' }).notNull().default(0),
		quantityReceived: numeric('quantity_received', { precision: 18, scale: 3 }).notNull().default('0'),
		sortOrder: integer('sort_order').notNull().default(0),
		...timestamps,
	},
	(table) => [
		index('purchase_order_items_order_sort_idx').on(table.purchaseOrderId, table.sortOrder),
		check(
			'purchase_order_items_amounts_check',
			sql`${table.quantity} > 0 AND ${table.unitPrice} >= 0 AND ${table.lineTotal} >= 0 AND ${table.quantityReceived} >= 0`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * procurement.goods_receipts (posted on creation, immutable)
 * ------------------------------------------------------------------------ */

export const goodsReceipts = procurementSchema.table(
	'goods_receipts',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		/** e.g. 0001/BPB/IMS/XI/26, assigned on creation. */
		code: varchar('code', { length: 32 }).notNull(),
		purchaseOrderId: uuid('purchase_order_id')
			.notNull()
			.references(() => purchaseOrders.id, { onDelete: 'restrict' }),
		/** Logical reference to inventory.warehouses.id — cross-module FK omitted. */
		warehouseId: uuid('warehouse_id').notNull(),
		/** Logical reference to inventory.warehouse_storages.id — cross-module FK omitted. */
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
		check('goods_receipts_status_check', sql`${table.status} IN ('posted')`),
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
		/** Logical reference to inventory.items.id — cross-module FK omitted. */
		itemId: uuid('item_id').notNull(),
		sku: varchar('sku', { length: 64 }).notNull(),
		name: text('name').notNull(),
		unit: varchar('unit', { length: 32 }).notNull(),
		quantity: numeric('quantity', { precision: 18, scale: 3 }).notNull(),
		/** Ex-VAT unit price booked into stock (IDR minor units). */
		unitCost: bigint('unit_cost', { mode: 'number' }).notNull().default(0),
		/** One serial per unit for serialized items. */
		serialNumbers: jsonb('serial_numbers').$type<string[]>(),
		/** Logical reference to inventory.stock_movements.id — cross-module FK omitted. */
		stockMovementId: uuid('stock_movement_id'),
		...timestamps,
	},
	(table) => [
		index('goods_receipt_items_goods_receipt_id_idx').on(table.goodsReceiptId),
		index('goods_receipt_items_purchase_order_item_id_idx').on(table.purchaseOrderItemId),
		check('goods_receipt_items_amounts_check', sql`${table.quantity} > 0 AND ${table.unitCost} >= 0`),
	],
);

/* ------------------------------------------------------------------------ *
 * procurement.purchase_returns (ERP-0061, replacement only)
 * ------------------------------------------------------------------------ */

export const purchaseReturns = procurementSchema.table(
	'purchase_returns',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		/** e.g. 0001/RTB/IMS/XI/26; null until approved. */
		code: varchar('code', { length: 32 }),
		goodsReceiptId: uuid('goods_receipt_id')
			.notNull()
			.references(() => goodsReceipts.id, { onDelete: 'restrict' }),
		purchaseOrderId: uuid('purchase_order_id')
			.notNull()
			.references(() => purchaseOrders.id, { onDelete: 'restrict' }),
		supplierId: uuid('supplier_id')
			.notNull()
			.references(() => suppliers.id, { onDelete: 'restrict' }),
		/** Logical reference to inventory.warehouses.id — cross-module FK omitted. */
		warehouseId: uuid('warehouse_id').notNull(),
		/** Logical reference to inventory.warehouse_storages.id — cross-module FK omitted. */
		binId: uuid('bin_id'),
		status: text('status').$type<PurchaseReturnStatus>().notNull().default('draft'),
		returnDate: date('return_date').notNull(),
		reason: text('reason').notNull(),
		notes: text('notes'),
		/** Sum of the line totals at receipt cost; informative, no journal. */
		totalAmount: bigint('total_amount', { mode: 'number' }).notNull().default(0),
		currencyCode: varchar('currency_code', { length: 3 }).notNull().default('IDR'),
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
			sql`${table.status} IN ('draft', 'submitted', 'approved', 'shipped', 'cancelled')`,
		),
		check('purchase_returns_total_check', sql`${table.totalAmount} >= 0`),
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
		/** Logical reference to inventory.items.id — cross-module FK omitted. */
		itemId: uuid('item_id').notNull(),
		sku: varchar('sku', { length: 64 }).notNull(),
		name: text('name').notNull(),
		unit: varchar('unit', { length: 32 }).notNull(),
		quantity: numeric('quantity', { precision: 18, scale: 3 }).notNull(),
		/** The goods receipt line's unit cost (IDR minor units). */
		unitCost: bigint('unit_cost', { mode: 'number' }).notNull().default(0),
		/** round(quantity × unit_cost). */
		lineTotal: bigint('line_total', { mode: 'number' }).notNull().default(0),
		/** The returned units of a serialized item. */
		serialNumbers: jsonb('serial_numbers').$type<string[]>(),
		/** Logical reference to inventory.stock_movements.id — cross-module FK omitted. */
		stockMovementId: uuid('stock_movement_id'),
		sortOrder: integer('sort_order').notNull().default(0),
		...timestamps,
	},
	(table) => [
		index('purchase_return_items_purchase_return_id_idx').on(table.purchaseReturnId),
		index('purchase_return_items_goods_receipt_item_id_idx').on(table.goodsReceiptItemId),
		check(
			'purchase_return_items_amounts_check',
			sql`${table.quantity} > 0 AND ${table.unitCost} >= 0 AND ${table.lineTotal} >= 0`,
		),
	],
);

export const procurementRelations = defineRelationsPart(
	{ suppliers, purchaseOrders, purchaseOrderItems, goodsReceipts, goodsReceiptItems, purchaseReturns, purchaseReturnItems },
	(r) => ({
		purchaseOrders: {
			supplier: r.one.suppliers({ from: r.purchaseOrders.supplierId, to: r.suppliers.id }),
			items: r.many.purchaseOrderItems({ from: r.purchaseOrders.id, to: r.purchaseOrderItems.purchaseOrderId }),
		},
		purchaseOrderItems: {
			purchaseOrder: r.one.purchaseOrders({ from: r.purchaseOrderItems.purchaseOrderId, to: r.purchaseOrders.id }),
		},
	}),
);

export type TSupplierInsert = typeof suppliers.$inferInsert;
export type TSupplierSelect = typeof suppliers.$inferSelect;
export type TPurchaseOrderInsert = typeof purchaseOrders.$inferInsert;
export type TPurchaseOrderSelect = typeof purchaseOrders.$inferSelect;
export type TPurchaseOrderItemInsert = typeof purchaseOrderItems.$inferInsert;
export type TPurchaseOrderItemSelect = typeof purchaseOrderItems.$inferSelect;
export type TGoodsReceiptInsert = typeof goodsReceipts.$inferInsert;
export type TGoodsReceiptSelect = typeof goodsReceipts.$inferSelect;
export type TGoodsReceiptItemInsert = typeof goodsReceiptItems.$inferInsert;
export type TGoodsReceiptItemSelect = typeof goodsReceiptItems.$inferSelect;
export type TPurchaseReturnInsert = typeof purchaseReturns.$inferInsert;
export type TPurchaseReturnSelect = typeof purchaseReturns.$inferSelect;
export type TPurchaseReturnItemInsert = typeof purchaseReturnItems.$inferInsert;
export type TPurchaseReturnItemSelect = typeof purchaseReturnItems.$inferSelect;
