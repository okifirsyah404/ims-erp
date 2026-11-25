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

Last synced: 2026-11-15 (ERP-0111 account pages added 2026-11-21). The schema
numbers quoted in the ERP-0070 entry below (18 schemas / 188 tables) are the
ADR-0024 figures as of 2026-11-19; ADR-0026 (2026-11-23) split `product` and
`warehouse` out of `inventory`, so the current contract is **20 schemas /
196 tables** (`docs/database/docs.dbml`). Full inventory of what has no code yet:
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

## Cross-cutting: database schema and table normalization (ERP-0070..ERP-0089)

Plan: `docs/plan/database-refactor/`. Decision: ADR-0024 (`proposed`).

### implemented
- ERP-0092 code number settings (2026-11-21): `/settings/code-numbers` (Settings -> Code Number) shows one card per `<schema>.code_numberings` (14 schemas) served by each owning module at `{prefix}/code-numberings` through the shared `codeNumberingController` + `CodeNumberingServiceBase`; app admin always, else `code_number:read`/`update`, warehouse card app-admin only. New `{ORG}` token (upper-cased org slug, every code type); customer/supplier codes generated when left empty. Evidence: `test/unit/code-numbering.test.ts`, `test/authorization/code-numbering-authorization.test.ts`, web-admin `test/unit/code-numbering-api.test.ts`; `progress.md` 2026-11-21. No live/browser check yet.

### in-progress
- ERP-0076 inventory: **backend done** (steps 1, 2a-2c); web-admin, web-landing and seeders open (P8). Item operations under /inventory/items/:id, /inventory/disposals, /inventory/tool-sets. **ADR-0026 split the product master and the warehouse estate out (2026-11-23):** `src/app/product/` (schema `product`, `/products`, `/product-categories`, `/product-listings`, website catalog at `/products/public/v1/catalog`) and `src/app/warehouse/` (schema `warehouse`, `/warehouses`); each owns its `settings`, `code_numberings` and `{COMPANY}`-token series; unit routes stay `/products/:id/units` but are served by `inventory`'s `SerialUnitService`. Frontend slice and the unit-test port are the open items.
- ERP-0078 procurement: **backend done** (supplier master gone, own numbering, products, `/procurement/*`); web-admin, seeder and `ExportedPurchaseOrderService` (P5) open.
- ERP-0077 sale: **backend done** (folder `sale`, `/sales/*`, own numbering, quotation person + company, legacy payments removed); web-admin, customer portal and seeder open; invoice-billing test blocked on P5.
- ERP-0079/0080/0081 finance, tax, payment: **backend done** (`finance` replaces `accounting` with depreciation; `tax` split out at `/taxes`; payment reworked to one ledger with polymorphic allocations, encrypted gateway config and `ExportedPaymentWebhookService`). `code-number` deleted. Web-admin, portal, webhook module (P7) and seeders open.
- ERP-0082/0083/0084 project, ticket, human-resource: **backend done** (project absorbs licensing + warranty; ticket replaces aftersales at `/tickets`; `human-resource` with salary records and `ExportedEmployeeService`). Web-admin, portal, landing and seeders open.
- ERP-0085/0086/0087/0089 document, notification, audit/automation, webhook: **backend done** (document owns its numbering, notification tables renamed to `push_notifications`, the `webhook` module owns `/webhooks/<provider>` with the legacy aliases and no schema). Web-admin wrappers, provider dashboards and seeders open.
  categories, item serials, stocks, movements, adjustments, valuation and the
  warehouse family run on the new schema (`/inventory/products`,
  `/inventory/product-categories`), numbering through
  `InventoryNumberingService`; 106 unit tests pass, `src/app/inventory`
  typechecks. Open: absorb `assets` (items, borrowing, maintenance, disposal,
  tool sets) and `catalog`, `ExportedInventoryService`, web-admin/web-landing.
