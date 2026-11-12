/**
 * Organization domain schema — owns the `organization` Postgres schema.
 *
 * @remarks
 * Internal structure of the one company (ADR-0007/ADR-0011): branches,
 * departments, positions, cost centres, fiscal settings and organization
 * scoped settings. Every table is tenant scoped by `organization_id`.
 *
 * The company profile, bank accounts and the numbering series moved out to
 * the `company` and `code_number` schemas in ERP-0042. `company_settings` was
 * renamed `organization.settings` in the same change.
 *
 * References to other modules (`auth`) are plain id columns with no FK —
 * cross-module FKs are forbidden (elysia-module rule 3.2).
 */
import {
	unixTimestamp,
	unixTimestampNullable,
} from '@drizzle/datatypes/unix-timestamp';
import { sql } from 'drizzle-orm';
import {
	boolean,
	check,
	pgSchema,
	text,
	uniqueIndex,
	uuid,
} from 'drizzle-orm/pg-core';

export const organizationSchema = pgSchema('organization');

/** Value types of a stored setting. */
export const SETTING_VALUE_TYPES = [
	'string',
	'number',
	'boolean',
	'json',
	'date',
] as const;
export type SettingValueType = (typeof SETTING_VALUE_TYPES)[number];

/** Shared soft-delete + audit columns. */
const timestamps = {
	createdAt: unixTimestamp('created_at').notNull(),
	updatedAt: unixTimestamp('updated_at')
		.notNull()
		.$onUpdate(() => new Date()),
	deletedAt: unixTimestampNullable('deleted_at'),
};

/* ------------------------------------------------------------------------ *
 * organization.settings
 * ------------------------------------------------------------------------ */

/**
 * Organization-scoped configuration key value store (ERP-0042).
 *
 * @remarks
 * Company-wide settings live in `company.settings`. Secret values are never
 * read back by the client.
 */
export const organizationSettings = organizationSchema.table(
	'settings',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		/** Logical reference to auth.organizations.id — cross-module FK omitted. */
		organizationId: text('organization_id').notNull(),
		settingGroup: text('setting_group').notNull(),
		settingKey: text('setting_key').notNull(),
		settingValue: text('setting_value'),
		valueType: text('value_type').notNull().default('string'),
		isSecret: boolean('is_secret').notNull().default(false),
		description: text('description'),
		/** Logical reference to auth.users.id — cross-module FK omitted. */
		updatedBy: text('updated_by'),
		...timestamps,
	},
	(table) => [
		uniqueIndex('settings_scope_uq')
			.on(table.organizationId, table.settingGroup, table.settingKey)
			.where(sql`deleted_at IS NULL`),
		check(
			'settings_value_type_check',
			sql`${table.valueType} IN ('string', 'number', 'boolean', 'json', 'date')`,
		),
	],
);

export type TOrganizationSettingSelect =
	typeof organizationSettings.$inferSelect;
export type TOrganizationSettingInsert =
	typeof organizationSettings.$inferInsert;
