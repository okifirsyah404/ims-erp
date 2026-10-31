# Progress

Latest verified state. Update this file every working session, including
exact commands and outcomes. `progress.md` lies are worse than missing code.

## Completed (this session - dashboard session user + tanstack-router-auth skill, 2026-10-30)

- **New skill** `.agents/skills/tanstack-router-auth/` (present, not in
  lock): guide-derived pattern from
  https://tanstack.com/router/latest/docs/guide/authenticated-routes —
  `_authed` guard with redirect preservation, `isRedirect` re-throw,
  login-side `redirect` param consumption, TanStack Query session-user
  flow, sidebar degradation rules.
- **Backend** `GET /users/me`: self profile via guard-resolved session id
  (server-side, `erp: {}` — self-scoped, no admin gate), declared before
  `/:userId`. Elysia typing quirk found: `erp: {}` (empty option object)
  drops the macro's resolved `erp` from handler types — `/me` uses
  `erp: { permission: [] }` with a NOTE comment. Verified: unauth curl →
  401 envelope; boot smoke clean.
- **Web-admin**:
  - `main.tsx`: `QueryClientProvider` mounted (was missing — `useQuery`
    would have crashed anywhere).
  - `_authed.tsx`: guard upgraded to guide spec — `search.redirect`
    preservation + `isRedirect(error)` re-throw (backend stays
    authoritative via `getSession()`).
  - `login/index.tsx`: `validateSearch` (`redirect` param); `LoginForm`
    takes `onSuccess`; login navigates `router.history.push(search.redirect ?? '/')`.
  - `src/lib/user-api.ts`: `selfUserQueryOptions` (`['users','me']`,
    60s stale, retry 1) unwrapping `TApiResponse<TSelfUser>`; local
    `TSelfUser` type mirrors backend `TUserProfile`.
  - `main-sidebar.tsx`: hardcoded sample user removed; `NavUser` fed by
    `useSelfUser` (`useQuery(selfUserQueryOptions)`); loading → `…`
    initials, error → degraded (no email/avatar).
  - `nav-user.tsx`: real-name initials fallback (was hardcoded `CN`),
    placeholder items (Upgrade to Pro / Billing) removed, Log out wired
    to `authClient.signOut()` → `/login`.
- Verified (2026-10-30): backend `bun run typecheck` clean, `bun test`
  78/78, boot smoke + unauth curl 401; web-admin `bun run build`
  (tsc + vite) clean, lint no new warnings in touched files. NOT yet
  manually verified in a browser: login → dashboard shows real
  name/email/avatar; deep-link round-trip through the `redirect` param.

## Completed (this session - avatar queue moved into user module, 2026-10-30)

- `src/providers/better-auth/avatar/` (queue + worker) moved to
  `src/app/user/queues/` (`avatar.queue.ts`, `avatar.worker.ts`) —
  avatar generation is user-domain logic, not provider infra; keeps the
  module folder pattern open for future queues.
- One behavior fix in the move: `processAvatarJob` previously wrote
  `auth.users.image` via raw `drizzleDB.update(users)`; it now writes
  through `IUserRepository.update()` (resolved once inside
  `startAvatarWorker()`), gaining Redis cache invalidation and
  soft-delete filtering (a job arriving after the user was deleted
  no-ops instead of resurrecting an image row for a deleted user).
- Import updates: `auth.options.ts` (create-hook), `src/index.ts`
  (worker start/SIGTERM), `scripts/dispatch-avatar.ts` (scratch script),
  `test/unit/avatar.worker.test.ts` (path only). `avatarObjectKey`/
  `presignAvatarUrl` stay in `@providers/s3/s3` (S3 = infra).
- Verified (2026-10-30): `bun run typecheck` clean; `bun run lint` no new
  warnings; `bun test` 78 pass / 0 fail; boot smoke test OK (worker up,
  queue connected, clean shutdown).

## Completed (this session - user module ERP-0007 slice, 2026-10-30)

**Status: implemented, typecheck + lint + unit suite green (78 pass), boot
smoke-tested. NOT e2e-verified against live admin session + Better Auth
runtime (see below).**

