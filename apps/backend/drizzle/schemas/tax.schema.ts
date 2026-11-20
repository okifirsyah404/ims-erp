/**
 * Tax module schema — owns the `tax` Postgres schema (new; split out of
 * `accounting`, ADR-0024 Q19).
 *
 * @remarks
 * Effective-dated tax rates, the period recap workpaper, its signed corrections
 * and withholding records. Rates are `numeric(9,4)` percentages, never floats;
 * money is bigint IDR minor units. A rate change is a new row and the
 * no-overlap rule per code is enforced by the service, not the database.
 */
import {
	unixTimestamp,
	unixTimestampNullable,
} from '@drizzle/datatypes/unix-timestamp';
import { createCodeNumberingTable } from '@shared/numbering/table';
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

export const taxSchema = pgSchema('tax');

/** Tax kinds. `ppn_input` / `ppn_output` are the two PPN directions. */
export const TAX_TYPE_KINDS = [
	'ppn',
	'pph',
	'ppn_input',
	'ppn_output',
	'other',
] as const;
export type TaxTypeKind = (typeof TAX_TYPE_KINDS)[number];

export const TAX_BASE_TYPES = ['gross', 'net', 'specific'] as const;
export type TaxBaseType = (typeof TAX_BASE_TYPES)[number];

/** Working-paper filing lifecycle. Filing itself happens outside the ERP. */
export const TAX_RECORD_STATUSES = [
	'draft',
	'verified',
	'filed',
	'corrected',
] as const;
export type TaxRecordStatus = (typeof TAX_RECORD_STATUSES)[number];

export const WITHHOLDING_STATUSES = [
	'recorded',
	'verified',
	'paid',
	'reversed',
] as const;
export type WithholdingStatus = (typeof WITHHOLDING_STATUSES)[number];

const organizationId = () => text('organization_id');
const currencyCode = () =>
	varchar('currency_code', { length: 3 }).notNull().default('IDR');

const timestamps = {
	createdAt: unixTimestamp('created_at').notNull(),
	updatedAt: unixTimestamp('updated_at').notNull(),
	deletedAt: unixTimestampNullable('deleted_at'),
};

/* ------------------------------------------------------------------------ *
 * tax.taxes
 * ------------------------------------------------------------------------ */

