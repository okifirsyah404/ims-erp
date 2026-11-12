/**
 * Automation domain schema — owns the `automation` Postgres schema. Built so
 * far: `outbox_messages` (M04 stages 1-2), the ERP events delivered to n8n.
 *
 * House rules honoured here: company-wide, no `organization_id`
 * (ADR-0012); unix-ms timestamps; soft delete.
 */
import { sql } from 'drizzle-orm';
import { check, index, jsonb, pgSchema, smallint, text, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
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
