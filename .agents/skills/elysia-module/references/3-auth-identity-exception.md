# 3.3 Identity Tables Belong to Auth; User & Organization Project

**Impact: CRITICAL**

## The Rule

The `user` and `organization` modules are the exception to rule 3.1: they
do not get their own Postgres schema. Better Auth generates and owns
`auth.users`, `auth.organizations`, `auth.members` (and siblings) in
`drizzle/schemas/auth.schema.ts`. Those modules read/write those tables
via their own repositories, importing row types from `auth.schema.ts`.
They never re-declare the tables and never hand-edit the generated file
except in coordination with the Better Auth codegen (`bun run auth:generate`).

**Write-surface invariant.** A projection module's repository declares —
in its contract TSDoc — the exact column subset it writes directly. Every
other mutation of the owned table flows through the owning system's API
behind a contract port. In the user module, `IUserRepository` touches
**only `deletedAt`**; `role`, `banned`, `banReason`, `banExpires`,
passwords, and sessions go exclusively through `IUserAuthGateway`
(wrapping Better Auth's admin API). Direct Drizzle writes to the auth
system's columns are forbidden — same class of rule as the cross-schema
FK ban (rule 3.2).

## Canonical Example (from this repo)

`apps/backend/drizzle/schemas/auth.schema.ts` — Better Auth generated,
single schema, internal FKs only:

```typescript
export const authSchema = pgSchema("auth");
export const users = authSchema.table("users", { /* ... */ });
export const organizations = authSchema.table("organizations", { /* ... */ });
export const members = authSchema.table("members", {
	organizationId: text("organization_id")
		.notNull()
		.references(() => organizations.id, { onDelete: "cascade" }), // FK inside auth: OK
	userId: text("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	// ...
});
```

`src/app/user/` and `src/app/organization/` build their repositories and
services over these tables; other modules reach them through the user /
organization services (rule 3.5).

The user module is the full worked example of the split: repository
(`repositories/user.repository.ts`, `deletedAt` + cache-aside reads over
`auth.users`), gateway (`services/better-auth-user.gateway.ts` wrapping
`auth.api.createUser`/`adminUpdateUser`/`setRole`/`banUser`/`unbanUser`),
and a service pairing both (soft delete = gateway ban **+** repository
`deletedAt` — Better Auth ignores `deletedAt` during authentication, so
the ban is what blocks logins).

## Adding Columns to Auth Tables

Declare the field in `src/providers/better-auth/auth.options.ts`
(`user.additionalFields`, `input: false` to keep it out of every Better
Auth API surface), then add the column to `auth.schema.ts` and emit a
drizzle migration. **Codegen caveat (verified 2026-10-30):**
`@better-auth/cli generate` (1.4.x) **regresses** this project's schema
file — it drops `pgSchema('auth')`, plural table names, and relations.
Until the CLI matches the installed better-auth version, apply columns
as hand-written append-only deltas replicating the generated declaration,
and note the deviation in `progress.md`.

## Why

- Better Auth's adapter owns DDL for its tables; a parallel "shadow" table
  drifts immediately.
- Identity is a platform concern, not a module — giving `user` its own
  schema would fork the source of truth for accounts.
- The modules still get their own layering, tokens, and services; only the
  physical schema is shared with auth.
- The write-surface invariant keeps deletion semantics visible: if a
  repository could write any column, nothing would record which state
  belongs to the auth system versus the module.

## Anti-patterns

- Creating `user.schema.ts` with an `app_users` table mirroring
  `auth.users` — two sources of truth.
- Hand-editing `auth.schema.ts` column definitions outside the codegen
  flow — changes are overwritten on the next `auth:generate`.
- Another module importing `auth.schema.ts` table objects for direct
  queries instead of calling the user/organization services (rule 3.5).
- A projection repository writing auth-owned columns (`role`, `banned`,
  `password`) directly — scatters the ownership boundary; use the gateway.
- Running `@better-auth/cli generate` against this repo's schema file and
  committing the regressed output (loses pgSchema/plural/relations).
