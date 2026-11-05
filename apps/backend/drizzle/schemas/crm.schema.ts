/**
 * CRM domain schema — owns the `crm` Postgres schema.
 *
 * Customers and their contacts (ADR-0011 port step 3a). Leads follow in
 * step 3b.
 *
 * House rules honoured here:
 * - **Company-wide, no `organization_id`** (ADR-0011 §2): organizations are
 *   internal departments; every department sees the same customers.
 * - Reusable codes use a partial unique index `WHERE deleted_at IS NULL`.
 * - Status vocabularies are `text` guarded by CHECK constraints.
 * - References to other modules (`auth`, `location`) are plain id columns
 *   with no FK.
 */
import { defineRelationsPart, sql } from 'drizzle-orm';
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
import {
	unixTimestamp,
	unixTimestampNullable,
} from '@drizzle/datatypes/unix-timestamp';

export const crmSchema = pgSchema('crm');

export const CUSTOMER_TYPES = ['individual', 'company', 'government', 'partner'] as const;
export type CustomerType = (typeof CUSTOMER_TYPES)[number];

/** Inactive customers cannot be used on new documents. */
export const CUSTOMER_STATUSES = ['active', 'inactive'] as const;
export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number];

const timestamps = {
	createdAt: unixTimestamp('created_at').notNull(),
	updatedAt: unixTimestamp('updated_at')
		.notNull()
		.$onUpdate(() => new Date()),
	deletedAt: unixTimestampNullable('deleted_at'),
};

/* ------------------------------------------------------------------------ *
 * crm.customers
 * ------------------------------------------------------------------------ */

export const customers = crmSchema.table(
	'customers',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		/** Upper-case; unique among live rows. */
		code: varchar('code', { length: 32 }).notNull(),
		customerType: text('customer_type').notNull().default('company'),
		name: text('name').notNull(),
		legalName: text('legal_name'),
		/** NPWP digits only (15 or 16). */
		taxId: varchar('tax_id', { length: 16 }),
		email: text('email'),
		phone: varchar('phone', { length: 30 }),
		whatsapp: varchar('whatsapp', { length: 30 }),
		/** Primary address, printed on documents. */
		addressLine: text('address_line'),
		/** Logical reference to location.villages.id — cross-module FK omitted. */
		villageId: uuid('village_id'),
		postalCode: varchar('postal_code', { length: 10 }),
		status: text('status').notNull().default('active'),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		ownerUserId: text('owner_user_id'),
		/** Logical reference to auth.portal_identities.id (customer portal). */
		portalIdentityId: uuid('portal_identity_id'),
		defaultCurrencyCode: varchar('default_currency_code', { length: 3 })
			.notNull()
			.default('IDR'),
		notes: text('notes'),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		createdBy: text('created_by'),
		...timestamps,
	},
	(table) => [
		uniqueIndex('customers_code_uq')
			.on(table.code)
			.where(sql`deleted_at IS NULL`),
		index('customers_name_idx').on(table.name),
		index('customers_tax_id_idx').on(table.taxId),
		index('customers_owner_user_id_idx').on(table.ownerUserId),
		check(
			'customers_customer_type_check',
			sql`${table.customerType} IN ('individual', 'company', 'government', 'partner')`,
		),
		check('customers_status_check', sql`${table.status} IN ('active', 'inactive')`),
	],
);

/* ------------------------------------------------------------------------ *
 * crm.customer_contacts
 * ------------------------------------------------------------------------ */

/** Contact person of a customer; at most one primary (repository rule). */
export const customerContacts = crmSchema.table(
	'customer_contacts',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		customerId: uuid('customer_id')
			.notNull()
			.references(() => customers.id, { onDelete: 'restrict' }),
		name: text('name').notNull(),
		position: text('position'),
		email: text('email'),
		phone: varchar('phone', { length: 30 }),
		whatsapp: varchar('whatsapp', { length: 30 }),
		isPrimary: boolean('is_primary').notNull().default(false),
		...timestamps,
	},
	(table) => [index('customer_contacts_customer_id_idx').on(table.customerId)],
);

export const crmRelations = defineRelationsPart({ customers, customerContacts }, (r) => ({
	customers: {
		contacts: r.many.customerContacts({
			from: r.customers.id,
			to: r.customerContacts.customerId,
		}),
	},
	customerContacts: {
		customer: r.one.customers({
			from: r.customerContacts.customerId,
			to: r.customers.id,
		}),
	},
}));

export type TCustomerSelect = typeof customers.$inferSelect;
export type TCustomerInsert = typeof customers.$inferInsert;
export type TCustomerContactSelect = typeof customerContacts.$inferSelect;
export type TCustomerContactInsert = typeof customerContacts.$inferInsert;