- **User module rebuilt to the location-module layered shape** (contracts/
  constants/ controllers/ services/ repositories/ container.ts):
  - `contracts/user.contract.ts` — zod boundary schemas (list query,
    create, update, ban, role, path params) + `z.infer` types.
  - `contracts/user.repository.interface.ts` — `IUserRepository extends
    IBaseRepository` + `paginate`; TSDoc pins the write-surface invariant:
    the repository touches ONLY `deletedAt`.
  - `contracts/user-auth.gateway.interface.ts` — `IUserAuthGateway` port
    over the Better Auth admin API; all methods take the caller's
    `Headers` because `/admin/*` endpoints run Better Auth's own
    admin-authorization check (`requireHeaders`); only `/admin/create-user`
    is server-facing.
  - `services/better-auth-user.gateway.ts` — wraps `auth.api.createUser`,
    `adminUpdateUser`, `setRole`, `banUser`, `unbanUser`; translates
    `APIError` 422→`UserEmailTakenError`, 404→`UserNotFoundError`.
  - `services/user.service.ts` — orchestration + avatar mapping.
    `getUser()` returns `TUserProfile` (`image` = short-lived presigned S3
    URL via `presignAvatarUrl`, or null; raw key never leaves the
    service). Replaces the old `getAvatarUrl()`/`GET /users/:userId/avatar`
    302 redirect. Invariant: soft delete = repo sets `deletedAt` AND
    gateway bans (reason `deleted`) — Better Auth ignores `deletedAt`
    during auth, so the ban is what blocks logins; restore = unban +
    clear `deletedAt`.
  - `repositories/user.repository.ts` — implements `IUserRepository`,
    soft-delete filtering (`isNull(users.deletedAt)`) on all reads,
    Redis cache-aside (5-min TTL, `user:all` / `user:id:<id>` keys,
    invalidated on `deletedAt` writes), never caches `paginate`.
  - `controllers/user.controller.ts` — envelope helpers
    (`ok`/`okPaginated`/`errorEnvelope` per `@ims-erp/common`), plugin-local
    `onError({ as: 'local' })` mapping VALIDATION/PARSE/ZodError→400,
    domain errors→404/409, non-admin→403. Authorization: `erpGuard()`
    session+membership on every route; mutations additionally gated by
    `erp: { policy: requireGlobalAdmin }` (session-resolved role ===
    `admin`; no `user` resource exists in the org AC catalog — user admin
    is Better Auth's global admin domain, with a second enforcement layer
    inside Better Auth itself).
  - `constants/di.ts` — tokens typed `InjectionToken<T>`;
    `container.ts` registers repository + gateway + service.
- **Endpoints** (prefix `/users`): `GET /` (paginated list), `GET /:userId`
  (full profile, presigned image), `POST /` (201), `PATCH /:userId`,
  `PATCH /:userId/role`, `POST /:userId/ban`, `POST /:userId/unban`,
  `DELETE /:userId` (soft delete), `POST /:userId/restore`.
- **Soft delete added to `auth.users`**: `deletedAt` declared as Better
  Auth `user.additionalFields` (`type: 'date'`, `input: false`) in
  `auth.options.ts`; column added to `drizzle/schemas/auth.schema.ts` +
  `TUserSelect`/`TUserInsert` exports.
  - **Codegen caveat**: `bunx --bun @better-auth/cli generate` (resolves
    1.4.x for this config) REGRESSES the schema file (drops
    `pgSchema('auth')`, plural tables, relations). The column was applied
    as a hand-written append-only delta replicating the generated
    declaration; revisit when the CLI matches better-auth 1.7.
  - Deviation note: generated/auth-schema `deletedAt` is a plain
    `timestamp`, not the project's `unixTimestampNullable` — Better Auth
    owns this file's shape.
- **Migration**: `database/migrations/20261030230723_parched_human_cannonball/`
  (`ALTER TABLE "auth"."users" ADD COLUMN "deleted_at" timestamp;`),
  applied to the local dev DB via `bun run drizzle:migrate`.
- Stale `auth:generate` script path fixed? NO — `package.json` still points
  at `./src/drizzle/schemas/auth.schema.ts`; output was passed explicitly.
  Left for ERP-0001 housekeeping.
