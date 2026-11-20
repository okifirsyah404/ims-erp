# Project Audit — 2026-10-25

Evidence-based state of the repository at audit time. All file references are
real and were inspected; test evidence comes from actually executed commands
(see "Baseline checks"). Do not treat folder names or pre-written specs as
proven functionality.

> 2026-10-28: `apps/backend-nest` (referred to below as `apps/backend`) was
> deleted; the Elysia backend (now `apps/backend`, formerly `apps/backend-elysia`)
> is the backend. The "Domain classification", "Baseline checks" and "Known
> risks" sections below are the **historical 2026-10-25 NestJS-era baseline**,
> kept for the record; do not read them as current state. Current state is the
> next section.

## Current state (2026-11-20, ADR-0024 baseline)

Only facts taken from `docs/plan/progress.md` entries of 2026-11-19/20 and from
the repository tree; nothing here is business acceptance.

| Area | State | Evidence |
|---|---|---|
| Schema | 18 Postgres schemas, 188 tables in `docs/database/docs.dbml`; 18 Drizzle schema files in `apps/backend/drizzle/schemas/`; the baseline migration creates 164 tables (the rest of `docs.dbml` is target-only, e.g. `human_resource.employee_addresses`, ticket templates) | `validate-dbml.ts` OK (188 tables, 162 intra-module refs, 169 logical reference columns) on 2026-11-19 |
| Migrations | one baseline `database/migrations/20261119145940_many_human_robot`; v1 chain archived in `database/migrations-archive/v1`; `generate` then reports no changes | verified 2026-11-19 on a disposable database: `migrate`, `seed` twice (second run inserted 0), `generate` "No schema changes" |
| Backend modules | 18 schema modules + `webhook` (no schema) mounted in `src/app/app.ts` (plus `user` and `organization`, which sit over the `auth` schema) | live boot 2026-11-20: all controllers resolved through DI |
| Live API | 69 GET endpoints called against a freshly migrated and seeded disposable database: 65 returned 200, 4 returned 400 (they need query parameters), none 404/5xx | smoke test 2026-11-20; **no UI was opened** and webhooks with a configured gateway, the license machine API and most write paths were **not** exercised |
| Tests | `bun run test` 7/7 turbo tasks: backend 1232, web-admin 119, locales 98, web-landing 24, web-customer-portal 60 pass; `bun run lint` 0 errors; `tsc` 0 errors | 2026-11-19/20 |
| Frontend | web-admin wrappers repointed to the new URLs (slices 1-5); landing and portal use the `@ims-erp/common` envelope contract; many new backend tables have no UI yet | `progress.md` 2026-11-19/20; read by controllers, not run in a UI |
| Astro apps | `@lucide/astro`, `@vite-pwa/astro` and `vite-plugin-pwa` are pinned back to the last building versions (dependabot ignores them); proper adaptation to the newer majors is open | `progress.md` 2026-11-20 |

Open ADR-0024 leftovers (from `progress.md`, 2026-11-20): legacy `crm.*` error
keys in `customer.errors.ts`; `ExportedFinanceService` / `ExportedJournalService`
not built; ticket templates and sub-tickets (Q29); the `employee_addresses`
Drizzle table and controller; supplier address endpoints; the reconciliation
match route path; the webhook body envelope status for `rejected`/`unknown`
outcomes; ERP-0070..0089 are all `in-progress`, none `accepted`.

## Repository state

- Single commit `d670b5c` ("Initial commit from create-turbo"). Everything after
  it is uncommitted work: the original Next.js starter (`apps/docs`, `apps/web`,
  `packages/eslint-config`, `packages/typescript-config`, old `packages/ui/src/*`)
  is deleted-but-uncommitted; all current code (`apps/backend`, `apps/web-admin`,
  `packages/common`, current `packages/ui/src`, root `tsconfig.json`,
  `bunfig.toml`, `.agents/`, `.claude/`, `skills-lock.json`) is untracked.
- Stale artifacts found but not fixed during the docs phase:
  - `README.md` is still Turborepo starter boilerplate.
  - Root `package.json` script `build:libs` references `@ims-erp/config` and
    `@ims-erp/lib-cache`, which do not exist in the workspace.
- Pre-existing failing suites described below are expected to be fixed by
  Phase 2 (authorization core + auth module), not ignored.

## Stack baseline (see `stack-compatibility.md` for full matrix)

Verified working foundations: Bun 1.4.2 + Turbo 2.10.13 + TS 6.0.3;
NestJS 12 on Fastify with `bodyParser: false` (required by the Better Auth
integration); Better Auth 1.7.12 with drizzle relations-v2 adapter; drizzle-orm
1.0.0-rc.4 Relational v2 (`defineRelationsPart`) + drizzle-kit 1.0.0-rc.4;
`@nestjs/drizzle` 0.0.2 `@InjectDrizzle()` in production use; zod 4; Keyv 6+
Redis; BullMQ configured in `bootstrap.module.ts`; Vitest 4 unit config with
tsconfig-alias resolution.

