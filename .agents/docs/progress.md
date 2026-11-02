# Progress

Latest verified state. Update this file every working session, including
exact commands and outcomes. `progress.md` lies are worse than missing code.

## Doc change — feature module lifecycle gate (2026-11-02)

Instructions-only change; no code, schema, migration, or seed was touched.
Status: **implemented** (not `verified` — nobody has yet confirmed an agent
follows the new gate end to end).

- **`AGENTS.md`**: new `## Feature module lifecycle` section between `##
Backend` and `## Internationalization`. Every backend feature work item —
  and specifically creating / updating / deleting `apps/backend/src/app/<module>/`
  — must (1) read `docs/database/` in the `erp-database-schema` protocol order,
  (2) run the `.agents/skills/grill-me` design interview before writing code,
  and (3) update `docs/database/` afterwards **when required** (table / column /
  index / constraint change, new cross-module logical reference, or a
  status / money / quantity / date / lifecycle rule change). Sync-back order is
  `docs.dbml` → `gen-logical-references.ts` → `validate-dbml.ts`.
- **`AGENTS.md`** `## Definition of done`: items 8–10 added (gates respected,
  `docs.dbml` updated-or-recorded + validator `OK`, module deletion leaves no
  orphans).
- **`AGENTS.md`** `## How to update these docs`: paragraph making
  `docs/database/` a same-change obligation, canonical over Drizzle.
- **`.agents/docs/README.md`**: named the 5 companion MDs explicitly (the count
  was right; the list was implicit) and pointed at the new gate.
  **Correction:** an earlier edit in this same change bumped the count to "6"
  on the assumption `implementation-phases.md` was uncounted. It was not —
  `docs/database/` has exactly 5 MDs, and the "6" was wrong. Reverted.
- **`.agents/docs/skills.md`**: `grill-me` added to the inventory as
  *present, not in lock*, with the honest caveat that its `SKILL.md` delegates
  to a `grilling` skill **that is not installed**.

Verification actually run:

```text
Select-String docs/database/docs.dbml -Pattern '^// MODULE:'   → 26 markers
Test-Path .agents/skills/grilling                              → False (absent, as documented)
bun docs/database/validate-dbml.ts                             → parsed: 253 tables, 0 standalone refs
                                                                  cross-module refs: 0
                                                                  timestamp gaps: 0
                                                                  OK   (exit 0)
```

`docs/database/` needed no change under the new rule: no table, column, index,
constraint, logical reference, or status vocabulary was modified. Noted here
rather than silently skipped.

Known inaccuracy left in place, flagged not fixed: the new `## Feature module
lifecycle` section describes the contract as 253 tables, the verified parser
count; `docs/database/module-ownership.md`, `implementation-phases.md` and the
`validate-dbml.ts` header comment still say **251** (`progress.md` line 481 above
already recorded 253). The count is not the contract — a follow-up docs pass
should reconcile 251 → 253 across the companions in one place.

Also verified while checking: `gen-logical-references.ts` writes
`logical-references.md` from `docs.dbml` using **absolute** paths
(`B:/ims/erp/...`), as does `validate-dbml.ts`. Neither script had to run in
this change (`docs/database/` was unchanged), so this was not exercised; the
hardcoded root is a portability defect worth fixing separately.

## Completed (this session — backend tidy-up W1–W4, 2026-11-02)

Conformance pass against the `/elysia-module`, `/elysia-tsyringe`,
`/elysia-layered-architecture` and `/tsyringe` skills. Waves W1–W9 done;
W8 (docs pass) complete. **URLs changed** — backend and web-admin moved
together, nothing pushed.

Remaining known follow-up (deliberately deferred, not forgotten): the
`user-management` **repositories/contracts/tokens** have not yet been merged
into `user`; `user-management/container.ts` is the seam.

### W1 — DI tokens have one home (`03625fc`)

- `src/di/tokens.ts` is the single definition site for `DRIZZLE_TOKEN` and
  `REDIS_TOKEN`; `provider.ts` imports and re-exports them (pure alias, never
  a second `Symbol(...)` call), so modules needing only a token avoid pulling
  the Drizzle/Redis clients into their import chain.
- `organization/containers/organization.container.ts` → `organization/container.ts`
  (matches every other module); its imports changed `../x` → `./x`.
- Deleted 0-byte dead files: `src/contracts/repositories/repository.interface.ts`
  (and the now-empty `src/contracts/` dir) plus five unused drizzle schemas
  (`warehouse`, `inventory`, `employee`, `document`, `project`).

### W2 — no SQL in services (`03625fc`)

- Deleted `user-management/services/role.service.ts`; `findMemberRole` folded
  into `RoleRepository` + `IRoleRepository`, and `InvitationService` now
  injects `ROLE_REPOSITORY_TOKEN` — it was the only reason the service held a
  Drizzle handle.
