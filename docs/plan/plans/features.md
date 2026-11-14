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

Last synced: 2026-11-14.

> **Sidebar shell note (2026-11-05):** the web-admin sidebar now renders the
> full M01–M12 nav map (see `progress.md`, "UI — full ERP sidebar shell").
> Routes marked below as `dbml only` / `Evidence: none` may already have a
> `ComingSoonPage` stub route (e.g. `/finance/tax/*`, `/procurement/*`,
> `/crm/*`); a stub is UI scaffolding, **not** feature status. Status here
> still means real, working functionality.

---

## Cross-cutting: role-based nav, login gate, warehouse PIC (ERP-0051)

Plan: `docs/plan/plans/side-nav-role-based.md`. Decision: ADR-0017 (`accepted` 2026-11-14).

### in-progress
- Warehouse person-in-charge Phase 1: `inventory.warehouse_managers` schema, hand-written migration
  `20261114150000_erp0051_warehouse_managers`, deterministic seeder. Evidence: `progress.md`
  2026-11-14 "warehouse PIC Phase 1", `docs.dbml` Inventory table + intra-module Ref, throwaway-DB
  replay (57 journal rows / 116 tables) and 3 idempotent seeder runs.
- Warehouse person-in-charge Phase 2: `warehouseGuard` (401/403/404 split, app-admin bypass),
  Drizzle-free `IWarehousePicResolver` port, `WarehouseManagerRepository` + `WarehouseManagerService`
  (assign 409/404, idempotent unassign, audit), PIC routes on read/update/archive/address/storages,
  `GET /warehouses/mine` (warehouses + storages). Evidence: `progress.md` 2026-11-14 "warehouse PIC
  Phase 2", backend 979 pass / 0 fail (service unit tests + denial tests), typecheck and lint clean,
  `validate-dbml.ts` OK (`docs/database/` unchanged). Open: PIC nav item and warehouse UI.
- Role-based sidebar in web-admin (`permission` / `open` / `internalRole` /
  `appAdminOnly`), switcher limited to internal-role organizations, logo fallback,
  route guard in `_authed` (redirect + toast), organization switch re-checks the
  current route, `/organizations/new` app-admin only, Settings needs an active
  organization. Done: Phase 4 web-admin (all of the above). Login gate and app roles
  implemented on branch `refactor/app-roles-investor-customer` (ADR-0018), migration
  `20261114120000_erp0048_investor_customer_app_roles` applied to a throwaway
  database and inspected (mixed rows keep internal roles, portal-only rows deleted,
  portal `org_role` cleared on pending invitations, second run a no-op). Open: PIC
  nav item and PIC UI (ADR-0017), live-server checks.
  Evidence: `progress.md` 2026-11-14 "Phase 4 complete" (browser checks, 97 tests)
  and "ERP-0051: investor and customer move to app roles".

### planned
- Warehouse person-in-charge Phases 3-5 (PIC nav item and UI, then the remaining
  plan phases). Evidence: none; Phases 1-2 backend are in place. ADR-0017 accepted
  2026-11-14.

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
- Organization info dashboard, dummy data — ERP-0040 (2026-11-12): tab `info`
  of the organization detail page renders users-by-role, projects, sales,
  inventory, activity, profit & loss, cash & bank cards with two BarCharts
  (existing `@ims-erp/ui/components/chart`, Recharts v3). Hardcoded dummy
  data (`apps/web-admin/src/lib/org-dashboard-data.ts`), en/id keys complete;
  **not feature status** — real wiring blocked on the owning modules.
