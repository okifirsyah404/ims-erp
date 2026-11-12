/**
 * Automation domain schema — owns the `automation` Postgres schema. Built so
 * far: `outbox_messages` (M04 stages 1-2), the ERP events delivered to n8n,
 * and the WhatsApp assistant (M04 stage 2): `faq_entries`,
 * `whatsapp_conversations`, `whatsapp_messages`.
 *
 * House rules honoured here: company-wide, no `organization_id`
 * (ADR-0012); unix-ms timestamps; soft delete.
 */
import { sql } from 'drizzle-orm';
import { boolean, check, index, integer, jsonb, pgSchema, smallint, text, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { unixTimestamp, unixTimestampNullable } from '@drizzle/datatypes/unix-timestamp';

export const automationSchema = pgSchema('automation');

export const OUTBOX_STATUSES = ['pending', 'published', 'failed'] as const;
export type OutboxStatus = (typeof OUTBOX_STATUSES)[number];

export const outboxMessages = automationSchema.table(
	'outbox_messages',
	{
		/** Also the event id the receiver dedupes on. */
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		topic: varchar('topic', { length: 64 }).notNull(),
		aggregateType: varchar('aggregate_type', { length: 64 }),
		aggregateId: text('aggregate_id'),
		payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
		status: text('status').$type<OutboxStatus>().notNull().default('pending'),
		attempts: smallint('attempts').notNull().default(0),
		lastAttemptAt: unixTimestampNullable('last_attempt_at'),
		publishedAt: unixTimestampNullable('published_at'),
		responseStatus: smallint('response_status'),
		errorMessage: varchar('error_message', { length: 500 }),
		/** Once-per-fact events (e.g. `license.due:<contract>:<end>:<days>`); a repeat publish is skipped. */
		dedupeKey: varchar('dedupe_key', { length: 200 }),
		createdAt: unixTimestamp('created_at').notNull(),
		updatedAt: unixTimestamp('updated_at')
			.notNull()
			.$onUpdate(() => new Date()),
		deletedAt: unixTimestampNullable('deleted_at'),
	},
	(table) => [
		index('outbox_messages_status_idx').on(table.status),
		index('outbox_messages_topic_idx').on(table.topic),
		index('outbox_messages_aggregate_idx').on(table.aggregateType, table.aggregateId),
		uniqueIndex('outbox_messages_dedupe_key_key').on(table.dedupeKey),
		check('outbox_messages_status_check', sql`${table.status} IN ('pending', 'published', 'failed')`),
		check('outbox_messages_attempts_check', sql`${table.attempts} >= 0`),
	],
);

export type TOutboxSelect = typeof outboxMessages.$inferSelect;
export type TOutboxInsert = typeof outboxMessages.$inferInsert;

const timestamps = {
	createdAt: unixTimestamp('created_at').notNull(),
	updatedAt: unixTimestamp('updated_at')
		.notNull()
		.$onUpdate(() => new Date()),
	deletedAt: unixTimestampNullable('deleted_at'),
};

/** Approved answers the WhatsApp assistant may use (M04 stage 2). */
export const faqEntries = automationSchema.table(
	'faq_entries',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		question: varchar('question', { length: 300 }).notNull(),
		answer: text('answer').notNull(),
		/** Comma separated words that also match this entry. */
		keywords: varchar('keywords', { length: 500 }),
		isActive: boolean('is_active').notNull().default(true),
		sortOrder: integer('sort_order').notNull().default(0),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		createdBy: text('created_by'),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		updatedBy: text('updated_by'),
		...timestamps,
	},
	(table) => [index('faq_entries_is_active_idx').on(table.isActive)],
);

export const CONVERSATION_STATUSES = ['assistant', 'handoff', 'closed'] as const;
export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number];
export const HANDOFF_REASONS = ['no_provider', 'not_found', 'human_requested', 'restricted', 'error'] as const;
export type HandoffReason = (typeof HANDOFF_REASONS)[number];

