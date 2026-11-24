/**
 * Supplier module schema — owns the `supplier` Postgres schema (new; split out
 * of `procurement`, ADR-0024 Q17).
 *
 * @remarks
 * A supplier **company** (the entity a purchase order is issued to) with its
 * **people** (PIC), plus addresses. Company-wide: no `organization_id`.
 * Bank details are restricted (`supplier:read_bank`).
 */
import {
	unixTimestamp,
	unixTimestampNullable,
} from '@drizzle/datatypes/unix-timestamp';
import { createCodeNumberingTable } from '@shared/numbering/table';
import { sql } from 'drizzle-orm';
import {
	boolean,
	check,
	index,
	integer,
	pgSchema,
	text,
	uniqueIndex,
	uuid,
	varchar,
} from 'drizzle-orm/pg-core';

export const supplierSchema = pgSchema('supplier');

export const SUPPLIER_COMPANY_TYPES = [
	'company',
	'government',
	'individual',
] as const;
export type SupplierCompanyType = (typeof SUPPLIER_COMPANY_TYPES)[number];

/** Inactive suppliers stay readable but cannot be used on new POs. */
export const SUPPLIER_STATUSES = ['active', 'inactive'] as const;
export type SupplierStatus = (typeof SUPPLIER_STATUSES)[number];

const timestamps = {
	createdAt: unixTimestamp('created_at').notNull(),
	updatedAt: unixTimestamp('updated_at')
		.notNull()
		.$onUpdate(() => new Date()),
	deletedAt: unixTimestampNullable('deleted_at'),
};

/* ------------------------------------------------------------------------ *
 * supplier.companies
 * ------------------------------------------------------------------------ */

/**
 * Supplier company, company-wide.
 *
 * @remarks
 * Was `procurement.suppliers` for company/government rows. `code` is the
 * `{SUPPLIER}` token of PO numbers. The bank columns are restricted and never
 * returned without `supplier:read_bank`. ERP-0116 dropped `whatsapp`,
 * `payment_terms_days` and `payment_term_note` (payment terms belong to the
 * purchase order).
 */
export const supplierCompanies = supplierSchema.table(
	'companies',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		/** Upper-case letters and digits; unique among live rows. */
		code: varchar('code', { length: 32 }).notNull(),
		name: text('name').notNull(),
		legalName: text('legal_name'),
		supplierType: text('supplier_type').notNull().default('company'),
		/** NPWP digits only (15 or 16). */
		taxId: varchar('tax_id', { length: 16 }),
		email: text('email'),
		phone: varchar('phone', { length: 30 }),
		website: varchar('website', { length: 200 }),
		// Restricted (`supplier:read_bank`).
		bankName: text('bank_name'),
		bankAccountNumber: text('bank_account_number'),
		bankAccountHolder: text('bank_account_holder'),
		/** Object-storage key of the single supplier photo; never a public URL. */
		imageObjectKey: text('image_object_key'),
		status: text('status').notNull().default('active'),
		notes: text('notes'),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		createdBy: text('created_by'),
		...timestamps,
	},
	(table) => [
		uniqueIndex('supplier_companies_code_uq')
			.on(table.code)
			.where(sql`deleted_at IS NULL`),
		index('supplier_companies_name_idx').on(table.name),
		index('supplier_companies_status_idx').on(table.status),
		index('supplier_companies_tax_id_idx').on(table.taxId),
		check(
			'supplier_companies_type_check',
			sql`${table.supplierType} IN ('company', 'government', 'individual')`,
		),
		check(
			'supplier_companies_status_check',
			sql`${table.status} IN ('active', 'inactive')`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * supplier.suppliers (PIC)
 * ------------------------------------------------------------------------ */

/**
 * Supplier-side person in charge, or an individual supplier when `company_id`
 * is null. Was the PIC columns of `procurement.suppliers`.
 */
export const suppliers = supplierSchema.table(
	'suppliers',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		companyId: uuid('company_id').references(() => supplierCompanies.id, {
			onDelete: 'restrict',
		}),
		name: text('name').notNull(),
		title: varchar('title', { length: 100 }),
		phone: varchar('phone', { length: 30 }),
		email: text('email'),
		/** Printed on purchase orders; at most one live row per company. */
		isPrimary: boolean('is_primary').notNull().default(false),
		status: text('status').notNull().default('active'),
		notes: text('notes'),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		createdBy: text('created_by'),
		...timestamps,
	},
	(table) => [
		uniqueIndex('suppliers_primary_uq')
			.on(table.companyId)
			.where(sql`is_primary AND deleted_at IS NULL AND company_id IS NOT NULL`),
		index('suppliers_company_id_idx').on(table.companyId),
		index('suppliers_status_idx').on(table.status),
		check('suppliers_status_check', sql`${table.status} IN ('active', 'inactive')`),
	],
);

/* ------------------------------------------------------------------------ *
 * supplier.addresses / supplier.company_addresses
 * ------------------------------------------------------------------------ */

/** Address of a supplier person. Only `village_id` is stored. */
export const supplierAddresses = supplierSchema.table(
	'addresses',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		supplierId: uuid('supplier_id')
			.notNull()
			.references(() => suppliers.id, { onDelete: 'cascade' }),
		kind: text('kind').notNull().default('office'),
		label: text('label'),
		addressLine: text('address_line').notNull(),
		/** Logical reference to location.villages.id — cross-module FK omitted. */
		villageId: uuid('village_id'),
		postalCode: varchar('postal_code', { length: 10 }),
		isPrimary: boolean('is_primary').notNull().default(false),
		...timestamps,
	},
	(table) => [
		index('supplier_addresses_supplier_id_idx').on(table.supplierId),
		check(
			'supplier_addresses_kind_check',
			sql`${table.kind} IN ('office', 'other')`,
		),
	],
);

