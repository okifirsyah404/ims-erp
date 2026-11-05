# Feature Status

Living status of every feature in `docs/plan/` (v5.1 module plans M01–M12 +
`backlog.md` ERP IDs), plus shipped features outside that scope.

Rules:

- Statuses: `planned` / `in-progress` / `implemented` / `verified` /
  `accepted` / `blocked`. `accepted` needs real reviewer sign-off; green tests
  never qualify.
- **`backlog.md` is the source of truth.** This file rolls those statuses up
  by module; on conflict, fix `backlog.md` first, then this file.
- Update this file in the same change that moves a `backlog.md` status
  (AGENTS.md Definition of Done item 5).
- Evidence = module path + test file or `progress.md` date.

Last synced: 2026-11-05.

> **Sidebar shell note (2026-11-05):** the web-admin sidebar now renders the
> full M01–M12 nav map (see `progress.md`, "UI — full ERP sidebar shell").
> Routes marked below as `dbml only` / `Evidence: none` may already have a
> `ComingSoonPage` stub route (e.g. `/finance/tax/*`, `/procurement/*`,
> `/crm/*`); a stub is UI scaffolding, **not** feature status. Status here
> still means real, working functionality.

---

## M01 Dashboard

### planned
- Stage 1 widgets: sales, cash, profit, inventory, projects, subscriptions — T14.
  Evidence: none. Blocked in practice by missing source modules.
- Stage 2 widgets: gateway, payroll, verified subscriptions — T31. Evidence: none.
- UI mock scaffold: `_authed.index.tsx` renders a dummy `DashboardPage`
  (sample data via `apps/web-admin/src/lib/dashboard-api.ts`, `dashboard`
  locale namespace). Scaffold only — **not feature status**; figures are
  placeholders until the real API replaces the mock fetcher.


## M02 CRM and Sales

### planned
- Leads, follow-ups/surveys, customers — T05, ERP-0004/0005. Evidence: dbml
  `crm` only.
- Invoice, DP (customer advance), receipt — T05, ERP-0011. Evidence: dbml
  `finance.invoices`/`receipts` only.
- One template per document — T05. Evidence: dbml `documents` only.
- Checkout / online orders — T21, ERP-0020. Evidence: dbml `commerce` only.
- Payment gateway callbacks + reconciliation — T22, ERP-0020. Evidence: none
  (see `sales.payments` under Outside the plan).

### in-progress
- SPH (quotation) + simple price approval — T05, ERP-0011 (`planned` in
  backlog). Evidence: `apps/backend/src/app/sales` create/list/get/update/
  submit/decision; `test/authorization/authorization.test.ts`. Gaps:
  `quotation_items` not in Drizzle, no UI route.

## M03 Subscription and Licensing

### planned
- Contract + license key register, dates, status, due list — T09, ERP-0019.
  Evidence: dbml `licensing` only.
- API keys + validate/activate/renew, grace/suspend — T23, ERP-0019.
  Evidence: dbml only.

### blocked
- Pilot application licensing integration — T24. Needs pilot app source access.

## M04 n8n, WhatsApp, Website

### planned
- One ERP event → n8n webhook (outbox, log, manual retry) — T14. Evidence:
  dbml `automation` only.
- Public catalog + IMS profile page, requirements form, WA button — T15.
  Evidence: none.
- AI FAQ + n8n integration — T27, ERP-0021. Evidence: none.
- Notifications, human handoff, WhatsApp logs — T28, ERP-0021. Evidence: none.

## M05 Inventory and Purchasing

### planned
- Inventory movement boundaries / valuation + GL reconciliation — ERP-0014
  (re-scoped into S1–S4; valuation deferred, OPEN-3).
- Suppliers, purchase orders, goods receipt, payables — T07, ERP-0012.
  Evidence: dbml `procurement` only.
- HPP / stock value via finance summary — T07. Evidence: none.

### implemented
- Stock ledger S3 — ERP-0028. Evidence:
  `apps/backend/src/app/inventory/services/stock.service.ts`,
  `test/unit/stock.service.test.ts` (22 tests), UI
  `/inventory/stock`, `/stock/movements`, `/stock/adjust`, `/stock/adjustments`.
  GL reconciliation portion of the original ERP-0014 criterion still open
  (OPEN-3 in `plans/inventory.md`).
- Items + serialized units S1 (SN statuses `pre_order` … `applied_warranty`)
  — T07, ERP-0014 S1. Evidence: `inventory/services/item.service.ts`,
  `test/unit/item.service.test.ts`, `item-status-matrix.test.ts`; UI
  `/inventory/items`, `/products`, `/materials`, `/components`, `/tools`.
