/**
 * Customer module schema — owns the `customer` Postgres schema (was `crm`).
 *
 * @remarks
 * A customer **company** (the B2B entity) with its **people**. A person is
 * either an individual buyer or the contact/PIC of a company, and carries the
 * customer-portal login columns that used to live in `auth.portal_identities`
 * (ADR-0024 Q5/Q16). `crm.customer_contacts` merged into `customers`; the lead
 * tables moved to `project` (Q12).
 *
 * Company-wide (ADR-0011): no `organization_id`. References to other modules
 * (`auth`, `location`) are plain id columns — cross-module FKs are forbidden.
 */
import {
	unixTimestamp,
	unixTimestampNullable,
} from '@drizzle/datatypes/unix-timestamp';
import { createCodeNumberingTable } from '@shared/numbering/table';
import { sql } from 'drizzle-orm';
import {
	type AnyPgColumn,
	boolean,
	check,
	index,
	pgSchema,
	text,
	uniqueIndex,
	uuid,
	varchar,
} from 'drizzle-orm/pg-core';

export const customerSchema = pgSchema('customer');

/* ------------------------------------------------------------------------ *
 * Vocabularies
 * ------------------------------------------------------------------------ */

/** Customer company kinds. */
export const CUSTOMER_COMPANY_TYPES = [
	'company',
	'government',
	'partner',
] as const;
export type CustomerCompanyType = (typeof CUSTOMER_COMPANY_TYPES)[number];

/** A person is either a standalone buyer or a company contact. */
export const CUSTOMER_TYPES = ['individual', 'contact'] as const;
export type CustomerType = (typeof CUSTOMER_TYPES)[number];

export const CUSTOMER_STATUSES = ['active', 'inactive'] as const;
export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number];

/** What a portal login may do for its company (owner decision D2). */
export const PORTAL_ROLES = ['owner', 'approver', 'finance', 'viewer'] as const;
export type PortalRole = (typeof PORTAL_ROLES)[number];

export const PORTAL_STATUSES = ['active', 'suspended', 'revoked'] as const;
export type PortalStatus = (typeof PORTAL_STATUSES)[number];

/** Shared soft-delete + audit columns. */
const timestamps = {
	createdAt: unixTimestamp('created_at').notNull(),
	updatedAt: unixTimestamp('updated_at')
		.notNull()
		.$onUpdate(() => new Date()),
	deletedAt: unixTimestampNullable('deleted_at'),
};

/* ------------------------------------------------------------------------ *
 * customer.companies
 * ------------------------------------------------------------------------ */

/**
 * Customer company — the B2B entity.
 *
 * @remarks
 * Was the `company`/`government`/`partner` rows of `crm.customers`. Addresses
 * moved to `customer.company_addresses`.
 */