/** Structured address of a supplier company. */
export const supplierCompanyAddresses = supplierSchema.table(
	'company_addresses',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		companyId: uuid('company_id')
			.notNull()
			.references(() => supplierCompanies.id, { onDelete: 'cascade' }),
		kind: text('kind').notNull().default('office'),
		label: text('label'),
		contactName: text('contact_name'),
		contactPhone: text('contact_phone'),
		addressLine: text('address_line').notNull(),
		/** Logical reference to location.villages.id — cross-module FK omitted. */
		villageId: uuid('village_id'),
		postalCode: varchar('postal_code', { length: 10 }),
		isPrimary: boolean('is_primary').notNull().default(false),
		...timestamps,
	},
	(table) => [
		index('supplier_company_addresses_company_id_idx').on(table.companyId),
		check(
			'supplier_company_addresses_kind_check',
			sql`${table.kind} IN ('office', 'factory', 'warehouse', 'billing', 'other')`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * supplier.settings / supplier.code_numberings
 * ------------------------------------------------------------------------ */

/** Supplier module configuration key value store. */
export const supplierSettings = supplierSchema.table(
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
		uniqueIndex('supplier_settings_scope_uq')
			.on(table.settingGroup, table.settingKey)
			.where(sql`deleted_at IS NULL`),
		check(
			'supplier_settings_value_type_check',
			sql`${table.valueType} IN ('string', 'number', 'boolean', 'json', 'date')`,
		),
	],
);

export const supplierCodeNumberings = createCodeNumberingTable(supplierSchema);

export type TSupplierCompanySelect = typeof supplierCompanies.$inferSelect;
export type TSupplierCompanyInsert = typeof supplierCompanies.$inferInsert;
export type TSupplierSelect = typeof suppliers.$inferSelect;
export type TSupplierInsert = typeof suppliers.$inferInsert;
export type TSupplierAddressSelect = typeof supplierAddresses.$inferSelect;
export type TSupplierAddressInsert = typeof supplierAddresses.$inferInsert;
export type TSupplierCompanyAddressSelect =
	typeof supplierCompanyAddresses.$inferSelect;
export type TSupplierCompanyAddressInsert =
	typeof supplierCompanyAddresses.$inferInsert;
export type TSupplierSettingSelect = typeof supplierSettings.$inferSelect;
export type TSupplierSettingInsert = typeof supplierSettings.$inferInsert;
export type TSupplierCodeNumberingSelect =
	typeof supplierCodeNumberings.$inferSelect;
export type TSupplierCodeNumberingInsert =
	typeof supplierCodeNumberings.$inferInsert;
