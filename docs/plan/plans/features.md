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

Last synced: 2026-11-15 (M07 portal rows: 2026-11-19). Full inventory of what has no code yet:
`plans/2026-11-15_0538_todo_undone.md` (revision 2 — it corrects five
"missing feature" claims that actually ship, e.g. the report API and the
assets operations surface). §7 item 3 (statement exports + monthly archive +
`/reports` UI) landed the same day; see progress 2026-11-15 "M12 T30".

> **Sidebar shell note (2026-11-05):** the web-admin sidebar now renders the
> full M01–M12 nav map (see `progress.md`, "UI — full ERP sidebar shell").
> Routes marked below as `dbml only` / `Evidence: none` may already have a
> `ComingSoonPage` stub route (e.g. `/finance/tax/*`, `/procurement/*`,
> `/crm/*`); a stub is UI scaffolding, **not** feature status. Status here
> still means real, working functionality.

---

## Cross-cutting: role-based nav, login gate, warehouse PIC (ERP-0051)

Plan: `docs/plan/plans/side-nav-role-based.md`. Decision: ADR-0017 (`accepted` 2026-11-14).

### verified
- Role-based sidebar in web-admin (`permission` / `open` / `internalRole` /
  `appAdminOnly`), switcher limited to internal-role organizations, logo fallback,
  route guard in `_authed` (redirect + toast), organization switch re-checks the
  current route, `/organizations/new` app-admin only, Settings needs an active
  organization. Evidence: `progress.md` 2026-11-14 "Phase 4 complete" (browser
  checks, 97 tests).
- Login gate and app roles (ADR-0018), branch `refactor/app-roles-investor-customer`:
  investor/customer moved to Better Auth app roles, `hasRole` multi-role checks,
  gate in `session.create.before` + `sessionGuard`, `create-user`/`set-role`
  restricted to `globalRoles`, migration
  `20261114120000_erp0048_investor_customer_app_roles` (mixed rows keep internal
  roles, portal-only rows deleted, portal `org_role` cleared on pending
  invitations, second run a no-op), `scripts/smoke-login-gate.ts` 8/8 against the
  real Better Auth instance. Evidence: `progress.md` 2026-11-14 "ERP-0051: investor
  and customer move to app roles".
- Warehouse person-in-charge Phase 1: `inventory.warehouse_managers` schema,
  hand-written migration `20261114150000_erp0051_warehouse_managers`, deterministic
  seeder. Evidence: `progress.md` 2026-11-14 "warehouse PIC Phase 1", `docs.dbml`
  Inventory table + intra-module Ref, throwaway-DB replay (57 journal rows / 116
  tables) and 3 idempotent seeder runs.
- Warehouse person-in-charge Phase 2: `warehouseGuard` (401/403/404 split,
  app-admin bypass), Drizzle-free `IWarehousePicResolver` port,
  `WarehouseManagerRepository` + `WarehouseManagerService` (assign 409/404,
  idempotent unassign, audit `warehouse.manager_assigned`/`_removed`), PIC routes on
  read/update/archive/address/storages, `GET /warehouses/mine` (warehouses +
  storages). Evidence: `progress.md` 2026-11-14 "warehouse PIC Phase 2", backend
  979 pass / 0 fail (service unit tests + denial tests), `validate-dbml.ts` OK
  (`docs/database/` unchanged).
- Warehouse person-in-charge Phase 4 item 8 (`11085e1`): `warehousePic` nav flag +
  `isPic` on `NavContext`, `useWarehouseAccess()` as the single gate,
  `AdminWarehouseList`/`PicWarehouseList`, `WarehouseAccessGate`, PIC detail tab
  split (items tabs are org-permission gated, so a PIC sees `storage` only),
  `/inventory/warehouses/new` short-circuited in `canOpenPath` as app-admin only,
  manager read surface `GET /warehouses/:id/managers` +
  `GET /warehouses/manager-candidates?search=` (picker cannot use `GET /admin/users`,
  which needs `member:read` plus an organization), persons-in-charge assign/unassign
  tab. Evidence: `progress.md` 2026-11-14 "Phase 4 item 8".
