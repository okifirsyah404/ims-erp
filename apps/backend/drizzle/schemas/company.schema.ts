/**
 * Company module schema — owns the `company` Postgres schema.
 *
 * @remarks
 * The one legal company behind every organization (ADR-0011): profile,
 * head office addresses, contacts, bank accounts and company-wide settings.
 * Every table is company-wide — no `organization_id` column in this schema,
 * because one letterhead, one set of bank accounts and one contact list serve
 * all internal organizations.
 *
 * Split out of the `organization` schema in ERP-0042. References to other
 * modules (`auth`, `location`) are plain id columns — cross-module FKs are
 * forbidden (elysia-module rule 3.2).
 */
import {
	unixTimestamp,
	unixTimestampNullable,
} from '@drizzle/datatypes/unix-timestamp';
import { sql } from 'drizzle-orm';
import {
	boolean,
	check,
	index,
	pgSchema,
	text,
	uniqueIndex,
	uuid,
	varchar,
} from 'drizzle-orm/pg-core';

export const companySchema = pgSchema('company');

/* ------------------------------------------------------------------------ *
 * Vocabularies
 * ------------------------------------------------------------------------ */

export const COMPANY_PROFILE_STATUSES = ['active', 'inactive'] as const;
export type CompanyProfileStatus = (typeof COMPANY_PROFILE_STATUSES)[number];

/** Which invoices print a bank account: with VAT and without VAT. */
export const BANK_ACCOUNT_INVOICE_USAGES = ['vat', 'non_vat'] as const;
export type BankAccountInvoiceUsage =
	(typeof BANK_ACCOUNT_INVOICE_USAGES)[number];

/** Kind of a company contact channel. */
export const CONTACT_TYPES = [
	'phone',
	'email',
	'whatsapp',
	'fax',
	'other',
] as const;
export type ContactType = (typeof CONTACT_TYPES)[number];

/** Value types of a stored setting. */
export const SETTING_VALUE_TYPES = [
	'string',
	'number',
	'boolean',
	'json',
	'date',
] as const;
export type SettingValueType = (typeof SETTING_VALUE_TYPES)[number];

/** Shared soft-delete + audit columns. */
const timestamps = {
	createdAt: unixTimestamp('created_at').notNull(),
	updatedAt: unixTimestamp('updated_at')
		.notNull()
		.$onUpdate(() => new Date()),
	deletedAt: unixTimestampNullable('deleted_at'),
};

/* ------------------------------------------------------------------------ *
 * company.profiles
 * ------------------------------------------------------------------------ */

/**
 * The company's legal and display profile: what printed documents need
 * (letterhead, signatory, default terms, warranty texts).
 *
 * @remarks
 * One live row for the whole company (partial unique index on a constant).
 * Addresses, phone, email and website live in `company.head_office_addresses`
 * and `company.contacts` since ERP-0042.
 */