- Org CRUD robustness — ERP-0041 (2026-11-12, **verified**): backend + web-admin
  UI (org-create nested users, image-profile icon dropzone with drag & drop on
  the create and edit pages, member/invite multi-role checkbox grid, bulk paste
  with `|` role separator) + backend unit tests (12 org-create-nested, 5
  employee-invite); migration verified on a
  disposable DB. Live browser walk-through done: WebP upload → MinIO
  presigned read, multi-role bulk invite stored `technician,sales`, retried
  invite reuses a leftover employee row. Logo picking is a drag & drop
  dropzone on both form pages; object key `organizations/<id>/logo.webp`
  (plural, like `users/<id>/avatar.webp`) re-verified with the real seed asset.
  The create page is now org details only (nested users removed by user
  decision; `POST /organizations` still accepts `users` for API callers) and
  the image input downscales to 512px client-side, caps the source at 20MB and
  falls back to the generated key `logo-generated.webp` behind a conditional
  `logo IS NULL` write. The organization list presigns each card logo on the
  server (a raw object key rendered as a broken image) with an initials fallback
  on load error. The list grid is `1 / sm:2 / lg:3 / 2xl:4` (a 4-up grid at
  `lg` produced 180px cards) and its header stacks below `sm`. The optional
  organization `description` (new nullable `text` column, 2000-char zod cap)
  is created/edited in a textarea and shown on the info dashboard, which also
  exposed and fixed a stale-`findById` cache bug on PATCH. **Server-side image
  normalisation** (same slice, 2026-11-13): the user never converts to WebP by
  hand — `apps/backend/src/utils/image.util.ts` (`Bun.Image`, no new dependency)
  sniffs PNG/JPG/WebP/GIF/BMP/TIFF/HEIC/AVIF and re-encodes every stored image
  (org logo, DiceBear-generated org logo and avatar, user avatar, document
  images) to WebP, downscaled to 512px (avatar 144px). The web admin keeps a
  canvas fast path (`encodeImage`, WebP with a PNG fallback) and can no longer
  fail with "WebP encoding failed"; the 2 MB upload cap is unchanged because the
  client downscales first. Evidence: progress 2026-11-12 and 2026-11-13.

## M02 CRM and Sales

### planned
- Leads, follow-ups/surveys, customers — T05, ERP-0004/0005. Evidence: dbml
  `crm` only.
- Invoice, DP (customer advance), receipt — T05, ERP-0011. Evidence: dbml
  `sales.invoices` and `sales.receipts` (kwitansi, owned by Sales); payment
  allocations stay in finance.
- One template per document — T05. Evidence: dbml `documents` only.
- Checkout / online orders — T21, ERP-0020. Evidence: dbml `commerce` only.
- Payment gateway callbacks + reconciliation — T22, ERP-0020. Evidence: none
  (payment ledger is `finance.payments`, M09; `sales.payments` is scheduled
  for removal at step S7 in `docs/database/implementation-phases.md`).

### implemented
- Customers + contacts — T05, ERP-0004/0005. Evidence: `apps/backend/src/app/crm`,
  `test/unit/customer.service.test.ts`, `/crm/customers` pages, `progress.md`
  2026-11-05 (ADR-0011 step 3a). Gaps: real-PG integration tests, e2e.
- Leads, follow-ups/surveys, website RFQ/contact/demo intake — T05.
  Evidence: `apps/backend/src/app/crm` (leads, public website API),
  `test/unit/lead.service.test.ts`, `/crm/leads` pages, `progress.md`
  2026-11-05 (ADR-0011 step 3b). Gaps: real-PG integration tests, e2e.
- SPH (quotation) + approval (no self-approval, no amount limit), revisions,
  lost ("Batal"), planned billing, print in the company's exact SPH layout
  (logo, signature, item photos) — T05, ERP-0011 (backlog
  `in-progress`: orders/invoices open). Evidence: `apps/backend/src/app/sales`
  (quotations), `test/unit/quotation.service.test.ts`,
  `test/authorization/authorization.test.ts`, `/sales/quotes` pages,
  `progress.md` 2026-11-06 (ADR-0011 step 3c). Gaps: real-PG integration
  tests, e2e.
- Sales orders from an approved or sent SPH (SPH becomes Deal; cancelling
  reopens it) — T05, ERP-0011. Evidence: `apps/backend/src/app/sales`
  (sales orders), `test/unit/sales-order.service.test.ts`, `/sales/orders`
  pages, `progress.md` 2026-11-06 (ADR-0011 step 3d-1). Gaps: real-PG
  integration tests, e2e.
