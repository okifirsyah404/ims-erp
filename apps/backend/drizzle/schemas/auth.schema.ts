/**
 * Auth schema — shared by the `user` and `organization` modules because
 * Better Auth owns it (ADR-0024 Q9, `elysia-module` rule 3.3).
 *
 * @remarks
 * The nine Better Auth core tables are hand-maintained: `auth:generate` is
 * never run because `@better-auth/cli` 1.4.x regresses this file (drops
 * `pgSchema('auth')`, pluralizes table names and loses relations).
 *
 * The ERP-owned extension tables live in the clearly marked section at the
 * end: `user_invitations` (the unified invitation queue) and
 * `organization_settings` (organization-scoped configuration, which absorbed
 * the planned `organization.fiscal_settings` as keys).
 */
import { defineRelationsPart, sql } from 'drizzle-orm';
import {
	boolean,
	check,
	index,
	integer,
	pgSchema,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from 'drizzle-orm/pg-core';
import {
	unixTimestamp,
	unixTimestampNullable,
} from '@drizzle/datatypes/unix-timestamp';

export const authSchema = pgSchema('auth');

export const users = authSchema.table(
	'users',
	{
		id: text('id').primaryKey(),
		name: text('name').notNull(),
		email: text('email').notNull().unique(),
		emailVerified: boolean('email_verified').default(false).notNull(),
		image: text('image'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
		role: text('role'),
		banned: boolean('banned').default(false),
		banReason: text('ban_reason'),
		banExpires: timestamp('ban_expires'),
		bio: text('bio'),
		username: text('username').unique(),
		displayUsername: text('display_username'),
		// Soft-delete marker owned by the user module's repository. Mirrors the
		// `deletedAt` additionalField in auth.options.ts.
		deletedAt: timestamp('deleted_at'),
		// User lifecycle for the invitation-only flow: pending | active | deactivated.
		status: text('status').default('active'),
		// When an invited user claimed the invitation (pending -> active).
		claimedAt: timestamp('claimed_at'),
		// Contact phone captured at invitation claim. Unique for the planned
		// phone login (partial index below).
		phone: text('phone'),
		// Personal fields moved from hr.employees (ERP-0034).
		gender: text('gender'),
		birthDate: unixTimestampNullable('birth_date'),
		birthPlace: text('birth_place'),
		maritalStatus: text('marital_status'),
	},
	(table) => [
		check(
			'users_gender_check',
			sql`gender IS NULL OR gender IN ('male', 'female')`,
		),
		check(
			'users_marital_status_check',
			sql`marital_status IS NULL OR marital_status IN ('single', 'married', 'divorced', 'widowed')`,
		),
		uniqueIndex('users_phone_live_idx')
			.on(table.phone)
			.where(sql`phone IS NOT NULL`),
	],
);

/** Row shape of `auth.users`. */
export type TUserSelect = typeof users.$inferSelect;
/** Insert shape of `auth.users`. */
export type TUserInsert = typeof users.$inferInsert;

export const sessions = authSchema.table(
	'sessions',
	{
		id: text('id').primaryKey(),
		expiresAt: timestamp('expires_at').notNull(),
		token: text('token').notNull().unique(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
		ipAddress: text('ip_address'),
		userAgent: text('user_agent'),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		impersonatedBy: text('impersonated_by'),
		activeOrganizationId: text('active_organization_id'),
	},
	(table) => [index('sessions_userId_idx').on(table.userId)],
);

export const accounts = authSchema.table(
	'accounts',
	{
		id: text('id').primaryKey(),
		accountId: text('account_id').notNull(),
		providerId: text('provider_id').notNull(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		accessToken: text('access_token'),
		refreshToken: text('refresh_token'),
		idToken: text('id_token'),
		accessTokenExpiresAt: timestamp('access_token_expires_at'),
		refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
		scope: text('scope'),
		password: text('password'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [index('accounts_userId_idx').on(table.userId)],
);

export const verifications = authSchema.table(
	'verifications',
	{
		id: text('id').primaryKey(),
		identifier: text('identifier').notNull(),
		value: text('value').notNull(),
		expiresAt: timestamp('expires_at').notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [index('verifications_identifier_idx').on(table.identifier)],
);

export const organizations = authSchema.table(
	'organizations',
	{
		id: text('id').primaryKey(),
		name: text('name').notNull(),
		slug: text('slug').notNull().unique(),
		logo: text('logo'),
		description: text('description'),
		createdAt: timestamp('created_at').notNull(),
		metadata: text('metadata'),
		// Soft-delete marker owned by the organization module's repository.
		deletedAt: timestamp('deleted_at'),
	},
	(table) => [uniqueIndex('organizations_slug_uidx').on(table.slug)],
);

/** Row shape of `auth.organizations`. */
export type TOrganizationSelect = typeof organizations.$inferSelect;
/** Insert shape of `auth.organizations`. */
export type TOrganizationInsert = typeof organizations.$inferInsert;

export const members = authSchema.table(
	'members',
	{
		id: text('id').primaryKey(),
		organizationId: text('organization_id')
			.notNull()
			.references(() => organizations.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		role: text('role').default('member').notNull(),
		createdAt: timestamp('created_at').notNull(),
	},
	(table) => [
		index('members_organizationId_idx').on(table.organizationId),
		index('members_userId_idx').on(table.userId),
	],
);

export const invitations = authSchema.table(
	'invitations',
	{
		id: text('id').primaryKey(),
		organizationId: text('organization_id')
			.notNull()
			.references(() => organizations.id, { onDelete: 'cascade' }),
		email: text('email').notNull(),
		role: text('role'),
		status: text('status').default('pending').notNull(),
		expiresAt: timestamp('expires_at').notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		inviterId: text('inviter_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
	},
	(table) => [
		index('invitations_organizationId_idx').on(table.organizationId),
		index('invitations_email_idx').on(table.email),
	],
);

export const passkeys = authSchema.table(
	'passkeys',
	{
		id: text('id').primaryKey(),
		name: text('name'),
		publicKey: text('public_key').notNull(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		credentialID: text('credential_id').notNull(),
		counter: integer('counter').notNull(),
		deviceType: text('device_type').notNull(),
		backedUp: boolean('backed_up').notNull(),
		transports: text('transports'),
		createdAt: timestamp('created_at'),
		aaguid: text('aaguid'),
	},
	(table) => [
		index('passkeys_userId_idx').on(table.userId),
		index('passkeys_credentialID_idx').on(table.credentialID),
	],
);

export const apikeys = authSchema.table(
	'apikeys',
	{
		id: text('id').primaryKey(),
		configId: text('config_id').default('default').notNull(),
		name: text('name'),
		start: text('start'),
		referenceId: text('reference_id').notNull(),
		prefix: text('prefix'),
		key: text('key').notNull(),
		refillInterval: integer('refill_interval'),
		refillAmount: integer('refill_amount'),
		lastRefillAt: timestamp('last_refill_at'),
		enabled: boolean('enabled').default(true),
		rateLimitEnabled: boolean('rate_limit_enabled').default(true),
		rateLimitTimeWindow: integer('rate_limit_time_window').default(86400000),
		rateLimitMax: integer('rate_limit_max').default(10),
		requestCount: integer('request_count').default(0),
		remaining: integer('remaining'),
		lastRequest: timestamp('last_request'),
		expiresAt: timestamp('expires_at'),
		createdAt: timestamp('created_at').notNull(),
		updatedAt: timestamp('updated_at').notNull(),
		permissions: text('permissions'),
		metadata: text('metadata'),
	},
	(table) => [
		index('apikeys_configId_idx').on(table.configId),
		index('apikeys_referenceId_idx').on(table.referenceId),
		index('apikeys_key_idx').on(table.key),
	],
);

/* ======================================================================== *
 * ERP-OWNED EXTENSION TABLES (not Better Auth; hand-written, append-only)
 * ======================================================================== */

/**
 * Invitation kind. `app` = application-admin invite (no organization),
 * `org` = organization admin/HR invite (role + organization attached).
 */
export const USER_INVITATION_TYPES = ['app', 'org'] as const;
export type UserInvitationType = (typeof USER_INVITATION_TYPES)[number];

/**
 * Invitation lifecycle. `pending` -> `accepted` on claim; `cancelled` by an
 * admin; `expired` by the sweeper (3-day expiry).
 */
export const USER_INVITATION_STATUSES = [
	'pending',
	'accepted',
	'cancelled',
	'expired',
] as const;
export type UserInvitationStatus = (typeof USER_INVITATION_STATUSES)[number];

/**
 * Unified invitation row for the closed (invitation-only) user lifecycle.
 *
 * @remarks
 * `tokenHash` is a SHA-256 of the emailed token - the raw token never touches
 * the database. Named `user_invitations` because Better Auth owns
 * `auth.invitations` (organization plugin).
 */
export const userInvitations = authSchema.table(
	'user_invitations',
	{
		id: text('id').primaryKey(),
		type: text('type', { enum: USER_INVITATION_TYPES })
			.default('app')
			.notNull(),
		email: text('email').notNull(),
		name: text('name'),
		organizationId: text('organization_id').references(
			() => organizations.id,
			{ onDelete: 'cascade' },
		),
		// Comma-joined closed ERP role keys ('admin,finance'); NULL on the
		// app-admin path. Same storage shape as `auth.members.role`.
		orgRole: text('org_role'),
		tokenHash: text('token_hash').notNull(),
		status: text('status', { enum: USER_INVITATION_STATUSES })
			.default('pending')
			.notNull(),
		invitedBy: text('invited_by')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		expiresAt: unixTimestamp('expires_at').notNull(),
		resentCount: integer('resent_count').default(0).notNull(),
		deliveryFailed: boolean('delivery_failed').default(false).notNull(),
		claimedAt: unixTimestampNullable('claimed_at'),
		deletedAt: unixTimestampNullable('deleted_at'),
		createdAt: unixTimestamp('created_at').notNull(),
		updatedAt: unixTimestamp('updated_at')
			.notNull()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		uniqueIndex('user_invitations_token_hash_idx').on(table.tokenHash),
		index('user_invitations_email_idx').on(table.email),
		index('user_invitations_organizationId_idx').on(table.organizationId),
		index('user_invitations_status_idx').on(table.status),
	],
);

/** Value types of a stored setting. */
export const SETTING_VALUE_TYPES = [
	'string',
	'number',
	'boolean',
	'json',
	'date',
] as const;
export type SettingValueType = (typeof SETTING_VALUE_TYPES)[number];

/**
 * Organization-scoped configuration key value store.
 *
 * @remarks
 * Absorbed `organization.settings` and the planned `organization.fiscal_settings`
 * (ADR-0024 Q4): the fiscal columns became keys
 * (`fiscal.year_start_month`, `fiscal.business_timezone`,
 * `fiscal.default_currency_code`) instead of a second table. Company-wide
 * settings live in `company.settings`.
 */
export const organizationSettings = authSchema.table(
	'organization_settings',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		organizationId: text('organization_id').notNull(),
		settingGroup: text('setting_group').notNull(),
		settingKey: text('setting_key').notNull(),
		settingValue: text('setting_value'),
		valueType: text('value_type').notNull().default('string'),
		isSecret: boolean('is_secret').notNull().default(false),
		description: text('description'),
		updatedBy: text('updated_by'),
		createdAt: unixTimestamp('created_at').notNull(),
		updatedAt: unixTimestamp('updated_at')
			.notNull()
			.$onUpdate(() => new Date()),
		deletedAt: unixTimestampNullable('deleted_at'),
	},
	(table) => [
		uniqueIndex('organization_settings_scope_uq').on(
			table.organizationId,
			table.settingGroup,
			table.settingKey,
		),
		check(
			'organization_settings_value_type_check',
			sql`${table.valueType} IN ('string', 'number', 'boolean', 'json', 'date')`,
		),
	],
);

export const authRelations = defineRelationsPart(
	{
		users,
		sessions,
		accounts,
		verifications,
		organizations,
		members,
		invitations,
		passkeys,
		apikeys,
		userInvitations,
		organizationSettings,
	},
	(r) => ({
		users: {
			sessions: r.many.sessions({
				from: r.users.id,
				to: r.sessions.userId,
			}),
			accounts: r.many.accounts({
				from: r.users.id,
				to: r.accounts.userId,
			}),
			members: r.many.members({
				from: r.users.id,
				to: r.members.userId,
			}),
			invitations: r.many.invitations({
				from: r.users.id,
				to: r.invitations.inviterId,
			}),
			passkeys: r.many.passkeys({
				from: r.users.id,
				to: r.passkeys.userId,
			}),
			userInvitations: r.many.userInvitations({
				from: r.users.id,
				to: r.userInvitations.invitedBy,
			}),
		},
		sessions: {
			user: r.one.users({
				from: r.sessions.userId,
				to: r.users.id,
			}),
		},
		accounts: {
			user: r.one.users({
				from: r.accounts.userId,
				to: r.users.id,
			}),
		},
		organizations: {
			members: r.many.members({
				from: r.organizations.id,
				to: r.members.organizationId,
			}),
			invitations: r.many.invitations({
				from: r.organizations.id,
				to: r.invitations.organizationId,
			}),
			userInvitations: r.many.userInvitations({
				from: r.organizations.id,
				to: r.userInvitations.organizationId,
			}),
			settings: r.many.organizationSettings({
				from: r.organizations.id,
				to: r.organizationSettings.organizationId,
			}),
		},
		members: {
			organization: r.one.organizations({
				from: r.members.organizationId,
				to: r.organizations.id,
			}),
			user: r.one.users({
				from: r.members.userId,
				to: r.users.id,
			}),
		},
		invitations: {
			organization: r.one.organizations({
				from: r.invitations.organizationId,
				to: r.organizations.id,
			}),
			user: r.one.users({
				from: r.invitations.inviterId,
				to: r.users.id,
			}),
		},
		passkeys: {
			user: r.one.users({
				from: r.passkeys.userId,
				to: r.users.id,
			}),
		},
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
export type TOrganizationSettingSelect =
	typeof organizationSettings.$inferSelect;
export type TOrganizationSettingInsert =
	typeof organizationSettings.$inferInsert;
