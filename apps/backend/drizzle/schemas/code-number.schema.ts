/**
 * Code Number module schema — owns the `code_number` Postgres schema.
 *
 * @remarks
 * The one numbering authority (ERP-0009): one code series per code type for
 * the whole company. Was `organization.document_sequences` (column
 * `document_type`) until ERP-0042.
 *
 * Allocation is one atomic `INSERT … ON CONFLICT DO UPDATE … RETURNING` in
 * the owning repository, so concurrent callers never get the same number.
 */
import {
	unixTimestamp,
	unixTimestampNullable,
} from '@drizzle/datatypes/unix-timestamp';
import { sql } from 'drizzle-orm';
import {
	bigint,
	check,
	pgSchema,
	text,
	uniqueIndex,
	uuid,
	varchar,
} from 'drizzle-orm/pg-core';

export const codeNumberSchema = pgSchema('code_number');

/**
 * Code types that get numbers from the numbering authority.
 *
 * @remarks
 * `web_*` are public references handed back to website visitors (RFQ,
 * contact, demo). Inventory and asset codes keep the shape they had under
 * ERP-0009; `warehouse` was added in ERP-0042 so a warehouse code can be
 * allocated (`WH-0001`); the three `item_*` types landed with ERP-0043, so an
 * item code is allocated per kind (`PRD-00001`, `MAT-00001`, `CMP-00001`).
 */
export const CODE_TYPES = [
	'quotation',
	'sales_order',
	'sales_invoice',
	'receipt',
	'web_rfq',
	'web_contact',
	'web_demo',
	'purchase_order',
	'goods_receipt',
	'stock_adjustment',
	'delivery_note',
	'project',
	'bast',
	'warranty',
	'service_ticket',
	'license_contract',
	// Inventory and assets (ERP-0009 sequences, merged 2026-11-06).
	'stock_movement',
	'asset',
	'asset_maintenance',
	'asset_disposal',
	'asset_tool_set',
	'asset_borrowing',
	// Accounting and sales documents from main (ADR-0011 port, step 3d-2 onward).
	'bank_reconciliation',
	'cash_bank_transaction',
	'payment',
	'journal_entry',
	'supplier_bill',
	// HR (ERP-0034): employee codes (`EMP-00001`).
	'employee',
	// Organization structure (ERP-0042): warehouse codes (`WH-0001`).
	'warehouse',
	// Item master per kind (ERP-0043): `PRD-00001`, `MAT-00001`, `CMP-00001`.
	'item_product',
	'item_material',
	'item_component',
	// Purchase returns (ERP-0068): `0001/RTB/IMS/XI/26`, numbered on approval.
	'purchase_return',
	// Sales returns (ERP-0065): `0001/RTJ/IMS/XI/26`, numbered on approval.
	'sales_return',
	// Procurement (2026-11-15): purchase requests (`0001/PR/IMS/XI/26`).
	'purchase_request',
] as const;
export type CodeType = (typeof CODE_TYPES)[number];

/** When a series starts again at 1 (business dates, Asia/Jakarta). */
export const RESET_POLICIES = ['never', 'yearly', 'monthly'] as const;
export type ResetPolicy = (typeof RESET_POLICIES)[number];

/** Shared soft-delete + audit columns. */
const timestamps = {
	createdAt: unixTimestamp('created_at').notNull(),
	updatedAt: unixTimestamp('updated_at')
		.notNull()
		.$onUpdate(() => new Date()),
	deletedAt: unixTimestampNullable('deleted_at'),
};

/**
 * Numbering series, one live row per code type.
 *
 * @remarks
 * `pattern` / `reset_policy` are the owner's override; `NULL` means the code
 * default for that type. `period_key` is the period the counter belongs to
 * (`2026`, `2026-11`, `all`); allocating in a new period starts again at 1.
 */
export const codeNumberSeries = codeNumberSchema.table(
	'series',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		/** Owning module of the code type (`sales`, `procurement`, …). */
		module: varchar('module', { length: 32 }).notNull(),
		codeType: varchar('code_type', { length: 32 }).notNull(),
		pattern: varchar('pattern', { length: 100 }),
		resetPolicy: text('reset_policy'),
		periodKey: varchar('period_key', { length: 7 }).notNull(),
		nextNumber: bigint('next_number', { mode: 'number' }).notNull().default(1),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		updatedBy: text('updated_by'),
		...timestamps,
	},
	(table) => [
		uniqueIndex('series_code_type_uq')
			.on(table.codeType)
			.where(sql`deleted_at IS NULL`),
		check(
			'series_reset_policy_check',
			sql`${table.resetPolicy} IS NULL OR ${table.resetPolicy} IN ('never', 'yearly', 'monthly')`,
		),
		check('series_next_number_check', sql`${table.nextNumber} > 0`),
	],
);

export type TCodeNumberSeriesSelect = typeof codeNumberSeries.$inferSelect;
export type TCodeNumberSeriesInsert = typeof codeNumberSeries.$inferInsert;