- Verified commands (2026-10-30, `apps/backend`):
  - `bunx --bun @better-auth/cli@latest generate ... -y` → regressed (see
    caveat); reverted, hand-applied instead.
  - `bun run drizzle:generate` → migration emitted; inspected SQL before
    applying; `bun run drizzle:migrate` → applied to local dev Postgres.
  - `bun run typecheck` → clean (after fixes: `adminUpdateUser` endpoint
    name, role-literal casts on `setRole`/`createUser` with `ponytail`
    notes, `erp: { policy }` instead of `beforeHandle` for typed ctx).
  - `bun run lint` → no new warnings; `bun test` → 78 pass / 0 fail (was
    67; +13 in rewritten `test/unit/user.service.test.ts`: image mapping
    presigned/null/absent, delete=ban+deletedAt pairing + no-write on
    missing user, restore=unban+clear, gateway delegation, null-prop).
  - Boot smoke test: `bun src/index.ts` → `🦊 Elysia is running at
    localhost:3001`, clean shutdown.
- NOT yet verified: e2e with a real admin session (create/ban/restore
  against live Better Auth runtime; permission catalog lacks a `user`
  resource by design — global-admin policy is the first-party gate).

## Completed (this session - avatar generation pipeline, 2026-10-29)

**Status: implemented (unit-verified), NOT integration-verified against a
running server + real S3.**

- On user creation (email sign-up, OAuth, admin-created — anything through
  the Better Auth instance, incl. the auth seeder), the
  `databaseHooks.user.create.after` hook in
  `src/providers/better-auth/auth.options.ts` enqueues an `avatar` job
  (`src/providers/better-auth/avatar/avatar.queue.ts`). Enqueue errors are
  logged and swallowed — sign-up never fails because of the queue.
  Deterministic `jobId: avatar:<userId>` dedupes replays; 3 attempts,
  exponential backoff.
- Worker (`avatar.worker.ts`): deterministic DiceBear `initials` avatar,
  seed = user name (falls back to userId), 72×72; SVG→PNG via
  `@dicebear/converter` (new dep; brings sharp/resvg); PNG written to
  `.tmp/avatars/<userId>.png` (repo-local temp dir, gitignored, always
  removed in `finally`); uploaded to S3 key `user/<userId>/avatar.png`;
  `auth.users.image` stores the **object key**, never a URL.
- S3 provider `src/providers/s3/s3.ts`: Bun-native `S3Client` from existing
  `S3_*` env (no new dependency); `avatarObjectKey()` +
  `presignAvatarUrl()` (5-min presigned GET).
- BullMQ runs on the existing Bun Redis client via `createBunRedisClient`
  (`src/providers/queue/queue.connection.ts`); no ioredis. Worker started in
  `src/index.ts`; SIGTERM closes worker then queue connection (wrapper
  `quit()`, never raw `redisClient.close()`).
- Show endpoint (outside Better Auth routes):
  `GET /users/:userId/avatar` in `src/app/user/controllers/user.controller.ts`
  — guarded by `erpGuard()` (session + org membership required, any member
  role; no permission needed); 302 redirect to a freshly presigned S3 URL;
  404 when the user has no avatar key yet. Fills the previously empty user
  module (repository/service/container + DI tokens).
- Verified commands (2026-10-29, `apps/backend`):
  - `bun install` after adding `@dicebear/converter@10.7.0` → resolved,
    21 packages installed.
  - `bun run typecheck` → clean; `bun run lint` → no new warnings (only
    pre-existing stub-file warnings).
  - `bun test` → 67 pass / 0 fail (was 54; +6 new: `test/unit/
    avatar.worker.test.ts` PNG magic bytes, determinism, blank-name
    fallback, key pattern; `test/unit/user.service.test.ts` presigned URL
    contains signature, 404 path; 67 total incl. 7 pre-existing auth tests).
- NOT yet verified (needs live server + reachable S3/Redis): end-to-end
  sign-up → job processed → object in bucket → endpoint 302. The presign
  unit test runs against real local config (offline signing only; no S3
  request made).

## Completed (this session - two-layer authorization core, 2026-10-29)

- **Permission catalog (single source of truth)**:
  `packages/common/src/authorization/erp-permissions.ts` - full ERP
  resource/action vocabulary, portal statements, built-in org statements,
  18 role grants (`erpRoleGrants`), all browser-safe and typed; exported
  from `@ims-erp/common`. `packages/common` rebuilt (`bun run build`).