- Warehouse person-in-charge Phase 5: `apps/backend/scripts/smoke-warehouse-pic.ts`
  47 pass / 0 fail over real HTTP against a freshly seeded disposable database
  (login gate, 401s, app admin without membership, PIC rights and denials,
  internal member without grant, investor+internal and multi-org, direct admin-route
  denial, assign/unassign round trip, PIC of a warehouse with no
  `inventory.warehouse_organizations` row) plus a real-browser pass (Edge, Vite 5173
  + backend 3001) covering the PIC nav item, the PIC-only warehouse list, the
  `/new` redirect, the multi-org switcher hiding the item, investor-only and
  customer-only logins rejected, direct-URL denial, and assign/unassign. Evidence:
  `progress.md` 2026-11-14 "ERP-0051: warehouse PIC Phase 5"; gates backend 999
  pass, web-admin 100 pass, locales 90 pass, react-email 5 pass, typecheck and lint
  clean; `docs/database/` unchanged. Plan `side-nav-role-based.md` complete.
  Not covered: the PIC `import`/`export` rights, because no warehouse route uses
  those actions yet — covered indirectly on 2026-11-14 by 6 action-matrix tests in
  `warehouse-authorization.test.ts` (the guard is action-agnostic and the controller
  declares only `read`/`update`/`archive`), and Phase 5 was re-run 47/47 against a
  freshly reset `ims_erp_local`.

### planned
- Nothing open for ERP-0051 itself. Delivery follow-ups are tracked separately in
  `docs/plan/plans/erp-0051-follow-ups.md` (ERP-0053 … ERP-0058): one route-guard
  behaviour bug, four documentation drifts, and one schema-helper gap.
- Sidebar regression fixed by ERP-0062 (2026-11-16): the deny-by-default
  `leafVisible()` had silently dropped Components, Materials and the three
  signature pages. Restored with `product.read` and the new
  `document.signature_read` / `signature_request` / `signature_sign` actions
  (catalog + grants in `packages/common`, nav gates, 3 grant tests). Evidence:
  `progress.md` 2026-11-16; browser-verified (menu, `has-permission` true, both
  inventory pages listing rows). Reminder: `packages/common` ships from `dist`,
  so a catalog change needs `bun run build` there plus a backend restart.

---

## Cross-cutting: migration history (ERP-0052)

Decision: ADR-0019 (`accepted` 2026-11-14).

### verified
- Migration history squashed to **19 migrations, one per Postgres schema**,
  generated from `drizzle/schemas` (1 `base` + 18 chained `diff` snapshots), so
  `bunx --bun drizzle-kit check` reports `Everything's fine` and
  `drizzle-kit generate` reports `No schema changes` against the repo's own
  `drizzle.config.ts` for the first time since the ERP-0011 merge. Root causes:
  11 migrations without `snapshot.json`, the unrecorded
  `DROP SCHEMA "finance" CASCADE` in `20261106170000`, and `generate` emitting a
  base snapshot when the out folder is empty. DDL the builder cannot express
  (`NULLS NOT DISTINCT` on both `stock_balances` scope indexes, the
  `deleted_at IS NULL` predicate on the two `items` code indexes, the
  intra-module `sales.receipts` -> `sales.invoices` FK) is kept as a documented
  tail in the owning migration. The cross-schema FK
  `receipts_payment_id_payments_id_fkey` (sales -> finance) was dropped - it
  violated `elysia-module` rule 3.2 / ADR-0014 - so the database now has zero
  cross-schema foreign keys. Evidence: `progress.md` 2026-11-14 "ERP-0052";
  `drizzle:migrate-reset` on `ims_erp_local` -> 19 journal rows, 116 tables;
  `drizzle:migrate` afterwards a no-op; probe column produced a real `ALTER TABLE`
  diff; schema fingerprint equal to the old chain except two auto-named
  constraints; `smoke-warehouse-pic.ts` 47/47; backend 1005 pass, web-admin 100,
  locales 90, react-email 5; typecheck, lint, `validate-dbml.ts` green.

### planned
- Teach `inventory.schema.ts`'s `scopedUnique()` helper the `deleted_at IS NULL`
  predicate so the snapshot matches the `items` code indexes the database carries.
  Cosmetic today - `generate` diffs against the snapshot, so it does not try to
  drop them (probed 2026-11-14) - but the two should not drift. Recorded in
  ADR-0019 consequences; not a regression of the squash.

---

## Cross-cutting: `docs.dbml` vs Drizzle parity (ERP-0054)

### verified
- Every table and column shipped in `apps/backend/drizzle/schemas/*.schema.ts`
  now exists in `docs/database/docs.dbml`, and
  `bun docs/database/validate-dbml.ts` enforces that one-way direction in
  section 5 (`drizzle parity drift: 0`, exit 1 on any drift). The reverse
  direction is deliberately not enforced: `docs.dbml` describes the target and
  legitimately carries 150 unbuilt tables plus planned columns.
