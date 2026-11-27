# ADR-0018 — Investor and customer are application roles, not organization roles

- **Status:** proposed (2026-11-14). Depends on ADR-0017 acceptance for the
  login-gate amendment in this record.
- **Status update 2026-11-28 (T-6, recorded by programmer B, reviewed by Oki):** **accepted** (implemented: app roles `investor` and `customer` in `packages/common/src/authorization/erp-permissions.ts`). The investor module is built in task M11-4 (IV-1).
- **Amends:** ADR-0006 (organization roles are the only ERP authorization: the
  `investor` and `customer` roles leave that set), ADR-0017 §8 (login gate),
  ADR-0017 §9 (investor-plus-internal wording).

## Context

`investor` and `customer` were organization roles (`erpRoleNames`,
`erpRoleGrants`, `organization-ac.ts`). Their rights are portal rights for a
future investor and customer app, not back-office rights. Holding them per
organization is the wrong scope: a portal identity is a property of the person,
not of one organization membership.

## Decision

1. **Remove** `investor` and `customer` from `erpRoleNames`, `erpRoleLabels`,
   `erpRoleGrants`, and the server and client organization access control. No
   organization role holds any portal grant.
2. **Add** them as Better Auth `admin()` application roles (`user.role`).
   Portal grants move to `appRoleGrants` in `@ims-erp/common`, data only, checked
   by the future portal modules.
3. **Multi-role.** Better Auth 1.7.14 `admin()` stores several roles as a
   comma-joined string in `user.role` (for example `admin,investor`). Every
   application-role check reads the list (`hasRole` / `hasAppRole`), never
   `=== 'admin'`.
4. **Custom roles are declared.** `investor` and `customer` are passed to
   `admin({ ac, roles })` on the server and `adminClient({ ac, roles })` on the
   client. They have no admin statements, so they cannot call admin endpoints.
5. **Login gate** (ADR-0017 §8, amended). A session is allowed only when the
   user is an application admin, or holds at least one membership with an
   internal organization role. `investor`/`customer` alone are rejected. A PIC
   with no membership is rejected. A PIC with an internal membership passes; PIC
   rights themselves still come only from `inventory.warehouse_managers`.
   `sessionGuard` re-checks the gate on every request (403), so sessions created
   before the gate are rejected. `erpGuard` is unchanged.
6. **Investor-plus-internal** (ADR-0017 §9, amended). A user with the
   `investor` app role and an internal membership logs in normally. The app role
   grants nothing in web-admin.
7. **Default organization.** The login hook activates the first membership
   with an internal role, never a membership without one.
8. **Existing data (dev only).** Investor and customer memberships are deleted;
   mixed rows keep their internal roles. Migration
   `20261114120000_erp0048_investor_customer_app_roles` is append-only and
   hand-written. No production server runs yet, so no data is migrated.
9. **Application admins** keep bypassing organization checks, as before.

## Consequences

- No table or column changes; `validate-dbml.ts` prints `OK`.
- Every `user.role === 'admin'` check is replaced by `hasRole`/`hasAppRole`.
- Future portal apps read `appRoleGrants` and `user.role`; they do not read
  organization roles.
- Any future internal-role rename must update `erpRoleNames`, which the login
  gate reads directly.

## Alternatives considered

- **Keep them as organization roles.** Rejected: wrong scope, and they would
  count as internal unless filtered by name.
- **One app role per user (`user.role` as a single value).** Rejected: admin()
  supports multiple roles, and an admin who is also an investor must keep both.

## Risks

- The login gate blocks users whose only membership is `investor`/`customer`.
  Intended; those rows are deleted by the migration.
- The route test harness stubs the login gate open (see
  `test/authorization/test-app.ts`), because the repo has no test that touches a
  real database. The gate is covered three ways instead: the pure predicate
  (`test/unit/login-gate.test.ts`), the guard wiring over HTTP with a
  controllable stub (`test/authorization/login-gate.guard.test.ts`), and a live
  script against the real Better Auth instance
  (`apps/backend/scripts/smoke-login-gate.ts`). The live script is deliberately
  outside `bun test`.

## Verification

- `bun test` in `apps/backend`: 941 pass, 0 fail, 73 files (after the role
  contract and guard-wiring tests were added).
- `bun test` in `apps/web-admin`: 97 pass, 0 fail.
- `bun run typecheck` at the root: pass. `apps/web-admin` `tsc --noEmit`: clean.
- `bun run lint`: 0 errors (warnings pre-existing).
- `bun docs/database/validate-dbml.ts`: OK.
- Migration `20261114120000_erp0048_investor_customer_app_roles` applied to a
  disposable database and inspected: portal-only memberships deleted, mixed rows
  keep their internal roles, portal `org_role` cleared on pending invitations, a
  pre-existing empty-role row survives, second run is a no-op, and the seeder
  runs twice with no portal role written. No table references `auth.members` or
  `auth.user_invitations`, so the deletes orphan nothing.
- Live gate check, `bun run scripts/smoke-login-gate.ts` against a disposable
  database (real Better Auth instance): 8/8 cases - admin without membership 200,
  `admin,investor` 200, `investor` alone 403, `customer` alone 403, plain `user`
  without membership 403, portal role plus an internal membership 200.
- Not verified: the PIC half of the ADR-0017 list (no `warehouse_managers` table
  yet), and browser checks against `bun run dev`.