- `TAuditEntry` moved to `contracts/repositories.interface.ts` (it is the
  repository's write DTO); `AuditRepository.insert()` added; `AuditService`
  now goes through `AUDIT_REPOSITORY_TOKEN` + `pinoLogger`.
- Gate: `Select-String -Path src/app/*/services/*.ts -Pattern DRIZZLE_TOKEN`
  → **CLEAN, no service injects the DB**.

### W3 — one shared HTTP layer (`c9d8cd3`, `69f53e9`)

New `src/http/` with `response.ts` (`buildMeta`/`ok`/`created`/`noContent`/
`okPaginated`/`errorEnvelope`), `errors.ts` (`AppError`, `DomainHttpError`,
`NotGlobalAdminError`, `toErrorResponse`) and `plugin.ts`
(`domainPlugin({name, prefix, tags, guards})`). All six controllers migrated.

- Six hand-rolled envelope copies had drifted apart: two controllers
  hand-built the 201 body because only one had a `created()` helper, and
  `okPaginated` had two incompatible signatures.
- Success envelopes deliberately **omit** `errors` (matching what most
  controllers shipped) while `errorEnvelope` always carries it; `noContent()`
  stays **200**, not 204, so existing client parsing is unaffected.
- `UserManagementError` now extends `AppError`; `NotGlobalAdminError` was
  declared privately and identically in three controllers and is now one class.
- **Bug fixed**: `createPayment` threw a bare 404 meaning "referenced
  quotation not found", and the controller re-labelled every `SalesStateError`
  404 as `sales.quotationNotFound` — telling the client the wrong resource was
  missing. New `ReferencedQuotationNotFoundError` + a dedicated onError arm.
- `QuotationRepository.list` now returns `TPaginationResult<T>` (was
  `{data,total}`, which forced the controller to hand-compute `totalPages`).
- `test/unit/http-response.test.ts` (7 tests) pins the wire shapes.

### W4 — `/admin` URL restructure (`69f53e9`)

| Surface | Before | After |
|---|---|---|
| Admin accounts | `/users` | `/admin/users` |
| Roles / catalog | `/roles`, `/roles/permissions` | `/admin/roles`, `/admin/roles/permissions` |
| Audit trail | `/audit` | `/admin/audit` |
| Invitation admin | `/invitations` | `/admin/invitations` |
| Self profile | `/users/me`, `/users/me/avatar` | unchanged |
| Public claim | `/invitations/claim/:token` | unchanged |
| Username check | `/users/username-available` | `/username-availability` |

- `OrganizationController` split into
  `organization/controllers/{organization,organization-bootstrap}.controller.ts`
  (`routes/` dir removed, matching every other module).
- `InvitationClaimController` extracted so the public, sessionless claim flow
  no longer shares a plugin with the admin-gated invitation routes;
  `UsernameCheckController` moved off `/users/username-available`, which
  collided with `UserController`'s `/:userId` parameter route.
- `src/index.ts`: the mount-order comment is gone — with the `/admin` prefix
  the old `GET /users` collision cannot recur, so ordering no longer matters.
- **SECURITY FIX (found while migrating)**: `GET /users/:userId` was declared
  `erp: {}` — no permission at all. `auth.users` is Better Auth-owned and has
  no organization column, so **any authenticated member could read any user's
  profile across tenants**. Now `{ erp: { policy: requireGlobalAdmin } }`,
  matching every other route on that controller. No web-admin consumer of the
  id lookup existed to break.
- web-admin: `lib/admin-api.ts` paths, both sidebars (`nav-admin.tsx` and the
  unused `sidebar.tsx`), routes moved `_authed/{users,roles,audit}` →
  `_authed/admin/*`, `routeTree.gen.ts` regenerated by the TanStack router
  Vite plugin during `bun run build` (no dev server needed).
- `scripts/smoke-admin-api.ts`: 23 endpoint references updated + 2 new checks
  for the `/users/:userId` guard.

### W5 — typed DI tokens (`94a43fc`)

`sales` and `organization` were the last two modules on bare `Symbol(...)`.
Both now declare `InjectionToken<T>`, so `container.register(TOKEN, {useClass})`
type-checks the implementation against its contract and `resolve<T>(TOKEN)`
infers `T` instead of `unknown`.

Typing the tokens immediately caught **two real defects** in
`test/authorization/test-app.ts`, both invisible while the tokens were `any`:

1. The sales fakes were loose object literals registered via `useValue` — they
   compiled only because nothing checked them against the repository contracts.
2. The quotation fake's `list()` still returned the **pre-refactor**
   `{ total, data }` shape, while `QuotationRepository.list` had moved to
   `TPaginationResult<T>` in W3. The fake was silently stale.

Both fakes are now annotated with the real contract types.

### W6 — audit module extracted (`94a43fc`)

New `src/app/audit/`: `container.ts`, `index.ts`,
`contracts/{audit.repository.interface,audit.contract}.ts`, `constants/di.ts`,
`repositories/audit.repository.ts`,
`services/{audit,audit-query}.service.ts`, `controllers/audit.controller.ts`.

- The ledger is cross-cutting — every module writes to it — while
  `user-management` only happened to be its first writer. Moving it gives
  future modules a module to inject instead of reaching into user-management.
- `GET /admin/audit` moved out of `UserAdminController` into a dedicated
  `AuditController.plugin()`.
- Direction of dependency preserved: user-management services still inject
  `AUDIT_SERVICE_TOKEN` (modules own their events, audit owns the ledger).
- Audit types (`auditQuerySchema`, `TAuditQuery`, `TAdminAudit`,
  `TAuditEntry`, `IAuditRepository`) removed from
  `user-management/contracts/` and `constants/di.ts`.

### W7 — user-management services merged into `user`

The seven service files moved `user-management/services/` →
`user/services/`: `invitation.service.ts`, `role-management.service.ts`,
`user-admin.service.ts`, `invitation.errors.ts`,
`better-auth-user-management.gateway.ts`, `logger-mailer.ts`, `token.ts`.
**Repositories, contracts and tokens stay in `user-management`** — the
repository merge was deliberately deferred, so `user-management/container.ts`
is now the documented seam where the two halves still meet.

- **Dead code removed**: `paginationQuerySchema`, `TPaginationQuery`,
  `userQuerySchema` and `TUserQuery` in
  `user/contracts/user.contract.ts` had **zero consumers** and collided by name
  with the live pair in `user-management/contracts/admin.contract.ts` (which is
  what `GET /admin/users` actually parses). The dead pair is gone, which also
  removed the name collision the merge would otherwise have created.
- **CACHE-INVALIDATION BUG FIXED.** `UserRepository` caches `auth.users` rows
  in Redis for 300s (`user:id:<id>`, `user:all`), but
  `UserManagementRepository` — the admin lifecycle path — wrote `status` and
  `deletedAt` to the same table **without evicting anything**. Consequences
  before the fix: a soft-deleted user kept serving from the cache on the
  self-service read path for up to 5 minutes, and a deactivated user read back
  as `active`.
  - New `src/app/user/constants/cache.ts` defines the shared key layout
    (`USER_CACHE_PREFIX`, `USER_CACHE_TTL_SECONDS`, `userListCacheKey()`,
    `userCacheKey()`); **both** repositories import it, so the keys cannot drift.
  - `UserManagementRepository` now injects `REDIS_TOKEN` and calls
    `invalidate(id)` after `createPendingUser`, `setStatus`, `setClaimed`,
    `delete`, `restore` and `reactivate`.
  - Proven live by `scripts/smoke-cache-invalidation.ts` (9 checks):
    deactivate → `GET /users/:id` immediately reports `deactivated`; restore →
    immediately `active`; soft delete → immediately **404**. The script restores
    its fixture, so it is safe to re-run.

### Verification (all run this session)

- `apps/backend`: `bunx tsc --noEmit` → exit 0; `bun test` → **131 pass,
  0 fail**; `bunx oxlint` → 0 errors, 4 pre-existing warnings (no new ones).
- `apps/web-admin`: `bun run build` (tsc -b + vite) → clean, admin routes
  code-split; `bun test` → **21 pass, 0 fail**.
- repo root: `bun run test` → 4/4 turbo tasks successful.
- **Live smoke** (`bun run scripts/smoke-admin-api.ts` against backend :3001):
  **18 passed, 0 failed**, stable across repeated runs.
- **Live cache probe** (`bun run scripts/smoke-cache-invalidation.ts`):
  **9 passed, 0 failed**, idempotent across repeat runs.
- Manual probes: `/username-availability` → 200; anon `/admin/users`,
  `/users/me` → 401; anon `/invitations/claim/<bad>` → 422.

### W9 — controller mounting moved to `src/app/app.ts`

`src/index.ts` no longer mounts controllers. It keeps the `register*`
container calls, the i18n/CORS/logger plugins, `.listen()` and the avatar
worker; `src/app/app.ts` owns every `.use(<Module>Controller.plugin())`
inside an exported **`createApp()` factory**. A factory, not a module-level
`const app`, because controllers resolve inside `plugin()`: an eager
instance would build at import time and make correctness depend on hoisted
import order between `app.ts` and `index.ts`.

`app.ts` also hoists the two `await OpenAPI.*` calls to a module-level
`betterAuthOpenApiDocument` so `/docs` stays a static snapshot while
`createApp()` remains synchronous.

**Corrected a wrong skill rule.** The `tsyringe` skill claimed "the current
codebase imports no `reflect-metadata` and injection works. Do not add the
polyfill speculatively". Removing the import to follow it crashed boot:

```
error: tsyringe requires a reflect polyfill. Please add 'import "reflect-metadata"'
to the top of your entry point.
  at node_modules/tsyringe/dist/cjs/index.js:5:15
```

tsyringe's CJS entry asserts `Reflect.getMetadata` at load; Bun's native
`design:paramtypes` emission does not define it, so the guard fires on Bun
too. The import is restored with a comment, and both skills now document the
real mechanism instead of the "Bun needs no polyfill" myth.

Skill bumps: `elysia-tsyringe` 1.0.0 → **1.1.0** (mount split + rule 2.5
correction), `elysia-module` 1.1.0 → **1.2.0** (checklist §3.6 split),
`tsyringe` 1.0.0 → **1.1.0** (rule 2.1 correction). Recorded in `skills.md`.

Verification after the change: `bunx tsc --noEmit` → exit 0; `bun test` →
**131 pass, 0 fail**; `bunx oxlint` → 0 errors, same 4 pre-existing warnings;
`smoke-admin-api.ts` → **18/18**; `smoke-cache-invalidation.ts` → **9/9**;
`/docs` → 200, anon `/users/me` and `/admin/users` → 401.

### W10 — avatar worker lifecycle owned by the user module

`src/index.ts` imported `./app/user/queues/avatar.worker` — the user module's
*internals* — and owned the worker's lifecycle (`.on('error')`, `.close()`,
SIGTERM). `app/user/` could not be lifted out without editing the composition
root.

