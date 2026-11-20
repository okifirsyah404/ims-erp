> Historical plan written before ADR-0024; module and schema names below are the pre-refactor ones (see docs/database/module-ownership.md for the current mapping).

# Dashboard on Real Data, Client Organization Context, and Switcher Polish

> Status: **approved plan** (grilled 2026-11-15, three rounds, 24 locked
> decisions). Slices 1–4 implemented 2026-11-15/16 (store and switcher; two
> aggregate endpoints; real dashboard with the mock removed; docs close-out).
> ERP-0060 stays `in-progress` until the two checks under "Open verification"
> are done.
> Scope: `apps/web-admin` (organization store, switcher, `/` dashboard) plus two
> read-only backend endpoints (sales, projects) and `docs/`.
> Backlog: **`ERP-0060`** (this plan), **`ERP-0061`** (audit activity roadmap,
> recorded here but out of scope).
> Renumbering (2026-11-16): the plan was drafted as ERP-0055 with a follow-up
> ERP-0056, but `plans/erp-0051-follow-ups.md` already owns those two IDs
> (`Plan decision 6 contradicts the shipped Administration section`;
> `module-ownership.md` schema inventory stale). Renumbered to ERP-0060 /
> ERP-0061 rather than reusing them.
> Related: `docs/plan/erp-module-plans/m01-dashboard.md` (M01 contract),
> `ERP-0040` (dummy org-info dashboard), `ERP-0051` (sidebar / switcher /
> route guards), `ERP-0047` (zustand + realtime precedent).
> No schema change: no table, column, index, constraint, status vocabulary or
> cross-module link moves. `docs/database/` was reviewed for this plan and is
> unchanged; `bun docs/database/validate-dbml.ts` must still print `OK`.

## Problem

- `/` renders `MOCK_SUMMARY` from `apps/web-admin/src/lib/dashboard-api.ts`
  behind a permanent "sample data" banner. Every figure is invented; only the
  subscriptions widget is live (`GET /licenses/summary`).
- `apps/web-admin/src/lib/org-dashboard-data.ts` is a second, unrelated mock
  (organization info tab). It is **not** in this plan's scope.
- The active organization is read ad hoc from the Better Auth session in each
  component (`session.session.activeOrganizationId`). `useActiveOrganizationId`
  documents "never keeps its own copy", so nothing can hold a switch in flight,
  and no API client can send `x-organization-id` without re-reading the session.
- `OrganizationSwitcher` gives no feedback: no marker on the active
  organization, no in-flight state, no role hint, and it degrades into a bare
  button when the user has no internal-role organization.
- The backend has **no** aggregate endpoint for sales or projects, and no
  `dashboard` module. Permission `dashboard: ['read']` exists in
  `packages/common/src/authorization/erp-permissions.ts:31` but **no route uses
  it** — deliberately, see D3.

## Locked decisions