- 11 shipped tables drifted (column sets, not names). The shipped shape won
  and each deviation is annotated `DEVIATION (shipped)` in `docs.dbml` because
  migrations are append-only: `assets.assets` / `inventory.warehouses`
  `image_url`; `auth.users` `claimed_at` + `phone`; `auth.user_invitations`
  dropped the stale `role_id`; `finance.payment_allocations` is `amount` (not
  `allocated_amount`) with no `currency_code` / `allocated_at` /
  `deleted_at`; `finance.ap_open_items` / `ar_open_items` / `sales.payments`
  have no `deleted_at`; `hr.employees` `hire_date` / `termination_date` are
  bigint unix-ms with the shipped `active|inactive|terminated` and
  `permanent|contract|probation|internship|outsourced` vocabularies.
- `auth.roles` and `auth.user_role_assignments` **removed** from `docs.dbml`:
  ERP-0041 made organization roles a closed `erpRoleNames` enum read directly
  from `@ims-erp/common` (`static-permissions.ts`, `role.schema.ts`), so the
  dynamic-role target tables contradicted the shipped authorization model. The
  same stale claim was fixed in `data-model.md`, `module-ownership.md`,
  `integrity-and-consistency.md`, `security-and-access.md` and
  `modules/organization.md`.
- Stale counts corrected to 270 tables / 27 modules / 233 refs in `AGENTS.md`,
  `implementation-phases.md`, `integrity-and-consistency.md`;
  `logical-references.md` regenerated (525 logical refs, 233 intra-module).
  Evidence: `progress.md` 2026-11-15 "ERP-0054".

---

## M01 Dashboard

### in-progress
- Dashboard on real data — ERP-0060 (2026-11-15, plan
  `plans/dashboard-real-data.md`): `/` is a client composition of existing
  module endpoints (no backend `dashboard` module). Two read-only aggregates
  added inside `sales` (`GET /invoices/summary`) and `projects`
  (`GET /projects/stats`). Every widget is permission-gated; the mock is gone.
  Slices 1-4 done 2026-11-15/16 (store and switcher, endpoints, real dashboard,
  docs close-out). Browser-verified: organization switch across two
  organizations and single-card degradation. Open before `verified`: permission
  denial in the browser (no working non-admin account) and a screenshot.
  Renumbered from ERP-0055 on 2026-11-16 (`plans/erp-0051-follow-ups.md` already
  owns ERP-0055/ERP-0056).
  Evidence: `progress.md` 2026-11-15/16, `test/unit/organization-store.test.ts`,
  `test/unit/invoice-summary.test.ts`, `test/unit/dashboard-api.test.ts`,
  `test/authorization/dashboard-aggregates.test.ts`.

### planned
- Stage 1 widgets: sales, cash, profit, inventory, projects, subscriptions — T14.
  Delivered on real data by ERP-0060 (slice 3, 2026-11-15) except open
  quotations, which stay on `/sales/quotations`. Client composition, not a
  backend `dashboard` module (plan D3); the M01 server-side gating requirement
  is met per source endpoint. The invoiced-sales chart leads the page at full
  width with 14 d / 1 m / 3 m / 6 m / 1 y / 5 y presets and a custom range
  picker, and every query refetches each minute (both 2026-11-16). Evidence:
  `progress.md` 2026-11-15/16.
- Stage 2 widgets: gateway, payroll, verified subscriptions — T31. Evidence: none.
- Audit as a business activity feed — ERP-0061: `GET /admin/audit` only knows
  identity targets, so the dashboard reads invoices and receipts for the
  activity widget. Evidence: none.
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

### implemented (follow-ups)
- Before-sales follow-up reminders to WhatsApp through n8n: a lead whose
  follow-up date arrived goes to its owner (overdue > 3 days also to the
  sales manager); a sent quotation without an answer after 3 and 7 days, and
  2 days before it expires, goes to its creator. Weekdays 08:00, internal
  only — ERP-0066. Evidence: `crm/services/lead.service.ts`
  (`publishFollowUpNotices`), `sales/services/quotation.service.ts`,
  `test/unit/lead.service.test.ts`, `test/unit/quotation.service.test.ts`,
  `progress.md` 2026-11-16 (live ERP → n8n run). Gaps: after-sales
  follow-ups (survey, maintenance, warranty) are next.