/** One WhatsApp chat with the company number (M04 stage 2). */
export const whatsappConversations = automationSchema.table(
	'whatsapp_conversations',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		/** WAHA chat id, e.g. `628123456789@c.us`; replies go here. */
		chatId: varchar('chat_id', { length: 128 }).notNull(),
		phone: varchar('phone', { length: 32 }).notNull(),
		contactName: varchar('contact_name', { length: 200 }),
		status: text('status').$type<ConversationStatus>().notNull().default('assistant'),
		handoffReason: text('handoff_reason').$type<HandoffReason>(),
		handoffAt: unixTimestampNullable('handoff_at'),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		assignedUserId: text('assigned_user_id'),
		/** Logical reference to crm.leads.id — set when an admin turns the chat into a lead. */
		leadId: uuid('lead_id'),
		lastMessageAt: unixTimestamp('last_message_at').notNull(),
		lastInboundAt: unixTimestampNullable('last_inbound_at'),
		...timestamps,
	},
	(table) => [
		uniqueIndex('whatsapp_conversations_chat_id_key').on(table.chatId),
		index('whatsapp_conversations_status_idx').on(table.status, table.lastMessageAt),
		check('whatsapp_conversations_status_check', sql`${table.status} IN ('assistant', 'handoff', 'closed')`),
		check(
			'whatsapp_conversations_handoff_reason_check',
			sql`${table.handoffReason} IS NULL OR ${table.handoffReason} IN ('no_provider', 'not_found', 'human_requested', 'restricted', 'error')`,
		),
	],
);

export const MESSAGE_DIRECTIONS = ['inbound', 'outbound'] as const;
export type MessageDirection = (typeof MESSAGE_DIRECTIONS)[number];
export const MESSAGE_AUTHORS = ['customer', 'assistant', 'admin', 'system'] as const;
export type MessageAuthor = (typeof MESSAGE_AUTHORS)[number];
/** Inbound: received → processed. Outbound: pending → sent | failed. */
export const MESSAGE_STATUSES = ['received', 'processed', 'pending', 'sent', 'failed'] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

/** Every WhatsApp message of a conversation (M04 stage 2 log). */
export const whatsappMessages = automationSchema.table(
	'whatsapp_messages',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		conversationId: uuid('conversation_id')
			.notNull()
			.references(() => whatsappConversations.id, { onDelete: 'restrict' }),
		direction: text('direction').$type<MessageDirection>().notNull(),
		author: text('author').$type<MessageAuthor>().notNull(),
		/** WhatsApp message id; inbound webhooks are deduped on it. */
		externalId: varchar('external_id', { length: 128 }),
		body: text('body').notNull(),
		status: text('status').$type<MessageStatus>().notNull(),
		faqEntryId: uuid('faq_entry_id').references(() => faqEntries.id, { onDelete: 'set null' }),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		sentBy: text('sent_by'),
		errorMessage: varchar('error_message', { length: 500 }),
		attempts: smallint('attempts').notNull().default(0),
		...timestamps,
	},
	(table) => [
		index('whatsapp_messages_conversation_idx').on(table.conversationId, table.createdAt),
		uniqueIndex('whatsapp_messages_direction_external_id_key').on(table.direction, table.externalId),
		index('whatsapp_messages_status_idx').on(table.status),
		check('whatsapp_messages_direction_check', sql`${table.direction} IN ('inbound', 'outbound')`),
		check('whatsapp_messages_author_check', sql`${table.author} IN ('customer', 'assistant', 'admin', 'system')`),
		check('whatsapp_messages_status_check', sql`${table.status} IN ('received', 'processed', 'pending', 'sent', 'failed')`),
		check('whatsapp_messages_attempts_check', sql`${table.attempts} >= 0`),
	],
);

export type TFaqEntrySelect = typeof faqEntries.$inferSelect;
export type TFaqEntryInsert = typeof faqEntries.$inferInsert;
export type TConversationSelect = typeof whatsappConversations.$inferSelect;
export type TConversationInsert = typeof whatsappConversations.$inferInsert;
export type TWhatsappMessageSelect = typeof whatsappMessages.$inferSelect;
export type TWhatsappMessageInsert = typeof whatsappMessages.$inferInsert;
