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
- Static, code-defined roles. Dynamic access control is NOT enabled.

## Where things live

| Concern | File |
|---|---|
| Shared browser-safe catalog (`erpStatements`, `erpRoleGrants`, role names) | `packages/common/src/authorization/erp-permissions.ts` |
| Backend access control + roles (`erpRoles`, `authorizeErpPermissions`) | `apps/backend/src/providers/better-auth/ac/organization-ac.ts` |
| Global role constants | `apps/backend/src/providers/better-auth/ac/admin-ac.ts` |
| Privilege-escalation hooks (member/invitation endpoints) | `apps/backend/src/providers/better-auth/ac/auth-hooks.ts` |
| Elysia guard (`erpGuard`, `erp` macro, ErpAuthError) | `apps/backend/src/authorization/elysia-auth.ts` |
| Client-side ac + roles (browser-safe re-composition) | `apps/web-admin/src/lib/erp-ac.ts` |
| Frontend permission types + helpers | `apps/web-admin/src/lib/permissions.ts`, `use-permission.tsx` |

## ERP roles (organization membership)

`owner, admin, member, operations_manager, sales_manager, sales,
project_manager, technician, freelancer, purchasing, warehouse, finance,
accountant, hr, customer_service, marketing, investor, customer, auditor`

Key separations encoded in the matrix (full grants in
`erpRoleGrants`, verified by `test/authorization/permission-matrix.test.ts`):

- **owner**: full ERP + organization administration; still subject to tenant
  boundaries, valid state transitions, and no self-approval.
- **admin** (org): membership/invitations/general settings/non-sensitive
  master data; NO payroll, payment execution, accounting, investor-finance,
  or integration secrets. Cannot grant the `owner` role (hook-enforced).
- **member**: baseline only; employee self-service additionally requires an
  actual employee relationship (record-level, when HR module lands).
- **sales** creates/submits; cannot approve (even own submissions).
- **finance** executes payments; no HR record access; payroll *payment*
  access ≠ payroll *record* access.
- **hr** prepares payroll; approval and execution stay separate.
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

## Scoping a Drizzle query

Every tenant-owned query filters by the validated organization id and never
fetches unscoped collections to filter afterward:

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

`auth-hooks.ts` installs Better Auth `hooks.before` middleware that:

- Blocks `owner` grants via `/organization/add-member`,
  `/organization/update-member-role`, and `/organization/create-invitation`
  unless the actor is an organization owner.
- Blocks non-grantable roles for org admins (owner only for now).
- Runs inside the Better Auth handler, so both the mounted auth routes and
  server-side `auth.api.*` calls are covered.

Global role changes remain exclusively within `admin()` endpoints.

## Audit

Sensitive actions (role changes, invitations, approvals/rejections, payment
execution, financial posting/reversal, sensitive exports, secret rotation,
impersonation) append to `erp.audit_logs`: actor, organization, action,
target, timestamp, outcome, redacted metadata. Implementation lands with the
modules that own those actions; the catalog resources (`audit_log:read`,
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
  organization id; the server remains authoritative.

## Bootstrap / seeding

- `bun run drizzle:seed` (apps/backend) runs `auth.seeder` then
  `location.seeder`. The auth seeder is idempotent: creates the initial
  global admin (no org membership) via the Better Auth instance; existing
  users are never reset.
- Credentials: `INITIAL_ADMIN_EMAIL` / `INITIAL_ADMIN_USERNAME` /
  `INITIAL_ADMIN_PASSWORD` (dev-only defaults; see `.env.example`). Values
  are never logged. There is no auto-promotion of existing users.

## Verification status

- Permission matrix + Elysia guard pipeline verified by
  `apps/backend/test/authorization/` (24 integration + 18 matrix tests,
  2026-10-29).
- Real-database session flow (login -> cookie -> guard) verified over live
  HTTP 2026-10-29; sessions now Redis-only via `secondaryStorage` (verified:
  Redis keys with 7d TTL, no new Postgres session rows, sign-out clears
  Redis + cookie, cookie cache ~4.5x faster repeat reads).

## Integration gaps (modules not yet built)

The catalog registers the full ERP vocabulary, but only the `sales` vertical
(quotation, payment) exists today. Routes for the remaining resources must
use the `erp` macro as they are built; record-level policies that depend on
missing modules (payslip ownership, investor report publication status,
approval_rule storage, audit writes) are documented here and MUST be wired
when each module lands.