export const customerCompanies = customerSchema.table(
	'companies',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		/** Upper-case; unique among live rows. */
		code: varchar('code', { length: 32 }).notNull(),
		name: text('name').notNull(),
		legalName: text('legal_name'),
		companyType: text('company_type').notNull().default('company'),
		/** NPWP digits only (15 or 16). */
		taxId: varchar('tax_id', { length: 16 }),
		email: text('email'),
		/** E.164, normalised by the service. */
		phone: varchar('phone', { length: 30 }),
		website: varchar('website', { length: 200 }),
		status: text('status').notNull().default('active'),
		/**
		 * The one owner of the company account: a contact of this company.
		 * Every other contact is staff (ERP-0114).
		 */
		ownerCustomerId: uuid('owner_customer_id').references(
			(): AnyPgColumn => customers.id,
			{ onDelete: 'set null' },
		),
		notes: text('notes'),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		createdBy: text('created_by'),
		...timestamps,
	},
	(table) => [
		uniqueIndex('customer_companies_code_uq')
			.on(table.code)
			.where(sql`deleted_at IS NULL`),
		index('customer_companies_name_idx').on(table.name),
		index('customer_companies_tax_id_idx').on(table.taxId),
		uniqueIndex('customer_companies_owner_uq')
			.on(table.ownerCustomerId)
			.where(sql`owner_customer_id IS NOT NULL AND deleted_at IS NULL`),
		check(
			'customer_companies_type_check',
			sql`${table.companyType} IN ('company', 'government', 'partner')`,
		),
		check(
			'customer_companies_status_check',
			sql`${table.status} IN ('active', 'inactive')`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * customer.customers
 * ------------------------------------------------------------------------ */

/**
 * A person: an individual customer, or a contact of a company (its one
 * owner or a staff member).
 *
 * @remarks
 * `user_id` is the person's Better Auth account (one account, one customer). A portal user is never an
 * organization member, so every ERP route (and the web admin's sign-in) refuses
 * it; only the portal routes accept an active login.
 */
export const customers = customerSchema.table(
	'customers',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		code: varchar('code', { length: 32 }).notNull(),
		/** The company this person belongs to; null for an individual buyer. */
		companyId: uuid('company_id').references(() => customerCompanies.id, {
			onDelete: 'restrict',
		}),
		name: text('name').notNull(),
		position: text('position'),
		/** E.164, normalised by the service. The email lives on the auth user. */
		phone: varchar('phone', { length: 30 }),
		customerType: text('customer_type').notNull().default('individual'),
		status: text('status').notNull().default('active'),
		/**
		 * The Better Auth account of this person — one account is exactly one
		 * customer (ERP-0114). Logical reference to auth.users.id.
		 */
		userId: text('user_id'),
		portalRole: text('portal_role'),
		portalStatus: text('portal_status'),
		/** Logical reference to auth.users.id — null for a self sign-up. */
		portalInvitedBy: text('portal_invited_by'),
		portalLastLoginAt: unixTimestampNullable('portal_last_login_at'),
		/** Account created with the default password; cleared on change/reset. */
		portalPasswordChangeRequired: boolean('portal_password_change_required')
			.notNull()
			.default(false),
		notes: text('notes'),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		createdBy: text('created_by'),
		...timestamps,
	},
	(table) => [
		uniqueIndex('customers_code_uq')
			.on(table.code)
			.where(sql`deleted_at IS NULL`),
		uniqueIndex('customers_user_uq')
			.on(table.userId)
			.where(sql`user_id IS NOT NULL AND deleted_at IS NULL`),
		index('customers_company_id_idx').on(table.companyId),
		index('customers_name_idx').on(table.name),
		check(
			'customers_type_check',
			sql`${table.customerType} IN ('individual', 'contact')`,
		),
		check(
			'customers_status_check',
			sql`${table.status} IN ('active', 'inactive')`,
		),
		check(
			'customers_portal_role_check',
			sql`${table.portalRole} IS NULL OR ${table.portalRole} IN ('owner', 'approver', 'finance', 'viewer')`,
		),
		check(
			'customers_portal_status_check',
			sql`${table.portalStatus} IS NULL OR ${table.portalStatus} IN ('active', 'suspended', 'revoked')`,
		),
		check(
			'customers_company_required_check',
			sql`${table.companyId} IS NOT NULL OR ${table.customerType} = 'individual'`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * customer.addresses / customer.company_addresses
 * ------------------------------------------------------------------------ */

/** Address of a person. Only `village_id` is stored (ADR-0024 Q10). */
export const customerAddresses = customerSchema.table(
	'addresses',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		customerId: uuid('customer_id')
			.notNull()
			.references(() => customers.id, { onDelete: 'cascade' }),
		kind: text('kind').notNull().default('residence'),
		label: text('label'),
		addressLine: text('address_line').notNull(),
		/** Logical reference to location.villages.id — cross-module FK omitted. */
		villageId: uuid('village_id'),
		postalCode: varchar('postal_code', { length: 10 }),
		isPrimary: boolean('is_primary').notNull().default(false),
		...timestamps,
	},
	(table) => [
		index('customer_addresses_customer_id_idx').on(table.customerId),
		check(
			'customer_addresses_kind_check',
			sql`${table.kind} IN ('residence', 'office', 'billing', 'other')`,
		),
	],
);

/** Structured address of a customer company (billing / shipping / site). */
export const customerCompanyAddresses = customerSchema.table(
	'company_addresses',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		companyId: uuid('company_id')
			.notNull()
			.references(() => customerCompanies.id, { onDelete: 'cascade' }),
		kind: text('kind').notNull().default('billing'),
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
		index('customer_company_addresses_company_id_idx').on(table.companyId),
		index('customer_company_addresses_kind_idx').on(
			table.companyId,
			table.kind,
			table.isPrimary,
		),
		check(
			'customer_company_addresses_kind_check',
			sql`${table.kind} IN ('billing', 'shipping', 'service', 'site', 'other')`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * customer.settings / customer.code_numberings
 * ------------------------------------------------------------------------ */

/** Customer module configuration key value store. */
export const customerSettings = customerSchema.table(
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
		uniqueIndex('customer_settings_scope_uq')
			.on(table.settingGroup, table.settingKey)
			.where(sql`deleted_at IS NULL`),
		check(
			'customer_settings_value_type_check',
			sql`${table.valueType} IN ('string', 'number', 'boolean', 'json', 'date')`,
		),
	],
);

export const customerCodeNumberings = createCodeNumberingTable(customerSchema);

export type TCustomerCompanySelect = typeof customerCompanies.$inferSelect;
export type TCustomerCompanyInsert = typeof customerCompanies.$inferInsert;
export type TCustomerSelect = typeof customers.$inferSelect;
export type TCustomerInsert = typeof customers.$inferInsert;
export type TCustomerAddressSelect = typeof customerAddresses.$inferSelect;
export type TCustomerAddressInsert = typeof customerAddresses.$inferInsert;
export type TCustomerCompanyAddressSelect =
	typeof customerCompanyAddresses.$inferSelect;
export type TCustomerCompanyAddressInsert =
	typeof customerCompanyAddresses.$inferInsert;
export type TCustomerSettingSelect = typeof customerSettings.$inferSelect;
export type TCustomerSettingInsert = typeof customerSettings.$inferInsert;
export type TCustomerCodeNumberingSelect =
	typeof customerCodeNumberings.$inferSelect;
export type TCustomerCodeNumberingInsert =
	typeof customerCodeNumberings.$inferInsert;
