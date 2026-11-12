# Project Audit — 2026-10-25

Evidence-based state of the repository at audit time. All file references are
real and were inspected; test evidence comes from actually executed commands
(see "Baseline checks"). Do not treat folder names or pre-written specs as
proven functionality.

> 2026-10-28: `apps/backend-nest` (referred to below as `apps/backend`) was
> deleted; `apps/backend-elysia` is the backend. Audit content below is kept as
> the historical NestJS-era baseline; re-audit backend-elysia before using
> these findings.

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
| Database migrations | verified present | `database/migrations/20261025064638_create_auth_schema/` creates `auth` schema (Better Auth tables, bigint timestamps, FKs/unique slug) **and** `erp` schema (`audit_logs`, `customers`, `investors`) in one baseline; timestamps are bigint unix ms; no `migrations/meta` journal observed (check before adding `generate`) |
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

| Issue | Evidence | Workaround used | Owner action |
|---|---|---|---|
| `drizzle-kit generate` / `migrate` refuse to run | two snapshot branches from `20261106103434_add_asset_image_url`; two snapshots with id `d536237d…`; hand-written migrations without snapshots (`20261106170000_…`, `20261112000000_erp0034_hr_employees`) | hand-written migrations; `bun run database/migrate-reset.ts` (drizzle-orm migrator, no conflict check) on a **disposable** database only | one agreed snapshot-chain repair; never `--fix-conflicts` (it deletes 14 applied migrations) |
| Schema and migrations disagree | `drizzle-kit push --explain` on a fresh database wants to create `auth.organization_role` and drop two `sales.receipts` FKs | none | reconcile in one migration |
| `DRIZZLE_TOKEN` injected in a service | `sales/services/invoice.service.ts` (uses `this.database.transaction`) — AGENTS hard rule: no service may inject it | none (M04 only added an outbox dependency) | move the transaction behind the repository / transaction runner |
| Port 3000 clash in dev | `@ims-erp/react-email` preview also binds 3000; the backend gets `127.0.0.1`, the preview `[::1]` | call the backend on `127.0.0.1:3000` | give the preview its own port |
| No local DB/Redis ports | `docker-compose.yml` publishes no Postgres/Redis ports; `.env` expects 15432/16379 | override file outside the repo (see `runbook.md`) | add a local override to the repo |
| `docs.dbml` `hr.employees` is the target, not ERP-0034 as built | DBML: `organization_id NOT NULL`, `date` columns, department/position ids; Drizzle: nullable org, bigint dates | none | sync the DBML table |
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