### implemented (document PDFs)
- Quotation (SPH) PDF on sending: rendered server-side from the print page
  (headless Chromium), kept on the registry document with a 30-day revocable
  link, carried by `quotation.sent` so n8n can send it to the customer
  (customer messages off by default) — ERP-0067. Evidence:
  `sales/services/quotation-delivery.service.ts`,
  `test/unit/quotation-delivery.service.test.ts`,
  `test/unit/document.service.test.ts`, `progress.md` 2026-11-17 (live
  Chromium render). Gaps: other documents (SO, invoice, delivery note),
  Chromium in the Docker image.

### planned
- One template per document — T05. Evidence: dbml `documents` only.
- Checkout / online orders — T21, ERP-0020. Evidence: dbml `commerce` only.
- Gateway reconciliation (fees, gross / net settlement) — T22, ERP-0020.
  Evidence: none (payment ledger is `finance.payments`, M09; `sales.payments`
  is scheduled for removal at step S7 in
  `docs/database/implementation-phases.md`).
- Document renderer + template editor — T05. Evidence: `GET/POST
  /documents/templates` exist, no render step, `documents/templates.tsx` is a
  stub. Print stays browser-print (no PDF library); `pdfmake` is the candidate
  only if an automatic PDF file is ever needed.
- External signers on the signature flow (customer/partner via a public token
  link) — `document.signatures.signer_type` and the `document.shares` token
  pattern are the upgrade path. Evidence: internal-only V1 ships (below).
- Drawing the signature on a canvas at signing time (slice 3 of the image
  question): today the signer uploads an image and reuses it.
- Generating a PDF from the app's own HTML layouts: the signed-PDF slice stamps
  an *uploaded* PDF only; print browser stays the default.

### in-progress
- Online payment of invoices (payment gateway) — T21/T22, ERP-0020, ADR-0021.
  Evidence: `apps/backend/src/app/payment` (`GatewayPaymentService`,
  `adapters/` Xendit / SingaPay / fake), `payment.gateway_payments`
  (ADR-0023; migration `20261117172959_erp0020_payment_gateway`),
  `test/unit/payment-gateway.test.ts`, invoice page card, `progress.md`
  2026-11-14 (API e2e 24/24, browser). Gaps: no provider sandbox yet,
  reconciliation, portal pay button.

### implemented
- Document signature requests (ask internal users to sign, sign/decline,
  cancel, immutable evidence), the per-user signature image, and placing that
  signature on a PDF uploaded to the document — T05, ERP-0048 / ERP-0049.
  Evidence: `apps/backend/src/app/document` (`signature.service.ts`,
  `signature.controller.ts`, `repositories/signature.repository.ts`),
  `document.signature_requests` + `document.user_signatures` + the three
  placement columns on `document.signatures` (migrations
  `20261116112133_erp0048_signature_requests`,
  `20261116173810_erp0048_signed_pdf`),
  `test/unit/signature.service.test.ts` (33 tests) + 15 route-guard tests,
  `/documents/signatures/{documents,request,mine}` pages, the placement page
  `…/mine/$requestId/place` and the Signatures card on
  `/documents/files/$documentId`, `progress.md` 2026-11-16 and 2026-11-17.
  Gaps: no committed e2e, external signers, canvas-drawn signatures.
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
  `apps/backend/src/app/sales` (`InvoiceService` with the journal +
  `InvoiceBillingService` for terms, restored 2026-11-14 after the PR #68
  merge had dropped them), `test/unit/invoice-billing.service.test.ts`,
  `/sales/invoices`, `/sales/down-payments`, `/sales/receipts`,
  `progress.md` 2026-11-06 (ADR-0011 step 3d-2) and 2026-11-14 (fix, API
  e2e 19/19, browser check). Gaps: kwitansi print (no sample),
  `finance.payments` ledger (S7).

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

- License API docs for own applications (gym, e-ticketing, visitor, …) —
  T24 groundwork, ERP-0019. Evidence: `docs/architecture/modules/licensing-integration.md`
  + `docs/architecture/api/licensing.yaml` (moved into `docs/architecture/` from a separate docs site
  site), `progress.md` 2026-11-14.