- Delivery notes (surat jalan): prepared against an order (partial
  deliveries), shipped out of stock at average cost with serial units sold,
  delivered with the receiver; print in the company's exact layout — T05/T07,
  ERP-0011 / ERP-0037. Evidence: `apps/backend/src/app/sales` (delivery
  notes), `test/unit/delivery-note.service.test.ts`, `/sales/deliveries`
  pages, `progress.md` 2026-11-06 (ADR-0011 step 5a). Gaps: programmer A's
  review of the serial-unit contract, real-PG integration tests, returns.
- Invoices with free billing terms, DP, receipts (kwitansi), invoice print
  in the company's exact layout — T05, ERP-0011. Evidence:
  `apps/backend/src/app/finance`, `test/unit/invoice.service.test.ts`,
  `/sales/invoices`, `/sales/down-payments`, `/sales/receipts`,
  `progress.md` 2026-11-06 (ADR-0011 step 3d-2). Gaps: real-PG integration
  tests, e2e, kwitansi print (no sample), `finance.payments` ledger (S7).

## M03 Subscription and Licensing

### done
- Contract + license key register, dates, status, due list — T09, ERP-0019.
  Evidence: `progress.md` 2026-11-06 (M03 stage 1): `/licenses` API,
  `/subscription` pages, dashboard widget; 10 unit tests, browser e2e.
  Not yet accepted by the owner.
- API keys + validate/activate/renew, grace/suspend — T23, ERP-0019.
  Evidence: `progress.md` 2026-11-06 (M03 stage 2): `/licensing/v1`,
  `/subscription/api-keys`, `/subscription/activations`; 12 + 11 unit tests,
  e2e. Not yet accepted by the owner.

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
  Note: the **in-app** notification substrate is not part of M04; it is
  `ERP-0047` (below) and its WhatsApp/email channels attach to that model later.

## Notification + realtime (ERP-0047)

### verified
- In-app notification module (schema `notification`, app-scope, organization as
  tag) + single realtime socket `/ws` + header bell with unread badge.
  Plan: `docs/plan/plans/ws-notification.md` (Phase 0-9). Evidence: Phase 0 done
  2026-11-13 — `docs/database/docs.dbml` module 27, `module-ownership.md`,
  `implementation-phases.md`, `data-dictionary.md`,
  `docs/architecture/modules/notification.md`, ADR-0016,
  `api-conventions.md`; `validate-dbml.ts` OK (268 tables, 231 refs, 0
  cross-module), `gen-logical-references.ts` 524 refs. Phase 1 done
  2026-11-13: `drizzle/schemas/notification.schema.ts` +
  `database/migrations/20261113150000_erp0047_notification_schema/` applied
  through `drizzle:migrate-reset` (2 tables, 9 indexes, 3 checks, 1 intra-module
  FK), `tsc -b --noEmit` clean. Phase 2 done 2026-11-13: `src/providers/
  realtime/` (`realtime.message.ts`, `realtime.hub.ts`, `realtime.gateway.ts`),
  `/ws` mounted in `createApp()`, hub in `registerProvider`; session-less
  upgrade 401, authenticated socket opens, `publish` delivers
  `{ type, status, sentAt, data }`. Phase 3 done 2026-11-13: `src/app/
  notification/` (repository, `NotificationService`, `ExportedNotificationService`,
  queue `send`/`prune` + worker), retention config keys, worker started in
  `src/index.ts`; live send/list/markRead/prune verified. Phase 4 done
  2026-11-14: `notification.controller.ts` (`GET /notifications`,
  `GET /notifications/unread-count`, `PATCH /notifications/:id/read`,
  `POST /notifications/read-all`) mounted via `notificationModule()` under the
  session guard only; `sessionGuard()` maps its own `ErpAuthError`, and the
  shared `domainPlugin` `VALIDATION` branch was fixed (it 500-ed every
  validation failure on a listening server). Phase 5 done 2026-11-14: adding a
  member (`OrganizationService.addMember`), creating an organization (creator +
  nested active users) and a successful invitation claim all produce
  `org.member_added`/`org.org_created` through `ExportedNotificationService`;
  a `NOTIFICATION_DISPATCHER_TOKEN` was added because the defaulted constructor
  parameter made tsyringe fail at boot. Phase 6 done 2026-11-14: the four
  templates are seeded in every environment and three demo rows for the seed
  admin in dev, both idempotent (4+3 then 0+0 inserted), guarded by a drift test
  that keeps the code vocabulary, the seed list and the declared variables in
  sync. Phase 7 done 2026-11-14: header bell with unread badge and popover,
  one `/ws` socket client with backoff reconnect and a `type` → handler
  registry, `NavUser` moved into the header, `notifications` locale namespace
  in en+id. Verified live (badge updates without reload, reconnect after a
  backend restart, Indonesian copy). Phase 8 done 2026-11-14: automated gates
  green, WS smoke test committed, live HTTP inbox and browser live badge verified;
  second-user live arrival verified in two runs (see `progress.md`). Verified.

