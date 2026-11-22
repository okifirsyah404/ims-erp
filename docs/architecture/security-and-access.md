# Security and Access

Auth, roles/permissions, portals, secrets, and audit. The backend is
authoritative; every frontend check is UX only.

> Rewritten 2026-10-29 for the Elysia backend + Better Auth 1.7.14
> two-layer authorization architecture (ADR-0006). The prior NestJS-era
> matrix is superseded.

## Two authorization layers (ADR-0006)

| Layer | Plugin | Storage | Scope |
|---|---|---|---|
| Global account administration | `admin()` (defaults preserved) | `auth.users.role` (`admin` / `user` only) | Account/session administration ONLY |
| ERP authorization | `organization()` with code-defined access control | `auth.members.role` (comma-separated ERP roles) | All business permissions, per organization |

Hard rules:

- A global admin WITHOUT organization membership has **no ERP access**.
  The guard validates membership server-side on every protected request.
- ERP roles never leak into `admin()`; global roles never grant ERP rights.
- Multi-role members get the UNION of their roles' permissions, but
  business separation-of-duties (self-approval, pre-approval execution)
  is enforced in services regardless of role combinations.

### Closed role enum, no dynamic role table

Organization roles are a **closed enum**, not runtime data (ERP-0041):

| Tier | What it is | Where |
|---|---|---|
| Role vocabulary + grants | The 19 `erpRoleNames` and their `erpRoleGrants` resource/action sets | `packages/common/src/authorization/erp-permissions.ts` |
| Storage | Comma-joined role keys on the membership row | `auth.members.role` (text) |

- `auth.members.role` holds comma-separated role keys; the guard unions the
  grants of every listed role. There is **no** per-organization role table and
  no runtime-mutable permission row - `auth.roles` does not exist.
  `StaticPermissionResolver` (`apps/backend/src/authorization/static-permissions.ts`)
  reads the shared catalog directly.
- There is exactly **one grant source**: server access control, client access
  control, and the seeders all consume `erp-permissions.ts`. Never layer a
  second local copy.
- A global app admin with **no** organization membership still has no ERP
  access; mutation guards require a membership role.
- `auth.members` is **hard-deleted** by Better Auth; it has no `deleted_at`
  column. Membership queries must never filter on one.

### Escalation guard

Better Auth's membership and invitation endpoints are directly reachable, so
`betterAuthHooks()` guards them server-side:

- only an organization owner may grant or change the `owner` role;
- organization admins may manage members/invitations only with the non-owner
  ERP roles the role policy allows;
- ordinary members can never grant privileged ERP roles;
- the last owner cannot be removed or demoted.

Source of truth: `apps/backend/src/providers/better-auth/ac/auth-hooks.ts`.


## Where things live

| Concern | File |
|---|---|
| Shared browser-safe catalog (`erpStatements`, `erpRoleGrants`, role names) | `packages/common/src/authorization/erp-permissions.ts` |
| Backend access control + roles (`erpRoles`, `authorizeErpPermissions`) | `apps/backend/src/providers/better-auth/ac/organization-ac.ts` |
| Global role constants | `apps/backend/src/providers/better-auth/ac/admin-ac.ts` |
| Privilege-escalation hooks (member/invitation endpoints) | `apps/backend/src/providers/better-auth/ac/auth-hooks.ts` |
| Elysia guard (`erpGuard`, `erp` macro, ErpAuthError) | `apps/backend/src/authorization/elysia-auth.ts` |
| Dynamic permission resolver (closed-enum grants, no DB lookup) | `apps/backend/src/authorization/static-permissions.ts` |
| `IPermissionResolver` / `PERMISSION_RESOLVER_TOKEN` contract | `apps/backend/src/authorization/permission-resolver.ts` |
| Authorization DI registration | `apps/backend/src/authorization/container.ts` |
| DI tokens (split from the provider so importing a token never opens a DB connection) | `apps/backend/src/di/tokens.ts` |
| Role policy + account lifecycle | `apps/backend/src/app/user/services/user-admin.service.ts`, `invitation.service.ts` |
| Client-side ac + roles (browser-safe re-composition) | `apps/web-admin/src/lib/erp-ac.ts` |
| Frontend permission types + helpers | `apps/web-admin/src/lib/permissions.ts`, `use-permission.tsx` |

## ERP roles (organization membership)

`owner, admin, member, operations_manager, sales_manager, sales,
project_manager, technician, freelancer, purchasing, warehouse, finance,
accountant, hr, customer_service, marketing, investor, customer, auditor`

