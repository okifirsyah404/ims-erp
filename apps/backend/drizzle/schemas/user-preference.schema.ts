/**
 * Per-user preferences (auth schema, ERP-owned table, ERP-0075).
 *
 * `auth.user_preferences` keeps one live value per user and key, e.g. the
 * customer portal's notification channels and language. Values are text
 * (booleans as `'true'` / `'false'`); the owning module interprets them.
 */
import { sql } from 'drizzle-orm';
import { text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { unixTimestamp, unixTimestampNullable } from '@drizzle/datatypes/unix-timestamp';
import { authSchema, users } from './auth.schema';

export const userPreferences = authSchema.table(
	'user_preferences',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		preferenceKey: text('preference_key').notNull(),
		preferenceValue: text('preference_value'),
		createdAt: unixTimestamp('created_at').notNull(),
		updatedAt: unixTimestamp('updated_at')
			.notNull()
			.$onUpdate(() => new Date()),
		deletedAt: unixTimestampNullable('deleted_at'),
	},
	(table) => [
		uniqueIndex('user_preferences_key_uq')
			.on(table.userId, table.preferenceKey)
			.where(sql`deleted_at IS NULL`),
	],
);

export type TUserPreferenceSelect = typeof userPreferences.$inferSelect;