## M05 Inventory and Purchasing

### planned
- Inventory movement boundaries / valuation + GL reconciliation — ERP-0014
  (re-scoped into S1–S4; valuation deferred, OPEN-3).
- Payables (supplier invoices) — T07, ERP-0012 / ERP-0035. Evidence: none.
- Stock value in the GL (journals) — T07, ERP-0014. Evidence: none (the
  value view exists, see implemented).

### implemented
- Suppliers (bank details restricted) and purchase orders with one-level
  approval and the company's PO print — T07, ERP-0035. Evidence:
  `apps/backend/src/app/procurement`, `test/unit/procurement.service.test.ts`,
  `/procurement/suppliers`, `/procurement/purchase-orders`, `progress.md`
  2026-11-06 (ADR-0011 step 4a). Gaps: real-PG integration tests, e2e.
- Goods receipts (BPB) against sent POs with serials, and moving-average
  HPP per stock balance — T07, ERP-0035 / ERP-0014. Evidence:
  `procurement/services/goods-receipt.service.ts`,
  `inventory/utils/moving-average.ts`, `test/unit/goods-receipt.service.test.ts`,
  `test/unit/moving-average.test.ts`, `/procurement/receipts`, `progress.md`
  2026-11-06 (step 4b). Gaps: programmer A's review of the stock-service
  change, real-PG integration tests.
- Opening stock / adjustments with unit cost, and the inventory value view
  (stock at average cost per item and warehouse, totals) — T07, ERP-0014 /
  ERP-0037. Evidence: `inventory/services/adjustment.service.ts`,
  `inventory/services/stock-valuation.service.ts`,
  `test/unit/adjustment.service.test.ts`, `test/unit/stock-valuation.service.test.ts`,
  `/inventory/stock/value`, `progress.md` 2026-11-06 (step 5b). Gaps:
  programmer A's review; the adjustment form's warehouse list is admin-only.
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

### proposed (ADR-0010)
- Warehouse↔organization links + scoped access — ERP-0031. Code landed
  2026-11-06 (migration `20261106062510_erp0031_warehouse_org_links`, link
  endpoints, 536 backend tests), but downgraded 2026-11-08: ADR-0010 is still
  `proposed`, so the design basis is not accepted. Evidence in `progress.md`
  (2026-11-06). Remaining: browser walk-through, reviewer sign-off.
- Stock transfers (warehouse→warehouse, storage→storage) — ERP-0032.
- Tracking views (per-storage balances, movement filters, unit location) —
  ERP-0033.
- ~~Minimal HR employees + warehouse PIC (display-only) — ERP-0034~~ moved
  to implemented 2026-11-10 (see above).