## Domain classification

Legend: **verified working** / **partially implemented** / **scaffold only** /
**absent** / **blocked**.

| Area | Classification | Evidence |
|---|---|---|
| Monorepo tooling (Bun/Turbo/workspace resolution) | verified working | `bun run test` started Turbo tasks correctly; aliases resolve |
| Config loading (`src/config/*`) | partially implemented | zod schemas exist; `dotenv-expand` version `1000.0.0` suspicious, unverified at runtime |
| Better Auth options/plugins | partially implemented | `src/providers/better-auth/auth-options.ts` complete config (admin, organization, passkey, emailOTP, magicLink, phoneNumber, i18n en/id, secondaryStorage on Keyv/Redis); not verified at runtime |
| Authorization core (`src/core/authorization/*`) | absent | directory does not exist, yet `test/unit/core/authorization/{roles,ownership}.spec.ts` and `apps/web-admin/src/lib/permissions.ts` define the intended design; `src/providers/better-auth/role-permission.ts` is an empty file |
| Auth module (`src/modules/auth/*`) | absent | two pre-written specs import `@backend/modules/auth/*`; no such directory |
| `user` domain | partially implemented | `user.repository.ts` (383 lines): pagination envelope, soft delete, cache-aside Redis, force-delete; controller/service still empty stubs; 2 failing "should be defined" specs |
| `customer` domain | partially implemented | schema + migration real; repository has only `findById` variants with a questionable scope-compare pattern; controller/service empty; 2 pre-written specs |
| `investors`, `audit_logs` schema | schema only | `erp-schema.ts` + baseline migration; no code |
| employee, expense, inventory, notification, organization, payment, product, purchasing, reporting, sales, supplier, warehouse modules (12) | scaffold only | each has a `*.module.ts` registered in `app.module.ts` plus empty controller/service; no DTOs, no queries |
| Database migrations | historical (superseded 2026-11-19 by the single ADR-0024 baseline, see "Current state") | **19 migrations, one per Postgres schema** (squashed 2026-11-14, ADR-0019); `20261028042701_create_auth_schema/` creates the `auth` schema (Better Auth tables, bigint timestamps, FKs/unique slug) plus the ERP-owned `auth.user_invitations`; each later folder adds exactly one schema. Timestamps are bigint unix ms. `drizzle-kit check` and `generate` both run clean against `drizzle.config.ts`. The pre-squash history (57 folders, no `migrations/meta` journal) is in git history only |
| Seeders | partially implemented | `database/seeders/` with runner + `auth.seeder.ts` and raw Indonesian address JSON (provinces/regencies/districts/villages); ERP-domain seeders absent |
| web-admin routes | scaffold only | only `/` ("Welcome Home!") and `/login`; `routeTree.gen.ts` generated; no authenticated layout wired to routes |
| web-admin shell | scaffold only | `main-sidebar.tsx` is untouched shadcn sample data ("Acme Inc", Playground/Models nav) |
| web-admin lib | scaffold + real config | `auth-client.ts` correct (`VITE_API_URL`, base path `/api/auth`, credentials include, admin plugin); `permissions.ts` — full intended permission matrix; `query-client.ts`, `use-permission.tsx` exist |
| `@ims-erp/common` | partially implemented | `contracts/pagination.ts`, `contracts/repository.ts`; **repository contract is a server abstraction — must not be exported to browser bundles** (verify before frontend import) |
| `@ims-erp/ui` | partially implemented | ~60 shadcn-style components present; chat-specific components exist; depends on system prompt conventions (Bash/JSX `tabs`, component json) |

## Baseline checks (executed 2026-10-25)

Environment: Windows dev drive, bun 1.4.2.

| Command (cwd) | Result | Notes |
|---|---|---|
| `bun run lint` (`apps/backend`) | PASS with 6 warnings | `role-permission.ts` empty; unused imports in `erp-schema.ts`; unused params in `auth-options.ts` |
| `bunx vitest run` (`apps/backend`) | **7 failed / 25 passed** files; 2 failed / 25 passed tests | all failures pre-existing |
| `bun run test` (repo root, Turbo `test` task) | FAIL (backend failing, 1/2 tasks) | consequence of the above |

Failing suites, grouped by cause:

1. Import of missing `src/core/authorization/{permissions,authorization.service}.ts`
   → `test/unit/core/authorization/ownership.spec.ts`, `roles.spec.ts`.
   The specs pre-write the intended design (`erpRoles`, `ErpPermission`,
   `AuthorizationService`).
