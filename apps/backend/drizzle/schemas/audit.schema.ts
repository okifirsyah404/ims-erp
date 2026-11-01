/**
 * Audit log schema (audit schema, ERP-owned).
 *
 * Append-only trail for security-relevant user-management events
 * (invitations, claims, role changes, member lifecycle). The actor is a
 * logical reference (`actor_user_id`) so a deleted user never erases the
 * trail. No soft delete, no updates — insert-only by contract.
 */
import { defineRelationsPart } from 'drizzle-orm';
import { bigint, index, jsonb, pgSchema, text } from 'drizzle-orm/pg-core';
import { unixTimestamp } from '@drizzle/datatypes/unix-timestamp';

export const auditSchema = pgSchema('audit');

/**
 * Audit event vocabulary for the user-management domain. Kept as a const
 * tuple (not a DB enum) per the DBML project rule: status vocabularies are
 * text guarded by application code.
 */
export const AUDIT_ACTIONS = [
	'invitation.sent',
	'invitation.resent',
	'invitation.cancelled',
	'invitation.deleted',
	'invitation.claimed',
	'user.precreated',
	'user.deactivated',
	'user.restored',
	'user.deleted',
	'role.created',
	'role.updated',
	'role.deleted',
	'member.added',
	'member.removed',
	'member.roleChanged',
	'org.created',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const auditLogs = auditSchema.table(
	'audit_logs',
	{
		id: text('id').primaryKey(),
		/** Logical reference to auth.users.id — cross-module FK omitted by rule. */
		actorUserId: text('actor_user_id').notNull(),
		/** Denormalized actor display (email) for readability without joins. */
		actorEmail: text('actor_email'),
		action: text('action').notNull(),
		/** e.g. 'invitation' | 'user' | 'role' | 'member' | 'organization'. */
		targetType: text('target_type').notNull(),
		targetId: text('target_id').notNull(),
		/** Tenant scope; null for global (app-admin) actions. */
		organizationId: text('organization_id'),
		/** Action-specific payload (before/after, emails, role names). */
		meta: jsonb('meta').$type<Record<string, unknown>>(),
		ipAddress: text('ip_address'),
		userAgent: text('user_agent'),
		createdAt: unixTimestamp('created_at').notNull(),
	},
	(table) => [
		index('audit_logs_created_at_idx').on(table.createdAt),
		index('audit_logs_organization_id_idx').on(table.organizationId),
		index('audit_logs_actor_user_id_idx').on(table.actorUserId),
		index('audit_logs_action_idx').on(table.action),
		index('audit_logs_target_idx').on(table.targetType, table.targetId),
	],
);

export const auditLogRelations = defineRelationsPart({ auditLogs }, () => ({}));

export type TAuditLogSelect = typeof auditLogs.$inferSelect;
export type TAuditLogInsert = typeof auditLogs.$inferInsert;