- **Backend access control** `apps/backend/src/providers/better-auth/ac/`:
  - `organization-ac.ts` - `createAccessControl` over `defaultStatements` +
    ERP catalog + portals; 18 `erpRoles`; `authorizeErpPermissions`
    (multi-role union, deny-by-default).
  - `admin-ac.ts` - global admin/user constants; admin() defaults preserved.
  - `auth-hooks.ts` - Better Auth `hooks.before` blocking owner-role grants
    via add-member / update-member-role / create-invitation unless actor is
    an owner; org admins restricted to non-owner roles.
  - `plugins/organization.auth.ts` now passes `ac` + `roles`; `teams: false`.
- **Username plugin** added (`plugins/username.auth.ts`); `auth.users`
  gained `username` (unique) + `display_username` in append-only migration
  `20261029044823_dear_living_lightning` (also creates `sales` schema).
- **Elysia guard** `src/authorization/elysia-auth.ts`: `erpGuard()` macro
  (`erp: { permission: [...], policy }`) resolving session from real
  request headers (401), organization context (`x-organization-id` header >
  active org; membership validated against the SAME id via
  `auth.api.getFullOrganization`, 403 when not a member - global admins
  NOT exempt), permission checks (403), optional record-level policy hook.
- **Sales vertical** (`src/app/sales/`, schema `drizzle/schemas/sales.schema.ts`):
  quotations + payments with tenant-scoped repositories (conditional
  `WHERE status = from` state transitions), FK-ownership validation
  (cross-org quotation references rejected 404), self-approval blocks
  (quotation + payment), execution-only-after-approval, explicit
  configuration-missing denial for approvals (no invented thresholds),
  whitelisted update fields (no mass assignment). Wired into
  `src/index.ts` bootstrap.
- **Auth seeder** `database/seeders/seed/auth.seeder.ts` - idempotent;
  creates initial global admin via Better Auth instance
  (`createUser` + `setUserPassword`), never resets existing users, no org
  membership. Credentials from new `AuthConfigSchema` (`auth` section in
  `config.schema.ts` + loader; `INITIAL_ADMIN_EMAIL/USERNAME/PASSWORD`,
  dev-only defaults, never logged; `.env.example` updated). Wired into
  `database/seeders/index.ts` (runs before location seeding).
- **Frontend** `apps/web-admin`: `lib/erp-ac.ts` (client ac+roles from the
  shared catalog), `organizationClient({ ac, roles })` in `auth-client.ts`,
  `permissions.ts` types from shared vocabulary, `use-permission.tsx`
  org-aware `usePermission`/`Can`/`useOrganizations`/`switchOrganization`,
  sidebar nav migrated to the new permission strings. `vite build` passes.
- **Tests** (`apps/backend/test/authorization/`, bun:test, offline):
  - `permission-matrix.test.ts` (18): all 18 roles defined; owner full;
    org-admin no payroll/payments/secrets; member baseline; sales
    create-not-approve; finance no HR; hr no approve/execute; auditor
    read-only; technician/freelancer scoping; portal-only roles; marketing
    restrictions; multi-role union; deny-by-default.
  - `authorization.test.ts` (24, real Elysia `app.handle()` with auth+DB
    mocked at seams): 401s; global-admin-no-membership; owner permissions;
    member baseline; sales create permitted + approve denied (permission);
    technician denied; cross-org read/FK rejection (404/403); org-context
    header mismatch; multi-role self-approval blocked in service;
    missing-approval-config denial; payment execute-before-approval (422);
    self-execution blocked; revoked membership denied; multi-permission
    checks.
- **Docs**: `security-and-access.md` rewritten (two layers, where things
  live, route/query/how-to guides, approvals, escalation, audit, cache,
  seeding, gaps); ADR-0006 added.
- **Verified commands (2026-10-29, from repo root unless noted)**:
  - `bun run lint` → 3 tasks successful (remaining warnings pre-existing)
  - `bun run test` → 2 tasks successful; backend 54 pass / 0 fail
  - `bun run typecheck` → 2 tasks successful
  - `bunx tsc -b` (apps/web-admin) → pass; `bun run build` (web-admin) → pass
  - `bunx drizzle-kit generate` (apps/backend) → append-only migration
    generated & inspected (sales schema + username columns)
  - `bun run build` (packages/common) → pass