| # | Decision |
|---|---|
| D1 | `activeOrganizationId` lives in a **client zustand store** so a user with several organizations can switch and every surface reads one value. The server session stays authoritative for authorization: switching still calls `organization.setActive`. |
| D2 | The store is a **read-through cache of a server fact**, not a second source of truth. It is seeded from the session and re-seeded whenever the session value changes. |
| D3 | **No backend `dashboard` module.** The dashboard is a client composition of existing module endpoints. Two missing aggregates are added **inside their owning modules** (D9, D10) — the dashboard never queries another module's tables. |
| D4 | Store shape: `{ activeOrganizationId: string | null, setActive(id), reset() }` in `apps/web-admin/src/lib/organization-store.ts` (follows `lib/realtime/realtime-store.ts`; no new `src/stores/` directory). |
| D5 | **No `localStorage` persistence.** A stale id would fire requests at an organization the user may have been removed from. A skeleton until the session resolves is the accepted cost. |
| D6 | Switch is **optimistic**: store first, then `organization.setActive`. On failure the store is rolled back to the previous id and an error toast shows. |
| D7 | Dashboard queries send **`x-organization-id`** from the store. The backend already prefers that header over `session.activeOrganizationId` and re-verifies membership (`apps/backend/src/authorization/elysia-auth.ts:125-163`), so a wrong id is a 403, never another tenant's data. |
| D8 | Drift is reconciled by one `<OrganizationContextSync />` mounted in the authenticated shell: it writes the session value into the store **only when that value changes**, so an optimistic set is never clobbered on re-render. |
| D9 | New endpoint **`GET /invoices/summary?from&to&groupBy=month`** (module `sales`, guard `invoice:read`). One request feeds both the sales card and the 6-month chart. Client-side paging of `/invoices` was rejected: it truncates at 100 rows per page and needs N requests. |
| D10 | New endpoint **`GET /projects/stats`** (module `projects`, guard `project:read`) returning counts by status, by stage, and overdue. It **must** reuse the `list()` visibility rule (`canViewAll ? undefined : actorUserId`), otherwise an aggregate leaks projects the caller may not see. |
| D11 | Status vocabulary for sales figures: `draft`, `void`, `cancelled` are **excluded**; `issued`, `partially_paid`, `paid`, `overdue` count as invoiced. Buckets are keyed on `issueDate`. |
| D12 | "Month" means **Asia/Jakarta** calendar month, computed once in one helper; never the browser zone. |
| D13 | Widgets: sales (MTD + previous month + delta), sales chart (first card, full width, 14 d / 1 m / 3 m / 6 m / 1 y / 5 y / custom range; Custom opens the calendar directly, no input - revised 2026-11-16), cash & bank, profit MTD (badge "provisional"), inventory (item count + stock value), projects, subscriptions, recent activity. **Open quotations is dropped** (D14). |
| D14 | `openQuotes` is not shown: `/sales/quotations` already owns that list, and there is no aggregate for its value. |
| D15 | Recent activity = last 5 invoices + last 5 receipts (both already exist and return a code), replacing the mock feed. The audit log cannot serve this: `GET /admin/audit` only knows `targetType: invitation\|user\|role\|member\|organization` and needs `audit_log:read`. See **ERP-0061** for the real fix. |
| D16 | Every widget is gated in the client with `usePermission` on its **source module** permission, and the server remains the enforcer. A widget the caller cannot read is not rendered; a failing request hides that card's data, not the page. |
| D17 | Per-widget failure isolation: each card owns skeleton / data / `Empty` / error-with-retry. One broken module never blanks the dashboard. |
| D18 | Freshness: every dashboard query uses `staleTime` **and** `refetchInterval` of 60 s (`DASHBOARD_REFRESH_MS`), so figures refresh themselves once a minute; TanStack Query leaves `refetchIntervalInBackground` false, so a hidden tab stops polling and catches up on focus. A header **Refresh** button also invalidates `['dashboard']` for an immediate update. (Revised 2026-11-16: the plan originally said no polling, per M01 "figures computed on page load"; the owner asked for auto-update.) |
| D19 | Query keys carry the organization: `['dashboard', <domain>, organizationId]`. Switching organization therefore renders the new organization's data with no manual invalidation, and never shows the previous one's numbers. |
| D20 | The mock is **deleted**: `fetchDashboardSummary`, `MOCK_SUMMARY`, and the `dashboard:banner.sampleData` key in `en` + `id`. `dashboard-api.ts` keeps its name and exports real query options. |
| D21 | `test/unit/dashboard-api.test.ts` currently asserts the mock; it is **rewritten** (Jakarta month helper, query keys, money formatting), not deleted. |
| D22 | No component tests are introduced: `apps/web-admin/test/` holds only pure-function tests. Dashboard UI is covered by typecheck, lint, locale guards and a browser walk-through. |
| D23 | `useActiveOrganizationId()` keeps its signature; only its body changes to read the store. Its "never keeps its own copy" doc-comment is rewritten to describe the store and cite ADR-0007. |
| D24 | Switcher polish: check mark + `aria-current` on the active organization, spinner on the item being switched with double-click blocked, role shown as `DropdownMenuShortcut`, slug kept as the trigger sub-label, and an `Empty` state when the user has no internal-role organization. |

## Facts established during exploration (do not re-discover)

- `apps/backend/src/app/app.ts` mounts module factories only; module entries are
  `apps/backend/src/app/<module>/index.ts` → `<module>Module()`.
- Controllers are built with `domainPlugin({ name, prefix, tags, guards })`
  (`apps/backend/src/http/plugin.ts`). `sales` and `projects` both use
  `guards: 'erp'`, prefix `/invoices`-rooted and `/projects`.
- `erp.organizationId` in a handler comes from `x-organization-id` else the
  session; membership and permission are re-checked server-side.
- Sales rows carry `grandTotal`, `issueDate`, `status`
  (`apps/backend/drizzle/schemas/sales.schema.ts`); receipts list already returns
  `{ ...receipt, invoiceCode, customerName }`
  (`apps/backend/src/app/sales/repositories/invoice.repository.ts:262-307`).
- `projects.status` is `active | closed | cancelled`; `projects.stage` is
  `preparation | delivery | installation | testing | training | handover | warranty`;
  overdue means `target_end_date < today` on a live, non-cancelled project.
  The mock's `planned/in_progress/done/on_hold` vocabulary does not exist.