### implemented
- Minimal HR employees + warehouse PIC — ERP-0034 (2026-11-10). Invite-first
  employee CRUD (`/hr/employees`: list/detail/create/patch/archive + picker),
  `hr.employees` with nullable organization (company-level rows) and
  `user_id` from the invitation pipeline, EMP numbering, warehouse PIC
  validation (422 `inventory.warehousePicInvalid`), web-admin
  `/hr/employees` pages, seeder. Evidence: `apps/backend/src/app/hr`,
  `apps/web-admin/src/components/hr`, `progress.md` 2026-11-10. Deferred:
  manager picker UI, export. Follow-up 2026-11-12: invite-creates-employee
  on both scopes (`EmployeeInviteService` behind `IInvitationEmployeePort`),
  rollback on insert failure, personal fields on `auth.users` via
  `IUserPersonalFieldsPort` (migration pending disposable-DB run), `hr`
  invite rights. Bulk invite via CSV/XLSX file upload added 2026-11-12
  (shared parser in `packages/common`, client-side parse + template
  download endpoints, `organizationSlug` resolution; evidence in
  `progress.md`).

### blocked
- Supplier payables and the M09 payable handoff of receipts — ERP-0035.
  Suppliers, PO and receipts are implemented (see "implemented"); needs M09 payables.

## M06 Assets and Equipment

### planned

- Asset register: value, PIC, condition, service notes — T07, ERP-0015.
  Evidence: dbml `assets` only.
- Depreciation as manual journal — T07, ERP-0015. Evidence: none.

### implemented
- Location tracking + borrowing ownership — ERP-0036. Evidence: contract
  shipped 2026-11-05 (`docs/database/docs.dbml`: assets 14 tables incl.
  `asset_types` + borrowing trio, inventory 13 tables, `validate-dbml.ts`
  prints `OK`; plan `plans/assets-equipment-location-and-borrowing.md` Slice 1
  done); Slice 2 shipped 2026-11-05 (asset schema rewritten, cleanup script
  applied, migration `20261105123204_faulty_ikaris`, reset + migrate + seed
  twice, 530 tests, DB CHECKs verified — see `progress.md`); Slice 3 shipped
  2026-11-06 (borrowing engine moved to `assets`,
  `inventory/services/borrowing.service.ts` and `assets.asset_assignments`
  gone, migration `20261105221923_erp0036_slice3_borrowing_engine`, migrate +
  seed twice, 526 tests); Slice 4 shipped 2026-11-06 (`borrowing` →
  `asset_borrowing` in all 10 roles, data-only migration
  `20261105223616_erp0036_slice4_permission_rename`, global asset-code
  sequence, `seed/assets.seeder.ts`, migrate + seed twice, 526 tests); Slice 5
  shipped 2026-11-06 (borrowing screens moved to `/assets/borrowings`,
  `GET /assets/types` added for the register filter + forms, asset detail gained
  place/transfer with warehouse→storage picker, inventory tools page + warehouse
  tools tab + `asset_assignments` UI gone, locale keys re-homed to
  `assets:borrowing*`; locale parity/dead-key guards green, web-admin build,
  root lint/typecheck/test, `validate-dbml.ts` all green). All five slices
  landed; browser walk-through pending.
  Stage 0 execution review resolved all blocking defects (global assets with
  stubbed warehouse reachability, global unique asset code, no
  `document_sequences` change, jsonb permission migration).
- Tool borrowing/return (S4) — T07, ERP-0029 (backlog `implemented`). Engine **moved to `assets`** by ERP-0036 Slice 3
  (2026-11-06): `assets/services/borrowing.service.ts`, 526 backend tests
  green; late-return + guest-PII retention sweeps on BullMQ. UI moved to
  `/assets/borrowings/*` by ERP-0036 Slice 5 (2026-11-06). Pending: browser
  walk-through; worker still in API process. Note: covers the M06 loan
  register (ADR-0010, proposed).

## M07 Projects and After-Sales

### planned
- Portal: project/BAST status + own tickets — T26, ERP-0022. Evidence: none.

### implemented
- Projects from a deal: PIC, targets, stage, default checklist with
  assignees, testing / training / BAST evidence (closing rule), direct costs
  with receipts, shipped material value and margin (cost-restricted) — T08,
  ERP-0015 / ERP-0037. Evidence: `apps/backend/src/app/projects`,
  `test/unit/project.service.test.ts`, `/projects` pages, `progress.md`
  2026-11-06 (ADR-0011 step 6a). Gaps: real-PG integration tests.
