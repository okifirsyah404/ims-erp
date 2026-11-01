/**
 * User management schema extension (auth schema, ERP-owned tables).
 *
 * Owns the dynamic organization role catalog and the unified invitation
 * queue for the closed (invitation-only) user lifecycle:
 *
 * - `auth.roles` — per-organization role master data. System roles
 *   (owner/admin/hr and the shared ERP catalog roles) are seeded per org;
 *   app/owner admins may create additional custom roles at runtime.
 *   Permissions are stored as jsonb `{ resource: action[] }` matching the
 *   shared catalog vocabulary (`@ims-erp/common` erpStatements).
 * - `auth.user_invitations` — single invitation pipeline for both the
 *   application-admin path (name + email, no organization) and the
 *   organization path (email + role). Users are pre-created at invite time
 *   (status `pending`); the invitation row holds the single-use, hashed,
 *   3-day claim token. Named `user_invitations` because Better Auth owns
 *   `auth.invitations` (organization plugin) — that table stays untouched.
 *
 * Escalation rules (rank comparison) are enforced server-side in the
 * user-management module, not in the schema.
 */
import { defineRelationsPart, sql } from 'drizzle-orm';
import {
	boolean,
	integer,
	index,
	jsonb,
	pgSchema,
	text,
	timestamp,
	uniqueIndex,
} from 'drizzle-orm/pg-core';
import type { ErpPermissionRequest } from '@ims-erp/common';
import { authSchema, organizations, users } from './auth.schema';

/**
 * Invitation kind. `app` = application-admin invite (no organization),
 * `org` = organization admin/HR invite (role + organization attached).
 */
export const USER_INVITATION_TYPES = ['app', 'org'] as const;
export type UserInvitationType = (typeof USER_INVITATION_TYPES)[number];

/**
 * Invitation lifecycle. `pending` → `accepted` on claim; `cancelled` by an
 * admin; `expired` by the sweeper (3-day expiry). Soft-deleted rows are
 * admin-deleted unclaimed invitations (the pre-created user row goes with
 * them via the service layer).
 */
export const USER_INVITATION_STATUSES = [
	'pending',
	'accepted',
	'cancelled',
	'expired',
] as const;
export type UserInvitationStatus = (typeof USER_INVITATION_STATUSES)[number];

/**
 * Per-organization role. `rank` drives the escalation guard server-side
 * (owner=100, admin=80, hr=60, member=10; custom roles rank below their
 * creator's rank). `permissions` is a plain-data permission grant
 * (`{ resource: action[] }`, deny-by-default) using the shared catalog
 * vocabulary. `isSystem` marks seeded roles that cannot be deleted.
 */
export const roles = authSchema.table(
	'roles',
	{
		id: text('id').primaryKey(),
		organizationId: text('organization_id')
			.notNull()
			.references(() => organizations.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		rank: integer('rank').notNull(),
		permissions: jsonb('permissions').$type<ErpPermissionRequest>().notNull(),
		isSystem: boolean('is_system').default(false).notNull(),
		// Soft-delete marker (business table; partial unique index below
		// excludes soft-deleted rows so a name can be reused after deletion).
		deletedAt: timestamp('deleted_at'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		uniqueIndex('roles_org_name_live_idx')
			.on(table.organizationId, table.name)
			.where(sql`deleted_at IS NULL`),
		index('roles_organizationId_idx').on(table.organizationId),
	],
);

/**
 * Unified invitation row. `tokenHash` is a SHA-256 of the emailed token —
 * the raw token never touches the database. On resend the hash and expiry
 * are replaced (old token dies) and `resentCount` increments.
 */
export const userInvitations = authSchema.table(
	'user_invitations',
	{
		id: text('id').primaryKey(),
		type: text('type', { enum: USER_INVITATION_TYPES })
			.default('app')
			.notNull(),
		email: text('email').notNull(),
		// App-admin path input; used to pre-create the user and prefill the
		// profile form on claim. Nullable because the org path may omit it.
		name: text('name'),
		organizationId: text('organization_id').references(() => organizations.id, {
			onDelete: 'cascade',
		}),
		roleId: text('role_id').references(() => roles.id, {
			onDelete: 'set null',
		}),
		tokenHash: text('token_hash').notNull(),
		status: text('status', { enum: USER_INVITATION_STATUSES })
			.default('pending')
			.notNull(),
		invitedBy: text('invited_by')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		expiresAt: timestamp('expires_at').notNull(),
		resentCount: integer('resent_count').default(0).notNull(),
		// Bounce/delivery failure flag surfaced in the admin pending list.
		deliveryFailed: boolean('delivery_failed').default(false).notNull(),
		claimedAt: timestamp('claimed_at'),
		// Soft-delete marker: admin deletes an unclaimed invitation (and its
		// pre-created pending user) after inviting a wrong email.
		deletedAt: timestamp('deleted_at'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		uniqueIndex('user_invitations_token_hash_idx').on(table.tokenHash),
		index('user_invitations_email_idx').on(table.email),
		index('user_invitations_organizationId_idx').on(table.organizationId),
		index('user_invitations_status_idx').on(table.status),
	],
);

export const roleRelations = defineRelationsPart(
	{ roles, userInvitations, organizations, users },
	(r) => ({
		roles: {
			organization: r.one.organizations({
				from: r.roles.organizationId,
				to: r.organizations.id,
			}),
		},
		userInvitations: {
			organization: r.one.organizations({
				from: r.userInvitations.organizationId,
				to: r.organizations.id,
			}),
			role: r.one.roles({
				from: r.userInvitations.roleId,
				to: r.roles.id,
			}),
			inviter: r.one.users({
				from: r.userInvitations.invitedBy,
				to: r.users.id,
			}),
		},
	}),
);

export type TRoleSelect = typeof roles.$inferSelect;
export type TRoleInsert = typeof roles.$inferInsert;
export type TUserInvitationSelect = typeof userInvitations.$inferSelect;
export type TUserInvitationInsert = typeof userInvitations.$inferInsert;
