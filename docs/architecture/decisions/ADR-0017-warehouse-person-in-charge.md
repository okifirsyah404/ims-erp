# ADR-0017 — Warehouse Person-in-Charge Access and Web-Admin Login Gate

- **Status:** accepted (2026-11-14), **implemented and verified (2026-11-14)**. Phases 1-5 landed on
  `refactor/app-roles-investor-customer`: Phase 1 (the `inventory.warehouse_managers` table, its
  migration and seeder), Phase 2 (the `warehouseGuard`, the PIC routes and the assignment service),
  Phase 4 item 8 (the PIC nav item and warehouse UI in `apps/web-admin`) and Phase 5 (live HTTP smoke
  plus a real-browser pass, summarised at the end of this ADR). `fix/side-nav-role-based` keeps an
  earlier Phase 4 web-admin record. Phase 2 was grilled before coding: the guard reaches the inventory
  module through a port rather than Drizzle, the 403/404 split below is confirmed,
  `GET /warehouses/mine` returns storages, and the route/idempotency rules below are the agreed ones.
- **Amends:** ADR-0008 §3 (warehouse access) and ADR-0010 §5 (access = role +
  link), §7 (org `admin` and `warehouse` role), §10 (`responsible_employee_id`
  stays display-only, but a PIC grant is now a separate, real access path).
- **Context:** ADR-0008 and ADR-0010 make warehouse CRUD global-admin-only, and
  stock operations run through organization roles plus a warehouse↔organization
  link. A warehouse has a real person in charge (PIC), who today cannot manage
  their own warehouse without being an application admin. Making them an
  application admin gives them every organization and every global warehouse.
  Separately, investors and customers hold organization roles that only exist
  for a future investor/customer view in another app. Those users must not be
  able to log in to `apps/web-admin`.
- **Decision:**
  1. **PIC is a per-user, per-warehouse grant.** A new table
     `inventory.warehouse_managers` links a warehouse to a user (many users per
     warehouse, many warehouses per user). It is separate from organization
     roles. Organization roles remain the only source of organization
     permissions.
  2. **PIC rights on their warehouse:** `warehouse:read`, `update`, `archive`,
     `import`, `export`. No `create`: creating a warehouse stays with application
     admins. "Delete" in business terms means `archive`, because the catalog has
     no `delete` action.
  3. **PIC does not need a link to the active organization.** A PIC can see and
     manage their own warehouse even when it is not linked to the active
     organization. This is an explicit exception to ADR-0010 §5 (unlinked → 404).
     Other organizations still cannot see the warehouse.
  4. **Stock is not part of the PIC grant.** Stock, receive, issue, transfer,
     and adjustment stay on the organization `warehouse` role plus the link
     (ADR-0010 §5). A PIC without that role cannot move stock.
  5. **Evaluation path.** A new `warehouseGuard` evaluates the PIC grant. It
     requires a Better Auth session and does not require an active organization.
     `erpGuard` is not changed and does not read PIC rows. `requireGlobalAdmin`
     stays on create, assign, and unassign.
  6. **Assign and unassign** a PIC are application-admin only. Each change is
     audited (`warehouse.manager_assigned`, `warehouse.manager_removed`).
     Soft-deleted assignments grant nothing.
  7. **Not-found over forbidden.** A PIC requesting a warehouse they do not
     manage gets 404, the same answer as for an unknown warehouse, so existence
     is not leaked.
  8. **Login gate.** A Better Auth hook rejects a session when the user is not an
     application admin and holds no internal organization role in any
     membership. The **internal** roles are every `erpRoleNames` entry;
     `freelancer` and `auditor` count as internal. `investor` and `customer` are
     no longer organization roles (ADR-0018), so they never count. A PIC with no
     membership is rejected. Sessions created before the gate are rejected too:
     `sessionGuard` re-checks the rule on each request.
  9. **Default organization.** At login the server sets the active organization
     to the first membership with an internal role, when none is active.
     Memberships without an internal role are not offered in the web-admin
     switcher. A user with an `investor` app role and an internal membership logs
     in normally; the app role grants nothing in web-admin.
     (Amended by ADR-0018.)
  10. **Application admins** bypass the login gate and see every live
      organization, as today (ADR-0007).
- **Consequences:**
  - One new inventory table (`warehouse_managers`), with a migration and a
    `docs/database/docs.dbml` update. `validate-dbml.ts` must print `OK`.
  - One new guard and one new service (`WarehouseManagerService`). Warehouse
    routes that PICs may call move from `requireGlobalAdmin` to `warehouseGuard`.
  - `GET /inventory/warehouses/mine` lists a caller's managed warehouses for the
    sidebar and pickers.
  - A login hook in the Better Auth configuration. Its exact API depends on the
    installed Better Auth version and is verified before implementation.
  - The organization-role rule "no organization role holds `warehouse:*`" stays
    true. PIC is the only new path to `warehouse:*`, and it is per warehouse.