Fixed without moving any file (the worker already lived in
`app/user/queues/`):

- `app/user/queues/avatar.worker.ts` — `startAvatarWorker()` now returns an
  `AvatarWorkerHandle` (`onError`, `close`) instead of a raw BullMQ `Worker`.
  The BullMQ event name, shutdown order and `Worker` type stay inside the
  module; `index.ts` no longer depends on BullMQ at all.
- `app/user/index.ts` (new) — public entry re-exporting `registerUser`,
  `startAvatarWorker`, `AvatarWorkerHandle` and `avatarUserCreateHook`.
  `index.ts` now imports `./app/user`, mirroring `./app/audit`.
- `src/index.ts` — imports `{ registerUser, startAvatarWorker } from './app/user'`;
  also removed a duplicated JSDoc block above `const bootstrap` left by W9.

**Rejected:** a `src/app/queue-worker.ts` with a generic `startBullQueue()`
mounted in `app/app.ts`. `app.ts` builds the HTTP app and returns an `Elysia`;
a worker returns a process handle with deliberately **non-fatal** failure
semantics. Merging them would repeat the mistake W9 undid, one layer up.

`closeQueueConnection()` deliberately stays in `index.ts`: the queue
connection is a shared provider, not the avatar worker's to close.

**`docs/database/` reviewed, unchanged.** No table, column, index, constraint,
cross-module reference or status vocabulary changed. The only column written is
`auth.users.avatar_object_key` (already canonical at `docs.dbml:512`).
`bun docs/database/validate-dbml.ts` → `parsed: 253 tables`, `cross-module
refs: 0`, `timestamp gaps: 0`, `OK`, exit 0.