- ERP-0075 supplier **backend done, consumers pending**: `src/app/supplier/`
  (2 repositories, service, `ExportedSupplierService`, `/suppliers` controller,
  container, entry), registered in `src/index.ts` and mounted in
  `src/app/app.ts` after `companyModule()`. 8 unit tests pass
  (`test/unit/supplier.service.test.ts`). Remaining: delete the old
  `procurement/controllers/supplier.controller.ts` + `supplier.service.ts`
  (P4, they compile against the removed `procurement.suppliers`), re-point
  `finance.supplier_bills` / `ap_open_items` (P5), web-admin `supplier-api.ts`
  + PO form pickers (step 6).
- ERP-0074 customer **backend done, consumers pending**: `src/app/customer/`
  (companies/people/addresses repositories, `CustomerService`,
  `ExportedCustomerService`, and the portal absorbed from the deleted `portal`
  module: `PortalAccountService`, `PortalAuthService`, `PortalService`,
  `/customers/portal/v1`, `/admin/customers/portal-accounts`; the login is the
  person's `customer.customers` row). `crm` deleted; its leads and website
  inquiries moved early into the new `src/app/project/` (`/projects/leads`,
  `/public/v1` URL kept until the Q34 cut-over). Unit tests: portal accounts and
  sign-in (18), customer (9), lead + website inquiry (12). Open: portal data
  reads (projects, tickets, devices) wait for the P6 ticket/project exported
  services (8 type errors, `test/unit/portal-data.test.ts` blocked); web-admin
  and web-customer-portal URL/shape changes.
- ERP-0073 company **backend done, consumers pending**: four repositories (one
  per table), `ExportedCompanyService`, `/companies`, invoice bank accounts
  removed (they live in finance, P5). 19 unit tests pass.
- ERP-0072 user: `ExportedUserService` added, portal accounts removed from the
  module, `role.schema` imports fixed; compiles clean.
- ERP-0070 P0 **code done, not accepted**: `docs/database/docs.dbml` rewritten
  to the ADR-0024 target (18 schemas, 188 tables; note normalization and the
  ADR-0014 nullable flip landed 2026-11-19), the Drizzle schema layer
  rewritten (18 files: 7 new — `customer`, `supplier`, `sale`, `tax`, `project`,
  `ticket`, `human-resource`; 11 rewritten; 13 deleted — `accounting`,
  `aftersales`, `asset`, `catalog`, `code-number`, `crm`, `hr`, `licensing`,
  `organization`, `portal`, `projects`, `role`, `sales`), and
  `src/shared/numbering/` added (`domain`, `table`, `repository-base`).
  `drizzle/db.ts` no longer registers relation parts (no repository used
  `db.query.*`). Evidence: `progress.md` 2026-11-19 "P0 schema contract".
- ERP-0071 location **partially done**: `findVillagePaths` batched join,
  `ExportedLocationService` (`assertVillage`, `resolveVillagePath`), token and
  container registration. Consumers not wired yet.
- ERP-0072 organization: the cross-module import in
  `organization/repositories/organization.repository.ts` (inventory schema) is
  removed; `warehousesCount` is 0 until `ExportedInventoryService` (P3) is
  injected into the service.

### planned
- ERP-0071..0087 remaining per-module refactor (auth, company, customer,
  supplier, inventory, sale, procurement, finance, tax, payment, project,
  ticket, human-resource, document, notification, audit + automation);
  ERP-0089 `webhook` module (no schema); ERP-0088 cutover (baseline
  migrations, seeders, URL aliases).
  Evidence: plan only (`progress.md` 2026-11-19, revised same day).

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
- Income/outcome summary and role-aware dashboard — ERP-0113 (2026-11-23,
  implemented): `GET /finance/cash-bank-transactions/summary` (`cash_bank:read`,
  cash basis, opening balances excluded); Income / Outcome / Net KPI cards and
  an income-vs-outcome chart; sections and cards shown per role grant; no-role
  explanation on `/`; `docs/role-permission.md` generated by
  `docs/gen-role-permission.ts`. Evidence: `progress.md` 2026-11-23,
  `test/unit/cash-flow-summary.test.ts`,
  `test/authorization/dashboard-aggregates.test.ts`,
  `test/unit/dashboard-api.test.ts`. Open: non-zero cash screenshot, review.
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
- ERP-0114 `/crm/customers` robustness (2026-11-23, **implemented**): one Better Auth account per customer person (username `{name}_{6 ms digits}`, default password `{username}12345678`, credentials shown once + emailed, verified email locked), one owner per customer company (`owner_customer_id`) + N staff, sectioned create/edit forms (identity, company incl. inline new company, contact, management) with photo upload, TanStack tables with server sort, filters and page size; global "(Optional)" labels, E.164 phone field, hidden number spinners. Evidence: `test/unit/customer.service.test.ts`, `test/unit/portal-account.test.ts`; `progress.md` 2026-11-23. Portal side is ERP-0115 (planned).
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
- ERP-0115 customer portal follow-up of ERP-0114: forced password change at first sign-in, username sign-in, owner/staff member UI. Plan: `docs/plan/plans/customer-portal-owner-and-first-login.md`.
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

## Cross-cutting: container images for the Astro apps (ERP-0107)

### implemented
- GHCR images `ghcr.io/okifirsyah404/ims-erp-landing` and
  `ghcr.io/okifirsyah404/ims-erp-customer-portal` (backend and web-admin
  moved to GHCR too): test-and-build + deploy workflows
  per app, root compose pulls them; build and server run on Bun only
  (PWA packages patched via `bun patch`). Evidence: `progress.md` 2026-11-22
  (local image builds + HTTP smoke). Not yet run on GitHub Actions.

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
- ERP-0109 Multi-image galleries (2026-11-23) for products/components/materials (M05), assets (M06) and warehouses: backend implemented (3 gallery tables + backfill migration, `/images` CRUD, cover mirrored into `image_object_key`); web-admin gallery UI and migration apply on a disposable DB still open.
- ERP-0110 Components and materials of a product (2026-11-23): informational composition per product (`product.product_components`, `GET|PUT /products/:id/components`), table on the detail page and editor in the create/edit form; not browser-verified.
- ERP-0116 Robust supplier master (2026-11-23): server-side sort + URL-backed filters on `/procurement/suppliers` (admin/users pattern), grouped form with an inline location cascade (create posts the address right after the company, edit PATCHes the primary one), company/PIC phone through the shared `CountryPhoneField` (E.164), company/person address CRUD behind `ExportedLocationService.assertVillage`, and the `whatsapp` / `payment_terms_days` / `payment_term_note` columns dropped (payment terms are written per purchase order). Migration generated, not applied; no browser walk-through.
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

### implemented
- ERP-0108 M07 sidebar restructure (2026-11-22): section renamed to Projects;
  Tickets (/tickets) and Warranty (/warranties) are top-level items with the
  warranty certificate list behind GET /warranties (pagination + project
  visibility); /projects/tickets/* routes moved to /_authed/tickets/*; the
  standalone BAST list page is removed (BAST lives in the project detail).
  Evidence: components/sidebar/nav-config.ts, 
outes/_authed/tickets/,
  
outes/_authed/warranties/, src/app/project/controllers/warranty.controller.ts,
  progress.md 2026-11-22.
- ERP-0094 portal session cookie + customer-only portal (2026-11-21, port of
  branch ERP-0069, ADR-0027): `/customers/portal/v1` sign-in and sign-up
  verification answer `Set-Cookie` with Better Auth's session cookie (no
  token in the body), logout clears it, the guard reads only `Cookie` (bearer
  401) and requires an active portal login, returning the global roles; the
  portal app admits only the `customer` role (moved from the ERP 2026-11-21);
  the role is granted on invitation and verified sign-up and backfilled by
  migration `20261121064831_erp0094_portal_customer_role`; new passwords
  12-128; OpenAPI summaries + request bodies. web-customer-portal and
  web-landing keep the cookie server-side. Evidence: `src/app/customer`,
  `src/authorization/portal-auth.ts`, `test/unit/portal-account.test.ts`,
  `apps/web-customer-portal/src/services/portal/erp-source.test.ts`,
  `progress.md` 2026-11-21 (live check on a disposable DB). Open: browser
  walk-through; ERP-0106 (2-step, devices, delete login) follows in P1.
- ERP-0106 portal security settings (2026-11-21, port of branch ERP-0081,
  P1): signed-in devices (Better Auth sessions by id, no tokens; sign out one
  or all others) and delete own login after the password (customer data
  kept, only company owner refused). Portal: `/settings/devices`,
  `/settings/delete-account`, settings page trimmed to working controls. The
  emailed two-step code and the stored settings (push, two-step, language;
  D3 columns + migration) were removed the same day by owner decision: the
  language is the portal's cookie sent as `Accept-Language`, push comes over
  the backend websocket, a second factor will be Better Auth's (not built).
  Evidence: `src/app/customer`, `test/unit/portal-account.test.ts`,
  `erp-source.test.ts`, `progress.md` 2026-11-21. Open: browser walk-through;
  Better Auth 2FA; account pages are P2 (ERP-0100).
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

## M08 Employees and Attendance (sidenav: Human Resource)

### implemented
- ERP-0117 robust HR slice 1 (2026-11-23): flat "Human Resource" sidenav,
  employee edit page + archive confirmation, task edit/soft delete,
  leave/overtime edit while submitted, attendance list with single-row CRUD.
  Evidence: `progress.md` 2026-11-23 (backend 1406 pass). No browser
  walk-through yet.
- ERP-0118 work schedule (2026-11-23): `/hr/schedule` week grid with cell
  CRUD and a weekly-pattern fill, `schedule` permission, seeder. Evidence:
  `progress.md` 2026-11-23 (migration on a throwaway database, backend 1412
  pass). No browser walk-through yet.
- ERP-0119 salary (2026-11-23): salary periods on the employee page, salary
  payee accounts in `finance.cash_bank_accounts` (`/finance/employee-bank-accounts`),
  payroll drafts from the period in force. Evidence: `progress.md` 2026-11-23
  (backend 1419 pass). No browser walk-through yet.
- ERP-0120 payday run (2026-11-23): `/settings/payroll` (application admins
  only), daily `payroll-pay-day` job creating draft payroll on payday and
  notifying `payroll:approve` holders. Evidence: `progress.md` 2026-11-23
  (backend 1425 pass). Scheduler not run against a live Redis yet.
- ERP-0121 invite documents (2026-11-23): draft employment agreement on every
  invite, personal data on the claim form, agreement PDF after the claim,
  employee Documents card. Evidence: `progress.md` 2026-11-23 (backend 1434
  pass). PDF render and browser walk-through not verified.
- ERP-0122 payslips (2026-11-23): payslip PDF per approved salary record,
  downloads one / all (ZIP) on the Payroll page, "Slip gaji saya" on
  `/accounts`. Evidence: `progress.md` 2026-11-23 (backend 1440 pass).
  Chromium render and browser walk-through not verified.

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
- Payroll journals — T20, ERP-0018. Evidence: none.

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
- Expense claims (ERP-0013, 2026-11-23, branch
  `feat/erp0013-expense-claims`): `finance.expense_claims(+items)` built,
  `/finance/expenses*` backend + web-admin (list, create/edit dialog, detail
  page), approval posts the accrual journal (idempotent `expense_claim:<id>`,
  DR expense per `category_code` / DR input tax / CR claims payable `2-1200`),
  new `expense_claim:*` permission. Evidence: 9 unit tests, migration
  `20261123150453_erp0013_expense_claims`, `validate-dbml.ts` OK, `progress.md`
  2026-11-23. Open: disposable-DB apply (Docker down) + browser check.
- Backlog mismatch resolved 2026-11-25: ERP-0010 moved to `implemented`
  (grill Q19); ERP-0011/0012 were already `implemented`.
- COA and cash/bank UX + default seed (ERP-0123..ERP-0125, 2026-11-25):
  `/finance/accounts` rebuilt on the `/procurement/suppliers` pattern (URL-backed
  search/type/status/postable filters, create/edit dialog, row actions, count)
  with a backend `search` (ilike code/name) + `isPostable` list filter;
  `/finance/cash-bank` gained a create/edit dialog carrying the invoice bank
  details (number, holder, usage, primary — one primary per usage enforced in
  the service) and the list now returns `glAccountId` (left join
  `bank_account_links`), so invoice printing finally sees form-entered accounts;
  `chart-of-accounts.seeder.ts` seeds 22 Indonesian accounts (every
  `constants/ar-posting.ts` code marked `isSystem`) and `finance.seeder.ts`
  links the seeded cash/bank accounts to `1-1000`/`1-1100`/`1-1200`. Evidence:
  backend 1453 pass, web-admin 209, locales 106, lint 0 errors,
  `validate-dbml.ts` OK; no schema change. Open: the seeder was not run against
  a database in this environment (no `POSTGRES_URL`), and there is no browser
  walk-through.

- GL foundation, Phase A of ADR-0030 (ERP-0126..0130, ERP-0132..0134,
  2026-11-25): `finance.posting_rules` + `PostingService.postBusinessEvent`
  (most specific rule wins; the hard-coded posting codes became 25 seeded `*`
  rules), `finance.cost_centers` (validated on journal lines),
  `journal_lines.product_id`, manual journals draft -> submitted ->
  approved/posted with maker-checker, reversal with mandatory reason that lands
  in the next open period when the original is closed, soft close (adjusting
  entries only) vs hard lock behind a no-pending-journal gate, CoA locking,
  IDR checks, trial balance + general ledger, audit trail; full 94-account
  `X-XXXX` CoA seed. Fixed: reports summed `posted` only, so a reversal negated
  the original instead of cancelling it. Evidence: migration
  `20261124201506_erp0127_finance_gl_foundation` applied to a local scratch DB,
  seed twice (second run 0 inserts), DB smoke 15/15, 19 new unit tests,
  backend 1472 / web-admin 209 / locales 106 pass, lint 0 errors,
  `validate-dbml.ts` OK. Open: browser walk-through; ADR-0030 owner approval.

- AR postings, Phase B (ERP-0135, 2026-11-25): invoices post through posting
  rules (DP to customer advances, revenue per product category, settlement
  releases the DP, service-period lines to deferred revenue with a monthly
  amortisation run and a lock gate), credit memos (apply/void) and
  maker-checker write-offs on the invoice page, `written_off` statuses.
  Evidence: migration `20261124212044_erp0135_ar_postings` on a local scratch
  DB, DB smoke 11/11, 9 unit tests, backend 1481 pass. Open: line-item invoice
  editor (service periods are API-only), credit allocation/refund.

- GR/IR and COGS, Phase B (ERP-0136/0137, 2026-11-25): goods receipts post
  Dr inventory / Cr GR/IR, bills clear GR/IR with purchase price variance,
  purchase returns reverse it, delivery notes post COGS (project COGS for a
  project order), sales returns reverse COGS, stock adjustments post against
  inventory variance. Evidence: migration `20261124214438_erp0136_grir_cogs`,
  DB smoke 7/7, PPV unit test. Open: PO-to-bill not run end to end on a
  database, supplier credit note, GR/IR aging warning.

- Receipts and gateway settlement, Phase B (ERP-0139, 2026-11-25): kuitansi
  (manual and online) now post to the GL and the AR open item (they did not
  before), credit memos survive later receipts, and gateway payouts are
  recorded as net to bank + fee against gateway clearing. Evidence: migration
  `20261125001655_erp0139_receipts_gateway`, DB smoke 8/8, 7 unit tests.
  Open: settlement-report import, refunds.

- Project postings, Phase B (ERP-0141, 2026-11-25): invoices carry the
  order's project and tag their revenue lines; manual project costs post to
  project COGS against claims payable or cash (by payment source) and their
  void reverses the journal; the cost form asks who paid and warns about a
  duplicate reference. Evidence: migration
  `20261125002439_erp0141_project_postings`, unit tests, DB smoke 3/3.

- Tax postings, Phase B (ERP-0140, 2026-11-25): PPh withheld at supplier
  payment (AP settled in full, bank pays the net, Utang PPh by tax code);
  monthly PPN settlement to Utang PPN / PPN lebih bayar; tax payments from
  cash/bank; Coretax e-Faktur and bukti-potong XML downloads (format
  unverified until a test import). Evidence: migration
  `20261125011648_erp0140_tax_postings`, unit tests, DB smoke 7/7.

### planned (ADR-0030 Phases B-D, accepted by the owner 2026-11-25)
- ERP-0131 year-end close; ERP-0138, 0142 (Phase B:
  payroll + PPh 21 TER, gateway clearing, tax + Coretax XML, project costs,
  sub-ledger opening import); ERP-0143..0147 (Phase C: bank statement import,
  advances/settlements, fixed-asset register + depreciation, project budgets,
  cost accounting); ERP-0148..0153 (Phase D: statements, forecast,
  profitability, ratios, management pack, closed-period profit contract).

### planned (Stage 2)
- Payroll + gateway postings (Stage 2) - T20, T22 (now ERP-0138 / ERP-0139). Evidence: none.
- Final COA list confirmed by finance/owner. The default seed is the 94-account
  `X-XXXX` hierarchy (ERP-0127); accounts are remapped through posting rules,
  not code changes, so the confirmation no longer needs a deploy.

## M10 Tax

### in-progress
- PPh 21 tables, ERP-0138 part 1 (2026-11-25): PTKP and Pasal 17 seeded,
  the TER table imported by finance as CSV at `/finance/tax/pph21` (never
  seeded), the PPh 21 engine, optional employee NPWP / PTKP / BPJS numbers,
  and company-wide PPh 21 / BPJS switches in the payroll settings. Payroll
  does not calculate with them yet (part 2). Evidence: migration
  `20261125014130_erp0138_pph21_tables`, unit tests, DB smoke 10/10.
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
- Account pages — since ERP-0111 (2026-11-21, **implemented**) one
  `/accounts` page of cards (username with live availability, email with
  verification + change-email, connected Google account, password or
  password-setup link, sessions) and `/profiles` as the profile editor
  itself (dropzone photo saved on Save, bio textarea); `/account/*` and
  `/profiles/edit` removed. Backend: Better Auth `user.changeEmail.enabled`
  (the email form never worked before), verification policy, and a
  `user.update.after` hook evicting the `GET /users/me` cache. Evidence:
  backend `test/unit/email-change-verification.auth.test.ts`, web-admin
  `test/unit/account-search.test.ts`, in-process E2E 11/11 and browser check
  in `progress.md` 2026-11-21 "ERP-0111". Google link round trip not run
  (needs a real Google account). Same day, ADR-0029: invitation-only sign-in
  — Google never signs up (`disableSignUp`), only `active` accounts get a
  session on any method (pending invitees and deactivated users refused with
  `ACCOUNT_NOT_ACTIVE`), no social link on inactive owners, `/login` shows
  mapped Google errors. Evidence: `login-gate.test.ts`,
  `google-login-hardening.auth.test.ts`, web-admin `login-error.test.ts`,
  in-process E2E 14/14.
- ERP-0112 last used login method (2026-11-23, **implemented**): Better
  Auth's `lastLoginMethod` plugin (cookie only, no schema) records the
  previous sign-in method; `/login` badges it with a pill overlaid on the
  Login button (`email`/`username`) or the Google button, `/sign-in/username`
  is mapped explicitly, and disconnecting Google clears it. Evidence: backend
  `last-login-method.auth.test.ts`, web-admin `last-login.test.ts`, live HTTP
  3/3 in `progress.md` 2026-11-23. Badge not checked in a browser.
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


