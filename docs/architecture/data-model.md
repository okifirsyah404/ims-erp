# Data Model

Schema, keys, constraints, and conventions. Current declarations:
`apps/backend/drizzle/schemas/*.ts` (auth + per-feature schemas) and
`apps/backend/drizzle/datatypes/unix-timestamp.ts`.

> Rewritten 2026-11-20 for ADR-0024 (database normalization baseline v2):
> **18 Postgres schemas, 188 tables** in `docs/database/docs.dbml`, plus the
> schema-less `webhook` module. `docs.dbml` is canonical; the Drizzle files in
> `apps/backend/drizzle/schemas/` mirror it, but the single baseline migration
> creates **164** tables, so some `docs.dbml` tables are still target-only (for
> example `human_resource.employee_addresses`; ticket templates and sub-tickets,
> Q29). Per-module ownership, table counts and contracts live in
> `docs/database/module-ownership.md`; this file keeps only the cross-cutting
> summary and the conventions.

## PostgreSQL schemas

| Schema | Owner module | Notes |
|---|---|---|
| `auth` | Identity | Better Auth core tables (hand-maintained) + `user_invitations`, `organization_settings`. The portal login lives in `customer.customers`, not here. |
| `location` | Location | Global reference data (province → regency → district → village). |
| `company` | Company | The one legal company: `profiles`, `addresses`, `contacts`, `settings`. Bank accounts are `finance.cash_bank_accounts`. |
| `customer` | Customer | `companies`, `customers` (people, incl. portal login), addresses, settings. |
| `supplier` | Supplier | `companies`, `suppliers` (PIC people), addresses, settings; bank details restricted. |
| `inventory` | Inventory | Products, physical items, stock ledger/balances, adjustments, borrowing, maintenance, disposals and the **warehouse tables**. One schema; the old separate `warehouse` schema is gone. |
| `sale` | Sale | Quotations, orders, delivery notes, returns, invoices, receipts, contracts. |
| `procurement` | Procurement | Purchase requests/orders, goods receipts, purchase returns. |
| `finance` | Finance | Ledger, journals, periods, cash/bank, reconciliations, supplier bills, AR/AP, depreciation. |
| `tax` | Tax | `taxes`, period records, corrections, withholding records. |
| `payment` | Payment | One payment ledger (`channel` manual\|gateway), polymorphic allocations, gateways with write-only sealed secrets. |
| `project` | Project | Projects, leads, handover, warranties and the license tables. |
| `ticket` | Ticket | `tickets`, `ticket_messages`, templates. |
| `human_resource` | Human Resource | Employees, attendance, leave, overtime, tasks, salaries and salary records. |
| `document` | Document | Templates, issued documents, files, signatures, shares, tags. `organization_id` nullable (NULL = company-wide). |
| `notification` | Notification | `push_notifications`, `push_notification_templates` (ADR-0016). |
| `audit` | Audit | `audit_logs`, append-only. |
| `automation` | Automation | n8n outbox, FAQ, WhatsApp conversations/messages. |

Facts that hold across modules:

- **Numbering is per module.** Every business schema owns a `code_numberings`
  table and a `<Module>NumberingService` (ADR-0024 Q32). There is no
  `code_number` schema and no central numbering module.
- **No organization schema.** Branches, departments and positions are gone;
  `auth.organizations` and `auth.organization_settings` remain, and
  `src/app/organization` is a module over those `auth` tables (no schema of
  its own).
- **`webhook` has no schema and no tables**: it is the inbound provider HTTP
  edge (`/webhooks/*`) and delegates to `payment` and `automation`.
- **The `erp` schema never existed** (see `module-ownership.md`).
- **Inventory scope.** Inventory rows may carry a null `organization_id`
  (global scope, ADR-0008): coded tables use a partial-unique *pair*
  (`(organization_id, code) WHERE organization_id IS NOT NULL` plus
  `(code) WHERE organization_id IS NULL`); global rows are addressed with
  `IS NULL`, never `eq(column, null)`. The stock ledger (`movements`) is
  append-only and `stocks` is a service-maintained projection written in the
  same transaction. Table and column names were renamed by ADR-0024; check
  `docs.dbml` for the current ones before relying on any name from older
  progress entries.
- **Payment secrets are write-only.** Gateway secrets are sealed with
  AES-256-GCM (`PAYMENT_SECRET_KEY`); the API returns only `hasSecret` and
  `secretLast4`.
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
that company, each with its own membership; organization roles are a closed
`erpRoleNames` enum stored comma-joined in `auth.members.role` (ERP-0041), not
a per-organization role table.
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
- Auth schema changes: hand-written, append-only edits to `auth.schema.ts`; never run `auth:generate` (AGENTS.md hard rule).
- Baseline (ADR-0024, 2026-11-19): the schema is one migration,
  `database/migrations/20261120061847_last_daredevil` (18 schemas, 164
  `CREATE TABLE` statements, no cross-schema `REFERENCES`). The 31-step v1
  chain is kept for history in `database/migrations-archive/v1` (not applied).
  Verified on a disposable database on 2026-11-19: `drizzle:migrate`, then
  `drizzle:seed` twice (second run inserted nothing), and a second
  `drizzle-kit generate` reported no schema changes. The earlier "blocked on
  main" branching-snapshot problem (2026-11-12) is resolved by this baseline
  (`runbook.md`).