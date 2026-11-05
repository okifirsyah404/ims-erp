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
 * Audit event vocabulary.
 *
 * @remarks
 * A single append-only ledger serves every domain (user-management, inventory,
 * and later assets), so actions are namespaced `<domain>.<event>`. Kept as a
 * const tuple (not a DB enum) per the DBML project rule: status vocabularies
 * are text guarded by application code.
 *
 * Inventory actions (hardening plan Phase I-3 / D3) cover the
 * financial-control events (adjustment workflow, borrowing issue/return/loss,
 * stock posting/reversal — per *operation*, not per ledger row) and
 * master-data CRUD. Master-data entries carry before/after snapshots in
 * `meta`.
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
	// --- inventory: financial-control events ---
	'stock_adjustment.created',
	'stock_adjustment.submitted',
	'stock_adjustment.approved',
	'stock_adjustment.rejected',
	'stock_adjustment.cancelled',
	'stock_adjustment.posted',
	'borrowing.created',
	'borrowing.approved',
	'borrowing.rejected',
	'borrowing.issued',
	'borrowing.returned',
	'borrowing.lost',
	'borrowing.cancelled',
	'borrowing.closed',
	'stock.posted',
	'stock.reversed',
	// --- inventory: master-data CRUD ---
	'item.created',
	'item.updated',
	'item.archived',
	'warehouse.created',
	'warehouse.updated',
	'warehouse.archived',
	'storage.created',
	'storage.updated',
	'storage.archived',
	// --- assets (M06, hardening plan Part II) ---
	'asset_category.created',
	'asset_category.updated',
	'asset_category.archived',
	'asset.created',
	'asset.updated',
	'asset.deactivated',
	'asset.reactivated',
	'asset.archived',
	'asset.borrowed',
	'asset.returned',
	'asset.lost',
	'asset.moved',
	'asset.placed',
	'asset.transferred',
	'asset.disposed',
	'asset.condition_recorded',
	'asset.serviced',
	'asset.depreciated',
	'asset.disposal_requested',
	'asset.disposal_approved',
	'asset.disposal_executed',
	'asset.disposal_cancelled',
	'asset.tool_set_created',
	'asset.tool_set_updated',
	'asset.tool_set_archived',
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
