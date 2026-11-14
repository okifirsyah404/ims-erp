/**
 * Portal identity schema extension (auth schema, ERP-owned table, ERP-0022).
 *
 * `auth.portal_identities` links a Better Auth login to the business record
 * it may see through a portal. Only `customer` is used today: the identity
 * points at `crm.customers.id` and at the person, `crm.customer_contacts.id`
 * (logical references, no foreign key, nullable per ADR-0014 — the Identity
 * service checks them through CRM's contract before the write), with a role
 * `owner | approver | finance | viewer` (owner decision D2, 2026-11-14).
 *
 * A portal user is never an organization member, so every ERP route (and
 * the web admin's sign-in) refuses it; the `/portal/v1` routes accept only an
 * `active` identity. One live identity per contact and per user (partial
 * unique indexes on live rows); revoking sets `status = 'revoked'` and
 * `deleted_at`, and a new invitation creates a new row.
 */
import { sql } from 'drizzle-orm';
import { check, index, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { unixTimestamp, unixTimestampNullable } from '@drizzle/datatypes/unix-timestamp';
import { authSchema, users } from './auth.schema';

export const PORTAL_TYPES = ['customer', 'investor', 'partner', 'technician'] as const;
export type PortalType = (typeof PORTAL_TYPES)[number];

/** What a customer's person may do (owner decision D2, 2026-11-14). */
export const PORTAL_ROLES = ['owner', 'approver', 'finance', 'viewer'] as const;
export type PortalRole = (typeof PORTAL_ROLES)[number];

export const PORTAL_IDENTITY_STATUSES = ['active', 'suspended', 'revoked'] as const;
export type PortalIdentityStatus = (typeof PORTAL_IDENTITY_STATUSES)[number];

export const portalIdentities = authSchema.table(
	'portal_identities',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		portalType: text('portal_type').$type<PortalType>().notNull(),
		/** Logical reference to the portal type's master row (crm.customers.id for `customer`). */
		linkedEntityId: uuid('linked_entity_id'),
		/** Logical reference to crm.customer_contacts.id: the person behind the login. */
		contactId: uuid('contact_id'),
		portalRole: text('portal_role').$type<PortalRole>().notNull().default('owner'),
		status: text('status').$type<PortalIdentityStatus>().notNull().default('active'),
		/** Logical reference to auth.users.id: the staff member or customer owner who invited; null for a self sign-up. */
		createdBy: text('created_by'),
		lastLoginAt: unixTimestampNullable('last_login_at'),
		createdAt: unixTimestamp('created_at').notNull(),
		updatedAt: unixTimestamp('updated_at')
			.notNull()
			.$onUpdate(() => new Date()),
		deletedAt: unixTimestampNullable('deleted_at'),
	},
	(table) => [
		uniqueIndex('portal_identities_user_id_uq')
			.on(table.userId)
			.where(sql`deleted_at IS NULL`),
		uniqueIndex('portal_identities_contact_uq')
			.on(table.portalType, table.contactId)
			.where(sql`deleted_at IS NULL`),
		index('portal_identities_entity_idx').on(table.portalType, table.linkedEntityId),
		check('portal_identities_portal_type_check', sql`${table.portalType} IN ('customer', 'investor', 'partner', 'technician')`),
		check('portal_identities_status_check', sql`${table.status} IN ('active', 'suspended', 'revoked')`),
		check('portal_identities_portal_role_check', sql`${table.portalRole} IN ('owner', 'approver', 'finance', 'viewer')`),
	],
);

export type TPortalIdentitySelect = typeof portalIdentities.$inferSelect;
export type TPortalIdentityInsert = typeof portalIdentities.$inferInsert;