- Warehouses S2 + addresses + storages + hardening (guards, counts,
  per-warehouse quantity, card grid, detail tabs, i18n) — ERP-0027. Evidence:
  `inventory/services/warehouse.service.ts`,
  `test/unit/warehouse.service.test.ts` (23 tests),
  `plans/warehouse-hardening.md` phases 1/2/2b done, UI
  `/inventory/warehouses/*`. Note: multi-warehouse rebaselined by ADR-0010
  (proposed 2026-11-04, owner sign-off pending).

### planned (ADR-0010)
- Warehouse↔organization links + scoped access — ERP-0031. Evidence:
  `docs.dbml` `inventory.warehouse_organizations` only.
- Stock transfers (warehouse→warehouse, storage→storage) — ERP-0032.
- Tracking views (per-storage balances, movement filters, unit location) —
  ERP-0033.
- Minimal HR employees + warehouse PIC (display-only) — ERP-0034.

### blocked
- Procurement (suppliers, PO, receipts) — ERP-0035. Needs M09 payables
  (ERP-0012).

## M06 Assets and Equipment

### in-progress

- Location tracking + borrowing ownership — ERP-0036. Evidence: contract
  shipped 2026-11-05 (`docs/database/docs.dbml`: assets 14 tables incl.
  `asset_types` + borrowing trio, inventory 13 tables, `validate-dbml.ts`
  prints `OK`; plan `plans/assets-equipment-location-and-borrowing.md` Slice 1
  done). Schema, migration, code and UI are still pending — five slices total.
  Stage 0 execution review resolved all blocking defects (global assets with
  stubbed warehouse reachability, global unique asset code, no
  `document_sequences` change, jsonb permission migration). Supersedes the M06
  "loan register" note below once implemented.

### planned

- Asset register: value, PIC, condition, service notes — T07, ERP-0015.
  Evidence: dbml `assets` only.
- Depreciation as manual journal — T07, ERP-0015. Evidence: none.

### implemented
- Tool borrowing/return (S4) — T07, ERP-0029 (backlog "shipped" → mapped
  `implemented`). Evidence: `inventory/services/borrowing.service.ts`, 60 tests,
  late-return + guest-PII retention sweeps on BullMQ; UI
  `/inventory/borrowings/*`. Pending: browser walk-through; worker still in API
  process. Note: lives in `inventory`; covers the M06 loan register
  (ADR-0010, proposed).

## M07 Projects and After-Sales

### planned
- Projects: PIC, target, tasks, direct costs — T08, ERP-0015. Evidence: dbml
  `projects` only.
- Testing/training/BAST evidence — T08, ERP-0015. Evidence: dbml
  `projects.project_handover` only.
- Basic tickets + manual closure, warranty — T08. Evidence: dbml `ticket`,
  `aftersales` only.
- Portal: project/BAST status + own tickets — T26, ERP-0022. Evidence: none.

## M08 Employees and Attendance

### planned
- Employees, manual attendance, leave, overtime, salary/bonus summary — T10,
  ERP-0008. Evidence: dbml `hr` only.
- Payslips, approval, payroll journals — T20, ERP-0018. Evidence: none.

### blocked
- Automated payroll calculation — T19, ERP-0018. Needs component rules from
  the business.

## M09 Finance

### planned
- Opening balances, COA, journals, reversals — T04, ERP-0010. Evidence: dbml
  `accounting` only.
- Cash/bank, receivables, payables, reconciliation — T06, ERP-0012/0013.
  Evidence: dbml `finance` only.
- Expense entry + journal posting — ERP-0013. Evidence: none.
- P&L, balance sheet, cash flow, drill-down — T11, ERP-0016. Evidence: none.
- Month-end close + reopen — T11, ERP-0017. Evidence: none.
- Payroll + gateway postings (Stage 2) — T20, T22. Evidence: none.

## M10 Tax

### planned
- Period summaries, tax lines, withholding, corrections/evidence/paid status —
  T12, ERP-0016. Evidence: dbml `accounting.tax_*` only.

### blocked
- Tax types/rates configuration — T12. Needs rates from finance.

## M11 Bonuses and Investors

### planned
- Recipients + capital register — T13. Evidence: dbml `investor` only.
- Approval + payment history, manual bonus summary — T13. Evidence: dbml only.
- Investor portal dashboard — T29, ERP-0023. Evidence: none.
- Data permissions + investor exports — T30, ERP-0023. Evidence: none.

### blocked
- Profit/reserve/share scheme — T13. Needs scheme from the owner.

## M12 Reports and Access Rights

