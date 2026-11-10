/**
 * Organization domain schema — owns the `organization` Postgres schema.
 *
 * Company profile, company bank accounts, and document numbering series.
 *
 * House rules honoured here:
 * - **Company-wide, no `organization_id`** (ADR-0011 §2): one company runs
 *   several internal organizations (departments, ADR-0007), but it has one
 *   letterhead, one set of bank accounts, and one numbering series per
 *   document type. Scoping these per department would let two departments
 *   issue the same invoice number.
 * - Singletons and reusable codes use partial unique indexes
 *   `WHERE deleted_at IS NULL`, so a soft-deleted row never blocks a new one.
 * - Status vocabularies are `text` guarded by CHECK constraints, never
 *   native enums (DBML project rule).
 * - References to other modules (`auth`, `location`) are plain id columns
 *   with no FK — cross-module FKs are forbidden.
 */
import { sql } from 'drizzle-orm';
import {
	bigint,
	boolean,
	check,
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

export const organizationSchema = pgSchema('organization');

/* ------------------------------------------------------------------------ *
 * Vocabularies
 * ------------------------------------------------------------------------ */

export const COMPANY_PROFILE_STATUSES = ['active', 'inactive'] as const;
export type CompanyProfileStatus = (typeof COMPANY_PROFILE_STATUSES)[number];

/**
 * Which invoices print a bank account: invoices with VAT ("wajib pajak")
 * and invoices without VAT ("non pajak") go to different accounts.
 */
export const BANK_ACCOUNT_INVOICE_USAGES = ['vat', 'non_vat'] as const;
export type BankAccountInvoiceUsage =
	(typeof BANK_ACCOUNT_INVOICE_USAGES)[number];

/**
 * Document types that get numbers. `web_*` are public references handed
 * back to website visitors (RFQ, contact, demo).
 */
export const DOCUMENT_TYPES = [
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
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

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

/* ------------------------------------------------------------------------ *
 * organization.company_profiles
 * ------------------------------------------------------------------------ */

/**
 * The company's legal and display profile: what printed documents need
 * (letterhead, signatory, default terms, warranty texts).
 *
 * @remarks
 * One live row for the whole company (partial unique index on a constant).
 */
export const companyProfiles = organizationSchema.table(
	'company_profiles',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		legalName: varchar('legal_name', { length: 200 }).notNull(),
		tradingName: varchar('trading_name', { length: 200 }),
		/** Short code used by document numbers (`{COMPANY}` token), e.g. `IMS`. */
		documentCode: varchar('document_code', { length: 16 }).notNull(),
		tagline: varchar('tagline', { length: 300 }),
		/** NPWP number of the company. */
		taxId: varchar('tax_id', { length: 32 }),
		email: varchar('email', { length: 200 }),
		phone: varchar('phone', { length: 100 }),
		website: varchar('website', { length: 200 }),
		/** Object-storage key of the letterhead logo. */
		logoObjectKey: text('logo_object_key'),
		/** Object-storage key of the signature and stamp image above the signatory name. */
		signatureObjectKey: text('signature_object_key'),
		/** Free-text address as printed on the letterhead. */
		addressLine: text('address_line'),
		/** Logical reference to location.villages.id — cross-module FK omitted. */
		addressVillageId: uuid('address_village_id'),
		postalCode: varchar('postal_code', { length: 10 }),
		signatoryName: varchar('signatory_name', { length: 200 }),
		signatoryTitle: varchar('signatory_title', { length: 100 }),
		/** Prefilled into new quotations. */
		defaultQuotationTerms: text('default_quotation_terms'),
		/** Printed on invoices. */
		defaultInvoiceTerms: text('default_invoice_terms'),
		/**
		 * Warranty certificate sections (coverage, exclusions, service terms),
		 * one item per line; empty = built-in sample text.
		 */
		warrantyCoverage: text('warranty_coverage'),
		warrantyExclusions: text('warranty_exclusions'),
		warrantyServiceTerms: text('warranty_service_terms'),
		status: text('status').notNull().default('active'),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		updatedBy: text('updated_by'),
		...timestamps,
	},
	(table) => [
		uniqueIndex('company_profiles_singleton_uq')
			.on(sql`(true)`)
			.where(sql`deleted_at IS NULL`),
		check(
			'company_profiles_status_check',
			sql`${table.status} IN ('active', 'inactive')`,
		),
		check(
			'company_profiles_document_code_check',
			sql`${table.documentCode} ~ '^[A-Z0-9]+$'`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * organization.company_bank_accounts
 * ------------------------------------------------------------------------ */

/**
 * Company-owned bank account (master reference; finance keeps its own
 * operational cash and bank accounts).
 *
 * @remarks
 * `invoice_usage` picks the account printed on an invoice: at most one live
 * account per usage.
 */
export const companyBankAccounts = organizationSchema.table(
	'company_bank_accounts',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		code: varchar('code', { length: 32 }).notNull(),
		bankName: varchar('bank_name', { length: 100 }).notNull(),
		bankCode: varchar('bank_code', { length: 20 }),
		branchName: varchar('branch_name', { length: 100 }),
		accountNumber: varchar('account_number', { length: 50 }).notNull(),
		accountHolder: varchar('account_holder', { length: 200 }).notNull(),
		currencyCode: varchar('currency_code', { length: 3 })
			.notNull()
			.default('IDR'),
		invoiceUsage: text('invoice_usage'),
		isPrimary: boolean('is_primary').notNull().default(false),
		isActive: boolean('is_active').notNull().default(true),
		...timestamps,
	},
	(table) => [
		uniqueIndex('company_bank_accounts_code_uq')
			.on(table.code)
			.where(sql`deleted_at IS NULL`),
		uniqueIndex('company_bank_accounts_invoice_usage_uq')
			.on(table.invoiceUsage)
			.where(sql`deleted_at IS NULL AND invoice_usage IS NOT NULL`),
		check(
			'company_bank_accounts_invoice_usage_check',
			sql`${table.invoiceUsage} IS NULL OR ${table.invoiceUsage} IN ('vat', 'non_vat')`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * organization.document_sequences
 * ------------------------------------------------------------------------ */

/**
 * Numbering series, one live row per document type.
 *
 * @remarks
 * `pattern` / `reset_policy` are the owner's override; `NULL` means the code
 * default for that type. `period_key` is the period the counter belongs to
 * (`2026`, `2026-11`, `all`); allocating in a new period starts again at 1.
 * Allocation is one atomic `INSERT … ON CONFLICT DO UPDATE … RETURNING` in
 * the owning repository, so concurrent callers never get the same number.
 */
export const documentSequences = organizationSchema.table(
	'document_sequences',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		/** Owning module of the document type (`sales`, `procurement`, …). */
		module: varchar('module', { length: 32 }).notNull(),
		documentType: varchar('document_type', { length: 32 }).notNull(),
		pattern: varchar('pattern', { length: 100 }),
		resetPolicy: text('reset_policy'),
		periodKey: varchar('period_key', { length: 7 }).notNull(),
		nextNumber: bigint('next_number', { mode: 'number' }).notNull().default(1),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		updatedBy: text('updated_by'),
		...timestamps,
	},
	(table) => [
		uniqueIndex('document_sequences_type_uq')
			.on(table.documentType)
			.where(sql`deleted_at IS NULL`),
		check(
			'document_sequences_reset_policy_check',
			sql`${table.resetPolicy} IS NULL OR ${table.resetPolicy} IN ('never', 'yearly', 'monthly')`,
		),
		check('document_sequences_next_number_check', sql`${table.nextNumber} > 0`),
	],
);

export type TCompanyProfileSelect = typeof companyProfiles.$inferSelect;
export type TCompanyProfileInsert = typeof companyProfiles.$inferInsert;
export type TCompanyBankAccountSelect = typeof companyBankAccounts.$inferSelect;
export type TDocumentSequenceSelect = typeof documentSequences.$inferSelect;