export const companyProfiles = companySchema.table(
	'profiles',
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
		/** Object-storage key of the letterhead logo. */
		logoObjectKey: text('logo_object_key'),
		/** Object-storage key of the signature and stamp image above the signatory name. */
		signatureObjectKey: text('signature_object_key'),
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
		uniqueIndex('profiles_singleton_uq')
			.on(sql`(true)`)
			.where(sql`deleted_at IS NULL`),
		check(
			'profiles_status_check',
			sql`${table.status} IN ('active', 'inactive')`,
		),
		check(
			'profiles_document_code_check',
			sql`${table.documentCode} ~ '^[A-Z0-9]+$'`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * company.head_office_addresses
 * ------------------------------------------------------------------------ */

/**
 * Office address of the company, company-wide (ADR-0011).
 *
 * @remarks
 * The `is_primary` address is the one printed on the letterhead; at most one
 * live primary row (partial unique index).
 */
export const headOfficeAddresses = companySchema.table(
	'head_office_addresses',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		label: varchar('label', { length: 100 })
			.notNull()
			.default('head_office'),
		addressLine: text('address_line').notNull(),
		/** Logical reference to location.villages.id — cross-module FK omitted. */
		villageId: uuid('village_id'),
		postalCode: varchar('postal_code', { length: 10 }),
		isPrimary: boolean('is_primary').notNull().default(false),
		...timestamps,
	},
	(table) => [
		uniqueIndex('head_office_addresses_primary_uq')
			.on(table.isPrimary)
			.where(sql`deleted_at IS NULL AND is_primary`),
	],
);

/* ------------------------------------------------------------------------ *
 * company.contacts
 * ------------------------------------------------------------------------ */

/** Company contact channel, company-wide (ADR-0011). */
export const contacts = companySchema.table(
	'contacts',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		contactType: text('contact_type').notNull(),
		value: varchar('value', { length: 200 }).notNull(),
		label: varchar('label', { length: 100 }),
		/** The contact shown on the letterhead per type; at most one live row. */
		isPrimary: boolean('is_primary').notNull().default(false),
		...timestamps,
	},
	(table) => [
		uniqueIndex('contacts_primary_per_type_uq')
			.on(table.contactType, table.isPrimary)
			.where(sql`deleted_at IS NULL AND is_primary`),
		index('contacts_value_idx').on(table.value),
		check(
			'contacts_contact_type_check',
			sql`${table.contactType} IN ('phone', 'email', 'whatsapp', 'fax', 'other')`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * company.bank_accounts
 * ------------------------------------------------------------------------ */

/**
 * Company-owned bank account (master reference; finance keeps its own
 * operational cash and bank accounts).
 *
 * @remarks
 * `invoice_usage` picks the account printed on an invoice: at most one live
 * account per usage.
 */
export const bankAccounts = companySchema.table(
	'bank_accounts',
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
		uniqueIndex('bank_accounts_code_uq')
			.on(table.code)
			.where(sql`deleted_at IS NULL`),
		uniqueIndex('bank_accounts_invoice_usage_uq')
			.on(table.invoiceUsage)
			.where(sql`deleted_at IS NULL AND invoice_usage IS NOT NULL`),
		index('bank_accounts_account_number_idx').on(table.accountNumber),
		check(
			'bank_accounts_invoice_usage_check',
			sql`${table.invoiceUsage} IS NULL OR ${table.invoiceUsage} IN ('vat', 'non_vat')`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * company.settings
 * ------------------------------------------------------------------------ */

/**
 * Company-wide configuration key value store (ERP-0042).
 *
 * @remarks
 * Organization-scoped settings live in `organization.settings`. Secret values
 * are never read back by the client.
 */
export const companySettings = companySchema.table(
	'settings',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		settingGroup: text('setting_group').notNull(),
		settingKey: text('setting_key').notNull(),
		settingValue: text('setting_value'),
		valueType: text('value_type').notNull().default('string'),
		isSecret: boolean('is_secret').notNull().default(false),
		description: text('description'),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		updatedBy: text('updated_by'),
		...timestamps,
	},
	(table) => [
		uniqueIndex('settings_scope_uq')
			.on(table.settingGroup, table.settingKey)
			.where(sql`deleted_at IS NULL`),
		check(
			'settings_value_type_check',
			sql`${table.valueType} IN ('string', 'number', 'boolean', 'json', 'date')`,
		),
	],
);

export type TCompanyProfileSelect = typeof companyProfiles.$inferSelect;
export type TCompanyProfileInsert = typeof companyProfiles.$inferInsert;
export type THeadOfficeAddressSelect =
	typeof headOfficeAddresses.$inferSelect;
export type THeadOfficeAddressInsert =
	typeof headOfficeAddresses.$inferInsert;
export type TContactSelect = typeof contacts.$inferSelect;
export type TContactInsert = typeof contacts.$inferInsert;
export type TBankAccountSelect = typeof bankAccounts.$inferSelect;
export type TBankAccountInsert = typeof bankAccounts.$inferInsert;
export type TCompanySettingSelect = typeof companySettings.$inferSelect;
export type TCompanySettingInsert = typeof companySettings.$inferInsert;
