# Data Model

Schema, keys, constraints, and conventions. Current declarations:
`apps/backend-elysia/drizzle/schemas/*.ts` (auth + per-feature schemas) and
`apps/backend-elysia/drizzle/datatypes/unix-timestamp.ts`.

> 2026-10-28: written against the deleted backend-nest tree
> (`apps/backend/src/providers/drizzle/...`); paths re-pointed, contents
> re-verify against backend-elysia before acting.

## PostgreSQL schemas

- **`auth`** — Better Auth-owned: `users`, `accounts`, `sessions`, `passkeys`,
  `organizations` (unique `slug`), `members`, `invitations`, phone/OTP/magic-link
  tables as generated. Timestamps are bigint milliseconds. FKs cascade to
  `users.id` for auth-owned tables.
- **`erp`** — business-owned:
  - `audit_logs` — `actor_id → auth.users.id ON DELETE SET NULL`, `actor_role`,
    `action`, `resource_type`, `resource_id`, `metadata` (jsonb), `ip`,
    `user_agent`; indexes on actor, action, (resource_type, resource_id).
  - `customers` — `id`, `name`, `email`, `phone`, `status` (default
    `'active'`), unix-ms timestamps, `deleted_at`; index on `status`. Planned
    extension (Phase 2): `code` (unique), customer type, contact person,
    structured Indonesian address references, tax identity.
  - `investors` — same shape plus `ownership_share` (placeholder); exact
    portion/reserve config is business data governed by owner approval.

## Conventions (pinned decisions)

- **Datetimes** — unix milliseconds in bigint columns via
  `unixTimestamp` / `unixTimestampNullable` custom types (`Date` at the app
  layer). Operational timestamps UTC; business dates Asia/Jakarta; accounting
  periods explicit. Comparison/filtering uses uniform ms epoch values.
- **Money** — integer IDR minor units (rupiah cents) for all ledger-grade
  amounts (ADR-0002). JSON serialization is a plain integer at the API surface.
  Never floats. UI formats to rupiah display assuming 0 decimals displayed or
  an agreed minor-unit policy at presentation time (record in Phase 3).
- **Identity** — `text` ids (nanoid/CUID-style) since auth table ids are text.
- **Soft delete** — `deleted_at` (nullable ms epoch). Reads default to alive
  rows (`deletedAt IS NULL`); mutations never hard-delete. Referenced master
  data cannot be hard-deleted; use `status: 'inactive'`/archive.
  Unique constraints on deletable tables must be **partial** (`WHERE
  deleted_at IS NULL`) so deleted rows don't block reused codes.
- **Deletion policy** — hard delete exists only for auth-owned force-delete
  paths (documented in `user.repository.ts`); ERP domain code has no hard
  delete.
- **Uniqueness scope** — constraints are company-scoped (there is no tenant
  dimension now, ADR-0001). Business codes should be unique within the
  company + alive-rows predicate; race conflicts surface as PG `23505` and are
  translated by services (409), never retried into duplicates.
- **References** — every relation declared in Relational v2 must also exist as
  a real PG FK when cross-table, with explicit `ON DELETE`
  (`SET NULL` for audit-like actor refs; `CASCADE` only for auth-owned child
  tables; `RESTRICT` for financial-linked master data).

## Organization/member semantics (ADR-0001, ADR-0007)

One company; `auth.organizations`/`members` model internal structure
(departments/teams/portal identity). Multiple organizations may exist inside
that company, each with its own membership and per-organization `auth.roles`
catalog (created organizations are provisioned with the full catalog).
ERP master tables do **not** carry an `organization_id` tenant column — master
data stays company-wide. If true multi-company arrives later this is a data
migration plus repo-layer scoping change — recorded as the migration path in
ADR-0001 and deliberately unbuilt (ADR-0007).

## Index policy (initial)

- FK columns indexed (existing convention: `accounts_userId_idx`,
  `audit_logs_actorId_idx`, …).
- Status columns indexed where filtered (existing for the three erp tables).
- Business code columns get unique partial indexes.
- Timestamps used for ordering/filter (e.g., `created_at` on user/customer
  lists) get plain indexes when a query proves the need; do not blanket-index.

## Address reference tables (planned, Phase 2, ADR-0003)

Source of truth: `apps/backend-elysia/database/seeders/raw/location/*` seeded
idempotently through the existing
seeder runner into `erp` schema tables with official Indonesian codes
(province → regency → district → village hierarchy restored via PK/FK chain —
code-defined, never guessed). Customer address = free-text street + four
reference ids. The browser fetches options through a cached API; addresses JSON
never ships in a frontend bundle.

## Migration policy

- Historical migrations are immutable. New schema changes → new migration via
  `drizzle:generate`, SQL inspected by a human, then applied to a **disposable**
  database for testing. `drizzle-kit push` is for disposable DBs only.
- Auth schema changes: run `auth:generate` (pin its version first), review the
  generated diff into the migration, never hand-edit auth tables.
- Unknown journal state for the existing baseline (`migrations/meta`) must be
  verified before the first new generate/migrate run.