/** Effective-dated tax rate (was `accounting.tax_types`). */
export const taxes = taxSchema.table(
	'taxes',
	{
		id: uuid('id').primaryKey().default(sql`uuidv7()`),
		organizationId: organizationId(),
		code: varchar('code', { length: 32 }).notNull(),
		name: text('name').notNull(),
		taxType: text('tax_type').notNull(),
		/** Percentage, e.g. 11.0000 for 11%. */
		rate: numeric('rate', { precision: 9, scale: 4 }).notNull().default('0'),
		baseType: text('base_type').notNull().default('gross'),
		isInclusive: boolean('is_inclusive').notNull().default(false),
		effectiveFrom: date('effective_from', { mode: 'string' }).notNull(),
		effectiveTo: date('effective_to', { mode: 'string' }),
		isActive: boolean('is_active').notNull().default(true),
		...timestamps,
	},
	(table) => [
		uniqueIndex('taxes_org_code_effective_uq')
			.on(table.organizationId, table.code, table.effectiveFrom)
			.where(sql`deleted_at IS NULL`),
		index('taxes_effective_from_idx').on(table.effectiveFrom),
		check(
			'taxes_tax_type_check',
			sql`tax_type IN ('ppn', 'pph', 'ppn_input', 'ppn_output', 'other')`,
		),
		check(
			'taxes_base_type_check',
			sql`base_type IN ('gross', 'net', 'specific')`,
		),
		check('taxes_rate_check', sql`rate >= 0`),
		check(
			'taxes_effective_range_check',
			sql`effective_to IS NULL OR effective_to >= effective_from`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * tax.records / tax.corrections
 * ------------------------------------------------------------------------ */

/** Period recap workpaper for one tax type (was `accounting.tax_records`). */
export const taxRecords = taxSchema.table(
	'records',
	{
		id: uuid('id').primaryKey().default(sql`uuidv7()`),
		organizationId: organizationId(),
		code: varchar('code', { length: 32 }).notNull(),
		taxTypeId: uuid('tax_type_id')
			.notNull()
			.references(() => taxes.id, { onDelete: 'restrict' }),
		periodYear: integer('period_year').notNull(),
		periodMonth: integer('period_month').notNull(),
		taxableBase: bigint('taxable_base', { mode: 'number' })
			.notNull()
			.default(0),
		taxAmount: bigint('tax_amount', { mode: 'number' }).notNull().default(0),
		currencyCode: currencyCode(),
		filingStatus: text('filing_status').notNull().default('draft'),
		filedOn: date('filed_on', { mode: 'string' }),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		verifiedBy: text('verified_by'),
		notes: text('notes'),
		...timestamps,
	},
	(table) => [
		uniqueIndex('tax_records_org_code_uq')
			.on(table.organizationId, table.code)
			.where(sql`deleted_at IS NULL`),
		uniqueIndex('tax_records_org_type_period_uq')
			.on(
				table.organizationId,
				table.taxTypeId,
				table.periodYear,
				table.periodMonth,
			)
			.where(sql`deleted_at IS NULL`),
		index('tax_records_tax_type_id_idx').on(table.taxTypeId),
		index('tax_records_period_idx').on(
			table.organizationId,
			table.periodYear,
			table.periodMonth,
		),
		check('tax_records_period_month_check', sql`period_month BETWEEN 1 AND 12`),
		check('tax_records_taxable_base_check', sql`taxable_base >= 0`),
		check('tax_records_tax_amount_check', sql`tax_amount >= 0`),
		check(
			'tax_records_filing_status_check',
			sql`filing_status IN ('draft', 'verified', 'filed', 'corrected')`,
		),
	],
);

/** Signed correction against a recap; the recap itself is never edited. */
export const taxCorrections = taxSchema.table(
	'corrections',
	{
		id: uuid('id').primaryKey().default(sql`uuidv7()`),
		organizationId: organizationId(),
		taxRecordId: uuid('tax_record_id')
			.notNull()
			.references(() => taxRecords.id, { onDelete: 'restrict' }),
		/** Signed IDR minor units. Zero is not a correction. */
		amount: bigint('amount', { mode: 'number' }).notNull(),
		currencyCode: currencyCode(),
		reason: text('reason').notNull(),
		/** Logical reference to document.documents.id — cross-module FK omitted. */
		evidenceDocumentId: uuid('evidence_document_id'),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		createdBy: text('created_by'),
		...timestamps,
	},
	(table) => [
		index('tax_corrections_tax_record_id_idx').on(table.taxRecordId),
		index('tax_corrections_evidence_document_id_idx').on(
			table.evidenceDocumentId,
		),
		check('tax_corrections_amount_check', sql`amount <> 0`),
		check('tax_corrections_reason_check', sql`char_length(trim(reason)) > 0`),
	],
);

/* ------------------------------------------------------------------------ *
 * tax.withholding_tax_records
 * ------------------------------------------------------------------------ */

/** Withholding (PPh) collected on a payment. */
export const withholdingTaxRecords = taxSchema.table(
	'withholding_tax_records',
	{
		id: uuid('id').primaryKey().default(sql`uuidv7()`),
		organizationId: organizationId(),
		code: varchar('code', { length: 32 }).notNull(),
		taxTypeId: uuid('tax_type_id')
			.notNull()
			.references(() => taxes.id, { onDelete: 'restrict' }),
		counterpartyType: text('counterparty_type'),
		counterpartyId: text('counterparty_id'),
		baseAmount: bigint('base_amount', { mode: 'number' }).notNull().default(0),
		taxAmount: bigint('tax_amount', { mode: 'number' }).notNull().default(0),
		currencyCode: currencyCode(),
		transactionDate: date('transaction_date', { mode: 'string' }),
		periodYear: integer('period_year'),
		periodMonth: integer('period_month'),
		status: text('status').notNull().default('recorded'),
		...timestamps,
	},
	(table) => [
		uniqueIndex('withholding_tax_records_org_code_uq')
			.on(table.organizationId, table.code)
			.where(sql`deleted_at IS NULL`),
		index('withholding_tax_records_tax_type_id_idx').on(table.taxTypeId),
		index('withholding_tax_records_counterparty_idx').on(
			table.counterpartyType,
			table.counterpartyId,
		),
		check('withholding_base_amount_check', sql`base_amount >= 0`),
		check('withholding_tax_amount_check', sql`tax_amount >= 0`),
		check(
			'withholding_status_check',
			sql`status IN ('recorded', 'verified', 'paid', 'reversed')`,
		),
	],
);

export const taxCodeNumberings = createCodeNumberingTable(taxSchema);

export type TTaxSelect = typeof taxes.$inferSelect;
export type TTaxInsert = typeof taxes.$inferInsert;
export type TTaxRecordSelect = typeof taxRecords.$inferSelect;
export type TTaxRecordInsert = typeof taxRecords.$inferInsert;
export type TTaxCorrectionSelect = typeof taxCorrections.$inferSelect;
export type TTaxCorrectionInsert = typeof taxCorrections.$inferInsert;
export type TWithholdingTaxRecordSelect =
	typeof withholdingTaxRecords.$inferSelect;
export type TWithholdingTaxRecordInsert =
	typeof withholdingTaxRecords.$inferInsert;
export type TTaxCodeNumberingSelect = typeof taxCodeNumberings.$inferSelect;
export type TTaxCodeNumberingInsert = typeof taxCodeNumberings.$inferInsert;