`grill-me` gate: its `grilling` dependency is not installed in this repo, so the
manual pass was run. Ownership → module owns worker lifecycle (above); tenant
scoping / soft delete / money / datetime / status vocabulary / cross-module
contracts → all unaffected by a lifecycle refactor.

Skill: `elysia-module` 1.2.0 → **1.3.0** (§3.6 gained a worker-handle step and
the "do not mount workers on `app/app.ts`" rule); `elysia-layered-architecture`
1.1.0 → **1.2.0** (rule 1.2 reference now states the lifecycle contract).

Verification: `bunx tsc --noEmit` → exit 0; `bun test` → **131 pass, 0 fail**;
`bunx oxlint` → 0 errors, same 4 pre-existing warnings; `smoke-admin-api.ts` →
**18/18**; `smoke-cache-invalidation.ts` → **9/9**; `/docs` → 200, anon
`/users/me` → 401.

## Completed (this session — multi-organization, 2026-11-02)

ADR: `.agents/docs/decisions/ADR-0007-multi-organization.md` (supersedes the
single-organization reading of ADR-0001; the "one company" decision stands).
Root cause of the reported `422 "An organization already exists; only one is
allowed"`: `OrganizationService.createOrganization` enforced a literal
single-org invariant that ADR-0001 never required.

- **Removed** `OrganizationAlreadyExistsError` + `existsAny()` (repository,
  interface, service) and the controller's 422 mapping/swagger text.
- **`organization.auth.ts`** — `allowUserToCreateOrganization: (user) =>
  user.role === GLOBAL_ADMIN_ROLE` (defense-in-depth behind the HTTP gate;
  skipped by Better Auth for server-side `userId` creates, so seeders work).
- **`createOrganization`** now forwards caller headers, so Better Auth
  enforces the admin gate AND activates the new org for that session; the
  creator becomes `owner` (`crud-org.mjs` behavior, verified live).
- **Role provisioning** — `seedRolesForOrganization(organizationId)` extracted
  from `organization-roles.seeder.ts` and called on every create (best-effort,
  logs on failure) so API-created orgs get the real `auth.roles` catalog
  instead of silently falling back to the static catalog.
- **Last-org guard** — `LastOrganizationError` (409) via
  `repository.countActive()`. Because delete is a SOFT delete, Better Auth's
  own session cleanup never runs, so `deleteOrganization(headers, id)` also
  calls `gateway.setActive(headers, null)` to release the caller.
- **Controller split (option a)** — `OrganizationBootstrapController.plugin()`
  owns `POST /organizations` on `sessionGuard()` + `requireGlobalAdmin`, so a
  membershipless app admin can bootstrap the first org; every other route
  stays on `erpGuard`. `sessionGuard`'s `erpSession` macro gained an optional
  `policy` hook (and kept the existing `{ session: true }` flag form used by
  `user.controller.ts`).
- **Seeders** — `organization.seeder.ts` skips in `prod`/`production` (new
  `config/providers/env.ts` `isProductionEnv()`, first consumer of the
  never-read `instance.env`), keyed by slug via `ensureOrganization()`;
  `addSeedMembersTo(organizationId)` joins seeded accounts to any org; a
  missing org is now a no-op instead of throwing.
- **Frontend** — switcher lists ALL live orgs for app admins (first-party
  endpoint) and memberships otherwise; `useActiveOrganizationId()` dropped its
  `organizations[0]` fallback (cross-org leak) and returns `null`; create
  gated on `user.role === 'admin'`; stale single-org copy removed; create and
  switch invalidate `erp-organizations` + `erp-has-permission`.

Verification (2026-11-02):

- `bun run typecheck` clean (backend); `bunx tsc -b` clean (web-admin).
- `bun test` — backend 113 pass / 0 fail; web-admin 20 pass / 0 fail.
- `bun run database/seeders/index.ts` — idempotent, org-aware skip logs.
- Live smoke (server on :3001, seeded admin):
  - create 2nd org → **201** (was 422); new org auto-activated; 19 role rows
    provisioned in every org including API-created ones.
  - org owner (`admin_seed`, global role `user`) create → **403
    "Application administrator role required"**; anonymous → **401**.
  - **membershipless** global admin (0 `members` rows) create → **201**, own
    membership role `owner`, 19 roles provisioned — the bootstrap case works.
  - delete non-last org → 200 and the caller's `activeOrganizationId`
    switched off the deleted org; delete the final live org → **409**.
  - Test users/orgs removed afterwards; DB back to the single `entragate` org.

## Completed (this session - user-management phase 4: admin UI + admin API, 2026-11-01)

Plan: `.agents/docs/plans/user-management.md`. Phase 4 of 7 complete (backend +
admin UI; `/members` page enhancements + member role-change UI remain).

Backend — new surface, all gated by the phase-3 dynamic guard:

- `contracts/admin.contract.ts` — zod schemas for users/roles/audit.
  `createRoleSchema`/`updateRoleSchema` `rank` accepts **1..100** (was
  `max(99)`). Rationale: schema validation must not cap below a rank the
  escalation guard is responsible for rejecting — the guard, not the schema,
  is the authorization boundary. With `max(99)` an owner's `rank: 100` POST was
  rejected as a 400 *validation* error and the rank guard never ran.
- `repositories/role.repository.ts` — Drizzle role CRUD: list (with live
  member counts), findById/findByName/findByNameIncludingDeleted, create,
  update, softDelete, undelete, countMembers.
- `repositories/audit.repository.ts`, `services/audit-query.service.ts` —
  filterable audit reads (action, targetType, actor, org, from/to range;
  `created_at` is unix-seconds so ranges convert via
  `new Date(floor(ms/1000)*1000)`).
