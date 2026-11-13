# Role-Based Sidebar, Route Guards, and Warehouse Person-in-Charge

> Status: **planned** (approved through grilling, 2026-11-14). Nothing shipped.
> Branch: `fix/side-nav-role-based`.
> Scope: `apps/web-admin` (sidebar, switcher, route guards) plus the backend
> pieces it depends on (login gate, warehouse person-in-charge access).
> Backlog: **no `ERP-*` ID claimed** (pure fix plus one new ADR-backed
> capability; see "Backlog" below).
> Decisions: ADR-0017 (`proposed`, to be written in Phase 0).

## Problem

- `main-sidebar.tsx` hides only `adminOnly` items. Every other section renders
  for every user, whatever the active organization and roles.
- `nav-config.ts` states "Permission gating is intentionally absent in this pass".
- Route guards exist only as UI gating. A user who types a URL reaches the page.
- The organization switcher lists every membership, including organizations
  where the user holds only the `investor` or `customer` role.
- Investors and customers should not log in to `apps/web-admin` at all. Their
  roles are for a future investor view in another app.
- Warehouses are global-admin-only (ADR-0008 §3, ADR-0010 §7). A warehouse
  person-in-charge (PIC) has no way to manage their own warehouse without being
  an app admin.
- Logo: `TOrganization.logo` exists in the list response, but the switcher does
  not show it. Cache keys are inconsistent (`['organizations']` vs
  `['erp-organizations']`), so an updated logo can stay stale.

## Locked decisions

| # | Decision |
|---|---|
| 1 | **Visibility is server-decided.** Frontend checks are UX only. Backend enforces every route. |
| 2 | **Hidden, not disabled.** A nav item the user cannot use is not rendered. Parent hides when no child passes. |
| 3 | **Deny by default.** A nav item with neither `permission` nor `open` is hidden. |
| 4 | **Dashboard (`/`) and Settings** show with the rules below. Dashboard is open to any logged-in user with an internal role. Settings needs an active organization. |
| 5 | **Warehouse section item** shows for app admins and for PICs (`GET /warehouses/mine`). Stock/inventory items stay on org permissions (ADR-0010). |
| 6 | **Administration** section: app admins only (`appAdminOnly`), as today. |
| 7 | **Skeleton** per section while permissions resolve. Never hide everything during load. |
| 8 | **Route guard**: `beforeLoad` in `routes/_authed` checks the same permission map as the nav. On failure: redirect to `/` plus an i18n toast (`en` + `id`). |
| 9 | **Switching organization** re-checks the current route. If it is no longer allowed, redirect to `/`. |
| 10 | **Switcher** lists only organizations where the user holds at least one internal role. The `investor` and `customer` roles are ignored in web-admin. |
| 11 | **Internal role** = any `erpRoleNames` entry except `investor` and `customer`. `freelancer` and `auditor` count as internal. |
| 12 | **Default organization** = the first organization where the user holds an internal role. Set by the server at login (Better Auth hook). |
| 13 | **Login gate** (backend, Better Auth hook): reject sessions with no internal role in any membership, unless the user is an app admin. Enforced server-side, not only hidden in UI. |
| 14 | **Existing sessions** are re-checked by `sessionGuard` on each request, so a session created before the gate is also rejected. |
| 15 | **App admin** bypasses the login gate and sees all organizations (existing ADR-0007 behavior). |
| 16 | **Multi-role per member**: `member.role` is a comma-separated string. Role checks are done per role name after splitting. |
| 17 | **Logo** uses `TOrganization.logo` from `organizationsQueryOptions`. Fallback: `Building2` icon. Cache keys unified. |
| 18 | **Warehouse PIC** (new capability, ADR-0017): a user assigned to a warehouse gets `warehouse:read`, `update`, `archive`, `import`, `export`. No `create`. "Delete" in the business sense = `archive` (the catalog has no `delete`). |
| 19 | **PIC does not need an active link** from the warehouse to the active organization. PIC can see and manage their own warehouse even when it is not linked to the active organization. This is an explicit exception to ADR-0010 §5. |
| 20 | **Stock stays on org roles.** PIC does not receive stock, receive, issue, transfer, or adjustment rights through the PIC grant. Those still come from the org `warehouse` role plus the link (ADR-0010 §5). |
| 21 | **Assign and unassign PIC**: app admin only. Each change is audited (`warehouse.manager_assigned`, `warehouse.manager_removed`). |
| 22 | **Warehouse create**: app admin only. |
| 23 | **Investor and customer roles** have no internal statements. A user who holds both an internal role and `investor` in one organization logs in normally. The `investor` role does not grant anything in web-admin. |

