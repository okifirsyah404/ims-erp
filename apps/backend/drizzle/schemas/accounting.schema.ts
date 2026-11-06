/**
 * Accounting schema, tax slice (M10, ERP-0016).
 *
 * Mirrors `docs/database/docs.dbml` (`accounting.tax_types`,
 * `accounting.tax_records`, `accounting.tax_corrections`,
 * `accounting.withholding_tax_records`). The rest of the accounting module
 * (chart of accounts, journals, periods) lands in later slices.
 *
 * Rules honoured here:
 * - Money is exact integer IDR minor units in `bigint` (ADR-0002). Rates are
 *   `numeric(9,4)` percentages, never floats.
 * - Cross-module references (`organization_id`, `verified_by`,
 *   `created_by`, `evidence_document_id`) are plain text/uuid columns with no
 *   foreign key. They are validated through the owning module's contract.
 * - Rate changes are new rows. The no-overlap rule per code is enforced by
 *   the service, not by the database.
 * - Soft delete via `deleted_at`. Uniqueness on reusable codes is a partial
 *   index `WHERE deleted_at IS NULL`.
 * - Status vocabularies are text guarded by CHECK constraints.
 */
import { sql } from 'drizzle-orm';
import {
	bigint,
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
	boolean,
} from 'drizzle-orm/pg-core';
import {
	unixTimestamp,
	unixTimestampNullable,
} from '@drizzle/datatypes/unix-timestamp';

export const accountingSchema = pgSchema('accounting');

/** Tax kinds. `ppn_input` / `ppn_output` are the two PPN directions. */
export const TAX_TYPE_KINDS = [
	'ppn',
	'pph',
	'ppn_input',
	'ppn_output',
	'other',
] as const;
export type TaxTypeKind = (typeof TAX_TYPE_KINDS)[number];

/** Base the rate applies to. */
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

/** Withholding lifecycle. */
export const WITHHOLDING_STATUSES = [
	'recorded',
	'verified',
	'paid',
	'reversed',
] as const;
export type WithholdingStatus = (typeof WITHHOLDING_STATUSES)[number];

/* ------------------------------------------------------------------------ *
 * Shared columns
 * ------------------------------------------------------------------------ */

/** Logical reference to `auth.organizations.id`. Tenant scope. */
const organizationId = () => text('organization_id').notNull();

/** Common audit and soft-delete timestamps. */
const timestamps = {
	createdAt: unixTimestamp('created_at').notNull(),
	updatedAt: unixTimestamp('updated_at').notNull(),
	deletedAt: unixTimestampNullable('deleted_at'),
};

/* ------------------------------------------------------------------------ *
 * accounting.tax_types
 * ------------------------------------------------------------------------ */

/**
 * Effective-dated tax rate. One row per code per effective period.
 * Overlap between rows of the same code is refused by the service.
 */