- License API keys issued as the acting member — ERP-0019, PR #104. Evidence:
  `progress.md` 2026-11-15; keys stay organization-owned but Better Auth is
  called as the signing member (`issuedBy` in metadata, "Issued by" /
  "Revoked by" on `/subscription/api-keys`), Better Auth `/api-key/*` HTTP
  routes closed, refusals map to `403 licensing.apiKey.notPermitted`. Not yet
  accepted by the owner.

### blocked
- Pilot application licensing integration — T24. Needs pilot app source access.

## M04 n8n, WhatsApp, Website

### done
- Public catalog API for the website (`CatalogSource`) and the website
  listing screen — T15, M04 stage 1. Evidence: `progress.md` 2026-11-07
  (M04 4a): `src/app/catalog`, `catalog.service.test.ts`, e2e. Profile page
  stays static on the website. Not yet accepted by the owner.
- One ERP event → n8n webhook (outbox, log, manual retry) — T14, M04 stage 1.
  Evidence: `progress.md` 2026-11-07 (M04 4b): `src/app/automation`,
  `outbox.service.test.ts`, e2e with a fake receiver (signature, retry,
  manual send). Not yet accepted by the owner.
- Stage 2 notifications as n8n events (invoice issued, payment received,
  ticket updated, license ending — daily, once per threshold) — T28,
  ERP-0021. Evidence: `progress.md` 2026-11-07 (M04 4c), event contract in
  `docs/architecture/modules/notification.md`. Not yet accepted by the owner.
- WA/n8n setup guide (T32 handover deliverable): WAHA webhook, n8n flow per
  event with signature check and dedupe, AI provider, go-live checklist.
  Evidence: `docs/user-guide/whatsapp-n8n-setup.en.md` / `.id.md`
  (2026-11-12); not yet tried against a real WAHA/n8n.
- WhatsApp AI on FAQ + catalog through WAHA, handoff queue, WhatsApp logs,
  admin replies, FAQ base, lead capture from a chat — T27/T28, ERP-0021,
  M04 stage 2. Evidence:
  `progress.md` 2026-11-07 (M04 4d): `whatsapp-assistant.test.ts`, e2e with
  fake WAHA and a fake OpenAI-compatible model. Not yet accepted by the
  owner; live use is blocked until WAHA, a dedicated number and an AI
  provider exist (sandbox first).
- Requirements form → lead — T15. Built in M02 (`/public/v1`, ADR-0011
  step 3b); the WA button is website-side.
- Merged into `main` on 2026-11-15 (`merge: main into feat/m04-on-main`):
  the branch now sits on the current mainline, the module doc moved to
  `docs/architecture/modules/automation.md` (the old `notification.md` name
  belonged to ERP-0047), the ADR was renumbered to ADR-0020, and the five
  snapshot-less hand-written migrations became one generated migration on
  main's squashed baseline. Billing events come from the sales module.

### planned
- Live WhatsApp/n8n go-live: WAHA instance and sandbox number, n8n flows
  for the events, AI provider choice — owner/infra, outside the code.

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

## M02 sales returns (ERP-0065)

### implemented
- Sales returns (retur penjualan) from a shipped delivery note, replacement
  only: one-level approval, condition per line on receiving (`good` back to
  stock, `damaged` serial units flagged), `return_in` at the delivery cost,
  the order re-opened for the replacement delivery — ERP-0065. Evidence:
  `sales/services/sales-return.service.ts`,
  `test/unit/sales-return.service.test.ts`, `/sales/returns`, `progress.md`
  2026-11-16 (API e2e 28/28, browser walk-through). Gaps: reviewer sign-off,
  a printed return document, real-PG integration tests.

## M05 Inventory and Purchasing

### planned
- Inventory movement boundaries / valuation + GL reconciliation — ERP-0014
  (re-scoped into S1–S4; valuation deferred, OPEN-3).
- Stock value in the GL (journals) — T07, ERP-0014. Evidence: none (the
  value view exists, see implemented).