Key separations encoded in the matrix (full grants in
`erpRoleGrants`, verified by `test/authorization/permission-matrix.test.ts`):

- **owner**: full ERP + organization administration; still subject to
  organization boundaries, valid state transitions, and no self-approval.
  The owner grant is **per organization** — owning one organization confers
  nothing in another.
- **admin** (org): membership/invitations/general settings/non-sensitive
  master data; NO payroll, payment execution, accounting, investor-finance,
  or integration secrets. Cannot grant the `owner` role (hook-enforced).
- **member**: baseline only; employee self-service additionally requires an
  actual employee relationship (record-level, when HR module lands).
- **sales** creates/submits; cannot approve (even own submissions).
- **finance** executes payments; no HR record access; payroll *payment*
  access ≠ payroll *record* access.
- **hr** (the role key; the module and schema are `human_resource`) prepares
  payroll; approval and execution stay separate.
- **purchasing/warehouse**: preparation and stock operations; no self-approval
  of their own requests/adjustments.
- **auditor**: read/export only; sensitive HR/payroll scope must be assigned
  explicitly (record-level policy, enforced when those modules land).
- **investor / customer**: portal roles only (`investor_portal.*` /
  `customer_portal.*`); no broad internal resource permissions.
- **marketing**: no integration secrets, no automation execution.

## Protecting a new Elysia route

```ts
import { erpGuard } from '@authorization/elysia-auth';

export class WidgetController {
	static plugin() {
		return new Elysia({ prefix: '/widgets' })
			.use(erpGuard())
			.get('/widgets', handler, {
				// permission strings: `<resource>:<action>`; ALL listed must pass
				erp: { permission: ['widget:read'] },
			})
			.post('/widgets/:id/approve', approveHandler, {
				erp: {
					permission: ['widget:approve'],
					// optional record-level policy; runs after permission checks
					policy: (ctx) => approvalPolicy(ctx.erp, ctx.params),
				},
			});
	}
}
```

The `erp` macro runs in the resolve phase BEFORE the handler and provides
`ctx.erp = { session, organizationId, member }`:

- 401 unauthenticated (no valid session from real request headers).
- 403 no organization context / not a member / missing permission.
- 404 where existence must not be disclosed (use in handlers).

Organization selection: explicit `x-organization-id` header takes
precedence over the session's active organization; the SAME resolved id is
used for membership, permissions, queries, and audit records.

### Routes with no organization context

`sessionGuard()` (`erpSession` macro) resolves the session and nothing else,
for actions that are deliberately NOT organization-scoped — e.g.
`GET/PATCH /users/me` and organization creation, which an application admin
must be able to perform while belonging to no organization. It exposes
`ctx.erp.session` only (no `organizationId`/`member`) and accepts an optional
`policy` hook for role checks such as `requireGlobalAdmin`.

Organization creation (`POST /organizations`) is the one organization route
on this guard: the gate is the global application-admin role
(`user.role === 'admin'`, ADR-0007), never an organization permission, so a
membershipless admin can bootstrap the first organization. Better Auth
re-checks the same rule via `allowUserToCreateOrganization`. Multiple
organizations are allowed (ADR-0012); the creation gate stays the same for
every subsequent one.

### Company-wide resources (ERP-0042)

Two resources are company-wide, not organization-scoped: `company` and
`document` (ADR-0015). They replaced `company_setting`, which used to carry the
profile, the numbering and the settings in one vocabulary. The company routes
live under `/companies` (ADR-0024; the earlier `/company/*` prefix is gone).

> Numbering is per module since ADR-0024 (each schema owns `code_numberings`).
> The `code_number` permission resource is still declared in
> `packages/common/src/authorization/erp-permissions.ts`, but no backend route
> uses it any more (no `/code-numbers` controller exists; grep of
> `apps/backend/src` finds none). Whether to remove the resource is an open
> cleanup, not decided here.

| Resource | Actions | Guards |
|---|---|---|
| `company` | `read`, `update` | the profile, logo/signature uploads and settings routes under `/companies` (check `company/controllers` for the exact paths) |
| `document` | `read`, `create`, `update`, `submit`, `approve`, `issue`, `void`, `download`, `signature_read`, `signature_request`, `signature_sign` | the registry, files, signatures, shares, tags |

