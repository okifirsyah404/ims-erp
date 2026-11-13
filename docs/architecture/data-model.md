# Data Model

Schema, keys, constraints, and conventions. Current declarations:
`apps/backend/drizzle/schemas/*.ts` (auth + per-feature schemas) and
`apps/backend/drizzle/datatypes/unix-timestamp.ts`.

> 2026-11-13: `apps/backend-elysia` is now `apps/backend`. The schema list
> below matches `docs/database/docs.dbml`: 27 modules, one Postgres schema each
> (ERP-0042, ADR-0015; `notification` added by ADR-0016). `docs.dbml` is
> canonical if the two disagree.

## PostgreSQL schemas

- **`auth`** — Better Auth-owned: `users`, `accounts`, `sessions`, `passkeys`,
  `organizations` (unique `slug`), `members`, `invitations`, phone/OTP/magic-link
  tables as generated. Timestamps are bigint milliseconds. FKs cascade to
  `users.id` for auth-owned tables.
- **`company`** — the one legal company of the application (ADR-0011, ERP-0042):
  - `profiles` — legal and trading name, `document_code` (the `{COMPANY}`
    numbering token), tagline, tax id, letterhead logo and signature object
    keys, and the values printed on documents (signatory name/title, default
    terms, warranty texts). One row for the whole company, no
    `organization_id`.
  - `head_office_addresses` — the printed office address; `village_id` is a
    logical reference to `location.villages.id` (ADR-0003).
  - `contacts` — email/phone/website channels.
  - `bank_accounts` — the company's own accounts printed on invoices (VAT and
    non-VAT). Not operational balances: Finance owns
    `finance.cash_bank_accounts`.
  - `settings` — company-wide key/value store (`setting_group`, `setting_key`,
    `value`, `value_type`, `is_secret` reserved `false`). Organization-scoped
    settings stay in `organization.settings`.
- **`code_number`** — the single numbering authority (ERP-0009, ERP-0042):
  - `series` — one row per `code_type`, with `pattern`, `reset_policy`,
    `next_number` and `last_issued_at`. Verbatim rename of
    `organization.document_sequences` (`document_type` → `code_type`),
    company-wide.
- **`document`** — the issued document registry (ERP-0042):
  - `templates` — document templates and their version.
  - `documents` — the issued registry row per outward-facing document, keyed by
    `source_type` + `source_id`; the business document stays in its owning
    module.
  - `files`, `signatures`, `access_logs`, `shares`, `tags`, `tag_links` —
    stored file metadata, signature records, the read audit trail, revocable
    public share tokens and tagging. `organization_id` is nullable: NULL means
    company-wide (ADR-0011 pattern).
- **`audit`** — `audit.audit_logs`: `actor_id` → `auth.users.id ON DELETE SET
  NULL`, `actor_role`, `action`, `resource_type`, `resource_id`, `metadata`
  (jsonb), `ip`, `user_agent`; indexes on actor, action, (resource_type,
  resource_id). Append-only.
- **`crm`** — `crm.customers`: `id`, `name`, `email`, `phone`, `status`
  (default `'active'`), `code`, unix-ms timestamps, `deleted_at`, structured
  Indonesian address references, tax identity.
- **`investor`** — `investor.investors`: the customer shape plus
  `ownership_share` (placeholder); exact portion/reserve config is business
  data governed by owner approval.
- **`erp`** — **retired**. The shared domain schema in the original plan was
  never created; the tables above landed in their own feature schemas. Do not
  add tables here.