- **Alternatives considered:**
  - **Make the PIC an application admin.** Rejected: grants every organization and
    every global warehouse.
  - **Keep the PIC display-only (ADR-0010 §10 as written).** Rejected by the owner:
    the PIC must manage their own warehouse.
  - **Named member assignment per organization.** Rejected in ADR-0010 as a second
    permission system. PIC is also a second path, but it is limited to one
    resource (warehouses) and one link (PIC ↔ warehouse), and it does not grant
    stock.
  - **Enforce the link check for PICs too.** Rejected by the owner: a PIC must
    keep access even when their warehouse is not linked to the active
    organization.
- **Risks:**
  - Decision 3 weakens the link model for PICs. It is deliberate and must be
    reviewed at acceptance.
  - Decision 8 blocks users who hold only investor or customer roles at login.
    Any future internal-role rename must update this rule.
  - Decision 5 adds an authorization path outside `erpGuard`. Each route that
    uses `warehouseGuard` needs denial tests (non-PIC, PIC of another warehouse,
    archived assignment, PIC create).
- **Verification (required before acceptance):** denial tests for `warehouseGuard`
  and the login hook; manual check with an investor-only user, an
  investor-plus-internal user, a PIC without an organization link, and an
  application admin without membership.
- **Verification progress:**
  - Login hook: done 2026-11-14 - `login-gate.guard.test.ts` (stubbed gate over
    HTTP) plus `scripts/smoke-login-gate.ts` against the real Better Auth
    instance, 8/8 cases including investor-only (403), investor-plus-internal
    (200) and admin-without-membership (200).
  - Phase 1 schema: done 2026-11-14 - table, hand-written migration replayed on
    a throwaway database (columns, indexes and cascade FK inspected), seeder
    idempotent across three runs, `validate-dbml.ts` `OK`.
  - `warehouseGuard` denial tests: done 2026-11-14 - `warehouse-authorization.test.ts`
    proves PIC read/update/storage access, PIC of another warehouse → 404 (not 403),
    no live or soft-deleted grant → 403, PIC create → 403, PIC assign → 403, and
    `GET /warehouses/mine` 401/200/empty/app-admin cases. `WarehouseManagerService`
    has its own unit tests (409 duplicate, 404 unknown user/warehouse, idempotent
    unassign, `listMine`). Backend 979 pass / 0 fail; typecheck and lint clean.
  - Phase 4 + Phase 5 end-to-end: done 2026-11-14, branch
    `refactor/app-roles-investor-customer`. Backend enforcement measured over
    real HTTP by `scripts/smoke-warehouse-pic.ts` against a freshly seeded
    disposable database: 47 pass / 0 fail, covering the login gate (app admin
    without membership 200, investor-only 403, customer-only 403,
    investor-plus-internal 200), no-session 401, PIC `/mine` returning exactly
    the granted warehouse, PIC of another warehouse 404, no-grant member
    `/mine` empty (not 403), direct admin routes 403, the assign/unassign round
    trip, and a PIC of a warehouse with **no**
    `inventory.warehouse_organizations` row (decision 3: read/update/archive
    and `POST /storages` 201). Rendering measured in a real browser (Edge, Vite
    5173 + backend 3001, disposable database, one fixture account per role):
    the nav item appears for the app admin and for a PIC without an
    organization link, the PIC list shows only its own warehouse with zero
    create controls and only the `Storage` detail tab, `/inventory/warehouses/new`
    redirects away, the multi-org switcher hides the item on an organization
    without the grant, investor-only and customer-only logins are rejected with
    "Web-admin access requires an internal organization role", and the
    assign/unassign controls work end to end. Full evidence, including the two
    corrections the run forced, is in `docs/plan/progress.md` under
    "2026-11-14 - ERP-0051: warehouse PIC Phase 5".
  - Dev-database reset + `import`/`export`: done 2026-11-14. The earlier Phase 5
    evidence used a disposable database because `ims_erp_local` predated the PIC
    table; `drizzle:migrate-reset` now rebuilds it (11.9 MB `pg_dump` backup
    first, then 116 tables / 57 journal rows, seeders clean) and the same 47
    cases pass against it. Two rights in decision 2, `import` and `export`, are
    declared but have no route; 6 action-matrix tests in
    `warehouse-authorization.test.ts` prove `warehouseGuard` is action-agnostic
    across all five actions and that the controller declares only
    `read`/`update`/`archive`, so a future import/export route breaks the test
    rather than the assumption. Backend 1005 pass / 0 fail.
