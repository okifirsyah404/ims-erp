/**
 * User management schema extension (auth schema, ERP-owned tables).
 *
 * Owns the unified invitation queue for the closed (invitation-only) user
 * lifecycle:
 *
 * - `auth.user_invitations` — single invitation pipeline for both the
 *   application-admin path (name + email, no organization) and the
 *   organization path (email + `org_role`). Users are pre-created at invite
 *   time (status `pending`); the invitation row holds the single-use,
 *   hashed, 3-day claim token. Named `user_invitations` because Better Auth
 *   owns `auth.invitations` (organization plugin) — that table stays
 *   untouched.
 *
 * Organization roles are a CLOSED enum: the 19 values of
 * `@ims-erp/common erpRoleNames`, stored as the Postgres enum type
 * `organization_role` (`org_role` column, NULL on app-path invites).
 * There is no per-organization dynamic role table.
 */
import { defineRelationsPart } from 'drizzle-orm';
import {
	boolean,
	integer,
	index,
	pgEnum,
	text,
	timestamp,
	uniqueIndex,
} from 'drizzle-orm/pg-core';
import { erpRoleNames } from '@ims-erp/common';
import { authSchema, organizations, users } from './auth.schema';

/**
 * Postgres enum for the closed ERP organization role catalog (lives in the
 * `auth` schema). Values mirror `erpRoleNames`; the guardian seeder keeps
 * the type in sync with the catalog (`CREATE TYPE` + `ADD VALUE IF NOT
 * EXISTS`).
 */
export const organizationRole = pgEnum(
	'auth.organization_role',
	erpRoleNames,
);

/** The Postgres enum name (used by the migration + guardian seeder). */
export const ORGANIZATION_ROLE_ENUM = 'auth.organization_role' as const;

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
		// Org path only: the closed ERP organization role (Postgres enum
		// `organization_role`). NULL on the app-admin path.
		orgRole: organizationRole('org_role'),
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
	{ userInvitations, organizations, users },
	(r) => ({
		userInvitations: {
			organization: r.one.organizations({
				from: r.userInvitations.organizationId,
				to: r.organizations.id,
			}),
			inviter: r.one.users({
				from: r.userInvitations.invitedBy,
				to: r.users.id,
			}),
		},
	}),
);

export type TUserInvitationSelect = typeof userInvitations.$inferSelect;
export type TUserInvitationInsert = typeof userInvitations.$inferInsert;
