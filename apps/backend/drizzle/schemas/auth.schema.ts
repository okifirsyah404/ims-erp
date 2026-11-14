import { defineRelationsPart, sql } from "drizzle-orm";
import {
  pgSchema,
  text,
  timestamp,
  boolean,
  integer,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { unixTimestampNullable } from "@drizzle/datatypes/unix-timestamp";

export const authSchema = pgSchema("auth");

export const users = authSchema.table("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
  role: text("role"),
  banned: boolean("banned").default(false),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires"),
  bio: text("bio"),
  username: text("username").unique(),
  displayUsername: text("display_username"),
  // Soft-delete marker owned by the user module's repository (sets/clears the
  // column directly via Drizzle). Mirrors the `deletedAt` additionalField in
  // auth.options.ts. Hand-applied append-only delta: @better-auth/cli 1.4.x
  // regresses this file (drops pgSchema/plural tables/relations), so the
  // generated column declaration is replicated here verbatim instead.
  deletedAt: timestamp("deleted_at"),
  // User lifecycle status for the invitation-only user management flow.
  // `pending`: pre-created by an invitation, no credentials yet.
  // `active`: claimed (credentials set) or seeded.
  // `deactivated`: soft-disabled by an admin (sessions revoked, login
  // blocked); memberships are kept so restore brings full context.
  // Mirrors the `status` additionalField in auth.options.ts (same
  // hand-applied-delta caveat as deletedAt above).
  status: text("status").default("active"),
  // When an invited user claimed their invitation (status pending → active).
  // The true "joined the application" date: `createdAt` only records the
  // admin's pre-creation of the pending row. Null for pending users; the
  // migration backfills `created_at` for already-active rows (seeded or
  // claimed before the column existed).
  claimedAt: timestamp("claimed_at"),
  // Contact phone number, captured at invitation claim (form 1). Unique so
  // the planned phone login can never hit a migration wall. Mirrors the
  // `phone` additionalField in auth.options.ts (hand-applied-delta caveat).
  phone: text("phone"),
  // Personal fields moved from hr.employees (ERP-0034). Hand-applied delta
  // (same caveat as above). `gender` allows male|female only (API contract).
  gender: text("gender"),
  birthDate: unixTimestampNullable("birth_date"),
  birthPlace: text("birth_place"),
  maritalStatus: text("marital_status"),
}, (table) => [
  check("users_gender_check", sql`gender IS NULL OR gender IN ('male', 'female')`),
  check(
    "users_marital_status_check",
    sql`marital_status IS NULL OR marital_status IN ('single', 'married', 'divorced', 'widowed')`,
  ),
  // Phone uniqueness for the planned phone login; partial so multiple
  // NULLs (users without phone) are allowed.
  uniqueIndex("users_phone_live_idx").on(table.phone).where(sql`phone IS NOT NULL`),
]);

/** Row shape of `auth.users`. */
export type TUserSelect = typeof users.$inferSelect;
/** Insert shape of `auth.users`. */
export type TUserInsert = typeof users.$inferInsert;

export const sessions = authSchema.table(
  "sessions",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    impersonatedBy: text("impersonated_by"),
    activeOrganizationId: text("active_organization_id"),
  },
  (table) => [index("sessions_userId_idx").on(table.userId)],
);

export const accounts = authSchema.table(
  "accounts",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("accounts_userId_idx").on(table.userId)],
);

export const verifications = authSchema.table(
  "verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("verifications_identifier_idx").on(table.identifier)],
);

export const organizations = authSchema.table(
  "organizations",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    logo: text("logo"),
    // Free-text organization description (ERP-0041). Hand-applied
    // append-only delta, same reason as `deletedAt` below.
    description: text("description"),
    createdAt: timestamp("created_at").notNull(),
    metadata: text("metadata"),
    // Soft-delete marker owned by the organization module's repository (sets
    // the column directly via Drizzle). Mirrors the `deletedAt`
    // additionalField in the organization plugin options. Hand-applied
    // append-only delta: see the matching note on `users.deletedAt` —
    // @better-auth/cli 1.4.x regresses this file, so the generated column
    // declaration is replicated here verbatim instead of regenerating.
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [uniqueIndex("organizations_slug_uidx").on(table.slug)],
);

/** Row shape of `auth.organizations`. */
export type TOrganizationSelect = typeof organizations.$inferSelect;
/** Insert shape of `auth.organizations`. */
export type TOrganizationInsert = typeof organizations.$inferInsert;

export const members = authSchema.table(
  "members",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").default("member").notNull(),
    createdAt: timestamp("created_at").notNull(),
  },
  (table) => [
    index("members_organizationId_idx").on(table.organizationId),
    index("members_userId_idx").on(table.userId),
  ],
);

export const invitations = authSchema.table(
  "invitations",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role"),
    status: text("status").default("pending").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    inviterId: text("inviter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("invitations_organizationId_idx").on(table.organizationId),
    index("invitations_email_idx").on(table.email),
  ],
);

export const passkeys = authSchema.table(
  "passkeys",
  {
    id: text("id").primaryKey(),
    name: text("name"),
    publicKey: text("public_key").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    credentialID: text("credential_id").notNull(),
    counter: integer("counter").notNull(),
    deviceType: text("device_type").notNull(),
    backedUp: boolean("backed_up").notNull(),
    transports: text("transports"),
    createdAt: timestamp("created_at"),
    aaguid: text("aaguid"),
  },
  (table) => [
    index("passkeys_userId_idx").on(table.userId),
    index("passkeys_credentialID_idx").on(table.credentialID),
  ],
);

export const apikeys = authSchema.table(
  "apikeys",
  {
    id: text("id").primaryKey(),
    configId: text("config_id").default("default").notNull(),
    name: text("name"),
    start: text("start"),
    referenceId: text("reference_id").notNull(),
    prefix: text("prefix"),
    key: text("key").notNull(),
    refillInterval: integer("refill_interval"),
    refillAmount: integer("refill_amount"),
    lastRefillAt: timestamp("last_refill_at"),
    enabled: boolean("enabled").default(true),
    rateLimitEnabled: boolean("rate_limit_enabled").default(true),
    rateLimitTimeWindow: integer("rate_limit_time_window").default(86400000),
    rateLimitMax: integer("rate_limit_max").default(10),
    requestCount: integer("request_count").default(0),
    remaining: integer("remaining"),
    lastRequest: timestamp("last_request"),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
    permissions: text("permissions"),
    metadata: text("metadata"),
  },
  (table) => [
    index("apikeys_configId_idx").on(table.configId),
    index("apikeys_referenceId_idx").on(table.referenceId),
    index("apikeys_key_idx").on(table.key),
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
  }),
);
