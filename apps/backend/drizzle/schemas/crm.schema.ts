/**
 * CRM domain schema — owns the `crm` Postgres schema.
 *
 * Customers and contacts (ADR-0011 port step 3a); leads, their follow-up
 * activities and website attachments (step 3b).
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
	bigint,
	boolean,
	check,
	index,
	integer,
	jsonb,
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

/** Lead pipeline (owner-approved M02 statuses); `won` = converted. */
export const LEAD_STATUSES = ['new', 'contacted', 'survey', 'quotation', 'won', 'lost'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];
export const LEAD_OPEN_STATUSES = ['new', 'contacted', 'survey', 'quotation'] as const;

export const LEAD_SOURCES = ['website', 'whatsapp', 'instagram', 'phone', 'referral', 'walk_in', 'other'] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const LEAD_ACTIVITY_TYPES = ['call', 'whatsapp', 'email', 'meeting', 'survey', 'note'] as const;
export type LeadActivityType = (typeof LEAD_ACTIVITY_TYPES)[number];

/** Website form that created a lead. */
export const LEAD_CHANNELS = ['rfq', 'contact', 'demo'] as const;
export type LeadChannel = (typeof LEAD_CHANNELS)[number];

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

export const CUSTOMER_ADDRESS_KINDS = ['billing', 'shipping', 'service', 'site', 'other'] as const;
export type CustomerAddressKind = (typeof CUSTOMER_ADDRESS_KINDS)[number];

/**
 * Structured address of a customer (company-wide like the customer, ERP-0075).
 * The customer portal manages kind `site` (installation sites and their PIC).
 */
export const customerAddresses = crmSchema.table(
	'customer_addresses',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		customerId: uuid('customer_id')
			.notNull()
			.references(() => customers.id, { onDelete: 'cascade' }),
		kind: text('kind').$type<CustomerAddressKind>().notNull().default('billing'),
		label: text('label'),
		contactName: text('contact_name'),
		contactPhone: text('contact_phone'),
		addressLine: text('address_line'),
		/** Logical references to location.* — cross-module FKs omitted (ADR-0014, nullable). */
		villageId: uuid('village_id'),
		districtId: uuid('district_id'),
		regencyId: uuid('regency_id'),
		provinceId: uuid('province_id'),
		postalCode: varchar('postal_code', { length: 10 }),
		isPrimary: boolean('is_primary').notNull().default(false),
		...timestamps,
	},
	(table) => [
		index('customer_addresses_customer_id_idx').on(table.customerId),
		index('customer_addresses_kind_idx').on(table.customerId, table.kind, table.isPrimary),
		check('customer_addresses_kind_check', sql`${table.kind} IN ('billing', 'shipping', 'service', 'site', 'other')`),
	],
);

export type TCustomerAddressSelect = typeof customerAddresses.$inferSelect;

/* ------------------------------------------------------------------------ *
 * crm.leads
 * ------------------------------------------------------------------------ */

/**
 * Prospect before a customer record exists (company-wide, ADR-0011).
 *
 * @remarks
 * Visibility is a service rule: `lead:assign` holders see all leads, others
 * only leads assigned to them (`owner_user_id`).
 */