- NOT yet verified (needs disposable DB / running server): `drizzle:migrate`
  against a real database, live login/cookie flow through the mounted auth
  handler, seeder execution against a real DB. These remain Phase 2 exit
  items.

## Completed (follow-up - runtime verification, 2026-10-29)

- **drizzle-kit driver fix**: migrate/push/generate/studio scripts in
  `apps/backend/package.json` now run under the Bun runtime
  (`bunx --bun drizzle-kit ...`) - the DB uses `drizzle-orm/bun-sql`, and
  drizzle-kit otherwise resolves no DB driver and exits with "please install
  either of 'pg', 'postgres', 'bun'...". Documented pattern; use the same
  prefix for any new drizzle-kit script.
- **Auth seeder corrected**: `auth.api.listUsers` requires an authenticated
  session (admin endpoint), so the seeder now checks existence via Drizzle
  (`drizzle/schemas/auth.schema.ts` users table) and creates via
  `auth.api.createUser` with inline `password` (single call; no
  `setUserPassword` follow-up needed).
- **Verified against the real dev DB (2026-10-29)**:
  - `bun run drizzle:migrate` → migrations applied successfully
    (sales schema + username columns).
  - `bun run drizzle:seed` → initial admin created
    (`admin@example.com`, global role `admin`, username `admin`) + location
    seeding; second run skipped the admin ("password NOT reset") →
    idempotency confirmed by running twice.
  - DB row verified: user has role=admin, username/displayUsername set.
  - Live Better Auth flow via `auth.api`: `signInEmail` with seeded
    credentials → 200 + `better-auth.session_token` cookie issued;
    wrong password → `UNAUTHORIZED`.
- Remaining Phase 2 exit item: boot `bun dev` and exercise cookie-based
  requests through the HTTP-mounted handler + `erpGuard` end-to-end
  (server-side `auth.api` verification above covers the credential/session
  path; HTTP cookie round-trip still pending).

## Completed (follow-up - login wiring + live HTTP verification, 2026-10-29)

- **Trusted origins** (`options/social-providers.auth.ts` +
  `auth.options.ts`): `trustedOrigins` now includes the app URL and
  `http://localhost:5173` (web-admin dev server). Without it, Better Auth's
  origin check rejects state-changing requests (`MISSING_OR_NULL_ORIGIN` /
  `INVALID_ORIGIN`) - sign-in itself worked but `set-active` did not.
- **Frontend login wired** (`apps/web-admin`):
  - `components/form/login-form.tsx` - was a static placeholder; now calls
    `authClient.signIn.email`, shows backend error messages, disables
    submit while pending, redirects to `/` on success.
  - `routes/_authed.tsx` - new authenticated layout route; `beforeLoad`
    calls `getSession()` (backend-authoritative) and redirects to `/login`
    when no session.
  - `routes/_authed.index.tsx` - moved from `index.tsx` under the guard;
    route tree regenerated (`routeTree.gen.ts`).
  - web-admin `tsc -b` + `vite build` pass.
- **Live HTTP verification (bun dev on :3000, real requests)**:
  - `POST /api/auth/sign-in/email` (correct creds) → 200 + session cookie.
  - `GET /sales/quotations` without cookie → **401** (guard rejects before
    handler); with cookie but no org membership (seeded global admin) →
    **403** ("Organization context required") - global admin ≠ ERP access
    confirmed over real HTTP.
  - `POST /api/auth/organization/set-active` (origin included) → 200;
    `get-session` shows `activeOrganizationId`.
  - `POST /sales/quotations` as org member (owner role) → **201**;
    `GET` list → **200** (tenant-scoped row visible, `erp` context logged:
    organizationId/member.role resolved server-side).
  - Foreign `x-organization-id` header with valid session → **403**
    ("Organization membership required").
  - Submit own quotation (200) then attempt own approval → **403**
    ("Self-approval is not allowed") - SoD enforced over live HTTP.
  - Wrong-password sign-in → 401 rejected.