"Company-wide" describes the **data scope**, never the authorization boundary:
these routes still run the `erp` macro with a validated organization, and then
check the permission. A caller with no permission in the validated organization
cannot read the profile even though the profile has no `organization_id`
column. Reads that genuinely need no organization context (the public share
endpoint `/documents/public/v1/shares/:token`) live on `sessionGuard()`-free public
routes and are authorized by the token alone, with an expiry and a revocation
flag checked on every request.

## Scoping a Drizzle query

Every organization-scoped query filters by the validated organization id and
never fetches unscoped collections to filter afterward:

```ts
const where = and(
	eq(widgets.organizationId, organizationId), // from ctx.erp, not the client
	eq(widgets.id, id),
);
```

Rules:

- Mutations are also scoped by `organizationId` + record identity.
- Referenced foreign keys (customers, projects, employees, files) must be
  validated to belong to the same organization (see
  `SalesService.createPayment` for the pattern).
- Whitelist writable fields explicitly (mass-assignment protection: never
  accept `organizationId`, `status`, `createdBy`, approval fields from the
  request body).
- Ownership/assignment scoping (assigned technician, own payslip, own
  customer/investor relationship) applies where a link exists; portal users
  read only records tied to their verified relationship.
- Exports, counts, search, and dashboard aggregations go through the same
  scoping.

## Sign-in (invitation-only, ADR-0029)

- Accounts come from invitations only. Google sign-in has
  `disableSignUp: true`: an unknown email ends at `/login?error=signup_disabled`
  and writes nothing.
- The web-admin login gate (`ac/login-gate.ts` `webAdminDenial`, run in
  `session.create.before` and per request) requires an **active** account
  (`status = 'active'`, not soft-deleted) before the role rule; refusals carry
  `ACCOUNT_NOT_ACTIVE` / `WEB_ADMIN_ACCESS_DENIED` and a translated message.
  Pending invitees must claim first; deactivated users cannot sign in by any
  method.
- `databaseHooks.account.create.before` refuses linking a social account to an
  inactive owner (`credential` exempt for the claim).
- Linking follows Better Auth defaults: same email only, local email must be
  verified for implicit linking (otherwise `account_not_linked`).

## Business approvals

Permissions are necessary but never sufficient for approvals:

1. Valid document state (repository conditional update: `WHERE status = from`).
2. No self-approval (actor ≠ creator), regardless of roles.
3. Amount/discount limits come from configuration; **missing configuration
   denies the action** with an explicit error (no invented thresholds).
   Currently `SalesService` denies approvals while no `approval_rule`
   configuration exists - see the `DEFAULT_APPROVAL_LIMIT` note.
4. Execution only from the approved state; approve/execute are atomic
   conditional updates (race-safe, no double execution).

## Privilege-escalation protection

Three complementary layers, all reading one shared ladder
(`assignableOrganizationRoles` / `grantableOrganizationRoles` in
`packages/common/src/authorization/erp-permissions.ts`):

| Caller | may invite / assign |
| --- | --- |
| `owner` | everything except `owner` on an *invitation* (owner is born with the organization; member management may still promote another owner) |
| org `admin` | every role except `owner` and `admin` |
| org `hr` | every role except `owner`, `admin` and `hr` |
| platform `admin` (`user.role`) | every role except `owner`, unless they also hold an owner membership |

1. **Better Auth hooks.** `auth-hooks.ts` installs `hooks.before` middleware that:

   - Blocks `owner` grants via `/organization/add-member`,
     `/organization/update-member-role`, and `/organization/create-invitation`
     unless the actor is an organization owner.
   - Blocks non-grantable roles for org admins (owner only for now).
   - Runs inside the Better Auth handler, so both the mounted auth routes and
     server-side `auth.api.*` calls are covered.

2. **Controller guards.** The first-party routes that bypass Better Auth's own
   endpoints re-check the same ladder against the guard-resolved caller
   (`src/authorization/role-assignment.ts`): `POST /admin/invitations`,
   `POST /organizations/:id/invitations` (single **and** bulk — the whole batch
   is rejected, so no employee is created for a row whose roles were dropped),
   `POST /hr/employees`, and the organization member add/update routes
   (`OrganizationService.assertAssignableRoles`, which passes the target
   member's current roles so keeping an existing grant is not treated as an
   escalation). Violations are a 403 carrying `invitation.roleNotAssignable` /
   `organization.roleNotAssignable`.

3. **Service-level role policy.** The user-management services (`/admin/users`,
   invitation claim) enforce the same role policy for account and membership
   mutations; the hooks above do not see those routes.