### implemented
- Payables from goods receipts: finance bills a purchase order for what was
  received and not billed yet (order price and VAT, supplier invoice number),
  recording debits Persediaan for stock lines — T07, ERP-0012 / ERP-0035.
  Evidence: `accounting/services/supplier-bill.service.ts`,
  `procurement/services/purchase-billing.service.ts`,
  `test/accounting/bill-from-order.test.ts`, `/finance/payables`,
  `progress.md` 2026-11-16 (API e2e 16/16). Gaps: the Persediaan account
  code `1-1400` is provisional (finance gate); no credit note when goods are
  returned after billing; reviewer sign-off.
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
- Purchase returns (retur pembelian) from a BPB, replacement only: one-level
  approval, `return_out` stock movement and serial units `returned` on
  shipping, the PO re-opened for the replacement — ERP-0068. Evidence:
  `procurement/services/purchase-return.service.ts`,
  `test/unit/purchase-return.service.test.ts`, `/procurement/purchase-returns`,
  `progress.md` 2026-11-15 (API e2e 34/34, browser walk-through). Gaps:
  reviewer sign-off, a printed return document, real-PG integration tests.
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
- Inventory & asset list UX — ERP-0063 (2026-11-16). Products/Components/
  Materials and the asset register are card grids with the entity photo
  (`components/item-thumb.tsx`, initials fallback); create moved into a dialog on
  each list page (`ItemForm.compact` + `defaultItemKind`, `AssetForm`
  `onSuccess`/`onCancel`), and both `/new` routes were deleted along with
  `nav:item.newItem`; `page` is a URL search param on all six lists with the
  page size fixed at 24 in the client, so `limit` never appears in the address
  bar, and `useClampPage` rewrites a stale `page` back into range. Stock balances/movements and borrowings show the item/asset photo, which
  the backend now projects (`findNamesByIds` returns `imageObjectKey`,
  `ItemImageService.urlFor`, `IBorrowingRepository.listFirstAssetImages`).
  Evidence: `progress.md` 2026-11-16. Gaps: the pager is unverified beyond one
  page (seeded lists fit a single page).

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
- Purchase requests (PR → PO by lines, free-text lines mapped on the PO,
  one-level approval, company-wide) — T07, ERP-0063 (2026-11-15). Evidence:
  `procurement/services/purchase-request.service.ts`,
  `repositories/request-ordering.ts`, `test/unit/purchase-request.service.test.ts`,
  `/procurement/purchase-requests`, `progress.md` 2026-11-15 (API e2e 32/32,
  browser). Not yet accepted by the owner.
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

### in-progress
- None.

### implemented
- Portal security settings — ERP-0081 (2026-11-20): 2-step sign-in by email
  code, active devices, delete own login (last business owner cannot); unused
  settings removed. Evidence: `test/unit/customer-portal.test.ts`,
  `progress.md` 2026-11-20 ERP-0081.
- Order tracking from real data + courier/waybill on delivery notes — ERP-0080
  (2026-11-20): one stage derivation for portal and website; RajaOngkir-ready
  courier codes. Evidence: `test/unit/public-tracking.test.ts` (10),
  `progress.md` 2026-11-20 ERP-0080.
- Document downloads in the customer portal — ERP-0079 (2026-11-20): SPH,
  invoice and warranty PDFs rendered on request; project files. Evidence:
  `test/unit/portal-document-file.test.ts` (4), `progress.md` 2026-11-20 ERP-0079.
- Website sign-in back to the page + order with price-on-request items — ERP-0078
  (2026-11-20). Evidence: `progress.md` 2026-11-20 ERP-0078.
- Customer notifications in the portal — ERP-0077 (2026-11-20): SPH sent,
  delivery shipped, invoice issued, payment received and support replies
  reach the customer's portal logins; unread counters in the navigation.
  Evidence: `test/unit/customer-portal-notifications.test.ts` (4),
  `progress.md` 2026-11-20 ERP-0077.
- Company-data change requests — ERP-0076 (2026-11-20): an owner asks in the
  portal; sales approve (values written to the customer) or reject on the
  customer page; the account manager is notified. Evidence: migration
  `20261120062749_erp0076_company_change_requests`,
  `test/unit/customer-change-request.test.ts` (4), `progress.md` 2026-11-20 ERP-0076.
- Customer portal account pages — ERP-0075 (2026-11-20): profile figures,
  personal data, installation sites (also shown to staff on the customer
  page), notification channels and language, onboarding, document library.
  Evidence: migration `20261120061331_erp0075_addresses_preferences`,
  `test/unit/portal-account-pages.test.ts` (8), `progress.md` 2026-11-20 ERP-0075.
- Website account cart and wishlist — ERP-0074 (2026-11-20): a signed-in
  customer's cart and saved products follow the account across devices; the
  portal lists and removes saved products. Evidence: migration
  `20261119192024_erp0074_cart_wishlist`, `test/unit/account-shop.test.ts`
  (6), `progress.md` 2026-11-20 ERP-0074.