- Dev server stopped after verification. Backend typecheck + 54 tests +
  web-admin typecheck all pass after changes.

## Completed (this session - backend unit tests + husky pre-commit, 2026-10-28)

- New local skill `bun-test` (`.agents/skills/bun-test/`, recorded in
  `skills.md`): bun:test conventions — mock() / mock.module(), Drizzle DB and
  Bun RedisClient always mocked via constructor injection, never real
  connections or connection strings. Reference: https://bun.com/docs/test.
- `apps/backend`: `"test": "bun test"`, `"lint": "oxlint"` added;
  `bunfig.toml` (test root `test/`, preload `test/preload.ts` importing
  `reflect-metadata` for tsyringe under the test runtime).
- Shared mock helpers `test/helpers/mock-db.ts`: chainable Drizzle query
  builder mock (captures calls, resolves configured rows/count, supports
  paginate-style count→rows alternation) and Redis mock (in-memory store,
  TTL capture, deletion).
- Unit tests (11, all offline, no network):
  - `test/unit/location.service.test.ts` — pass-through delegation to the 4
    repository interfaces, null propagation.
  - `test/unit/province.repository.test.ts` — cache-aside (miss→DB→set with
    300s TTL, hit skips DB), cached `null` short-circuit, soft-delete `where`
    applied, create invalidates list+id cache keys.
- `apps/backend` gained devDependency `reflect-metadata` + `oxlint`.
- `.husky/pre-commit` uncommented: `bun run lint` + `bun run test` (`build`
  stays commented — too slow for a hook). Turbo `test` task set
  `cache: false` so cached PASS cannot mask stale state.
- Verified (exact commands, from repo root):
  - `bun run lint` → 3 tasks successful
  - `bun run test` → 2 tasks successful; `apps/backend`: 11 pass / 0 fail
  - `bun test` in `apps/backend` run twice → identical pass (idempotent)
  - Remaining oxlint warnings are pre-existing (empty stub files, unused
    stub params in `src/app/user`, `src/providers/better-auth`); no
    warnings in new test files.
- User scope decision: database and Redis are **mocked**, not real, in this
  slice; repository integration tests against disposable Postgres remain a
  documented future layer (see `testing-strategy.md`).

- New local skill `nestjs-layered-architecture` (`.agents/skills/` +
  `.claude/skills/` mirror, recorded in `skills.md`): module layout, layer
  rules, DTO/contract patterns, soft-delete + cache repository patterns from
  `modules/user/`.
- Cross-feature isolation rule (modular monolith) added to that skill,
  `architecture.md` (module rules + ERP schema ownership), and root
  `AGENTS.md` hard rules: each feature module owns a Postgres schema
  (`customer.*`, `sales.*`, ...), no cross-feature FKs/joins/table imports,
  cross-module access only via exported `External<X>Service` facade; Better
  Auth `auth-schema` tables are the explicit shared-infrastructure exception
  (existing `erp.audit_logs.actor_id → auth users.id` FK allowed). Stop
  growing the shared `erp` schema; migrate existing feature tables as each
  feature is built.
- Audit evidence: only cross-boundary DB references found are
  `erp-schema.ts` → `auth-schema.ts` (`auditLogs.actorId` FK +
  `erpRelations`); module repositories each import only their own domain's
  schema. No violations beyond the documented exceptions.
- No code was changed; no database touched.

- Audited the repository (see `project-audit.md`) — evidence-based
  classification of all modules, with baseline commands executed.
- Wrote this documentation set: `README.md`, `project-audit.md`,
  `stack-compatibility.md`, `skills.md`, `architecture.md`, `domain-map.md`,
  `data-model.md`, `api-conventions.md`, `security-and-access.md`,
  `plan.md`, `backlog.md`, `testing-strategy.md`, `runbook.md`,
  `decisions/ADR-0001..0005`, `phases/phase-1..7` — plus rewrote root
  `AGENTS.md` (Turborepo managed block preserved).
- Pin decisions recorded: ADR-0001 (one company, internal multi-organization),
  ADR-0002 (money = integer IDR minor units), ADR-0003 (structured Indonesian
  address references), ADR-0004 (Relational v2), ADR-0005 (drizzle client DI).
- No code was changed; no skills installed; no database touched.