The UI mirrors the ladder rather than defining it: the invite dialog's role
dropdown, the member-edit checkboxes and the bulk-invite spreadsheet parser all
call the shared helper, so a hidden option and a rejected request can never
disagree.

Global role changes remain exclusively within `admin()` endpoints.

## Audit

User-management events are **implemented**: `audit.audit_logs` is an
append-only ledger written by `AuditService`
(`src/app/audit/services/audit.service.ts` — its own `audit` module since the
W6 extraction; it was previously inside `user-management`), read through
`AuditQueryService` and the `GET /admin/audit` route gated on
`audit_log:read`.

- Vocabulary: `invitation.sent|resent|cancelled|deleted|claimed`,
  `user.precreated|deactivated|restored|deleted`,
  `role.created|updated|deleted`, `member.added|removed|roleChanged`,
  `org.created`.
- Insert-only by contract: no updates, no soft delete (exempt from the
  `deleted_at` rule as an append-only ledger).
- The actor is a **logical** reference to `auth.users.id`, so a deleted user
  never erases the trail.
- `created_at` is a timestamp; range filters convert unix-ms inputs via
  `new Date(floor(ms/1000)*1000)`.

The remaining business modules (approvals, payment execution, financial
posting, exports, secret rotation, impersonation) still append to this same
table as they land; the catalog resources (`audit_log:read`,
`audit_log:export`) are already gated.

## Cache / revocation

- **Session storage**: sessions live in **Redis** via Better Auth
  `secondaryStorage` (`options/secondary-storage.auth.ts`, adapter over the
  shared Bun `RedisClient`). Keys are prefixed `better-auth:`; TTLs are in
  seconds. `storeSessionInDatabase: false` — Postgres does not store sessions
  (rows in `auth.sessions` from before the switch are legacy and unused).
  Storage failures are logged and re-thrown (fail closed), never silently
  treated as "no session".
- **Cookie cache**: `session.cookieCache` enabled with a 5-minute maxAge —
  repeated requests within the window skip the Redis round-trip (verified:
  ~55ms cold vs ~12ms cached). Revocations/sign-outs still take effect
  immediately for the affected session (sign-out clears both the cookie and
  the Redis record); role/membership changes propagate within the 5-minute
  cookie-cache window at most.
- Role/membership checks in the guard re-resolve membership
  via `auth.api.getFullOrganization` with the caller's headers - removed
  membership takes effect within the cookie-cache window.
- Frontend permission queries are cached for 60s and re-keyed by active
  organization id; the server remains authoritative. Switching or creating an
  organization invalidates both the permission cache and the organization
  list, since Better Auth changes the session's active organization.
- **`auth.users` row cache** (`UserRepository`, 300s TTL, keys
  `user:id:<id>` and `user:all`) is shared state: the admin lifecycle path
  (`UserManagementRepository`) writes `status`/`deletedAt` to the same table,
  so **every** such write must evict those keys. The key layout lives in
  `src/app/user/constants/cache.ts` and both repositories import it, so they
  cannot drift. (Fixed in W7: admin deactivate/restore/delete previously left
  the self-service read path serving a stale row for up to 5 minutes —
  including a soft-deleted user still readable at `GET /users/:id`.) Verified
  live by `apps/backend/scripts/smoke-cache-invalidation.ts`. Better Auth's
  own writes (update-user, admin API, email verification, change-email) evict
  the same keys through `databaseHooks.user.update.after`
  (`options/user-cache.auth.ts`, ERP-0109).

## Bootstrap / seeding

- `bun run drizzle:seed` (apps/backend) runs the seeders registered in
  `database/seeders/index.ts` (auth, location, company, inventory, finance, tax,
  HR, notification, organization seeders; check the file for the exact order).
  The auth seeder is idempotent: creates the initial
  global admin (no org membership) via the Better Auth instance; existing
  users are never reset.
- **Organization seeding is dev-only.** The organization seeder is skipped in
  `prod`/`production` (ADR-0007): production organizations are created through
  the API by an application admin, and the first organization is not assumed
  to exist. A skip is logged, never thrown, so later seeders still run.
- **Role seeding is a drift check, not a write.** Since ERP-0041 the role
  catalog is a closed enum in `@ims-erp/common`; there are no role rows to
  seed. `organization-roles.seeder.ts` only verifies the old
  `auth.organization_role` enum type is gone and logs the catalog, so a stale
  database is reported loudly.