### implemented
- Authorization core — ERP-0002. Evidence:
  `packages/common/src/authorization/erp-permissions.ts`,
  `test/authorization/permission-matrix.test.ts`, `authorization.test.ts`;
  progress 2026-10-29 / 2026-11-01.
- Auth module + runtime verification — ERP-0003. Evidence: Better Auth in
  Elysia chain, `sessionGuard`/`erpGuard`; progress 2026-10-29 live HTTP
  verified.
- Exports, monthly report archive — T30. Evidence: none.
- Customer accounts + protected docs — T25, ERP-0022. Evidence: dbml
  `auth.portal_identities` only.
- Cross-account security UAT — T31. Evidence: none.

### implemented
- User domain: CRUD, status, soft delete, cache invariants — T02, ERP-0007.
  Evidence: `apps/backend/src/app/user`, `test/unit/user.service.test.ts`,
  `user-admin.service.test.ts`; progress 2026-10-30. Pending: e2e admin-session.
- Organizations + members + seeders (multi-org) — ERP-0026. Evidence:
  `apps/backend/src/app/organization`, UI `/organizations/*`; progress
  2026-10-31, 2026-11-02 live smoke. Pending: browser acceptance. Note:
  organizations = internal departments, consistent with v5.1 (ADR-0010).

## Backlog-only (no module)

### planned
- ERP-0001 Repo housekeeping.
- ERP-0006 Address reference model + lookup API (lookup API itself exists; see
  Outside the plan).
- ERP-0008 Remaining master data (company profile, suppliers, catalog, COA,
  cash/bank, packages, investors).
- ERP-0009 Document numbering service.
- ERP-0024 UAT, reconciliation, backup drill.
- ERP-0025 Release preparation.

### implemented
- ERP-0030 Faker seeders + `faker` skill. Evidence: `apps/backend/database/
  seeders`, `test/unit/inventory-seeder.data.test.ts`,
  `member-seed-config.test.ts`; run-twice verified 2026-11-03.

---

## Outside the plan

Shipped, but in neither the v5.1 module plans nor a `backlog.md` ERP ID.
Status wording from `progress.md`; none is `accepted`.

### implemented
- Invitations + public claim flow (`/admin/invitations`,
  `/invitations/claim/:token`) — `apps/backend/src/app/user`
  (`invitation.service.ts`); progress 2026-11-01 live claim + auto-login.
- Dynamic role management + `hasPermission` resolver (`/admin/roles`) —
  `user/services/role-management.service.ts`;
  `test/unit/role-management.service.test.ts`, `permission-resolver.test.ts`.
- Audit log (`/admin/audit`) — `apps/backend/src/app/audit`; progress W6.
- Admin users list (`/admin/users`), deactivate/restore with session revoke —
  `user/services/user-admin.service.ts`; `test/unit/user-admin.service.test.ts`.
- Username login + `/username-availability` —
  `providers/better-auth/plugins/username.auth.ts`; probe 200 in progress.
  Username login tab (phase 5) has no closing entry.
- Account pages (profile, email, password, sessions) — `apps/web-admin/src/
  routes/_authed.account.*`, `_authed.profiles.*`, `/users/me*`. No progress
  entry.
- Forgot/reset password — `apps/web-admin/src/routes/{forgot,reset}-password`.
  No progress entry.
- Avatar pipeline (DiceBear → WebP → S3 via BullMQ) — user module queues;
  `test/unit/avatar.worker.test.ts`; progress 2026-11-03 verified end to end.
- Redis secondary-storage sessions —
  `providers/better-auth/options/secondary-storage.auth.ts`;
  `test/unit/secondary-storage.auth.test.ts`; progress 2026-10-29 live.
- Location lookup API (province → village) — `apps/backend/src/app/location`;
  `location.service.test.ts`, `province.repository.test.ts`.
- Backend i18n (Accept-Language) — `providers/i18n`;
  `test/unit/request-language.test.ts`.
- Web-admin i18n (`@ims-erp/locales`, en + id) — `packages/locales`;
  `locale-parity.test.ts`, `locale-dead-keys.test.ts`.
- Sales payments approve/execute with SoD — `apps/backend/src/app/sales`;
  progress 2026-10-29 live HTTP. Overlaps M09 `finance.payments`; needs mapping.
- Stock adjustments with approval — `inventory/services/adjustment.service.ts`;
  UI `/inventory/stock/adjustments`.
- Worker registry — `providers/queue/worker-registry.ts`;
  `test/unit/worker-registry.test.ts`.
- Shared HTTP envelope + `/admin/*` URL layout — `src/http/{response,errors,
  plugin}.ts`; `test/unit/http-response.test.ts`.
- Toast bus — `apps/web-admin/src/components/toast.tsx`.