- BAST documents (several per project) and the warranty certificate (one per
  project, from a BAST date, serials of shipped devices, profile texts),
  printed in the company's exact layouts — T08, ERP-0015 / ERP-0037.
  Evidence: `projects/services/handover.service.ts`,
  `apps/backend/src/app/aftersales`, `test/unit/handover-warranty.test.ts`,
  `/projects/$projectId/bast/*`, `/projects/$projectId/warranty*`,
  `/projects/bast`, `progress.md` 2026-11-06 (step 6b). Gaps: real-PG
  integration tests.
- Service tickets with the warranty check by serial number (shipped device →
  project → certificate), technician assignment, resolution with cost, and
  closing with the customer's confirmation — T08, ERP-0037. Evidence:
  `aftersales/services/service-ticket.service.ts`,
  `test/unit/service-ticket.service.test.ts`, `/projects/tickets` pages,
  `progress.md` 2026-11-06 (step 6c). Gaps: real-PG integration tests; SLA
  and escalation not decided.

## M08 Employees and Attendance

### planned
- Employees, manual attendance, leave, overtime, salary/bonus summary — T10,
  ERP-0008. Evidence: dbml `hr` only.
- Payslips, approval, payroll journals — T20, ERP-0018. Evidence: none.

### blocked
- Automated payroll calculation — T19, ERP-0018. Needs component rules from
  the business.

## M09 Finance

### in-progress (Stage 1 - F1..F9, commits 7a44dbd..<f9>; backlog mismatch, see note)
- Ledger core: `accounting` pg-schema (COA, journal entries/lines, periods,
  opening balances), posting engine with single tx-aware `post` gateway,
  append-only reversals, document-sequence codes, idempotency keys,
  open-period gate, close/lock/reopen (audited, owner-only). Evidence:
  backend tests (686 pass), migration applied to dev.
- Cash & bank: finance.cash_bank_accounts/transactions with GL links
  (required at first movement) and per-movement JE posting.
- Receivables/payables: sales invoices post AR through the finance mirror
  sub-ledger (`accounting.ar_open_items` / `ap_open_items`), finance.payments
  workflow draft→submitted→approved→executed with allocations, void +
  void-executed append-only reversal, finance.supplier_bills
  draft→approved→partially_paid→paid. AR/AP aging computed on demand.
- Reports: P&L, balance sheet, cash flow computed on demand from posted
  journal lines (never stored snapshots); bank reconciliation workflow
  draft→in_progress→reconciled→closed with exact statement=book gate.
- Month-end close: advisory pre-close checklist; period transitions.
- Web-admin UI: 9 finance routes + finance-api typed client (F8).
- Backlog mismatch: ERP-0010 (accounting foundations) and ERP-0011..0013 are
  still `planned` in `backlog.md`, so this section stays `in-progress` here
  until the backlog is decided. Code evidence is in `main` (accounting schema,
  migrations, tests).

### planned (Stage 2)
- Expense entry + journal posting - ERP-0013. Evidence: none.
- Payroll + gateway postings (Stage 2) - T20, T22. Evidence: none.
- Final COA seed list from finance/owner (provisional codes
  `1-1300`/`1-1100`/`4-1000`/`2-1000`/`2-1100`/`5-1000`/`1-1800` in use).

## M10 Tax

### in-progress
- ERP-0016 Phases 1–3: backend (tax rate master, period working papers
  draft → verified → filed, corrections, withholding, recap), web-admin UI
  at `/finance/tax/*` (recap with CSV/XLSX export, types, records, corrections,
  withholding), `GET /tax/export.csv`, and `GET /tax/export.xlsx` via
  `exceljs` 4.4.0 (write-only; advisory note in the plan doc). Evidence:
  migration `20261106173111_erp0016_tax_slice1` applied to dev; backend tests
  632/632 (incl. 11 service + 80 authorization + 3 xlsx); web-admin build
  green; locales en + id parity/dead-key green. Not yet: real rates
  (placeholders only, D18).