- `ProjectService.list` narrows rows with `involvedUserId: ctx.canViewAll ? undefined : ctx.actorUserId`;
  `canViewAll` is `project:assign|read_cost|export` or `service_ticket:assign`
  (`apps/backend/src/app/projects/utils/project-context.ts`).
- `GET /cash-bank/accounts` is the one non-paginated list and already returns
  `currentBalance` per account; `GET /stock/valuation` returns `grandTotal`;
  `GET /items` exposes the total through `meta.total`; `GET /licenses/summary`
  returns `{ endingWithinDays, endingSoon, ended }`.
- Client query options already exist for cash accounts (`finance-api.ts:340`),
  P&L (`finance-api.ts:637`), stock valuation (`stock-valuation-api.ts:42`),
  licenses (`license-api.ts`), items (`inventory-api.ts:256`) and projects
  (`project-api.ts`). They do **not** send `x-organization-id` today.
- Zustand is already a dependency and used once, for ephemeral socket state.
- `apps/web-admin/src/routes/_authed.tsx` returns `{ session }` from `beforeLoad`
  and wraps the outlet in `MainLayout`.

## Slice 1 — Organization context store and switcher

1. `apps/web-admin/src/lib/organization-store.ts`: zustand store per D4, with a
   `getActiveOrganizationId()` accessor for non-React callers and
   `organizationHeaders()` returning `{ 'x-organization-id': id }` (empty when
   no organization).
2. `apps/web-admin/src/components/organization/organization-context-sync.tsx`:
   `useSession()` → `useEffect` writes the value only when it differs from the
   store (D8). Mounted once in `MainLayout`.
3. `apps/web-admin/src/lib/use-active-organization.ts`: same signature, reads the
   store (D23).
4. `apps/web-admin/src/components/sidebar/organization-switcher.tsx`: optimistic
   switch with rollback (D6), check mark + `aria-current`, in-flight spinner,
   `DropdownMenuShortcut` for the member role, `Empty` state (D24).
5. Send `organizationHeaders()` from the API modules the dashboard consumes
   (`finance-api.ts`, `inventory-api.ts`, `stock-valuation-api.ts`,
   `license-api.ts`, `project-api.ts`, and the new sales summary client) (D7).
6. New `nav` locale keys in `en` + `id` for the added switcher copy.
7. Unit test: store seeds once, does not overwrite an optimistic set, `reset()`
   clears; `organizationHeaders()` is empty without an organization.

Exit: switching organization updates every consumer from one value; no page
reads `session.session.activeOrganizationId` for the dashboard path.

## Slice 2 — Two read-only endpoints

1. `sales`: `invoiceSummaryQuerySchema` (`from`, `to`, `groupBy=month`) in
   `contracts/invoice.contract.ts`; `InvoiceRepository.summary(organizationId,
   { from, to })` doing `SUM(grand_total)` + `count()` bucketed by month;
   `InvoiceService.summary`; `GET /invoices/summary` on `InvoiceController` with
   `erp: { permission: ['invoice:read'] }`.
   Payload: `{ from, to, totalInvoiced, invoiceCount, months: [{ month, invoiced, count }] }`,
   statuses per D11.
2. `projects`: `ProjectRepository.stats({ involvedUserId })` (counts by status,
   by stage, overdue) and `ProjectService.stats(ctx)` reusing the `list()`
   visibility rule (D10); `GET /projects/stats` with `project:read`.
   Payload: `{ active, closed, cancelled, overdue, byStage: [{ stage, count }] }`.
3. Tests: month bucketing and range filtering; `invoice:read` denial; stats
   visibility for a non-involved member versus a manager; `project:read` denial.

Exit: both endpoints answer over real HTTP with a seeded organization; no
cross-module repository access; `docs/database/` unchanged.

**As built (2026-11-15).** `INVOICED_STATUSES` is `issued | partially_paid | paid`:
`overdue` is derived from `due_date` at read time and never stored, so it cannot
appear in the column. Buckets group on `left(issue_date::text, 7)` rather than
`to_char(issue_date, $1)`, because PostgreSQL does not consider the select-list
and `GROUP BY` calls of a parameterised `to_char` to be the same expression
(first run failed with `must appear in the GROUP BY clause`). Evidence and the
local-PostgreSQL proof are in `progress.md` 2026-11-15 "slice 2".

## Slice 3 — Dashboard on real data