export const leads = crmSchema.table(
	'leads',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		name: text('name').notNull(),
		companyName: text('company_name'),
		email: text('email'),
		phone: varchar('phone', { length: 30 }),
		whatsapp: varchar('whatsapp', { length: 30 }),
		source: text('source').notNull(),
		status: text('status').notNull().default('new'),
		needs: text('needs'),
		/** Exact integer IDR minor units (ADR-0002). */
		estimatedValue: bigint('estimated_value', { mode: 'number' }),
		currencyCode: varchar('currency_code', { length: 3 }).notNull().default('IDR'),
		/** Assigned salesperson. Logical reference to auth.users.id. */
		ownerUserId: text('owner_user_id'),
		nextFollowUpAt: unixTimestampNullable('next_follow_up_at'),
		/** Customer the lead was converted into (status `won`). */
		customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'restrict' }),
		convertedAt: unixTimestampNullable('converted_at'),
		lostReason: text('lost_reason'),
		channel: text('channel'),
		/** Public reference handed back to the website visitor. */
		reference: varchar('reference', { length: 40 }),
		/** The website payload as received, for audit. */
		submission: jsonb('submission').$type<Record<string, unknown>>(),
		idempotencyKey: varchar('idempotency_key', { length: 100 }),
		/** Customer portal account the website RFQ belongs to (ERP-0072); not the conversion `customerId`. */
		portalCustomerId: uuid('portal_customer_id').references(() => customers.id, { onDelete: 'restrict' }),
		/** How the RFQ joined the portal account: `account` (submitted signed in) or `claim` (email code). */
		portalLinkedVia: text('portal_linked_via'),
		portalLinkedAt: unixTimestampNullable('portal_linked_at'),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		createdBy: text('created_by'),
		...timestamps,
	},
	(table) => [
		index('leads_owner_user_id_idx').on(table.ownerUserId),
		index('leads_status_idx').on(table.status),
		index('leads_next_follow_up_at_idx').on(table.nextFollowUpAt),
		index('leads_portal_customer_id_idx').on(table.portalCustomerId),
		uniqueIndex('leads_reference_uq')
			.on(table.reference)
			.where(sql`reference IS NOT NULL`),
		uniqueIndex('leads_idempotency_key_uq')
			.on(table.idempotencyKey)
			.where(sql`idempotency_key IS NOT NULL`),
		check(
			'leads_source_check',
			sql`${table.source} IN ('website', 'whatsapp', 'instagram', 'phone', 'referral', 'walk_in', 'other')`,
		),
		check(
			'leads_status_check',
			sql`${table.status} IN ('new', 'contacted', 'survey', 'quotation', 'won', 'lost')`,
		),
		check('leads_channel_check', sql`${table.channel} IS NULL OR ${table.channel} IN ('rfq', 'contact', 'demo')`),
		check('leads_portal_linked_via_check', sql`${table.portalLinkedVia} IS NULL OR ${table.portalLinkedVia} IN ('account', 'claim')`),
		check('leads_portal_link_check', sql`(${table.portalCustomerId} IS NULL) = (${table.portalLinkedVia} IS NULL)`),
	],
);

/** Follow-up log of a lead (calls, visits, surveys). */
export const leadActivities = crmSchema.table(
	'lead_activities',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		leadId: uuid('lead_id')
			.notNull()
			.references(() => leads.id, { onDelete: 'restrict' }),
		activityType: text('activity_type').notNull(),
		notes: text('notes').notNull(),
		occurredAt: unixTimestamp('occurred_at').notNull(),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		createdBy: text('created_by').notNull(),
		...timestamps,
	},
	(table) => [
		index('lead_activities_lead_id_idx').on(table.leadId, table.occurredAt),
		check(
			'lead_activities_type_check',
			sql`${table.activityType} IN ('call', 'whatsapp', 'email', 'meeting', 'survey', 'note')`,
		),
	],
);

/** File sent with a website RFQ; the storage key never leaves the server. */
export const leadAttachments = crmSchema.table(
	'lead_attachments',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		leadId: uuid('lead_id')
			.notNull()
			.references(() => leads.id, { onDelete: 'restrict' }),
		fileName: varchar('file_name', { length: 255 }).notNull(),
		contentType: varchar('content_type', { length: 120 }).notNull(),
		sizeBytes: integer('size_bytes').notNull(),
		storageKey: text('storage_key').notNull(),
		...timestamps,
	},
	(table) => [index('lead_attachments_lead_id_idx').on(table.leadId)],
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
export type TLeadSelect = typeof leads.$inferSelect;
export type TLeadInsert = typeof leads.$inferInsert;
export type TLeadActivitySelect = typeof leadActivities.$inferSelect;
export type TLeadAttachmentSelect = typeof leadAttachments.$inferSelect;
