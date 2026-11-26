/**
 * Company module schema — owns the `company` Postgres schema.
 *
 * @remarks
 * The one legal company behind every organization (ADR-0011): profile,
 * addresses, contacts and company-wide settings. Every table is company-wide —
 * no `organization_id` column in this schema, because one letterhead and one
 * contact list serve all internal organizations.
 *
 * `company.head_office_addresses` is now `company.addresses` (ADR-0024 Q21) and
 * `company.bank_accounts` moved to `finance.cash_bank_accounts` (Q19).
 * Addresses store only `village_id`; the path is resolved through
 * `ExportedLocationService` (Q10).
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
		/** Object-storage key of the onboarding image shown on the login page. */
		onboardingObjectKey: text('onboarding_object_key'),
		signatoryName: varchar('signatory_name', { length: 200 }),
		signatoryTitle: varchar('signatory_title', { length: 100 }),
		/** Prefilled into new quotations. */
		defaultQuotationTerms: text('default_quotation_terms'),
		/** Printed on invoices. */
		defaultInvoiceTerms: text('default_invoice_terms'),
		/** Warranty certificate sections, one item per line. */
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
 * company.addresses
 * ------------------------------------------------------------------------ */

/**
 * Office address of the company, company-wide.
 *
 * @remarks
 * The `is_primary` address is the one printed on the letterhead; at most one
 * live primary row (partial unique index). Only `village_id` is stored - the
 * district/regency/province path is derived (ADR-0024 Q10).
 */
export const companyAddresses = companySchema.table(
	'addresses',
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
		uniqueIndex('addresses_primary_uq')
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
 * company.settings
 * ------------------------------------------------------------------------ */

/**
 * Company-wide configuration key value store.
 *
 * @remarks
 * Organization-scoped settings live in `auth.organization_settings`.
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
		uniqueIndex('company_settings_scope_uq')
			.on(table.settingGroup, table.settingKey)
			.where(sql`deleted_at IS NULL`),
		check(
			'company_settings_value_type_check',
			sql`${table.valueType} IN ('string', 'number', 'boolean', 'json', 'date')`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * company.letterheads
 * ------------------------------------------------------------------------ */

/**
 * Uploaded letterhead (kop surat) templates, company-wide (ERP-0165).
 *
 * @remarks
 * A document picks one (`procurement.purchase_orders.letterhead_id`). A
 * soft-deleted letterhead keeps its images, so a document that used it still
 * prints. Every upload gets a fresh object key. At most one live default.
 */
export const letterheads = companySchema.table(
	'letterheads',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		name: varchar('name', { length: 100 }).notNull(),
		/** Object-storage key of the header image printed across the top (WebP). */
		headerObjectKey: text('header_object_key').notNull(),
		/** Object-storage key of the optional footer image printed on every page (WebP). */
		footerObjectKey: text('footer_object_key'),
		isDefault: boolean('is_default').notNull().default(false),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		updatedBy: text('updated_by'),
		...timestamps,
	},
	(table) => [
		uniqueIndex('letterheads_default_uq')
			.on(table.isDefault)
			.where(sql`deleted_at IS NULL AND is_default`),
	],
);

export type TCompanyProfileSelect = typeof companyProfiles.$inferSelect;
export type TCompanyProfileInsert = typeof companyProfiles.$inferInsert;
export type TCompanyAddressSelect = typeof companyAddresses.$inferSelect;
export type TCompanyAddressInsert = typeof companyAddresses.$inferInsert;
export type TContactSelect = typeof contacts.$inferSelect;
export type TContactInsert = typeof contacts.$inferInsert;
export type TCompanySettingSelect = typeof companySettings.$inferSelect;
export type TCompanySettingInsert = typeof companySettings.$inferInsert;
export type TLetterheadSelect = typeof letterheads.$inferSelect;
export type TLetterheadInsert = typeof letterheads.$inferInsert;