1. Rewrite `apps/web-admin/src/lib/dashboard-api.ts`: per-domain query options
   keyed by organization (D19), Jakarta month helper (D12), sales-summary client
   (D9). Mock removed (D20).
2. Rewrite `apps/web-admin/src/components/dashboard/dashboard-page.tsx`: header
   (organization name, Refresh), widget grid per D13, `usePermission` gating
   (D16), per-widget states (D17), provisional badge on profit, "—" plus tooltip
   when stock value is withheld for missing `product:read_cost`.
3. `routes/_authed.index.tsx`: replace the empty `null` for a user with no
   internal-role organization with an `Empty` state pointing at `/organizations`
   (non-internal users still get nothing, to avoid a `/` redirect loop).
4. Locale keys: remove `dashboard:banner.sampleData`; add only what renders
   (refresh, error/retry, empty, activity rows, provisional, stock-value
   withheld). `en` + `id` both, parity and dead-key guards green.
5. Rewrite `test/unit/dashboard-api.test.ts` per D21.

Exit: `/` shows real figures for the active organization, changes when the
organization changes, survives one failing endpoint, and `bun run lint`,
`bun run test`, `bun run typecheck` are green.

## Slice 4 — Docs close-out

1. `docs/plan/erp-module-plans/m01-dashboard.md`: status `planned` → `in progress`,
   plus a "deviation" note that the dashboard is a client composition and no
   backend `dashboard` module exists.
2. `docs/plan/backlog.md`: `ERP-0060` status with evidence; `ERP-0061` for the
   audit-activity roadmap below.
3. `docs/plan/plans/features.md` rollup updated in the same change.
4. `docs/plan/progress.md`: one dated entry per slice with exact commands and
   outcomes, and the line stating `docs/database/` was reviewed and unchanged.

**As built (2026-11-16).** All four items done. The ID collision described in
the header forced a renumber to ERP-0060 / ERP-0061 in every document that
mentions this work.

## Definition of done

1. `bun run lint`, `bun run test`, `bun run typecheck` green in the touched
   workspaces; locale parity + dead-key guards green.
2. `bun docs/database/validate-dbml.ts` prints `OK` (no schema delta).
3. Backend tests cover both new endpoints including permission denial and
   projects visibility.
4. Browser walk-through: switch organization on `/`, all widgets change; revoke
   a permission and confirm the widget disappears; kill one endpoint and confirm
   only that card degrades. *Met except the revoke-a-permission step, blocked on
   a working non-admin account (see "Open verification").*
5. `progress.md` + `backlog.md` + `features.md` updated in the same change.

## Open verification (updated 2026-11-16)

Done (browser, local stack): lint, tests, typecheck, `validate-dbml.ts`; `/`
loads with all nine dashboard requests 200 and `x-organization-id`; no console
errors. Two-organization switch: a second organization was created, the UI
switch moved the Cash widget from empty to that organization's account and back
(`progress.md` 2026-11-15/16). Single-card degradation: with `/projects/stats`
forced to 500, only the Projects card showed "unavailable", Sales and Inventory
kept their figures, and Try again recovered the card.

Still open (ERP-0060 stays `in-progress` until these pass):

- Permission denial in the browser: no seeded non-admin account signs in here
  (role-account seeds returned 401). Server-side denial is covered by
  `test/authorization/dashboard-aggregates.test.ts`; the browser check needs a
  working account.
- A screenshot for the review, which needs a visible desktop window.

Found while verifying, out of scope, not fixed:

- `POST /cash-bank/accounts` stores `openingBalance` but sets
  `currentBalance: 0` (`cash-bank.service.ts:113`), so a new account shows Rp 0
  on the dashboard. A design decision is needed (post the opening balance as a
  journal, or seed `currentBalance`).
- No DELETE route exists for cash accounts; the verification account was
  deactivated with `PATCH isActive:false` and stays on the dev database.



## Out of scope / follow-ups

- **ERP-0061 — audit as an activity feed.** `GET /admin/audit` only records
  `invitation | user | role | member | organization`, so it cannot describe
  business activity. Extending `targetType` (and the producers that write those
  rows) to invoices, projects, stock movements and licenses is the real fix for
  D15; until then the dashboard reads invoices and receipts directly.
- Organization info tab mock (`lib/org-dashboard-data.ts`, `ERP-0040`) — reuse
  the widgets from this plan when it is wired, do not duplicate the mocks.
- Per-widget server-side gating (M01 requires it for a real `/dashboard/summary`
  endpoint). Not applicable while the dashboard composes module endpoints, each
  of which already enforces its own permission.
- Web Push, real-time dashboard refresh, per-role dashboards: still out of scope
  per M01.