## Phase 0 — Decisions and docs

1. Write `docs/architecture/decisions/ADR-0017-warehouse-person-in-charge.md`
   (`proposed`). Content:
   - PIC is a per-user, per-warehouse grant, separate from organization roles.
   - It is not evaluated by `erpGuard`. A new `warehouseGuard` evaluates it.
   - Explicit exception to ADR-0010 §5 (no link check for PIC).
   - Amends ADR-0008 §3 and ADR-0010 §5, §7, §10: "no organization role holds
     `warehouse:*`" stays true; PIC is the only new path.
   - Login gate rule and internal-role definition.
2. Update `docs/plan/plans/features.md` with the plan entry.
3. Owner sign-off on ADR-0017 is required before Phase 2 merges.

## Phase 1 — Schema (`inventory`)

Edit `docs/database/docs.dbml` first (canonical), then:

```text
bun docs/database/gen-logical-references.ts
bun docs/database/validate-dbml.ts   # must print OK
```

New table `inventory.warehouse_managers`:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `warehouse_id` | uuid not null | Intra-schema FK to `inventory.warehouses.id`, `ON DELETE CASCADE` |
| `user_id` | text null | Logical reference to `auth.users.id` (ADR-0014). Presence checked by the Identity contract before write. |
| `assigned_by` | text null | Logical reference to `auth.users.id` |
| `created_at` | bigint | unix ms (`unixTimestamp`) |
| `deleted_at` | bigint null | soft delete (`drizzle-soft-deletes`) |

- Unique partial index `(warehouse_id, user_id) WHERE deleted_at IS NULL`.
- Index on `user_id` for the `GET /warehouses/mine` lookup.
- Migration generated with `bun run drizzle:generate`, SQL inspected, applied
  to a disposable database, then `drizzle:migrate` and `drizzle:seed` run twice.
- `warehouse_managers` gets no money, quantity, or status vocabulary.

## Phase 2 — Backend authorization

1. **`warehouseGuard`** (new, next to `erpGuard` in `src/authorization/`):
   - Requires a Better Auth session. No active organization required.
   - Allowed when the caller is app admin, or has an active PIC row for the
     `:id` warehouse.
   - Macro options: `{ action: 'read' | 'update' | 'archive' | 'import' | 'export' }`.
     Create stays `requireGlobalAdmin`.
   - Error mapping follows the existing `ErpAuthError` envelope.
2. **Routes**:
   - `GET /inventory/warehouses/mine`: session guard; returns warehouses where
     the caller is an active PIC. App admins get the full list.
   - `GET/PATCH /inventory/warehouses/:id` and storage routes: `warehouseGuard`.
     Storage create/update/archive: PIC allowed for `update` and `archive`.
   - `POST /inventory/warehouses`: `requireGlobalAdmin` (unchanged).
   - Assign/unassign manager routes: `requireGlobalAdmin`, with audit writes.
3. **Services**:
   - `WarehouseManagerService` (`assign`, `unassign`, `listMine`).
   - Assign verifies the target user through the Identity contract. Unknown or
     deleted user → 404.
   - Duplicate active assignment → 409 `WarehouseManagerExistsError`.
   - Keep `assertWarehouseLinked` for stock and adjustment routes unchanged.
4. **Errors** under `inventory/errors/`, extending `AppError`. Locale keys added
   in `en` + `id`.
5. **Tests** (bun:test, mocked DB):
   - Non-PIC, non-admin → 403 on warehouse read.
   - PIC of warehouse A → 404 on warehouse B (not 403, so existence is not
     leaked).
   - PIC without an org link → still reads own warehouse (decision 19).
   - PIC `create` → 403.
   - PIC `archive` on own warehouse → allowed.
   - Soft-deleted assignment → denied.
   - Assign by non-admin → 403. Duplicate assign → 409.

## Phase 3 — Login gate and session

1. Verify the Better Auth version installed in `apps/backend` before writing code.
   Confirm the hook point (`databaseHooks.session.create.before` or equivalent).
2. Hook logic:
   - Load memberships for the user.
   - If the user is app admin: allow.
   - If no membership role is internal: reject with a clear error envelope.
   - Otherwise set `activeOrganizationId` to the first organization with an
     internal role, if none is already active.
3. `sessionGuard` re-checks the internal-role rule per request for sessions created
   before the gate was added.