2. Import of missing `src/modules/auth/*` →
   `test/unit/modules/auth/{controllers,services}/*.spec.ts`.
3. `test/unit/modules/customer/services/customer.service.spec.ts` — suite
   import failure (module graph), to be resolved when the customer slice code
   lands.
4. `user.controller.spec.ts` / `user.service.spec.ts` — "should be defined"
   fails; instantiate-time DI/dependency issue in stub classes.

## Pre-existing issues on main found 2026-11-12

Found while rebuilding M08 (PR #83) and M04 (PR #84) on `main` @ 89940c0.
Not caused by those PRs; recorded here per the Definition of Done.

> Historical (2026-11-12 → 2026-11-15). The module and table names below
> (`accounting`, `hr`, `sales`) predate ADR-0024 (now `finance`,
> `human_resource`, `sale`), and the `hr.employees` vocabulary row and the
> "squashed migrations" statements were superseded by the 2026-11-19 baseline;
> the `DRIZZLE_TOKEN` row is still true for the services listed under their new
> names (see below).

Re-checked 2026-11-15 on `feat/m08-hr-on-main` after merging `main` @ `2b28fc46`:

- **Resolved by ERP-0052** (migration history squashed to one migration per
  schema, ADR-0019): `drizzle-kit generate` / `migrate` now run on the linear
  chain (`drizzle-kit check` → `Everything's fine`), and the
  `push --explain` drift on `auth.organization_role` / `sales.receipts` is
  gone with the regenerated snapshots.
- **Resolved 2026-11-15**: `docs.dbml` `hr.employees` now matches the built
  table (nullable `organization_id`, `date` hire/termination columns, `text`
  `user_id`), so that row was dropped.
- **Still open** — the rows below.

| Issue | Evidence | Workaround used | Owner action |
|---|---|---|---|
| `DRIZZLE_TOKEN` injected in a service | Re-grepped 2026-11-20 (`src/app/*/services`): still present in `sale/services/invoice.service.ts`, `finance/services/{bank-reconciliation,cash-bank,month-end-close,opening-balance,posting,supplier-bill}.service.ts`, `inventory/services/{adjustment,stock}.service.ts` and `payment/services/payment.service.ts` — AGENTS hard rule: no service may inject it. Only the file list was re-checked; the transaction usage in the new files was not read | none (M04 only added an outbox dependency) | move the transaction behind the repository / transaction runner |
| `human_resource.employees` status vocabulary vs `docs.dbml` (was `hr.employees`) | Row recorded 2026-11-15 against the pre-ADR-0024 `hr.schema.ts`. **Not re-checked** after the move to `human-resource.schema.ts` and the rewritten `docs.dbml` | n/a | re-compare the two vocabularies before relying on this row |
| Port 3000 clash in dev | `@ims-erp/react-email` preview also binds 3000; the backend gets `127.0.0.1`, the preview `[::1]` | call the backend on `127.0.0.1:3000` | give the preview its own port |
| No local DB/Redis ports | `docker-compose.yml` publishes no Postgres/Redis ports (only backend 3001 and web-admin 8080); `.env` expects 15432/16379 | override file outside the repo (see `runbook.md`) | add a local override to the repo |
| JSON columns are `jsonb` | `data-dictionary.md` 1.12 says structured payloads are JSON `text`; 14+ `docs.dbml` columns use `jsonb` | M04 follows the existing `jsonb` practice | decide and fix the dictionary or the columns |

## Known risks and blockers

| Risk | Impact | Mitigation tracked in |
|---|---|---|
| Auth never exercised at runtime (session, CORS/trusted origins, Fastify raw-body middleware order) | could invalidate phase-2 slice and later phases | `phases/phase-2-auth-access-customer-slice.md` exit criteria — real login/e2e required |
| drizzle-orm on `1.0.0-rc.4` (rc channel) | API/internal churn | `stack-compatibility.md`; pin exact versions, no silent upgrades |
| No `drizzle-kit` journal/meta visible for the existing migration dir | `generate` behavior uncertainty | verify `drizzle:generate` on a disposable DB before first use |
| `README.md`, root `package.json` `build:libs` mismatch | onboarding confusion, broken convenience command | backlog item under Phase 1 housekeeping |
| `.env` contains real values in working tree; `.env` not in root `.gitignore` audit yet | secret-leak risk | `security-and-access.md` secrets policy; verify before any commit |

## Rules of interpretation

- "Implemented" = code exists and behavior exercised by tests/evidence.
- "Scaffold only" = module registered and empty; do not count toward progress.
- Do not infer tenancy, workflow status, or financial semantics from names.
  The organization model decision is recorded in `decisions/ADR-0001`.