## Partially done (pre-existing, not touched this session)

- `user` domain: repository is complete and documented; controller/service are
  stubs; 2 specs failing.
- `customer` domain: schema/migration real; code scaffold-level.
- Auth: configuration complete; runtime unverified.

## Blocked

- ERP-0003 runtime sign-off needs a real dev server + DB (available locally —
  unblocked for next session, pending execution).

## Latest checks (exact commands, 2026-10-25)

| Command (cwd) | Outcome |
|---|---|
| `bun run lint` (apps/backend) | pass, 6 warnings (empty `role-permission.ts`, unused imports/params) |
| `bunx vitest run` (apps/backend) | 7 failed / 25 passed files; 2 failed / 25 passed tests — all pre-existing; causes in `project-audit.md` |
| `bun run test` (repo root) | fail (backend red) |

## Latest checks (exact commands, 2026-10-27)

| Command (cwd) | Outcome |
|---|---|
| `bun run lint` (apps/backend) | pass, warnings (empty files, unused vars — pre-existing set) |
| `bunx vitest run` (apps/backend) | **no spec files found** — all `src/**/*.spec.ts` gone from tree since 2026-10-25 baseline (only `test/app.e2e-spec.ts` remains, needs e2e config). Not caused by Dockerfile work. |
| `bunx tsc -p tsconfig.build.json` (apps/backend) | pass; grep of fresh `dist/` shows zero `@providers/@config/@modules` alias imports |
| `docker build -f apps/backend/Dockerfile .` (repo root) | **blocked** — Docker daemon not running during session; image build unverified |

### Dockerfile slice (2026-10-27)

- Wrote `apps/backend/Dockerfile` (bun 1.4-alpine multi-stage: deps →
  `nest build` → prod-only runtime, non-root `USER bun`, port 3000) +
  `apps/backend/Dockerfile.dockerignore`.
- Replaced 3 `@providers/...` alias imports with relative paths
  (`bootstrap.module.ts`, `mail-queue.service.ts`, `mail.processor.ts`) so
  compiled `dist/` resolves at runtime.
- `config.loader.ts`: missing `.env` (ENOENT) no longer throws — compose
  injects env vars; avoids hard dependency on a `.env` file in containers.
- Image build + container boot **verified** (2026-10-27):
  `docker build -f apps/backend/Dockerfile .` succeeds; running the image
  with env-only config bootstraps all Nest modules (no `.env`, no aliases in
  `dist/`, decorator DI works under Bun). Full compose boot against real
  Postgres/Redis still unverified. Dockerfile gotchas fixed during build:
  `!apps/web-admin/package.json` needed in dockerignore (lockfile lists all
  workspaces), `--ignore-scripts` needed (root `prepare: husky` fails in
  prod-only install), runtime must `COPY --from=build` (not host `dist/`).

## Session 2026-10-28 — backend-nest removal

- Deleted `apps/backend-nest/` (package `backend`) entirely; `bun install`
  regenerated `bun.lock` (workspace + `backend@workspace` entries gone).
- Removed `backend` from docker matrix in `.github/workflows/build-main.yml`
  and `deploy-main.yml`; removed the `test-backend` job from `build-main.yml`.
- Removed `backend` service from `docker-compose.yml` and
  `docker-compose.override.yml`; `web-admin` no longer depends on it.
- Deleted NestJS skills (`nestjs-best-practices`, `nestjs-better-auth`,
  `nestjs-drizzle`, `nestjs-layered-architecture`) from `.agents/skills/` +
  `.claude/skills/`; removed lock entry from `skills-lock.json`.
- Updated `drizzle-unix-timestamp` / `drizzle-soft-deletes` skills: canonical
  path now `apps/backend-elysia/drizzle/datatypes/unix-timestamp.ts`.
- Rewrote docs around `apps/backend-elysia`: `AGENTS.md`, `architecture.md`,
  `api-conventions.md`, `stack-compatibility.md`, `runbook.md`,
  `testing-strategy.md`, `modules/README.md`; marked ADR-0005 superseded;
  added historical notes to `project-audit.md` and `modules/*.md`; fixed
  `apps/web-admin/src/lib/permissions.ts` header comment.
- Commands run: `bun install` (clean, 16 packages); no tests/typecheck run
  (backend-elysia has no test script yet).
