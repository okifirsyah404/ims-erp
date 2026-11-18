# M01 — Dashboard

## Purpose

One read-only overview page for the owner and finance: how the business is
doing today, without opening each module. Reads data owned by other modules.
Stores nothing of its own.

## Stage 1 scope (baseline)

Summary of:

- sales
- cash
- profit
- inventory
- projects
- subscriptions nearing their due dates

_Interpretation, needs owner confirmation:_

| Widget | Source module | Figure |
|---|---|---|
| Sales | M02 | Invoiced amount this month and the previous month; open SPH count and value |
| Cash | M09 | Cash/bank balance per account, as of today |
| Profit | M09 | Month-to-date profit and loss from the general ledger (unclosed period is marked "provisional") |
| Inventory | M05 | Item count and stock value from the latest finance summary (HPP is manual, so the value is not live) |
| Projects | M07 | Active projects by status; projects past their target date |
| Subscriptions | M03 | Contracts ending within 30 days and contracts already expired |

Every figure links to the source list it summarizes.

## Stage 2 scope (baseline)

Adds summaries of:

- gateway transactions
- payroll
- subscriptions, using **verified** data only

_Interpretation, needs owner confirmation:_

- Gateway: gross amount, fees, amount awaiting settlement and cash received,
  shown as separate figures (same split as M09 reconciliation).
- Payroll: only **approved** payroll runs, with total and period.
- "Verified" means a valid callback or manual finance verification. Pending
  rows are never counted.

## Explicit limits (out of scope)

- No advanced BI, ad-hoc queries, pivot tables or a chart builder.
- No customized dashboard for each role. _Interpretation:_ one dashboard, and
  widgets are hidden when the viewer lacks permission on the source module.
- No real-time streaming. Figures are computed when the page loads.

## Tasks

| ID | Task | PIC | Days | Price (IDR) | Share |
|---|---|---|---|---:|---|
| T14 | Dashboard and one basic webhook | A | S1 14–15 | 337,500 | Dashboard half; the webhook half is in M04 |
| T31 | Integration, UAT, and final fixes | A + B | S2 27–29 | 750,000 | Stage 2 widgets are verified here (shared task) |

_Interpretation:_ Stage 2 widgets have no task of their own. They are built
inside the tasks that produce their data (T20 payroll, T22 gateway) and
checked in T31.

## SOPs

- S13 Monthly reporting: period close, then financial/operational reports,
  owner review and archive. The dashboard is the operational side of S13.

## Controls

- Figures must come from the same queries or ledger as the official reports
  (M09). A dashboard figure that disagrees with the report is a defect.
- Each widget enforces the source module's permission on the server. Hiding
  a widget in the UI is not access control.
- Customers and investors never see this dashboard. Their views are the
  portals (M07, M11, M12).

## Acceptance

- UAT: dashboard scenarios inside U01–U20 (Stage 1) and U21–U32 (Stage 2),
  per Excel `Scope` sheet. Scenario text is not in the repo.
- _Interpretation:_ each widget figure matches its source report for a test
  month.

## Definition of Done

Common DoD in [README.md](README.md), plus:

- Each widget figure matches its source module report on the seed data, with
  a test asserting the figure.
- A user without permission on a source module gets no data for that widget
  from the API (test covers the denial).
- Provisional and unverified figures are labelled as such in the UI (`en`
  and `id`).

## Dependencies

- Needs: M02, M03, M05, M07 and M09 lists/reports to exist (Stage 1), and
  M08 payroll and M02/M09 gateway (Stage 2).
- Provides: an entry point for S13.

## Current state vs plan (updated 2026-11-16)

- Schema: none needed. `docs.dbml` has no dashboard schema, which is correct.
- Code: no backend `dashboard` module, by decision (plan
  `plans/dashboard-real-data.md`, D3). The dashboard is a **client composition**
  of the owning modules' endpoints: `GET /invoices/summary` (sales),
  `GET /projects/stats` (projects, added 2026-11-15), `GET /cash-bank/accounts`,
  `GET /reports/profit-and-loss`, `GET /items`, `GET /stock/valuation`,
  `GET /licenses/summary`, plus recent invoices and receipts.
- Deviation from the contract above: there is no single `/dashboard/summary`
  endpoint. The server-side gate the DoD asks for is enforced **per source
  endpoint** (`invoice:read`, `cash_bank:read`, `financial_report:read`,
  `product:read` / `product:read_cost`, `project:read`, `license:read`); a
  caller without a source permission gets a 403 for that widget and nothing
  else. The client hides the request as a convenience, not as the boundary.
- Route: `/` (`_authed.index.tsx`) renders `DashboardPage` with real data; the
  sample-data banner is removed.
- Invoiced-sales chart: first card, full width, with presets 14 days, 1/3/6
  months, 1/5 years and a custom date range (`packages/ui` `DateRangePicker`).
  Presets are rolling windows ending today; buckets are daily up to 31 days and
  monthly above. The Sales card keeps its own month-bucketed window. Choosing
  Custom opens the two-month calendar immediately - there is no input to click
  first.
- Freshness: every dashboard query refetches every 60 s (`DASHBOARD_REFRESH_MS`);
  the header Refresh button forces an immediate update.
- Status: **in progress** (ERP-0060). Stage 1 widgets are on real data.
  Stage 2 (gateway, payroll, verified subscriptions) is still planned.
  Open quotations are not shown; the quotations page owns that list.
- Verified in the browser (2026-11-15/16, `progress.md`): `/` on real data, the
  organization switch across two organizations (widget data followed the active
  organization), and single-card degradation (one endpoint failing leaves the
  other widgets intact).
- Not verified: permission denial in the browser (no working non-admin account
  on the dev database). Server-side denial is covered by
  `test/authorization/dashboard-aggregates.test.ts`.
- `beyond-baseline`: none.