4. Tests: investor-only → rejected; investor + internal → allowed, default org
   is the internal one; app admin without membership → allowed; customer-only
   → rejected.

## Phase 4 — Web-admin

1. **Nav model** (`nav-config.ts`, `sidebar-item.ts`):
   - Add `permission?: Permission | Permission[]`, `open?: true`,
     `appAdminOnly?: true`.
   - Replace `adminOnly` with `appAdminOnly`.
   - Items with none of `permission`, `open`, `appAdminOnly` are hidden.
   - Warehouse item: `appAdminOnly` or PIC (via `/warehouses/mine`). Modeled as
     a custom predicate, not a permission string.
2. **`filterNav(sections, { can, isAppAdmin, isPic })`** (pure, in
   `nav-config.ts` or a sibling file). Unit tests in `apps/web-admin/test/unit`.
3. **Permission batch hook**: one `organization.hasPermission` call with every
   nav permission, cached under `['erp-has-permission', userId, activeOrgId]`.
   Skeleton per section while pending.
4. **`main-sidebar.tsx`**: replace the "organization-only users" comment. Use
   `filterNav`.
5. **Switcher** (`organization-switcher.tsx`):
   - List only organizations with an internal role (decision 10).
   - Logo from `TOrganization.logo`, fallback `Building2`.
   - Invalidate `['erp-has-permission']` and `['erp-organizations']` after switch.
   - Re-check the current route (decision 9).
   - Unify the cache key with `organizationsQueryOptions` (currently
     `['organizations']`). Upload/delete logo invalidates both keys.
6. **Route guard** in `routes/_authed` `beforeLoad`:
   - Map URL prefix → permission or predicate (same source as nav).
   - `/admin/*` and `/organizations/new` → app admin only.
   - Failure → `redirect({ to: '/' })` + toast.
7. **i18n**: new strings (guard toast, skeleton labels if any) in `en` and `id`.
   Run `bun run test` (locale parity and dead keys).
8. **Warehouse PIC UI**: PIC sees the warehouse list filtered to their
   warehouses. Create button hidden for PIC (decision 22). Manager assign UI
   for app admin only.

## Phase 5 — Verification

- `bun run lint`, `bun run test`, `bun run typecheck` from repo root.
- Backend denial tests (Phase 2) and login-gate tests (Phase 3).
- Manual checks in the browser, one account per role:
  - App admin (no membership) → all items, org list shows all internal orgs.
  - PIC without org link → Warehouse item, own warehouse only, no create.
  - Multi-org user → switcher shows only internal orgs, default is internal.
  - Investor-only → login rejected.
  - Investor + internal in another org → login ok, investor org missing from switcher.
  - Customer-only → login rejected.
  - Route typed directly without permission → redirected to `/`.
- Use `bun run dev` for the manual pass. Do not claim verified without evidence.

## Phase 6 — Docs in the same change

- `docs/database/docs.dbml` updated, `validate-dbml.ts` prints `OK`.
- `docs/architecture/decisions/ADR-0017-*.md` status moves to `accepted` only
  after owner sign-off.
- `docs/plan/progress.md`: dated entry with exact commands and results.
- `docs/plan/backlog.md`: no `ERP-*` claimed. Record the fix as a non-ERP
  entry, or add a new ERP ID if the owner wants one. Owner decides.
- `docs/plan/plans/features.md`: move this plan's status with the code.

## Risks and open points

- **ADR-0010 §5 exception** (PIC without link) weakens the link model. It is
  deliberate (decision 19) but must be stated in ADR-0017 and reviewed.
- **Better Auth hook API** is not verified yet. Phase 3 starts with that check.
- **`member.role` as comma-separated string**: role checks must split on `,`.
  Existing `guardResolve` already does this; the login gate must match it.
- **Existing sessions**: handled by re-checking in `sessionGuard` (decision 14).
  Sessions stay valid until expiry otherwise.
- **Item Warehouse for PIC** needs the `/warehouses/mine` endpoint before the
  nav can show it. Until then the item stays hidden for PIC.
- **Owner sign-off** on ADR-0017 is required. Until accepted, the PIC backend
  work stays on the branch and is not merged.

## Out of scope

- Stock and inventory operations for PIC (decision 20).
- Investor view in another app (separate product).
- Restore endpoint for warehouses (no change, per warehouse-hardening D2).
- Replacing `usePermission` with the batch hook across the rest of the app.
  Only nav and route guard use the batch in this plan.