- Public order tracking — ERP-0073 (2026-11-20): website `/track` shows the
  full status when the email or phone matches the sales order; the portal's
  sign-in-free lookup shows a minimal status. Evidence:
  `test/unit/public-tracking.test.ts` (8), `progress.md` 2026-11-20 ERP-0073.
- Website forms and RFQs in the customer portal — ERP-0072 (2026-11-20):
  contact, demo and RFQ forms reach the ERP as leads; a signed-in RFQ joins
  the customer's account; guest RFQs are claimed with an emailed code; promo
  codes deferred (field hidden). Evidence: migration
  `20261119185938_erp0072_lead_portal_link`, `test/unit/portal-rfq.test.ts`
  (7), `progress.md` 2026-11-20 ERP-0072.
- Dynamic website configured in the ERP — ERP-0071 (ADR-0025), stages 1-4
  implemented 2026-11-19/20 (not accepted; browser walk-through of the
  content editor open). Stage 1
  implemented 2026-11-19: identity, contact, social links, default SEO,
  header and footer menus and website API keys in the web admin
  (Integrations → Website Settings), read by the website through
  `/public/v1/site`. Evidence: `apps/backend/src/app/commerce`,
  migration `20261119140431_erp0071_commerce_site`,
  `test/unit/website-config.test.ts` (8), `progress.md` 2026-11-19.
  Stage 2 implemented 2026-11-19: website content (17 types, `web_pages` +
  `web_assets`, image upload) edited in Integrations → Website Content and
  the home page read from it. Evidence: migration
  `20261119163259_erp0071_commerce_content`, `website-content.test.ts` (12),
  `website-content-labels.test.ts` (4), `progress.md` 2026-11-19 stage 2.
  Stage 3 implemented 2026-11-19: solutions, portfolio, case studies and
  testimonials on the website from the ERP (`progress.md` stage 3).
  Stage 4 implemented 2026-11-20: about, careers, news, help centre, legal,
  warranty and installation from the ERP (`progress.md` 2026-11-20).
- Customer portal stage 2 (ERP-0070, 2026-11-19): online order (website
  checkout) → draft SPH owned by the account manager or the default
  salesperson, customer accepts a sent SPH → sales order, orders, issued
  invoices and gateway payment in the portal, role gates. Evidence:
  `apps/backend/src/app/portal/services/portal-sales.service.ts`,
  `apps/backend/src/app/sales/services/customer-sales.service.ts`,
  `test/unit/portal-sales.test.ts` (14), `progress.md` 2026-11-19.
- Customer portal session (ERP-0069, ADR-0024, 2026-11-19): Better Auth
  session cookie held by the portal server (never in a body or a browser),
  global `customer` role required by the guard, sign-in and sign-up,
  new-password rule aligned (12-128), documented request bodies for every
  `/portal/v1` route. Evidence: `apps/backend/src/app/portal`,
  `src/authorization/portal-auth.ts`, migration
  `20261119120000_erp0069_portal_customer_role`,
  `test/unit/customer-portal.test.ts` (27), `progress.md` 2026-11-19.
- Customer portal stage 1 — T26 + the account part of T25, ERP-0022
  (ADR-0022): one login per customer contact with a role, staff invitations,
  owners manage colleagues, individuals sign up with an emailed code, the web
  admin refuses customer logins; `/portal/v1` sign-in (lockout), projects
  with milestones/BASTs/files (no costs), service tickets opened, discussed
  and confirmed by the customer (staff thread with internal notes), devices
  and warranties. Evidence: `src/app/portal`,
  `test/unit/customer-portal.test.ts`, `progress.md` 2026-11-14 (e2e 50/50).
  Gaps: the website adapter routes not wired; stage 2 (orders, quotations,
  invoices, documents, attachments) planned.
- Customer-facing UI in the monorepo: the public website and the customer
  portal (Astro) moved from the separate `entragate-platform` repository into
  `apps/` as root workspaces — `@ims-erp/web-landing` (:4321),
  `@ims-erp/web-customer-portal` (:4322), `@ims-erp/design-tokens`; one
  `bun.lock`, `astro check`/`astro build` wired into turbo. The ERP contract
  clients live in each app (`src/api/`), not in a shared package. Evidence: `progress.md` 2026-11-15 (astro check 0 errors, astro
  build passes) and 2026-11-18 (rename to `@ims-erp/*`, merge onto main).
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

### done
- Employees (invite-first, organization or company level) — ERP-0034.
  Evidence: `progress.md` 2026-11-10.