- **`inventory`** — inventory module (ADR-0008, ADR-0009):
  - `items` — SKU-level master. `item_kind` (`product|component|material|tool|service`,
    CHECK-guarded text, not an enum), `is_serialized`, `is_stock_tracked`,
    `min_stock_qty`, exact-integer IDR prices. **Supersedes `catalog.items`.**
  - `serial_tracked_items` — one physical unit per row. `status`
    (`pre_order|in_stock|borrowed|lost|sold|applied_warranty`);
    `is_provisional_serial` ties to `pre_order` via a CHECK. Name kept
    deliberately (plan D9).
  - `warehouses` — global (`organization_id IS NULL`) or per-organization.
    Address fields moved out to `warehouse_addresses` (strict 1:1).
  - `warehouse_addresses` — `street` free text plus optional
    `rt`/`rw`/`postal_code` and a village-level logical ref to
    `location.villages` (ADR-0003). Only `village_id` links to location data;
    the province/regency/district selections are UI state, rebuilt on edit.
  - `warehouse_storages` — flat bins, no zone level (D14).
    `UNIQUE(warehouse_id, code) WHERE deleted_at IS NULL`.
  - `stock_movements` — **authoritative, append-only ledger** (ADR-0008). One
    row per movement, never updated after posting; a correction is a new
    row. A reversal is a `reference_type = 'reversal'` row pointing at the
    original, and the original flips to `status = 'reversed'` exactly once
    (the conditional `UPDATE … WHERE status = 'posted'` is the concurrency
    guard). **No valuation columns**: `unit_cost`/`currency_code` were removed
    because they were guaranteed to hold `0` forever — valuation belongs to the
    accounting module, and the base price lives on `items.selling_price` /
    `items.purchase_price` (OPEN-3 closed).
  - `stock_balances` — **service-maintained projection** over
    `stock_movements`, written inside the same transaction as the movement
    that caused it. No triggers. Only `applyDelta` writes quantity, and it is
    an atomic upsert (`ON CONFLICT … DO UPDATE SET quantity_on_hand =
    quantity_on_hand + excluded…`), never read-then-write. `recomputeFromLedger`
    is the repair operation *and* the test oracle. Two partial unique indexes
    (`…_org_scope_uq` `WHERE organization_id IS NOT NULL`, `…_global_scope_uq`
    `WHERE organization_id IS NULL`) let the upsert name the right conflict
    target per scope. **Scope rule:** a balance's `organization_id` follows the
    **warehouse**, not the caller — an organization-owned warehouse keeps
    per-organization balances, while a global warehouse has **one shared
    balance row** (`organization_id = NULL`) that every organization contributes
    to and sees. That is deliberate: a global warehouse is one shared physical
    space. `quantity_reserved` stays 0 until reservations are built, so
    `quantity_available == quantity_on_hand`.
  - **Ledger sign rule.** A movement stores an **unsigned** quantity; direction
    is a property of its `movement_type` (`isOutbound`). Every row counts toward
    a balance total, **including `reversed` ones** — a reversal is a new opposing
    movement, so the original and its reversal cancel exactly. Excluding the
    original would leave the reversal uncancelled and drift the balance by `q`
    on every reversal (caught by the recompute oracle).
  - **Negative stock is refused for every movement type**, reversal included.
  - `stock_adjustments` + `stock_adjustment_items` — adjustments are
    **documents, not bare movements**, with a real approval chain:
    `draft → submitted → approved|rejected → posted|cancelled`. Only `posted`
    writes movements; posting is idempotent (`posted_at IS NOT NULL` is the
    guard). `stock_adjustments.organization_id` is **NOT NULL**, unlike the rest
    of `inventory.*`: an adjustment is always raised by a tenant, even against a
    global warehouse. Self-approval is refused unless the actor holds
    `stock_adjustment:approve`. A line stores `quantity_before`/`quantity_after`
    (counted totals, not deltas) so a recount is auditable; a line whose delta is
    zero writes **no** movement (a `recount` that agrees still reaches `posted`).
  - Not yet implemented: `stock_transfers`, `stock_reservations`, `lot_batches`,
    `cycle_counts`, `borrowings`, `borrowing_lines`, `borrowing_events`
    (S4+). The tables exist in the schema and migration; the services do not.
  - **Every `inventory.*` table has a nullable `organization_id`**; coded
    tables use a partial-unique *pair* (`(organization_id, code) WHERE
    organization_id IS NOT NULL` plus `(code) WHERE organization_id IS NULL`)
    because PostgreSQL treats every NULL as distinct. Global rows are addressed
    with `IS NULL` only — never `eq(column, null)`, never a sentinel.
  - Warehouse routes are **application-admin-only** (`sessionGuard` +
    `requireGlobalAdmin`), not org-permission-gated: no organization role holds
    any `warehouse:*` action. Non-admins get 403 on reads, not an empty list.
  - `is_default` is **service-enforced** to at most one per scope (including
    the `NULL` scope); a partial unique index cannot express that.
  - A warehouse's `organization_id` is **immutable after creation** (plan
    D-C), as is its `code`.

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

## Organization/member semantics (ADR-0001, ADR-0007, ADR-0012)

One company; `auth.organizations`/`members` model internal structure
(departments/teams/portal identity). Multiple organizations may exist inside
that company, each with its own membership and per-organization `auth.roles`
catalog (created organizations are provisioned with the full catalog).
ERP master tables do **not** carry an `organization_id` tenant column — master
data stays company-wide. If true multi-company arrives later this is a data
migration plus repo-layer scoping change — recorded as the migration path in
ADR-0001 and deliberately unbuilt (ADR-0007).

A **transaction document** records the organization that issued it in a
nullable `organization_id` logical reference (`sales.invoices` is the first,
ADR-0012). Every cross-module reference is nullable (ADR-0014), so the column
states no presence rule: the owning module's contract validates it before the
write.

## Index policy (initial)

- FK columns indexed (existing convention: `accounts_userId_idx`,
  `audit_logs_actorId_idx`, …).
- Status columns indexed where filtered (existing for the three erp tables).
- Business code columns get unique partial indexes.
- A unique index that includes a nullable `organization_id` uses the
  ADR-0008 pair: `(organization_id, code) WHERE organization_id IS NOT NULL`
  plus `(code) WHERE organization_id IS NULL`, because a unique index ignores
  `NULL`.
- Timestamps used for ordering/filter (e.g., `created_at` on user/customer
  lists) get plain indexes when a query proves the need; do not blanket-index.

## Address reference tables (planned, Phase 2, ADR-0003)

Source of truth: `apps/backend/database/seeders/raw/location/*` seeded
idempotently through the existing
seeder runner into `location.*` tables with official Indonesian codes
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
