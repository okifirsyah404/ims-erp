/**
 * Portal identity schema extension (auth schema, ERP-owned table, ERP-0022).
 *
 * `auth.portal_identities` links a Better Auth login to the business record
 * it may see through a portal. Only `customer` is used today: the identity
 * points at `crm.customers.id` (logical reference, no foreign key, nullable
 * per ADR-0014 — the Identity service checks the customer through CRM's
 * contract before the write).
 *
 * A portal user is never an organization member, so every ERP route refuses
 * it; the `/portal/v1` routes accept only an `active` identity. One live
 * identity per customer and per user (partial unique indexes on live rows);
 * revoking sets `status = 'revoked'` and `deleted_at`, and a new invitation
 * creates a new row.
 */
import { sql } from 'drizzle-orm';
import { check, index, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { unixTimestamp, unixTimestampNullable } from '@drizzle/datatypes/unix-timestamp';
import { authSchema, users } from './auth.schema';

export const PORTAL_TYPES = ['customer', 'investor', 'partner', 'technician'] as const;
export type PortalType = (typeof PORTAL_TYPES)[number];

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
		status: text('status').$type<PortalIdentityStatus>().notNull().default('active'),
		/** Logical reference to auth.users.id: the staff member who invited the account. */
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
		uniqueIndex('portal_identities_entity_uq')
			.on(table.portalType, table.linkedEntityId)
			.where(sql`deleted_at IS NULL`),
		index('portal_identities_linked_entity_id_idx').on(table.linkedEntityId),
		check('portal_identities_portal_type_check', sql`${table.portalType} IN ('customer', 'investor', 'partner', 'technician')`),
		check('portal_identities_status_check', sql`${table.status} IN ('active', 'suspended', 'revoked')`),
	],
);

export type TPortalIdentitySelect = typeof portalIdentities.$inferSelect;
export type TPortalIdentityInsert = typeof portalIdentities.$inferInsert;