- `services/role-management.service.ts` — rank/escalation guard (target rank
  strictly below caller's), grant validation against the shared catalog
  vocabulary, system-role and in-use delete guards, soft-deleted name revive.
- `services/user-admin.service.ts` — deactivate (revokes sessions, keeps
  memberships), restore, soft delete, outrank checks.
- `controllers/user-admin.controller.ts` — `/admin/users`, `/admin/roles`,
  `/admin/roles/permissions`, `/admin/audit` (the `/admin` prefix arrived in
  the W4 tidy-up; see the top entry); `callerRank()` = highest live role rank
  in the validated org, with app-admin-without-dynamic-role ceiling 80 (never
  owner).
- Permission mapping: user list / role list / `/admin/roles/permissions` →
  `member:read`; role create → `member:create`; user+role update,
  deactivate/restore → `member:update`; delete → `member:delete`; audit list →
  `audit_log:read`.

Frontend (`apps/web-admin`) — UX-only gating, backend enforces everything:

- `lib/admin-api.ts` — users/roles/audit/invitations fetchers, `queryOptions`,
  `parseBulkInviteRows` (resolves pasted role *names* to ids; unknowns fall
  through to the backend's `member` fallback), `BULK_INVITE_LIMIT = 100`,
  `ADMIN_PERMISSIONS`.
- `lib/use-active-organization.ts` — resolves the active org from the session
  (the "first org" fallback was removed on 2026-11-02; it returns `null`
  instead, see the ADR-0007 entry at the top).
- Routes `/_authed/admin/users`, `/_authed/admin/roles`, `/_authed/admin/audit`
  (moved under `/admin` in the W4 tidy-up — see the entry at the top);
  components `admin/invite-dialog.tsx` (single + bulk paste),
  `admin/pending-invitations-panel.tsx` (expiry display, resend/cancel/delete).

### Bugs found and fixed this phase

1. **Double-encoded `owner` grants in the live DB.** `auth.roles.permissions`
   for the `owner` row was a JSON **string** (a serialized object stored
   through an extra `JSON.stringify`), i.e. `jsonb_typeof = 'string'` with 3786
   numeric-index keys. `grantsAllow()` iterates `Object.entries(grant)`, which
   on a string yields indices — so owner was denied **every** permission and
   all phase-4 endpoints 403'd. Repaired by `scripts/refresh-role-grants.ts`
   (`rolesUpdated: 1`). Hardened `sameGrants()` in
   `organization-roles.seeder.ts` to treat non-object/array values as drift so
   the ops script can self-heal this class of corruption.
2. **`GET /users` route shadowing + missing guard.** Two controllers register
   `GET /users`: the legacy `UserController` (prefix `/users`) and the new
   `UserAdminController`. With prefix-wrapped plugins the **FIRST** registration
   wins (verified: `new Elysia().use(prefixed).use(literal)` → prefixed handler
   answers; reversing swaps the winner). The legacy listing was also declared
   `erp: {}` — no permission — so **any authenticated member could enumerate
   the entire user base**. Fixed both: legacy `/` now uses
   `{ erp: { policy: requireGlobalAdmin } }` (matching every other route on
   that controller), and `UserAdminController.plugin()` is mounted **before**
   `UserController.plugin()` in `src/index.ts` so the permission-gated
   `member:read` listing wins.
   → **Superseded structurally** by the W4 `/admin` prefix (see the top entry):
   the admin listing is now `GET /admin/users`, so the two modules no longer
   register the same path and mount order is irrelevant. The legacy listing was
   subsequently removed outright, and the same class of hole on
   `GET /users/:userId` (bare `erp: {}`) was found and gated in W4.
3. **Revive path crashed with 500** (`undefined is not an object (evaluating
   'role.id')`). `RoleRepository.update()` filtered `.where(isNull(deletedAt))`,
   but `create()` revives a soft-deleted role by updating it *before*
   `undelete` — the predicate matched zero rows, `.returning()` yielded
   `undefined`, and the caller dereferenced it. Removed the `deletedAt`
   predicate from `update`; who may edit is decided by the service (rank guard,
   system-role rules), not by the query.
4. **React purity warnings** in `pending-invitations-panel.tsx` from calling
   `Date.now()` during render; moved "now" into a cached `useQuery`.
5. **`user.organizations` undefined in the admin users table** (runtime crash:
   `can't access property "length", user.organizations is undefined`).
   `GET /users` was still being answered by the *legacy* `UserController`
   handler, which returns bare user columns with no membership join. The two
   handlers do not actually collide: the legacy plugin is `prefix: '/users'`
   + `.get('/')`, so it registers the distinct path `/users/` while the admin
   controller registers `/users` — and Elysia serves `/users/` for a bare
   `/users` request. Reordering the mounts could never fix it (my earlier
   "first registration wins" note was measured on prefix-less toy plugins and
   is **wrong** for this case; the two routes simply never competed).
   Fixed by making the admin controller the single owner of the listing:
   the legacy `GET /users` handler (and its now-dead `okPaginated` helper and
   `userQuerySchema` import) was deleted. The users table also uses
   `user.organizations ?? []` defensively, and a unit test pins that the
   admin projection always emits the field.

   → **Superseded structurally** by the W4 `/admin` prefix (see the top
   entry). The admin listing is now `GET /admin/users` and the legacy
   `UserController` no longer registers a collection route at all, so the
   `/users` vs `/users/` ambiguity this entry describes cannot recur. The
   accurate lesson survives: the "first registration wins" rule was measured
   on prefix-less toy plugins and did **not** apply to prefix-wrapped ones.

### Verification (exact commands)

- `apps/backend` (follow-up fix): `bunx tsc --noEmit` → clean; `bun test` →
  **113 pass / 0 fail**; `bun run scripts/smoke-admin-api.ts` → **16 passed, 0
  failed** (added a check that every `/users` row carries `organizations`;
  that surface is now `/admin/users` and the same check reads
  `every /admin/users row carries an organizations array` — see the W4 entry).
- `apps/backend`: `bun run scripts/smoke-admin-api.ts` → **15 passed, 0
  failed**, stable across consecutive runs (the second run exercises the revive
  path the same script would otherwise mask).- `apps/web-admin`: `bunx tsc --noEmit -p tsconfig.app.json` → clean (plain
  `tsc --noEmit` checks NOTHING here — root `tsconfig.json` has `"files": []`);
  `bun run build` → clean, all three routes code-split.
- repo root: `bun run lint` → 0 errors (5 web-admin warnings + ui/backend
  warnings are pre-existing); `bun run docs/database/validate-dbml.ts` → OK
  (253 tables, 0 gaps).

Scripts kept: `scripts/smoke-admin-api.ts`, `scripts/cleanup-smoke-roles.ts`,
`scripts/refresh-role-grants.ts` (+ pre-existing ops scripts). All `diag-*.ts`
throwaways deleted.

## Completed (this session - user-management phase 3: dynamic hasPermission guard + single grant source, 2026-11-01)

Plan: `.agents/docs/plans/user-management.md`. Phase 3 of 7 complete.

- **Single grant source enforced**: `packages/common/src/authorization/
  erp-permissions.ts` now owns the merged catalog — built-in organization
  statements (`organization/member/invitation/ac`, via `builtInOrgStatements`)
  are folded INTO `erpRoleGrants` (owner = all ERP statements + full built-in
  org administration; admin = `organization:['read','update']`,
  `member:['create','read','update','delete']`, `invitation:['create','cancel']`,
  `ac:['read']` + prior catalog grants). Server `organization-ac.ts` and client
  `erp-ac.ts` had their local `ownerGrants`/`adminOrgGrants` layering DELETED —
  both build roles purely from `erpRoleGrants`; both spread the shared
  `builtInOrgStatements` into their statement vocabulary, so server/client/db
  seeds cannot drift. `packages/common` rebuilt.
- **Guard DB seam**: `src/authorization/permission-resolver.ts` —
  `IPermissionResolver` interface + `PERMISSION_RESOLVER_TOKEN` +
  `grantsAllow()` (union-of-grants checker). No DB imports in this file.
  `src/authorization/dynamic-permissions.ts` — `DynamicPermissionResolver`
  (`@injectable`, `@inject(DRIZZLE_TOKEN)`) unions `auth.roles.permissions`
  jsonb of the member's live roles for the validated org; falls back to static
  `authorizeErpPermissions` ONLY when no live row matches the member's role
  names. `src/authorization/container.ts` — `registerAuthorization()`
  registered in `src/index.ts`. `elysia-auth.ts` `erpGuard()` resolves the
  resolver from the tsyringe container once at plugin build.
  `src/di/tokens.ts` split out of `provider.ts` (token-only, no DB client
  imports) so importing the token never opens a connection.
- **Tests fixed**: `test/authorization/test-app.ts` registers an in-memory
  `IPermissionResolver` mock (`installPermissionResolverMock`, seeded with
  catalog grants; `setRoleGrants` overrides per test; `resetFixture` resets).
  No test opens a DB connection. New `test/unit/permission-resolver.test.ts`
  (9 tests, `mockDb` helper): live-row grant/deny, multi-role union,
  live-rows-authoritative (no fallback when a row exists), static fallback,
  `grantsAllow` semantics. `authorization.test.ts` gained 3 integration tests
  proving live rows decide access in the real Elysia pipeline.
  `bun test` = **90 pass / 0 fail** (was 61/17).
- **Seeder refresh path**: `organization-roles.seeder.ts` stays insert-only
  for re-runs (never overwrites admin-edited rows) but gained
  `refreshSystemRoleGrants()` — re-syncs existing `isSystem=true` rows whose
  permissions differ from the catalog (order-insensitive comparison), so a
  catalog change reaches already-seeded orgs on demand. Ops script
  `scripts/refresh-role-grants.ts` runs it. Custom roles are never touched.
- **Live verification** (dev server :3001):
  - `scripts/refresh-role-grants.ts` → 2 rows updated (owner/admin now carry
    the built-in org grants in `auth.roles.permissions`).
  - owner `GET /organizations/:id/members` → **200** (dynamic; was 403 before
    the catalog merge — root cause fixed).
  - member `GET /sales/quotations` → **403** (dynamic deny).
  - `scripts/smoke-dynamic-authoritative.ts`: owner row narrowed to
    `{dashboard:['read']}` → quotation read **403** even though the static
    catalog grants it (dynamic set is authoritative); row restored.
  - `scripts/smoke-fallback.ts`: owner row soft-deleted → quotation read
    **200** via static catalog fallback; row restored.
- `bunx tsc --noEmit` clean (backend); root `bun run typecheck` clean;
  `bun run lint` warnings pre-existing only; web-admin `bun run build` clean
  (consumes rebuilt common).
- **Not done (next)**: phase 4 admin UI (users → invitations → roles →
  members → audit), 5 username login tab, 6 deactivate/restore, 7 avatar
  claim hook check.

## Completed (this session - user-management phase 2: invitation module + claim flow, 2026-11-01)

Plan: `.agents/docs/plans/user-management.md`. Phase 2 of 7 complete.

- **Module** `apps/backend/src/app/user-management/`: contracts (gateways/
  repositories/services interfaces + DI tokens), errors, token utils
  (SHA-256 hash, `timingSafeEqual` compare), `InvitationRepository`,
  `UserManagementRepository`, `BetterAuthUserManagementGateway`,
  `LoggerInvitationMailer` (SMTP later), `AuditService`, `RoleService`,
  `InvitationService`, `InvitationController` (public claim routes +
  requireGlobalAdmin admin routes) and `UsernameCheckController`, both
  static-`plugin()` house style; wired in `src/index.ts`.
- **Audit schema** `drizzle/schemas/audit.schema.ts` (`audit.audit_logs`):
  text id, actor logical ref + denormalized email, AUDIT_ACTIONS vocabulary,
  target_type/target_id, nullable organization_id, meta jsonb, insert-only
  ledger. DBML entry REPLACED the stale aspirational one (was uuid/entity_id
  shaped); `bun run docs/database/validate-dbml.ts` → OK, 253 tables.
- **Better Auth internals learned (root-caused the claim 401)**:
  `auth.api.addMember` needs NO session when `organizationId` is in the body
  (orgMiddleware only), but `getFullOrganization` runs `orgSessionMiddleware`
  and 401s without a caller session. All org access moved into
  `BetterAuthUserManagementGateway.attachMembership` — addMember inside
  `runWithEndpointContext`, org name via internal adapter
  `ctx.adapter.findOne({model:'organization'})`. Claim order:
  claimCredentials → setClaimed → attachMembership → markStatus(accepted) →
  createSession, so a failed attach leaves the invitation retryable.
- **Invite edge cases fixed**: repository gained `findAnyByEmail` +
  `restore` (clears deletedAt, re-pends). Re-inviting a claimed email →
  clean 409 `InvitationPendingExistsError` (was 500 `users_email_key`);
  soft-deleted wrong-email user is restored and re-invited.
- **Live smoke (dev server, all via PowerShell Invoke-RestMethod)**: app-path
  claim + auto-login (newhire@entragate.test, set-cookie present), org-path
  claim with member role (fallback@entragate.test) and CUSTOM role
  (tech2@entragate.test → membership row `role='technician'`), reused token
  → 422, cancel → 200, delete claimed invitation → 409, resend kills old
  token (old → 422, new → 200), duplicate pending overwrite (`overwritten:
  true`, resentCount increments), bulk invite with bogus roleId → member
  fallback. Audit rows confirmed: invitation.sent 6, user.precreated 6,
  invitation.resent 1, invitation.cancelled 1
  (`bun run scripts/audit-summary.ts` from apps/backend).
- **Verification scripts** (run from apps/backend cwd): `verify-claim.ts`,
  `audit-summary.ts`. Note: PowerShell breaks backticks in `bun -e` — always
  write script files. Watch-mode logging can land in a different child than
  the shell output file; when responses look stale, kill all bun processes
  and restart clean.
- `bunx tsc --noEmit` clean; `bun test` 78/78 pass; lint warnings only
  pre-existing empty schema stubs.
- **Not done (next)**: phase 3 dynamic-role `hasPermission` guard swap,
  phase 4 admin UI, 5 username login tab, 6 deactivate/restore, 7 avatar
  hook check. Commit pending for phases 1+2.

## Completed (this session - user-management phase 1: schema + role seeding, 2026-11-01)

Plan: `.agents/docs/plans/user-management.md` (grilled/approved). Phase 1 of 7:
database shape for the invitation-only user lifecycle.

- **New schema** `apps/backend/drizzle/schemas/role.schema.ts` (auth schema,
  ERP-owned): `auth.roles` (per-org dynamic role master data: name, rank,
  permissions jsonb, isSystem, soft-delete + partial unique
  `(organization_id, name) WHERE deleted_at IS NULL`) and `auth.user_invitations`
  (unified invitation pipeline: type app|org, tokenHash SHA-256 unique,
  status pending|accepted|cancelled|expired, 3-day expiry via expiresAt,
  resentCount, deliveryFailed, claimedAt, soft delete). Named
  `user_invitations` because Better Auth owns `auth.invitations` (untouched).
- **`auth.users.status`** text column added (`active` default): pending |
  active | deactivated lifecycle. Declared in auth.schema.ts (hand-applied
  delta, same 1.4.x codegen caveat as deletedAt) AND registered as a
  `user.additionalFields.status` (`input: false`, default 'active') in
  auth.options.ts so Better Auth passes it through. drizzle-kit quirk: the
  partial-index `.where()` needs `sql` from `drizzle-orm` (not pg-core).
- **Relations**: `roleRelations` added to `drizzle/db.ts`.
- **Migration** `20261101021221_ancient_luckman` (generated, human-inspected,
  applied): 2 tables, users.status column, 6 indexes, 4 FKs.
- **Seeder** `database/seeders/seed/organization-roles.seeder.ts`:
  materializes the shared catalog (`erpRoleNames`/`erpRoleGrants`) as
  per-org `auth.roles` master data; ranks owner=100, admin=80, hr=60,
  member=10, other catalog roles=50; `isSystem=true`; idempotent (live-row
  existence check, never overwrites). Wired into `seeders/index.ts` after
  `seedOrganizationMembers`.
- **Verified**: migration applied to dev DB; seeder ran twice (19 inserted,
  then 0 = idempotent); `scripts/verify-user-management-schema.ts` shows
  owner/admin/hr ranks correct, 17 existing users `active`, 0 invitations.
  `bun run typecheck` clean (after adding `status: 'active'` to the
  user.service.test.ts fixture), root `bun run lint` 0 errors, backend
  `bun test` 78 pass / 0 fail. DBML updated (roles, user_invitations,
  users.status; now 253 tables) and `validate-dbml.ts` passes (0 cross-module).
- **Not done (next phases)**: invitation module + claim flow (phase 2),
  dynamic-role `hasPermission` guard (phase 3), admin UI (phase 4),
  login username tab (5), deactivate/restore (6), avatar claim hook check (7).
  Note: `@dbml/core` was missing from node_modules (progress line 618
  overstated) — re-added as root devDependency to run the validator.

## Completed (this session - auth UX fixes: /users/me session guard + session org auto-activation + menu warnings, 2026-10-31)

- **Bug**: `GET /users/me` sat behind the full `erpGuard`, which 403s when
  neither `x-organization-id` nor `session.activeOrganizationId` is present.
  Fresh logins have no active org → sidebar showed `…` with no name/email.
- **Fix A** — `sessionGuard()` in `src/authorization/elysia-auth.ts`: a
  session-only plugin (macro `erpSession`) resolving the Better Auth session
  and 401-ing when absent; no organization/membership resolution, so
  `ErpContext.organizationId`/`member` stay non-nullable for existing
  consumers. `/users/me` (user.controller.ts) opts in via
  `{ erpSession: { session: true } }` and `.use(sessionGuard())`.
- **Fix B** — `sessionAutoActivateOrganizationHook`
  (`src/providers/better-auth/options/session.auth.ts`, previously an empty
  placeholder), wired as `databaseHooks.session.create.before` in
  `auth.options.ts`: stamps the user's first `members` row as
  `activeOrganizationId` on session creation. Existing sessions unaffected
  (need one re-login or manual switch). See
  `modules/organization.md` → "Session auto-activation".
- **Elysia macro typing quirk (1.4.30)**: an EMPTY option object
  (`{ macroKey: {} }`) drops the macro's resolved context from handler
  types (TS2339 at the handler). Boolean `{ macroKey: true }` does NOT fix
  it; a NON-EMPTY object (`{ macroKey: { anything: true } }`) does. This
  mirrors the already-documented `erp: {}` vs `erp: { permission: [] }`.
- **Frontend** — Base UI `MenuGroupContext` console warning on dropdown
  open: `DropdownMenuLabel` renders `Menu.GroupLabel`, which requires a
  group context; wrapped labels in `DropdownMenuGroup` in
  `organization-switcher.tsx` and `nav-user.tsx` (unstyled
  `div[role=group]`, no visual change).
- **Verified live** (backend :3001): fresh login → `GET /users/me` (no
  header) → 200 `admin / admin@example.com`; `GET /organizations` (no
  header) → 200, Entragate (auto-activated). `bun run typecheck` clean,
  `bun test` 78 pass / 0 fail, web-admin `bun run build` clean.

## Completed (this session - organization module + member CRUD + seeders, 2026-10-31)

Backlog: **ERP-0026** (implemented; live smoke verified).

- **Schema** `auth.organizations.deleted_at` timestamp added via hand-written
  delta + migration `20261031032506_chief_phil_sheldon`
  (`ALTER TABLE "auth"."organizations" ADD COLUMN "deleted_at" timestamp;`),
  applied with `bun run drizzle:migrate` (verified). Plugin side: Better Auth
  org plugin `schema.organization.additionalFields.deletedAt` (date, not
  required, `input: false`) in `plugins/organization.auth.ts`. `auth.schema.ts`
  remains hand-maintained (never `auth:generate`).
- **Permissions** `builtInOrgStatements` (@ims-erp/common) extended with
  `organization.create|read`, `member.read`; `organization-ac.ts` merges them
  into `organizationStatements` + owner/admin roles (admin keeps catalog
  member create/update/delete, layered with read). `PermissionRequirement`
  widened to accept `organization:*`/`member:*`/`invitation:*`/`ac:*`.
- **Backend module** `src/app/organization/` (contracts/repo/gateway/service/
  controller/container/di; registered in `src/index.ts`): routes per the table
  in `modules/organization.md`; soft delete +
  restore, last-owner 409, member list joined with users. Org DELETE never
  uses `auth.api.deleteOrganization`. (The single-org invariant present at
  the time was removed on 2026-11-02 — see the ADR-0007 entry at the top.)
- **Seeders** `organization.seeder.ts` (Entragate + initial admin as owner via
  one `createOrganization({ userId })`) and `organization-members.seeder.ts`
  (16 internal-role accounts, `<role>.seed@entragate.local`, per-role dev
  password `<role>123456`).
  Registered after `seedAuth()` in `database/seeders/index.ts`.
- **Web-admin**: `team-switcher.tsx` → `organization-switcher.tsx` (`git mv`,
  real org data, active-org switch, Manage/New entries); organization API
  client (`src/lib/organization-api.ts`); dedicated route pages
  `routes/_authed/organizations/` (index / new / $organizationId / .edit /
  members.new / members.$memberId.edit); minimal toast bus
  (`components/toast.tsx`, `<Toaster />` in root) — sonner not installed.
  Create button gated `organization.create` (now the application-admin role
  since 2026-11-02); edit/delete/member actions
  gated `organization.update|delete`, `member.create` (UX only).
- **Docs** `modules/organization.md` rewritten; `security-and-access.md`
  stale `erp.audit_logs` fixed (schema never existed; table is future
  `audit_logs` per docs/database/). Verified no stale `erp` schema in the
  live DB (`auth, drizzle, location, sales` only).
- **Verified 2026-10-31** (commands + results):
  - `bun run typecheck` (backend + web-admin via `tsc -b`) clean.
  - `bun test` (backend) 78 pass / 0 fail (one permission-matrix assertion
    updated to catch an admin-grants regression found during the work).
  - `bun run build` (web-admin) clean.
  - Migration applied; `bun run drizzle:seed` run twice — second run all
    skip (`created: 0`), idempotent.
  - Live smoke (dev server + seeded admin cookie + `x-organization-id`):
    `GET /organizations` → 1 org "Entragate"; duplicate
    `POST /organizations` → 422; `GET /members` → 17 members;
    `PATCH .../members/:id` role change + revert → 200; `DELETE`
    non-owner member → 200; re-add → 201; demote/remove last owner → 409.
  - NOT yet verified in a browser: org pages end-to-end (login → switcher →
    list → edit → members flows). Redis avatar-worker "Connection closed"
    boot warning is pre-existing (Redis not running locally), unrelated.

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
- **Endpoints** (prefix `/users`, self-service + Better Auth admin surface;
  the org-scoped admin lifecycle moved to `/admin/users` in the W4 tidy-up):
  `GET /me` (self profile), `GET /:userId` (full profile, presigned image —
  **global-admin gated** since W4), `POST /` (201), `PATCH /:userId`,
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