### blocked
- Final tax rates and rounding rule — finance gate (D14, D18). Placeholders
  seeded until confirmed.

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
- Organization-scoped invitations + one shared invite dialog — ERP-0039
  (2026-11-12). Org admins list/resend/cancel/delete their own pending
  invitations (`/organizations/:organizationId/invitations`, path org
  authoritative, out-of-scope → 404) without the app-admin-only
  `/admin/invitations`; `components/invite/invite-dialog.tsx` serves both
  `/admin/users` (org picker incl. explicit “no organization”) and the
  organization Members tab; claim phone is E.164 (`libphonenumber-js`).
  Evidence: `apps/backend/src/app/organization/controllers/
  organization-invitation.controller.ts`,
  `test/unit/invitation.service.test.ts` (12),
  `apps/web-admin/test/unit/invite-parse.test.ts` (10), browser run in
  `progress.md` 2026-11-12. Pending: reviewer sign-off, PR.

## Backlog-only (no module)

### planned
- ERP-0001 Repo housekeeping.
- ERP-0006 Address reference model + lookup API (lookup API itself exists; see
  Outside the plan).
- ERP-0008 Remaining master data (suppliers, catalog, COA, cash/bank,
  packages, investors) — company profile part implemented, see below.
- ERP-0024 UAT, reconciliation, backup drill.
- ERP-0025 Release preparation.
- ERP-0037 Nullable cross-module references (ADR-0014 schema flip).
- ERP-0045b Organization settings KV CRUD (`organization.settings`) — split out of
  ERP-0045, not built.

### in-progress
- ERP-0046 Dependabot bun config moved to the workspace root (`directory: "/"`)
  so the single root `bun.lock` is updated with the manifests. Evidence:
  `.github/dependabot.yml`, `progress.md` 2026-11-13. Not verified until a
  dependabot PR lands with `bun.lock` in its diff and green CI.
- ERP-0037 Port M02/M05/M07 onto main (ADR-0011): steps 1-2 implemented
  2026-11-05 (numbering, company profile, role grants; item categories,
  fixed units, brand/specification/active on items) and 3a (customers +
  contacts, `/crm/customers`) and 3b (leads, follow-ups, website API);
  3c-3d and 4-6 planned.
  Evidence: `progress.md` 2026-11-05, `test/unit/item-category.service.test.ts`.

### implemented
- ERP-0045c Settings section (2026-11-13). Sidebar `Settings` after
  Administration: Company, Code numbering, Document. `/settings/company`,
  `/settings/code-numbers`, `/settings/documents`; `/admin/company` and
  `/admin/code-numbers` redirect. Company form cut to identity + contact;
  `documentCode` relabelled "Company code"; Signatory, Bank accounts, Default
  terms, Warranty certificate and Logo/signature removed from the page; the logo
  moved to `/settings/documents` (the company signature image was dropped from
  that page the same day — signatures get their own module). `PUT
  /company/profile` is now a patch (`companyProfilePatchSchema`) so the removed
  fields keep their stored value.
  Evidence: `progress.md` 2026-11-13 ERP-0045c and the `/settings/documents`
  entry after it; backend 872 tests, web-admin 70, locales 86, build + lint
  clean. Verified in the browser: the form shows only identity + contact,
  "Company code" label, a tagline-only save keeps `signatoryName` and the bank
  account, both old `/admin/*` URLs redirect, `/settings/documents` has one logo
  field and no signature field, and the `document` settings card is empty until
  ERP-0048 writes its key.