export const taxTypes = accountingSchema.table(
	'tax_types',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
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
		uniqueIndex('tax_types_org_code_effective_uq')
			.on(table.organizationId, table.code, table.effectiveFrom)
			.where(sql`deleted_at IS NULL`),
		index('tax_types_effective_from_idx').on(table.effectiveFrom),
		check(
			'tax_types_tax_type_check',
			sql`tax_type IN ('ppn', 'pph', 'ppn_input', 'ppn_output', 'other')`,
		),
		check(
			'tax_types_base_type_check',
			sql`base_type IN ('gross', 'net', 'specific')`,
		),
		check('tax_types_rate_check', sql`rate >= 0`),
		check(
			'tax_types_effective_range_check',
			sql`effective_to IS NULL OR effective_to >= effective_from`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * accounting.tax_records
 * ------------------------------------------------------------------------ */

/**
 * Period recap workpaper for one tax type. `tax_amount` is the recap as
 * computed when the record was prepared; corrections live in
 * `tax_corrections` and never edit it.
 */
export const taxRecords = accountingSchema.table(
	'tax_records',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		organizationId: organizationId(),
		code: varchar('code', { length: 32 }).notNull(),
		taxTypeId: uuid('tax_type_id')
			.notNull()
			.references(() => taxTypes.id, { onDelete: 'restrict' }),
		periodYear: integer('period_year').notNull(),
		periodMonth: integer('period_month').notNull(),
		/** Exact IDR minor units. */
		taxableBase: bigint('taxable_base', { mode: 'number' })
			.notNull()
			.default(0),
		taxAmount: bigint('tax_amount', { mode: 'number' }).notNull().default(0),
		currencyCode: varchar('currency_code', { length: 3 })
			.notNull()
			.default('IDR'),
		filingStatus: text('filing_status').notNull().default('draft'),
		filedOn: date('filed_on', { mode: 'string' }),
		/** Logical reference to `auth.users.id`. */
		verifiedBy: text('verified_by'),
		notes: text('notes'),
		createdAt: unixTimestamp('created_at').notNull(),
		updatedAt: unixTimestamp('updated_at').notNull(),
		deletedAt: unixTimestampNullable('deleted_at'),
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
		check(
			'tax_records_period_month_check',
			sql`period_month BETWEEN 1 AND 12`,
		),
		check('tax_records_taxable_base_check', sql`taxable_base >= 0`),
		check('tax_records_tax_amount_check', sql`tax_amount >= 0`),
		check(
			'tax_records_filing_status_check',
			sql`filing_status IN ('draft', 'verified', 'filed', 'corrected')`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * accounting.tax_corrections
 * ------------------------------------------------------------------------ */

/**
 * Signed correction against a recap. Net payable is the recap plus the sum
 * of active corrections, computed at read time.
 */
export const taxCorrections = accountingSchema.table(
	'tax_corrections',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		organizationId: organizationId(),
		taxRecordId: uuid('tax_record_id')
			.notNull()
			.references(() => taxRecords.id, { onDelete: 'restrict' }),
		/** Signed IDR minor units. Zero is not a correction. */
		amount: bigint('amount', { mode: 'number' }).notNull(),
		currencyCode: varchar('currency_code', { length: 3 })
			.notNull()
			.default('IDR'),
		reason: text('reason').notNull(),
		/** Logical reference to `documents.documents.id`. */
		evidenceDocumentId: uuid('evidence_document_id'),
		/** Logical reference to `auth.users.id`. */
		createdBy: text('created_by').notNull(),
		...timestamps,
	},
	(table) => [
		index('tax_corrections_tax_record_id_idx').on(table.taxRecordId),
		index('tax_corrections_evidence_document_id_idx').on(
			table.evidenceDocumentId,
		),
		check('tax_corrections_amount_check', sql`amount <> 0`),
		check(
			'tax_corrections_reason_check',
			sql`char_length(trim(reason)) > 0`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * accounting.withholding_tax_records
 * ------------------------------------------------------------------------ */

/**
 * Withholding (PPh) collected on a payment. Counterparty is a plain text
 * pair with no cross-module validation (D11).
 */
export const withholdingTaxRecords = accountingSchema.table(
	'withholding_tax_records',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		organizationId: organizationId(),
		code: varchar('code', { length: 32 }).notNull(),
		taxTypeId: uuid('tax_type_id')
			.notNull()
			.references(() => taxTypes.id, { onDelete: 'restrict' }),
		counterpartyType: text('counterparty_type'),
		counterpartyId: text('counterparty_id'),
		baseAmount: bigint('base_amount', { mode: 'number' }).notNull().default(0),
		taxAmount: bigint('tax_amount', { mode: 'number' }).notNull().default(0),
		currencyCode: varchar('currency_code', { length: 3 })
			.notNull()
			.default('IDR'),
		transactionDate: date('transaction_date', { mode: 'string' }),
		periodYear: integer('period_year'),
		periodMonth: integer('period_month'),
		status: text('status').notNull().default('recorded'),
		createdAt: unixTimestamp('created_at').notNull(),
		updatedAt: unixTimestamp('updated_at').notNull(),
		deletedAt: unixTimestampNullable('deleted_at'),
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

export type TTaxTypeSelect = typeof taxTypes.$inferSelect;
export type TTaxTypeInsert = typeof taxTypes.$inferInsert;
export type TTaxRecordSelect = typeof taxRecords.$inferSelect;
export type TTaxRecordInsert = typeof taxRecords.$inferInsert;
export type TTaxCorrectionSelect = typeof taxCorrections.$inferSelect;
export type TTaxCorrectionInsert = typeof taxCorrections.$inferInsert;
export type TWithholdingTaxRecordSelect =
	typeof withholdingTaxRecords.$inferSelect;
export type TWithholdingTaxRecordInsert =
	typeof withholdingTaxRecords.$inferInsert;
