/**
 * Notification schema — owns the `notification` Postgres schema (ERP-0047).
 *
 * In-app notification inbox plus the templates that produce it. House rules
 * honoured here:
 * - **App-scope, no `organization_id`** (ADR-0016): a notification belongs to
 *   one user and is readable from every organization that user belongs to.
 *   Organization context travels as a display tag (the organization name),
 *   never as a scope filter.
 * - `user_id` is a logical reference to `auth.users.id` — cross-module FK
 *   omitted by rule; validated through the Identity module contract.
 * - The one FK is intra-module: `notifications.notification_template_id` →
 *   `push_notification_templates.id`, `on delete set null`, so a deleted template
 *   never erases delivery history.
 * - Operational timestamps are unix milliseconds.
 */
import { sql } from 'drizzle-orm';
import { boolean, check, index, jsonb, pgSchema, text, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { unixTimestamp, unixTimestampNullable } from '@drizzle/datatypes/unix-timestamp';

export const notificationSchema = pgSchema('notification');

/** Channels the row model can carry. Only `in_app` is produced today. */
export const NOTIFICATION_CHANNELS = ['email', 'whatsapp', 'in_app', 'webhook'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

/** Delivery states. Only `sent` (worker insert) and `read` (recipient) are produced today. */
export const NOTIFICATION_STATUSES = [
	'queued',
	'sending',
	'sent',
	'delivered',
	'read',
	'failed',
	'cancelled',
] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

/**
 * Template codes: `<module>.<event>`, snake_case, prefix = owning module.
 * Adding an event means adding it here, to the seeder, and to the client
 * `notifications` locale namespace.
 */
export const NOTIFICATION_TEMPLATE_CODES = [
	'org.member_added',
	'org.org_created',
	'sales.invoice_issued',
	'document.signature_requested',
	'document.signature_signed',
	'document.signature_declined',
] as const;

/** CamelCase aliases the notification producer uses (i18next-safe keys). */
export const NOTIFICATION_TEMPLATE_KEYS = {
	'org.member_added': 'org.memberAdded',
	'org.org_created': 'org.orgCreated',
	'sales.invoice_issued': 'sales.invoiceIssued',
	'document.signature_requested': 'document.signatureRequested',
	'document.signature_signed': 'document.signatureSigned',
	'document.signature_declined': 'document.signatureDeclined',
} as const;
export type PushNotificationTemplateCode = (typeof NOTIFICATION_TEMPLATE_CODES)[number];

const timestamps = {
	createdAt: unixTimestamp('created_at').notNull(),
	updatedAt: unixTimestamp('updated_at')
		.notNull()
		.$onUpdate(() => new Date()),
	deletedAt: unixTimestampNullable('deleted_at'),
};

/* ------------------------------------------------------------------------ *
 * notification.push_notification_templates
 * ------------------------------------------------------------------------ */

export const pushNotificationTemplates = notificationSchema.table(
	'push_notification_templates',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		/** `module.event` code; one template serves every organization. */
		code: varchar('code', { length: 64 }).notNull(),
		name: text('name').notNull(),
		channel: text('channel').$type<NotificationChannel>().notNull().default('in_app'),
		subjectTemplate: text('subject_template'),
		/** English fallback body; the client renders localized copy from `code` + `variables`. */
		bodyTemplate: text('body_template').notNull(),
		/** Declared variable names, e.g. `["organizationName","role"]`. */
		variables: jsonb('variables').$type<string[]>(),
		isActive: boolean('is_active').notNull().default(true),
		...timestamps,
	},
	(table) => [
		uniqueIndex('push_push_notification_templates_code_uq')
			.on(table.code)
			.where(sql`deleted_at IS NULL`),
		index('push_push_notification_templates_channel_idx').on(table.channel),
		check(
			'push_push_notification_templates_channel_check',
			sql`${table.channel} IN ('email', 'whatsapp', 'in_app', 'webhook')`,
		),
	],
);

/* ------------------------------------------------------------------------ *
 * notification.notifications
 * ------------------------------------------------------------------------ */

export const pushNotifications = notificationSchema.table(
	'push_notifications',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		/** Intra-module FK: the template used at send time, kept for reference only. */
		notificationTemplateId: uuid('notification_template_id').references(
			() => pushNotificationTemplates.id,
			{ onDelete: 'set null' },
		),
		/** Logical reference to auth.users.id — cross-module FK omitted by rule. */
		userId: text('user_id').notNull(),
		/** Denormalized `module.event` code, so a later template edit never rewrites history. */
		templateCode: varchar('template_code', { length: 64 }).notNull(),
		title: text('title').notNull(),
		body: text('body'),
		/** Display chips, e.g. `["Entragate org"]`. The organization name lives here, not in a column. */
		tags: jsonb('tags').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
		/** Interpolation values for the template, e.g. `{ organizationName, role }`. */
		variables: jsonb('variables').$type<Record<string, string>>(),
		/** Producer extras (navigation target, deep-link params). Never used for authorization. */
		metadata: jsonb('metadata').$type<Record<string, unknown>>(),
		channel: text('channel').$type<NotificationChannel>().notNull().default('in_app'),
		status: text('status').$type<NotificationStatus>().notNull().default('sent'),
		sentAt: unixTimestampNullable('sent_at'),
		readAt: unixTimestampNullable('read_at'),
		sourceType: text('source_type'),
		sourceId: text('source_id'),
		...timestamps,
	},
	(table) => [
		index('push_notifications_user_id_idx').on(table.userId),
		index('push_notifications_user_status_idx').on(table.userId, table.status),
		index('push_notifications_status_idx').on(table.status),
		index('push_notifications_created_at_idx').on(table.createdAt),
		index('push_notifications_template_id_idx').on(table.notificationTemplateId),
		check(
			'push_notifications_channel_check',
			sql`${table.channel} IN ('email', 'whatsapp', 'in_app', 'webhook')`,
		),
		check(
			'push_notifications_status_check',
			sql`${table.status} IN ('queued', 'sending', 'sent', 'delivered', 'read', 'failed', 'cancelled')`,
		),
	],
);

export type TPushNotificationTemplateSelect = typeof pushNotificationTemplates.$inferSelect;
export type TPushNotificationTemplateInsert = typeof pushNotificationTemplates.$inferInsert;
export type TPushNotificationSelect = typeof pushNotifications.$inferSelect;
export type TPushNotificationInsert = typeof pushNotifications.$inferInsert;