- Credentials: `INITIAL_ADMIN_EMAIL` / `INITIAL_ADMIN_USERNAME` /
  `INITIAL_ADMIN_PASSWORD` (dev-only defaults; see `.env.example`). Values
  are never logged. There is no auto-promotion of existing users.

## Verification status

- Permission matrix + Elysia guard pipeline verified by
  `apps/backend/test/authorization/` (24 integration + 18 matrix tests,
  2026-10-29).
- Dynamic role resolution, role CRUD and the account lifecycle verified by
  `apps/backend/test/unit/` — 113 tests, 0 failures (2026-11-01). All
  repository/DB dependencies are mocked; guard tests never open a real
  database connection.
- Live admin API verified by `apps/backend/scripts/smoke-admin-api.ts`
  (16/16 checks), including the escalation guard rejecting an owner-rank grant.
- Real-database session flow (login -> cookie -> guard) verified over live
  HTTP 2026-10-29; sessions now Redis-only via `secondaryStorage` (verified:
  Redis keys with 7d TTL, no new Postgres session rows, sign-out clears
  Redis + cookie, cookie cache ~4.5x faster repeat reads).

## Integration gaps (modules not yet built)

The catalog registers the full ERP vocabulary. After ADR-0024 the backend
mounts the 18 schema modules plus `webhook` (see `docs/database/module-ownership.md`),
and the 2026-11-20 live smoke test read 69 list/detail endpoints across them
without a 404/5xx; that proves reachability, **not** that every permission,
ownership rule or write path is exercised. Routes for resources still being
built must use the `erp` macro; record-level policies that depend on missing
pieces (payslip ownership, investor report publication status, approval_rule
storage) are documented here and MUST be wired when each lands.

Sensitive-field gates that exist: supplier bank columns are stripped from every
company response unless the caller holds `supplier:read_bank`, and a bank write
without it is a 403 (`SupplierBankForbiddenError`; read side verified live,
write side by a role that can update but lacks the permission **not** verified
live). Payment gateway secrets are write-only (sealed AES-256-GCM, only
`hasSecret`/`secretLast4` are returned; `payment_gateway:read|update`, held by
`owner` today). Employee bank/salary data is masked without
`employee:read_private`.

Inbound provider webhooks (`/webhooks/{xendit,singapay,whatsapp}`) carry no
session: authenticity is the provider signature/token check inside the owning
module's webhook service; an unconfigured provider answers 404, a rejected
signature 401.

Audit writes are no longer a gap: `audit.audit_logs` and `AuditService` exist,
and the user-management actions listed under **Audit** already append to it.

Company and Document are built (ERP-0042): their routes exist and are guarded
by the `erp` macro plus the `company:*` and `document:*` permissions (the
Code Number module was removed by ADR-0024). The document **signature request** flow is built
(ERP-0048/ERP-0049): `document:signature_read` sees the signature register and
one document's signature section, `document:signature_request` creates and
cancels requests, `document:signature_sign` acts on a request addressed to the
caller (sign, decline) and owns that caller's signature image. Every role that
holds `document:read` also holds `signature_read` + `signature_sign`; only owner,
admin, operations_manager, sales_manager, project_manager, finance and hr hold
`signature_request`. Those are the guard's first gate, never the only one: the
service re-checks that the caller *is* the addressed signer (sign/decline) or
*is* the requester (cancel) and that the row is still pending and unexpired, so a
stolen permission only ever produces a 403/409. Signing writes the immutable
evidence row in `document.signatures`; nothing else does. The `document.*`
settings group holds only `document.signature_request_expiry_days`, which the
request form reads as its default.

Signature routes, by action:

| Route | Action |
|---|---|
| `GET /documents/signatures`, `GET /documents/:id/signatures` | `document:signature_read` |
| `GET /documents/signatures/requests/outgoing`, `POST /documents/signatures/requests`, `POST …/:id/cancel` | `document:signature_request` |
| `GET /documents/signatures/requests/incoming`, `POST …/:id/sign`, `POST …/:id/decline`, `PUT/GET …/:id/signed-pdf`, `GET/PUT/DELETE /documents/signatures/my-image`, `POST /documents/signatures/user-images` | `document:signature_sign` |

Placing the signature on a PDF is a write the signer performs on their own
signature: the route re-checks that the request is addressed to the caller and
that it is already `signed`, records `pdf_sign` on the document's access trail,
and refuses a second placement (the artifact is final). The source PDF must be
one of that document's files — the server never renders a PDF itself.
