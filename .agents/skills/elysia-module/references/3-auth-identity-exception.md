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

## Why

- Better Auth's adapter owns DDL for its tables; a parallel "shadow" table
  drifts immediately.
- Identity is a platform concern, not a module — giving `user` its own
  schema would fork the source of truth for accounts.
- The modules still get their own layering, tokens, and services; only the
  physical schema is shared with auth.

## Anti-patterns

- Creating `user.schema.ts` with an `app_users` table mirroring
  `auth.users` — two sources of truth.
- Hand-editing `auth.schema.ts` column definitions outside the codegen
  flow — changes are overwritten on the next `auth:generate`.
- Another module importing `auth.schema.ts` table objects for direct
  queries instead of calling the user/organization services (rule 3.5).