- Attendance (manual + import), leave (12-day quota, no self-approval),
  overtime, employee tasks, salary summary approved and locked by the owner,
  salary bank account — T10, ERP-0059. Evidence: `progress.md` 2026-11-12
  (`hr-records.service.test.ts`, e2e); rebased on `main` @ `2b28fc46`
  2026-11-15 (squashed migration baseline, `hasAppRole`, `CodeNumberService`),
  see `progress.md` 2026-11-15. Not yet accepted by the owner.

### planned
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
- Report API: `GET /reports/profit-and-loss`, `/balance-sheet`, `/cash-flow` in
  `accounting/controllers/payment.controller.ts` over `report.service.ts`.
- Statement CSV exports — T30 (partial). `GET /reports/{profit-and-loss,
  balance-sheet,cash-flow}.csv` gated `financial_report:export`;
  `accounting/utils/report-csv.ts`, `test/unit/report-csv.test.ts`.
- Monthly report archive — T30 (partial). `accounting.report_archives`
  (migration `20261115090001_same_guardsmen`), `ReportArchiveService`,
  `GET|POST /reports/archives`, `/reports/monthly-archives` page,
  `test/unit/report-archive.service.test.ts`,
  `scripts/smoke-report-archives.ts` 11/11 live. Evidence: progress 2026-11-15
  "M12 T30".
- Reports UI: `/reports` renders `ReportsPage` (was a stub). Evidence: progress
  2026-11-15 "M12 T30".

### planned
- XLSX/PDF exports for statements (CSV only today) — T30.
- Browser walk-through of `/reports` and `/reports/monthly-archives`; no
  real-PG test exists for any module.
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
- ERP-0008 Remaining master data (suppliers, catalog, COA, cash/bank,
  packages, investors) — company profile part implemented, see below.
- ERP-0025 Release preparation.
- ERP-0037 Nullable cross-module references (ADR-0014 schema flip).
- ERP-0045b Organization settings KV CRUD (`organization.settings`) — split out of
  ERP-0045, not built.

### in-progress
- ERP-0024 UAT, reconciliation, backup drill: UAT scripts for M02, M03, M04,
  M05, M07, M08 written (`docs/plan/uat/`, 2026-11-12), not yet run;
  reconciliation and backup drill not started.

### implemented
- ERP-0038 Port M02/M05/M07 onto main (ADR-0011): all six steps; on main
  through PR #58 → `merge/main-sync` → PR #68 (2026-11-09). Evidence:
  `progress.md` 2026-11-05/06, per-module entries above.
- ERP-0006 Address reference model + lookup API: `src/app/location`
  (`/locations/*`, cached), `location.seeder.ts`,
  `test/unit/location.service.test.ts`; built by programmer A.
- ERP-0009 Document numbering (company-wide series, settings page).
  Evidence: `apps/backend/src/app/organization`, `test/unit/numbering.service.test.ts`,
  `progress.md` 2026-11-05.
- ERP-0008 (part) Company profile + invoice bank accounts. Evidence:
  `test/unit/company-profile.service.test.ts`, `progress.md` 2026-11-05.
- ERP-0046 Dependabot bun config moved to the workspace root (`directory: "/"`)
  so the single root `bun.lock` is updated with the manifests. Evidence:
  `.github/dependabot.yml`, `progress.md` 2026-11-13. Not verified until a
  dependabot PR lands with `bun.lock` in its diff and green CI.
- ERP-0037 Port M02/M05/M07 onto main (ADR-0011): steps 1-2 implemented

### implemented
- ERP-0064 Dynamic company branding + login onboarding image (2026-11-17).
  `company.profiles.onboarding_object_key` (WebP via `storeDocumentImage`,
  S3/MinIO); `PUT/DELETE /company/profile/onboarding`; public
  `GET /company/branding` -> `{ name, onboardingUrl }` (no guard);
  `ICompanyService.getDisplayName()`; emails and the tax XLSX creator take
  `tradingName ?? legalName` over `APP_NAME` env (fallback `'ERP'`); the
  login page subtitle and hero image come from branding
  (`/hero.png` fallback). Upload fields live on an "Images" card on
  `/settings/company` (user request; supersedes the ERP-0045c logo
  placement on `/settings/documents`, which now holds the document settings
  only and gains an `open: true` nav leaf). Evidence: `progress.md`
  2026-11-17; backend 1133 tests, web-admin 119, locales 98; live HTTP +
  browser verified.
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


