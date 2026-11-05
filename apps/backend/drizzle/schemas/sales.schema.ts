/**
 * Sales domain schema — owns the `sales` Postgres schema.
 *
 * Quotations (SPH) with their items and status history (ADR-0011 port step
 * 3c), plus the transitional `payments` scaffold.
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
	{ quotations, quotationItems, quotationStatusHistory },
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
export type TPaymentInsert = typeof payments.$inferInsert;
export type TPaymentSelect = typeof payments.$inferSelect;