- Follow-up tasks created: backend-elysia Dockerfile + compose service, CI
  test job for elysia, authorization core port to elysia.

## 2026-10-31 - Docs sync: AGENTS.md, runbook.md, architecture.md

No code changed; docs only. Reconciled with README.md, package scripts, and
verified history in this file.

- `AGENTS.md`: Drizzle driver corrected to `drizzle-orm/bun-sql` (was
  `node-postgres`). Command table updated to verified reality: `bun install`,
  `bun run dev` (`turbo run dev`, not `start:dev`), lint/test/typecheck,
  `drizzle:generate|migrate|seed` (all `bunx --bun drizzle-kit`). New hard
  rule: never run `auth:generate` (1.4.x CLI regresses `auth.schema.ts`;
  hand-written append-only deltas instead). Reading order now includes
  `stack-compatibility.md` and `modules/`.
- `runbook.md`: stale `apps/backend-elysia` paths → `apps/backend`; command
  statuses flipped from proposed to verified with dates; `auth:generate`
  removed with explanation; Docker section updated (compose now has
  backend + web-admin services; source-build Dockerfile still open backlog).
- `architecture.md`: backend path fixed; `auth` schema bullet now documents
  the `auth:generate` regression caveat.

## Next executable task

**Customer slice (ERP-0002/3/4/5)** — HTTP bring-up is done (verified
2026-10-29); continue applying the `erp` macro + scoping patterns from
`security-and-access.md`. Also open: backend source-build Dockerfile + CI test
job polish.

## Completed - Better Auth secondary storage (Redis), 2026-10-29

- options/secondary-storage.auth.ts: adapter implementing Better Auth's
  full SecondaryStorage contract (get / getAndDelete / increment / set /
  delete) over the shared Bun RedisClient. Keys prefixed etter-auth:;
  TTLs in seconds (setex); GETDEL for atomic getAndDelete; INCR+EXPIRE on
  first increment only (fixed-window rate-limit contract). Fail closed:
  errors logged via betterAuthLogger and re-thrown.
- uth.options.ts: secondaryStorage wired; session.storeSessionInDatabase:
  false (Redis-only sessions); session.cookieCache enabled, 5-min maxAge.
- Live verification (bun dev + real Redis on :6379): sign-in 200; Redis holds
  etter-auth:<token> + etter-auth:active-sessions-<userId> (7d TTL);
  NO new Postgres session rows after sign-in (DB rows pre-switch are legacy);
  cookie cache active (etter-auth.session_data cookie; repeat get-session
  55ms -> 12ms); sign-out 200 then get-session -> null; 7 adapter unit tests
  pass with mocked RedisClient seam; suite 61 pass / 0 fail; typecheck clean.

## 2026-10-30 - Database documentation consolidated into docs/database/

Status: implemented (design docs; no live DB touched).

- DB docs moved out of apps/backend/database and .agents/docs/database into
  docs/database/ (repo root): docs.dbml (canonical persistence contract),
  5 companion MDs, validate-dbml.ts, gen-logical-references.ts. Only
  migrations/, seeders/, migrate-reset.ts remain in apps/backend/database.
- Identity module folded: 6 ERP extension tables now live in the auth schema
  (auth.user_profiles, user_role_assignments, portal_identities,
  user_preferences, identity_verifications, user_devices) alongside the 9
  Better Auth core tables. No identity schema exists.
- org schema renamed to organization (9 tables, 6 refs). Organization master
  remains auth.organizations (Better Auth).
- Deleted docs.generated.sql (throwaway validator export) and
  postgresql-constraints.sql (superseded: constraints are specified for
  direct implementation in the Drizzle schemas; see S7 in
  docs/database/implementation-phases.md for the 85/197/45 inventory).
- Validation (docs/database/validate-dbml.ts, bun + @dbml/core): parsed 251
  tables, 218 refs, 0 cross-module, 0 timestamp gaps, OK. logical-references
  regenerated: 529 logical refs, 36 targets.
- Skills dbml-database-docs (.agents + .claude copies) updated to the new
  docs/database/docs.dbml path.
- Not verified: nothing applied to any database; the DBML remains a design
  reference for hand-written Drizzle schemas.