- ERP-0045 Company settings KV CRUD (2026-11-13, `company.settings` only;
  `organization.settings` split into ERP-0045b). `GET /company/settings`,
  `PUT /company/settings/:group/:key`, permissions `company:read` /
  `company:update`, no delete route; service-side value check per `value_type`
  (string/number/boolean/json/date) plus the DB CHECK; single-statement upsert
  on the live `(setting_group, setting_key)` partial unique index.
  `is_secret` stays reserved (`false`): the API neither accepts nor returns it.
  UI `CompanySettingsCard` on `/admin/company`. Evidence: `progress.md`
  2026-11-13 ERP-0045; `test/unit/company.service.test.ts` 15 pass.
- ERP-0044 Document registry wiring + files + public share links (2026-11-13).
  11 outward-facing types register through `DocumentService.register` and void
  with `voidBySource`; `document.files` upload/list/soft-delete/presigned download
  with `access_logs`; `document.shares` with its own `token` uuid, mandatory
  expiry, revocable, anonymous `GET /public/v1/documents/:token`; detail page
  `/documents/$documentId`. Migration `20261113140000_erp0044_document_share_token`.
  Evidence: `progress.md` 2026-11-13 ERP-0044. Not `verified`: no live HTTP or
  browser pass on the share and download routes.
- ERP-0043 Item codes per kind (2026-11-13). `item_product`/`item_material`/
  `item_component` code types (`PRD-00001`/`MAT-00001`/`CMP-00001`,
  `{TYPE}-{SEQ:5}`, reset never, module `inventory`); `inventory.items.code`
  generated by the numbering authority and immutable, `inventory.items.serial_number`
  nullable, `sku` stays manual and required. Migration
  `20261113130000_erp0043_item_codes` (deterministic per-kind backfill, ADR-0008
  unique index pair, 3 series rows). Asset needed no change - `AST-` was already
  allocated and no `sku` column was added. Evidence: `progress.md` 2026-11-13.
- Sidebar (2026-11-13): Documents section below CRM & Sales, with Files
  (`/documents/files`), Signatures (Document Signature, Request Signature, My Signature,
  placeholders until ERP-0048/0049), Templates (placeholder until ERP-0050).
  The same day ERP-0045c moved Company and Code numbering out of Administration
  into a new `Settings` section, so Administration now holds the organization
  pages and the audit log only. Evidence: `progress.md` 2026-11-13 "sidebar"
  (top entry), commit `7b1f699` for the first arrangement, ERP-0045c for the move.
- ERP-0042 Decoupled `organization` into `company` + `document` +
  `code_number` (2026-11-13). Three Postgres schemas, one append-only migration
  each; `company.profiles/head_office_addresses/contacts/bank_accounts/settings`,
  `code_number.series` (verbatim rename of `organization.document_sequences`,
  `document_type`→`code_type`, 32 code types incl. `warehouse` and the three
  item kinds),
  `document.templates/documents/files/signatures/access_logs/shares/tags/tag_links`;
  `organization.company_settings` split into `company.settings` +
  `organization.settings`. Contracts `CompanyService.getProfile(tx?)`,
  `CodeNumberService.next(codeType, {date, context, tx})`,
  `DocumentService.issue(...)`. Permissions `company:*` / `code_number:*` /
  `document:*` replace `company_setting:*`. API `/company/profile` +
  `/code-numbers`; UI `/documents`, `/settings/company`,
  `/settings/code-numbers` (the `/admin/*` pages and `/admin/settings` were
  replaced by ERP-0045c). Docs: `architecture/modules/{company,code-number,document}.md`
  and ADR-0015. Evidence: `apps/backend/src/app/{company,code-number,document}`,
  `test/unit/{company,code-number}.service.test.ts`, migrations
  `2026111312*_erp0042_*` verified on a disposable DB, `progress.md` 2026-11-13.
- ERP-0009 Code numbering (company-wide series, settings page). Moved to
  `code_number` by ERP-0042.
  Evidence: `apps/backend/src/app/code-number`, `test/unit/code-number.service.test.ts`,
  `progress.md` 2026-11-05 and 2026-11-13.
- ERP-0008 (part) Company profile + invoice bank accounts. Moved to `company`
  by ERP-0042. Evidence:
  `test/unit/company.service.test.ts`, `progress.md` 2026-11-05 and 2026-11-13.
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
