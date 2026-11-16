# Progress

Feature status rollup: `docs/plan/plans/features.md` (todo / in-progress /
done by module; update in the same change as a `backlog.md` status move).

Latest verified state. Update this file every working session, including
exact commands and outcomes. `progress.md` lies are worse than missing code.

> **Historical paths:** entries dated before 2026-11-05 may reference
> `.agents/docs/...` locations (e.g. `progress.md`, `backlog.md`, `modules/`,
> `decisions/`, plan docs). These were moved on 2026-11-05: tech docs to
> `docs/architecture/`, planning/status docs to `docs/plan/`. Historical
> entries are left as written; only current/live sections use the new paths.

## 2026-11-16 - ERP-0039: official WhatsApp (Meta Cloud API) option, registration guide, robust dedupe

The owner asked about Meta WhatsApp Business, because WAHA numbers risk bans, and about how to
register; documented and built into the n8n workflow (branch `docs/m04-n8n-workflows`, PR #114).

**Workflow (`docs/integrations/n8n/`)**
- **Provider switch.** "4. Send WhatsApp" now reads `WHATSAPP_PROVIDER`:
  - `waha`: unchanged.
  - `meta`: the Cloud API. Business-initiated messages must be approved templates, so
    `POST /v23.0/<META_PHONE_NUMBER_ID>/messages` carries `type: template`, language `id`, and
    body parameters.
  - A message without a template is skipped and reported, never sent as free text.
- **Templates.** "3. Compose messages" now gives every message both forms: the free text and a
  template name with its parameters (new lines flattened, as Meta refuses them).
- **Template tooling.**
  - `meta-templates.json`: 15 Indonesian Utility templates.
  - `create-meta-templates.ts`: submits them to the WABA.
  - `check-meta-templates.ts`: runs the compose code for every topic and change, and checks
    template names and parameter counts.
  - `samples.ts`: holds the sample events shared by the scripts.
- **Dedupe fix found by testing.**
  - The problem: workflow static data is loaded when an execution starts and saved when it
    ends, after the ERP already has its answer. An event re-sent right away got through: 1 of 3
    repeats, and the Meta run's third retry attempt.
  - The fix: dedupe now uses an n8n data table `erp_processed_events`. Node "2a" creates it if
    missing (`createIfNotExists`), "2b" looks the id up, and "5a" upserts it only after the
    sends succeeded, all before the answer.

**Docs**
- New `docs/user-guide/whatsapp-business-meta.id.md` / `.en.md`:
  - WAHA vs Meta;
  - what to prepare (legal data, documents, a dedicated number not on the app, payment method,
    display name);
  - step-by-step registration (portfolio, app, WABA, number, business verification, Billing Hub,
    System User token);
  - template rules and the catalog, limits (250 → 2,000 …, per portfolio), cost model (per
    message since 2025-07-01, service charged from 2026-10-01) with a rate warning, opt-in;
  - n8n config, and a migration plan.
- These facts were checked against Meta's official docs on 2026-11-16 (pricing, messaging limits,
  get started, templates, webhook endpoint). The Indonesian per-message rates come only from
  third-party sources that disagree, so the guide says to verify them.
- `n8n-workflows.*.md`: the node table (data table, provider) and env vars were updated.
- `whatsapp-n8n-setup.*.md` warn about WAHA bans and link the Meta guide.

**Verification on a real n8n 2.47.7, with a mock WAHA + Graph API on :3999**
- `check-meta-templates.ts`: 34 messages against 15 templates, `OK`.
- **Meta mode.**
  - `send-test-event.ts all` returned 10× 200, giving 13 Graph calls with the right URL
    (`/v23.0/<id>/messages`), Bearer token and template payloads.
  - The extra changes (approved / shipped / received / overdue) also passed, including the
    supplier template with 6 parameters.
  - Meta answering 500 → webhook 500 → the retry succeeds → the next try is "duplicate".
- **Dedupe:** 6/6 immediate repeats were detected (before the fix: 1/3 got through), and a bad
  signature returned 401.
- **WAHA mode regression:** all 10 topics returned 200 with 15 WAHA calls, and a repeat was
  "duplicate".
- `create-meta-templates.ts` against the mock: 15 submissions to `/<WABA>/message_templates`.

**Not done**
- The ERP's inbound assistant on Meta (webhook `hub.challenge` + `X-Hub-Signature-256`, and a
  Meta adapter for `IWhatsappGateway`) is code work in M04 that waits for the owner's go.
- No real Meta account or approved templates yet.
- `docs/database/` was reviewed and is unchanged.

## 2026-11-16 - ERP-0039: importable n8n workflow for every ERP event, tested on a real n8n

Branch `docs/m04-n8n-workflows` from `origin/main` (`a1be332`). The owner
asked for a workflow they can import, explained in detail.

**What was added**
- `docs/integrations/n8n/erp-event-router.workflow.json`: one workflow for
  all topics.
  - Nodes: webhook `erp-events` → verify the HMAC signature (±10 minutes
    replay window) → skip duplicates (workflow static data) → compose
    messages from one `CONFIG` block (team numbers per role,
    `notifyCustomers` / `notifySuppliers` off by default) → send WhatsApp via
    WAHA → remember the event → answer the ERP.
  - An optional email branch is disabled after import.
  - The HTTP answers match the ERP outbox retry policy: 401/400 stop the
    retries, 500 (WAHA down) retries, 200 for handled or duplicate.
- The Code sources live in `docs/integrations/n8n/src/`;
  `build-workflow.ts` rebuilds the JSON from them.
- `send-test-event.ts` sends signed sample events, the same as the ERP, with
  `--change`, `--bad-signature` and `--repeat`.
- Guides: `docs/user-guide/n8n-workflows.id.md` and `.en.md`. They cover
  requirements, n8n and ERP env, import, each node, recipients, topics,
  testing and go-live. `whatsapp-n8n-setup.*.md` lists the new topics and
  links the guide.
- The topics `purchase_return.updated` (#108), `sales_return.updated` (#111),
  `supplier_bill.recorded` and `supplier_bill.due` (#112) are published by
  their PRs. Until those merge, `main`'s ERP sends only the six older topics;
  the workflow handles both.

**Verification on a real n8n 2.47.7 (Docker), with a fake WAHA on :3999**
- `n8n import:workflow`, then `publish:workflow` and a restart: imported and
  active.
- `send-test-event.ts all`, plus every `change` of the returns, bills and
  tickets: 25 events, all 200; 34 WhatsApp calls with the right chat ids and
  API key. Texts reviewed.
- Negative cases:
  - `--bad-signature` → 401.
  - `--repeat` → the second is "duplicate"; WhatsApp is sent once.
  - WAHA answering 500 → the webhook answers 500. The same event id
    succeeds once WAHA is back, and a third try is "duplicate".
- **Real ERP → n8n.** The backend of PR #112 ran on `ims_erp_v_ap` with
  `N8N_WEBHOOK_URL` pointing at the test n8n. Recording a bill (ap-e2e,
  16/16) made finance's WhatsApp receive "Tagihan pemasok 0008/SB/DEV/XI/26
  … dicatat", and `automation.outbox_messages` shows
  `supplier_bill.recorded | published | 1`.
- The links were checked against the web-admin routes, and two were fixed
  (`/projects/tickets/:id`, `/integrations/whatsapp-ai/:id`).
- The n8n 2.x specifics were confirmed live: `$env` with
  `N8N_BLOCK_ENV_ACCESS_IN_NODE=false`, `require('crypto')` with
  `NODE_FUNCTION_ALLOW_BUILTIN`, and `this.helpers.httpRequest` in Code
  nodes.

**Not done.** Real WAHA and real numbers (UAT). The owner still has to
approve the customer and supplier texts. `docs/database/` was reviewed and is
unchanged.

## 2026-11-16 - Inventory & asset lists: cards, images, dialog create, URL pagination (ERP-0063)

Status: **implemented** (browser-checked 2026-11-16; multi-page paging still
unverified because the seeded lists fit one page). `docs/database/` reviewed: no
table, column, index, constraint, status vocabulary or cross-module link changed
(`bun docs/database/validate-dbml.ts` -> OK, 275 tables / 235 refs).

Scope, in the order it landed:

- **Backend projections only (no schema change).**
  `inventory/contracts/item.repository.interface.ts` +
  `repositories/item.repository.ts`: `findNamesByIds` now returns
  `{ id, name, imageObjectKey }` instead of `{ id, name }`, so the stock lists
  can resolve a photo in the same query that resolves the name.
  `services/item-image.service.ts`: new `urlFor(objectKey)` (the body
  `withImageUrl` already used), injected into `StockService`;
  `TStockBalanceWithNames` / `TStockMovementWithNames` gained `imageUrl`.
  `assets/contracts/borrowing.repository.interface.ts` +
  `repositories/borrowing.repository.ts`: new `listFirstAssetImages(ids)` (one
  `borrowing_lines` x `assets` join per page, ordered by line `created_at`), and
  `BorrowingService.paginate` decorates each row with `imageUrl`
  (`TBorrowingListItem`).
- **Card layout + images.** New `apps/web-admin/src/components/item-thumb.tsx`
  (photo, or a two-letter initials tile) used by both card grids and the three
  tables. `components/inventory/item-kind-list.tsx` is a card grid
  (`sm:grid-cols-2 lg:grid-cols-3`) showing the photo, name link, code · sku,
  category, inactive and tracking badges; `components/assets/asset-register-list.tsx`
  replaced the `https://picsum.photos/300/200` placeholder with
  `ItemThumb src={asset.imageUrl}`. `stock-list`, `movement-list` and
  `borrowing-list` keep their tables and gained a 40px thumb beside the item /
  borrowing code.
- **Create in a dialog.** `ItemForm` gained `defaultItemKind` (the kind page
  pre-selects its own kind) and `compact` (drops the page heading);
  `AssetForm` gained `onSuccess`, `onCancel` and `compact`. Each of
  `/inventory/products`, `/inventory/components`, `/inventory/materials` and
  `/assets/register` now opens the form in a `Dialog` behind `product.create` /
  `asset.create`. Deleted `routes/_authed/inventory/items/new.tsx` and
  `routes/_authed/assets/register/new.tsx`, plus the `nav:item.newItem` sidebar
  entry and its `nav.ts` key in **both** locales (the dead-key scan would fail
  otherwise). `routeTree.gen.ts` regenerated by `bun run build`.
- **Pagination.** `page` is a URL search param on all six lists
  (`validateSearch` + `Route.useSearch()`/`useNavigate()`, house pattern); the
  page size is a frontend constant `PAGE_SIZE = 24` passed as `limit`, so the
  address bar carries `page` but never `limit`. Components take `page` /
  `onPageChange` props (shared `ItemKindList` cannot use one `getRouteApi` id);
  each query uses `placeholderData: previous` and clamps the rendered page to
  `totalPages`. The stock `inStockOnly` toggle resets to page 1. Previously every
  list hardcoded `limit: 100` and had no pager.

Commands and outcomes:

- `apps/backend`: `bunx tsc --noEmit -p tsconfig.json` clean after adding the
  `urlFor`/`listFirstAssetImages` doubles to
  `test/authorization/stock-test-doubles.ts` and
  `test/unit/asset-borrowing.service.test.ts`, and `imageObjectKey` to the
  `findNamesByIds` double in `test/unit/item.service.test.ts`; `bun test`
  -> **1084 pass / 0 fail** (83 files).
- `apps/web-admin`: `bun run build` (`tsc -b && vite build`) clean.
- Root: `bun run lint` 0 errors (12 pre-existing warnings, none in the touched
  files); `bun run test` green (web-admin 119 pass - the new `clampPage` cases
  included - plus `packages/locales` parity/dead-key).
- `bun docs/database/validate-dbml.ts` -> OK.

Browser-verified 2026-11-16 (in-app browser, Vite 5173 + backend 3001, `admin`
session): `/inventory/products` renders 12 cards with the initials fallback
(seeded items carry no photo), code · sku, category and tracking badge, and the
"New item" dialog opens with Kind pre-selected to `Product`; `/assets/register`
renders 6 cards with the same fallback, no `picsum` request, and its "Register
asset" dialog opens; `/inventory/stock` (4 rows), `/inventory/stock/movements`
(4 rows) and `/assets/borrowings` (3 rows) show the 40px thumb beside the
item/borrowing code; console clean on all five pages. `?page=9` on a 1-page list
is rewritten to `?page=1` by `useClampPage` (`lib/use-clamp-page.ts`), which is
what the manual `Math.min` clamp alone could not do. The pager itself does not
render because every seeded list fits one page (`PaginationControls` returns
`null` at `totalPages <= 1`), so a real second page is still unverified.

## 2026-11-16 - Sidebar: Components, Materials and Signatures restored (ERP-0062)

Status: **implemented**. `docs/database/` reviewed: no table, column, index,
constraint, status vocabulary or cross-module link changed
(`bun docs/database/validate-dbml.ts` -> OK).

Cause: commit `950a7a3c` (2026-11-14, "filter sidebar and switcher by role and
permission") switched the sidebar to deny-by-default `leafVisible()`, and the
three items had no flag, so they silently disappeared while their routes still
existed.

- `packages/common/src/authorization/erp-permissions.ts`: the `document`
  statement gains `signature_read`, `signature_request`, `signature_sign`
  (vocabulary only; ERP-0048/ERP-0049 flows still unbuilt). Every role that
  already held `document:read` (15 blocks) also gets `signature_read` +
  `signature_sign`; `signature_request` goes to owner (blanket spread), admin,
  operations_manager, sales_manager, project_manager, finance and hr. `member`
  stays without document access.
- `apps/web-admin/src/components/sidebar/nav-config.ts`: `item.components` and
  `item.materials` gated on `product.read` (routes were already real
  `ItemKindList` pages); `item.documentSignatures` / `item.requestSignature` /
  `item.mySignature` gated on `document.signature_read` / `.signature_request`
  / `.signature_sign`. No locale change needed (`nav.ts` en+id already carried
  all three keys).
- `apps/backend/test/authorization/authorization.test.ts`: new `document
  signature grants` block - the three actions exist in the catalog, every
  role holding `document:read` also holds `signature_read` + `signature_sign`,
  and the `signature_request` holder list is exactly the seven roles above.
- `docs/architecture/security-and-access.md`: `document` action list and the
  signature-flow note updated.
- Commands: `bun run build` in `packages/common` (the backend test resolves
  `@ims-erp/common` from `dist`), then `bun test test/authorization/authorization.test.ts`
  in `apps/backend` -> 30 pass / 0 fail. Full gates: backend `bun test`
  2168 pass / 0 fail, web-admin 115 pass / 0 fail, `tsc -b` clean in both
  workspaces and in `packages/common`, `bun run lint` 0 errors (200 pre-existing
  warnings), `bun docs/database/validate-dbml.ts` -> OK (275 tables, 235 refs).
- Browser-verified 2026-11-16 (in-app browser, Vite 5173 + backend 3001,
  `admin` session, org `entragate`): sidebar shows `Documents > Files,
  Signatures` with the three children (Document Signature, Request Signature,
  My Signature) and `Items > Products, Components, Materials`; the three
  `has-permission` POSTs for `document.signature_read|_request|_sign` return
  `success: true`; `/documents/signatures/documents` renders its "Coming soon"
  stub, `/inventory/components` lists 4 components and `/inventory/materials`
  lists 4 materials, console clean.
- **Gotcha worth remembering:** `@ims-erp/common` is consumed from `dist`, and
  `bun run dev` (bun `--watch`) does not rebuild it or reload it into a running
  backend. A catalog change therefore needs `bun run build` in
  `packages/common` **and** a backend restart, otherwise `has-permission`
  keeps answering `false` for the new actions and the nav item stays hidden
  even though the source is correct. This is exactly what happened before the
  browser check above.
- Skipped on purpose: `templates`, `itemCategories`, `goodsReceipts`,
  `deliveryNotes`, `downPayments`, `depreciation`, `bast`, `openingBalances`,
  `documentSettings` stay hidden - they still have no catalog resource.

## 2026-11-15 - Dashboard real data, slice 1: client organization context (ERP-0060)

Plan: `plans/dashboard-real-data.md` (grilled 2026-11-15, 24 locked decisions).
Slice 1 of 4. `docs/database/` reviewed: no table, column, index, constraint,
status vocabulary or cross-module link changed.

- `apps/web-admin/src/lib/organization-store.ts` (new): zustand
  `{ activeOrganizationId, setActive, reset }` plus `getActiveOrganizationId()`
  and `organizationHeaders()` (`x-organization-id`). No `localStorage`
  persistence (D5). Follows `lib/realtime/realtime-store.ts`, no `src/stores/`.
- `apps/web-admin/src/components/organization/organization-context-sync.tsx`
  (new): mirrors `session.session.activeOrganizationId` into the store, writing
  only when the value changes, so an optimistic switch is not clobbered (D8).
  Mounted once in `components/layout/main-layout.tsx`.
- `apps/web-admin/src/lib/use-active-organization.ts`: same signature, body now
  reads the store; the "never keeps its own copy" doc-comment was rewritten
  (D23).
- `components/sidebar/organization-switcher.tsx`: optimistic switch with
  rollback + toast on failure (D6), `Check` + `aria-current` on the active
  organization, `Spinner` + `disabled` while a switch is in flight,
  `DropdownMenuShortcut` showing the membership role, slug kept as trigger
  sub-label, and an `Empty` state (title/description/button) instead of a bare
  button when the user has no internal-role organization (D24).
- `x-organization-id` is now sent by the API clients the dashboard will use:
  `finance-api.ts`, `inventory-api.ts`, `invoice-api.ts`, `license-api.ts`,
  `project-api.ts`, `stock-valuation-api.ts` (D7). Backend already prefers that
  header over the session value and re-checks membership, so a stale id yields
  403, never another organization's data.
- `test/unit/organization-store.test.ts` (new): 5 tests - empty initial state,
  optimistic value survives a same-value sync, a sync replaces it once the
  server catches up, headers carry the id, `reset()` clears.

Verification: `apps/web-admin` `bun test` 105 pass / 0 fail (17 files),
`bunx tsc -b --noEmit` clean, `bunx oxlint` 0 errors (12 pre-existing warnings,
none in the new files). Repo root `bun run typecheck` 4/4 tasks, `bun run test`
5/5 tasks (backend 1067, locales 94, react-email 5), `bun run lint` 0 errors.

Not done in slice 1: the switcher/`Empty` copy reuses existing `nav` keys, so no
new locale keys were needed. No browser walk-through yet - deferred to slice 3,
when the dashboard actually consumes the store.

## 2026-11-15 - Dashboard real data, slice 2: two read-only aggregate endpoints (ERP-0060)

Plan: `plans/dashboard-real-data.md` (D9, D10, D11, D12). No schema change:
`docs/database/` reviewed, no table/column/index/constraint/link moved;
`bun docs/database/validate-dbml.ts` still prints `OK` (275 tables, 0
cross-module refs, 0 timestamp gaps, 0 parity drift).

**`GET /invoices/summary?from&to&groupBy=month|day`** (module `sales`, guard
`invoice:read`)

- `invoiceSummaryQuerySchema` (`contracts/invoice.contract.ts`): two Jakarta
  business dates, `from <= to`, `groupBy` defaults to `month`.
- `InvoiceRepository.summary` groups on `left(issue_date::text, 7)` (month) or
  `issue_date::text` (day), sums `grand_total` and counts rows, scoped by
  organization, `deleted_at is null`, `issue_date` inside the window and
  `status in (issued, partially_paid, paid)`.
- `INVOICED_STATUSES` deliberately excludes `overdue`: that state is derived
  from `due_date` at read time and never stored (`sales.schema.ts`).
- `utils/invoice-summary.ts` (`periodKeys`, `fillSummary`) zero-fills every
  period the window touches and recomputes the totals from the buckets, so the
  6-month chart has a stable shape. Pure, unit-tested.
- Aggregates are coerced with `Number()` because bun-sql returns
  `bigint`/`int` results as strings.
- `GET /invoices/summary` is registered **before** `/invoices/:id`.

**`GET /projects/stats`** (module `projects`, guard `project:read`)

- `ProjectRepository.stats({ involvedUserId, today })`: counts by status, by
  stage (active only, zero-filled over `PROJECT_STAGES`) and overdue
  (`status = 'active' and target_end_date < today`), all three in parallel.
- `ProjectService.stats(ctx)` passes `involvedUserId: ctx.canViewAll ?
  undefined : ctx.actorUserId` - the **same** visibility rule as `list()`, so
  the aggregate cannot reveal a project the list would hide (this was the one
  data-leak risk called out in the plan).
- `today` comes from `businessDateOf()` (Asia/Jakarta).

**Tests**

- `test/unit/invoice-summary.test.ts` (new, 7 tests): month/day period keys
  incl. a year boundary, zero-fill + totals, aggregate coercion, and a
  `mockDb`-based assertion that the query binds the organization, both date
  bounds and the three invoiced statuses while excluding
  draft/void/cancelled.
- `test/unit/project.service.test.ts`: the fake repository gained `stats`, plus
  one new test proving a technician counts nothing until a task is assigned,
  then counts exactly that project, and that overdue only counts active
  projects.
- `test/authorization/dashboard-aggregates.test.ts` (new, 6 tests): real
  `erpGuard` + controllers over stubbed services - 401 without a session,
  `technician` 403 on `/invoices/summary`, `finance` 200 with the guard's
  organization id, an inverted window rejected with 400, `member` 403 on
  `/projects/stats`, `technician` 200 there (`project:read`, narrow rows).

**SQL proved against the real local PostgreSQL** (`ims_erp_local`, disposable
rows inserted under a probe organization and deleted afterwards, probe script
removed): month buckets `2026-09 = 500000/2` (issued + paid), `2026-10 =
100000/1` (partially paid; draft and void excluded), `2026-11 = 0` (cancelled
excluded); an invoice with a null `issue_date` and one from another
organization never counted; day grouping zero-filled 9 days and found the
single row; `projects.stats` returned `{active: 2, closed: 1, overdue: 1}`
(a closed project past its target date is **not** overdue) and all zeros for a
caller with no involvement.

First run failed with `column "invoices.issue_date" must appear in the GROUP BY
clause`: PostgreSQL does not treat `to_char(x, $1)` in the select list and
`to_char(x, $2)` in `GROUP BY` as the same expression. Replaced with the
parameterless `left(issue_date::text, 7)` / `issue_date::text` form.

Verification: backend `bun test` 1081 pass / 0 fail (83 files), `bunx tsc
--noEmit` clean, `bunx oxlint` 0 errors (pre-existing warnings only).

Noticed, deliberately not touched: `invoiceListQuerySchema` accepts
`status=overdue`, but no row is ever stored as `overdue` (derived at read time),
so that filter can only return an empty list. Pre-existing, outside this
plan's scope.

Not done in slice 2: the web-admin client for `/invoices/summary` and the
dashboard rewrite are slice 3.

## 2026-11-15 - Dashboard real data, slice 3: real dashboard, mock removed (ERP-0060)

Plan: `plans/dashboard-real-data.md` (D3, D13, D16–D22). The mock
(`MOCK_SUMMARY`, `fetchDashboardSummary`) and `dashboard:banner.sampleData` are
deleted; `/` renders only endpoint data.

**Web admin**

- `lib/dashboard-api.ts` rewritten: local fetchers (`getJson`, `getPage`) send
  `organizationHeaders()`; every query key is `['dashboard', <domain>,
  organizationId, …]` (D19) and `enabled` is false without an organization or
  without the source permission (D16). Sources: `/invoices/summary` (sales card
  and chart, one request), `/cash-bank/accounts`, `/reports/profit-and-loss`
  (current month), `/items?limit=1` (count), `/stock/valuation` (`grandTotal`),
  `/projects/stats`, `/licenses/summary`, `/invoices?limit=5` +
  `/receipts?limit=5` (activity). `salesWindow` runs from six months back to
  **today**, not month end, so future-dated invoices never count.
- `project-api.ts`: `TProjectStats` + `projectStatsQueryOptions`.
- `components/dashboard/dashboard-page.tsx` rewritten: Refresh invalidates
  `['dashboard']`; each widget has its own skeleton / unavailable + retry; stock
  value is withheld (`—`) without `product:read_cost`; profit is labelled
  provisional; projects show active/closed/overdue and a bar per stage; the
  activity feed interleaves the five newest invoices and receipts; no
  organization → an `Empty` state pointing to `/organizations`. Project stage
  labels reuse `projects:stage.*`.
- `locales`: `en` + `id` `dashboard` bundle rewritten (sample banner removed,
  keys only for rendered copy). Parity and dead-key guards green.
- `test/unit/dashboard-api.test.ts` rewritten (Jakarta month arithmetic, window
  shape, dashboard root prefix, organization-keyed keys, disabled without
  organization or permission). The mock tests were retired with the mock.

**Defects found while building (fixed)**

- First typecheck failed: spreading another client's `queryOptions` and
  `TApiResponse.data` (nullable) broke overload inference. Fixed with typed
  local fetchers and keys.
- A `Button render={<Link>}` raised a Base UI `nativeButton` warning. Replaced
  with a plain `Link` styled as a button.

**Verification**

- `apps/web-admin`: `bun test` 106 pass / 0 fail; `bunx tsc -b --noEmit` clean;
  `oxlint` 0 errors (12 pre-existing warnings, none in dashboard files).
- Repo root: `bun run typecheck` 4/4, `bun run test` 5/5 (backend 1081,
  web-admin 106, locales 94, react-email 5), `bun run lint` 0 errors,
  `validate-dbml.ts` OK.
- Browser, local dev stack, `admin@local.com` (owner, Entragate organization):
  `/` loads; the request log shows `/invoices/summary`, `/invoices`,
  `/receipts`, `/licenses/summary`, `/items`, `/cash-bank/accounts`,
  `/reports/profit-and-loss`, `/stock/valuation`, `/projects/stats`, all **200**
  with `x-organization-id` set. No console errors after reload. Items shows 12;
  the other figures are zero because the dev database has no sales, finance or
  project rows (`sales.invoices` 0 rows, `projects` empty).

**Browser checks, same day (verification run)**

- Organization switch: a second organization `Entragate Cabang Dua`
  (`L4byXUUL27k4PuKhMiF4ONg85Rm8JrmQ`, owner `admin@local.com`) was created
  through `POST /organizations`. A cash account created in it appeared in the
  Cash widget only while that organization was active, and the widget went back
  to empty on switching back. The dashboard reads the active organization, not
  a stale copy.
- Single-card degradation: `/projects/stats` was forced to 500 in the page.
  Only the Projects card showed "This figure is unavailable right now. Try
  again"; Sales and Inventory kept their figures. Try again refetched the card
  and it recovered in the same page (the blocked endpoint was still hit twice,
  as expected).
- Not run: permission denial in the browser (no seeded non-admin account signs
  in on this database). Server-side denial is covered by
  `test/authorization/dashboard-aggregates.test.ts`. The role accounts
  (`<role>.seed@entragate.local`) returned 401 on sign-in here; the cause was
  not investigated, so only `admin@local.com` was used.
- Not captured: screenshot (needs a visible desktop window).

**Found, out of scope, not fixed**

- `POST /cash-bank/accounts` stores `openingBalance` but sets
  `currentBalance: 0` (`cash-bank.service.ts:113`), so a new account shows Rp 0.
  Needs a design decision: post the opening balance as a journal, or seed the
  running balance. Not changed here.
- There is no DELETE route for cash accounts. The verification account was
  deactivated with `PATCH isActive:false` and stays on the dev database.

## 2026-11-16 - Dashboard real data, slice 4: docs close-out and backlog renumbering (ERP-0060)

Slice 4 of `plans/dashboard-real-data.md`.

- **ID collision found and fixed.** The plan was drafted as ERP-0055 with a
  follow-up ERP-0056, but `plans/erp-0051-follow-ups.md` already assigns
  ERP-0055 (`Plan decision 6 contradicts the shipped Administration section`)
  and ERP-0056 (`module-ownership.md` schema inventory stale). Those are
  separate, still-open items. This plan is now **ERP-0060** and the audit
  activity-feed follow-up is **ERP-0061**; both were renumbered in
  `backlog.md`, `plans/dashboard-real-data.md`, `plans/features.md` and this
  file. The ERP-0055/ERP-0056 text still present in `progress.md` around the
  ERP-0051 follow-up inventory is that other work and was deliberately left
  alone.
- `docs/plan/erp-module-plans/m01-dashboard.md`: "Current state" rewritten -
  no backend `dashboard` module by decision, the source endpoints listed, the
  deviation from a single `/dashboard/summary` recorded, status `in progress`,
  and the browser gaps named.
- `docs/plan/backlog.md`: ERP-0060 row carries the four slices and the
  remaining checks; ERP-0061 row added for the audit feed.
- `docs/plan/plans/features.md`: M01 rollup says the Stage-1 widgets are on
  real data, open quotations stay out, and the audit feed is ERP-0061.
- `plans/dashboard-real-data.md`: header status, "As built" note on slice 2,
  and an "Open verification" section.
- `docs/database/` reviewed: no table, column, index, constraint, status
  vocabulary or cross-module link changed by any of the four slices.
  `bun docs/database/validate-dbml.ts` prints `OK`.

No code changed in this slice. Gates re-run 2026-11-16 anyway:
`bun run test` 5/5 (backend 1081, web-admin 106, locales 94, react-email 5,
0 failures) and `bun docs/database/validate-dbml.ts` → `OK` (275 tables, 0
cross-module refs, 0 timestamp gaps, 0 parity drift).

Still open, so ERP-0060 stays `in-progress`: permission denial in the browser
(no working non-admin account on the dev database) and a screenshot.

## 2026-11-16 - Dashboard auto-update every minute (ERP-0060, revises D18)

Owner request: the dashboard must refresh itself instead of waiting for the
header button.

- `apps/web-admin/src/lib/dashboard-api.ts`: new `DASHBOARD_REFRESH_MS =
  60 * 1000`; all nine dashboard queries (sales summary, cash, profit, item
  count, stock value, projects, subscriptions, recent invoices, recent
  receipts) now set `staleTime` **and** `refetchInterval` to it. The stale time
  equals the interval so a remount inside the same minute never double-fetches.
  `refetchIntervalInBackground` stays false (TanStack default), so a hidden tab
  stops polling and catches up when focused.
- `test/unit/dashboard-api.test.ts`: one new test pins `refetchInterval` and
  `staleTime` to `DASHBOARD_REFRESH_MS` (60 000 ms) on every widget.
- Plan decision **D18 revised**: it said "no polling (M01: figures computed on
  page load)"; it now records the one-minute auto-update and why it changed.
  The Refresh button stays for an immediate update.
- Removed a stale doc-comment on `salesSummaryQueryOptions` that still described
  a `select` the rewrite had dropped.

Verification: `apps/web-admin` `bun test test/unit/dashboard-api.test.ts` 11
pass / 0 fail; `bunx tsc -b --noEmit` clean; repo `bun run test` 5/5.

Browser evidence (same page, no user action): consecutive GETs spaced
`/invoices/summary` 60 656 ms, `/cash-bank/accounts` 60 229 ms,
`/projects/stats` 60 080 ms. Polling runs; the tab was visible throughout, and
a hidden tab stops by design.

## 2026-11-16 - Invoiced-sales chart: first, full width, with a range picker (ERP-0060, revises D13)

Owner request: the invoiced-sales chart leads the page at full width and can be
read over 14 days, 1/3/6 months, 1/5 years, or a custom date range.

- New `packages/ui/src/components/date-range-picker.tsx`: two-month range
  popover, same construction as the existing `DatePicker` (Popover + Calendar +
  Button trigger, `YYYY-MM-DD` in/out, `min`/`max`, year dropdown). `mode="range"`
  needs care: `react-day-picker` reports `range.from` as the **anchor** and puts
  the day just clicked in `range.to`, and it reports `to === from` for the first
  click, so a controlled value cannot tell "one day picked" from "range done".
  The component therefore keeps a `pendingFrom` and only emits a range on the
  second click, then closes.
- `lib/dashboard-api.ts`: `SALES_RANGES`, `salesChartWindow(today, range, custom)`,
  `addDays`, `daysBetween`, `shiftMonths` (day-clamping, so 31 Mar minus a month
  is 28 Feb, not 3 Mar). Presets are **rolling** windows ending today. Buckets
  are daily up to a 31-day span and monthly above it, so 14 days and 1 month
  show days while 3 months and longer show months. An incomplete or inverted
  custom range falls back to the 6-month default instead of firing a half-open
  request. `salesSummaryQueryOptions` now takes the resolved window and keys on
  `groupBy` too.
- `components/dashboard/dashboard-page.tsx`: the chart is the first card and
  spans the grid; a `ToggleGroup` holds the presets, and the `DateRangePicker`
  appears only for `custom`. The card subtitle shows the resolved window and the
  window total. The Sales card keeps its own month-bucketed window, since it
  compares the current month with the previous one.
- Locales: `chart.range.*` presets, `chart.rangeLabel`, `chart.customPlaceholder`,
  `chart.invoiced` in `en` + `id`; the `{{months}}` title is gone.

Verification (browser, local stack, after inserting three probe invoices for the
Entragate organization and deleting them again):
- Chart is the first card, 977 px inside a 1025 px `main` — full width.
- Presets resolved as: 14 days `2026-11-03..11-16` `groupBy=day` (Rp 100.000);
  1 month `2026-10-17..11-16` (Rp 100.000); 3 months `2026-08-17..11-16`
  (Rp 300.000); 6 months `2026-05-17..11-16` (Rp 300.000); 1 year
  `2025-11-17..11-16` (Rp 300.000); 5 years `2021-11-17..11-16` (Rp 600.000,
  catching the June 2024 invoice). Non-zero bars matched each total.
- Custom range: picking 1 Nov then 15 Nov produced `2026-11-01..11-15`
  `groupBy=day`, closed the popover, and issued exactly one request.
- A single day shows `Nov 1, 2026 – …` while the second date is pending.

Gates: repo `bun run test` 5/5 (backend 1081, web-admin 115, locales 94,
react-email 5), `bun run typecheck` 4/4, `bun run lint` 0 errors.
`docs/database/` reviewed: no schema change.

**Follow-up the same day: "Custom" opens the calendar directly.** The picker's
own input button is gone from this screen; clicking the Custom preset shows the
two-month calendar straight away.

- `packages/ui/src/components/popover.tsx`: `PopoverContent` forwards `anchor`
  to the positioner, so a popover can hang off an element that is not its
  trigger.
- `date-range-picker.tsx`: new `showTrigger`, `anchor`, `open`, `onOpenChange`.
  With `showTrigger={false}` no button renders and the caller drives `open`.
  Closing is now the **controlled caller's** job: the internal close was removed
  for the controlled case because calling it inside the popover's own select
  handler raced with Base UI and left the calendar open.
- `dashboard-page.tsx`: the toggle group is the popover anchor; picking Custom
  (or clicking it again while active) sets `customOpen`, and `onChange` closes
  once both ends exist. The card subtitle reads "Pick a date range" until the
  range is complete.

Verified in the browser: Custom opens two calendars with no input button
(`hasInputButton: false`), picking 1 → 15 Nov closes it and shows
`2026-11-01 to 2026-11-15`, clicking Custom again reopens with the range
selected, Escape dismisses, and switching to a preset leaves it closed.










## 2026-11-15 - M12 T30: statement CSV exports + monthly report archive (branch `feat/reports-surface`)

Item 3 of `plans/2026-11-15_0538_todo_undone.md` §7. The report **API** already
existed; what was missing was the export surface, the monthly archive, and the
`/reports/*` UI. All three now exist.

**Backend**

- New table `accounting.report_archives` (`docs.dbml` first, then Drizzle,
  then generated migration `20261115090001_same_guardsmen`): unique scope index
  `(organization_id, period_year, period_month, report_type)`, CHECKs on the
  month range and the report type. Applied to `ims_erp_local`; columns, index
  and both constraints verified through `pg_catalog`.
- `ReportArchiveRepository` (insert / list / find, no update, no delete),
  `ReportArchiveService.archivePeriod` (refuses an `open` period, accepts
  `closed`/`locked`, idempotent on the scope index), two new domain errors
  (`accounting.reportArchiveNotFound`, `accounting.reportArchivePeriodOpen`)
  with en+id copy.
- `utils/report-csv.ts` flattens each statement to one CSV row per line plus
  total rows; UTF-8 BOM, RFC 4180 quoting, same convention as the tax recap.
- Routes on the accounting module: `GET /reports/profit-and-loss.csv`,
  `/reports/balance-sheet.csv`, `/reports/cash-flow.csv` (gated
  `financial_report:export`), and `GET /reports/archives`,
  `GET /reports/archives/:id` (`financial_report:read`),
  `POST /reports/archives` (`accounting_period:close`).

**Web admin**

- `/reports` renders the real `ReportsPage` (it was a `ComingSoonPage`), and
  `/reports/monthly-archives` is a working page: list of frozen statements with
  the headline figure per type, an archive-month form, pagination.
- `Export CSV` buttons on the reports page behind `financial_report.export`,
  using a new `lib/download.ts` (fetch with `credentials: 'include'` + blob
  save, so the server keeps the permission check).
- `finance-api.ts` gained `reportArchivesQueryOptions`, `reportArchiveQueryOptions`,
  `archiveMonth`; locales `archives.*` + `type.*` in en and id.

**Defects found and fixed while proving it**

- `generated_by uuid` was wrong: `auth.users.id` is a 32-char nanoid, so every
  `POST /reports/archives` from a real session answered 500 with
  `Failed query: insert into accounting.report_archives`. Changed to `text`,
  matching `accounting_periods.closed_by` / `reopened_by`, and the migration was
  regenerated (the old one was never applied anywhere but this dev DB).
- `POST /reports/archives` returned HTTP 200 with `status: 201` in the body.
  The repo convention is `status(201, created(...))`; fixed.
- The insert also needed an explicit `updatedAt`, which Drizzle's `$onUpdate`
  does not fill on insert.

**Evidence**

- `bun test` backend 1067 pass / 0 fail (81 files, +11 new: `report-csv.test.ts`
  8, `report-archive.service.test.ts` 6), web-admin 100 pass, locales 94 pass.
- `bunx tsc --noEmit` clean in both apps; `bun run lint` 0 errors (6
  pre-existing warnings, none in the touched files).
- `bun docs/database/validate-dbml.ts` -> `parsed: 275 tables, 235 refs`,
  `cross-module refs: 0`, `timestamp gaps: 0`, `drizzle parity drift: 0`, `OK`.
- `scripts/smoke-report-archives.ts` 11 pass / 0 fail over real HTTP against the
  local server: archive list, the three CSV exports (content type, BOM, header
  row, attachment filename), a closed month accepted with `201`, an open month
  refused with `409`.
- The archive write path was proven end to end on `ims_erp_local` (close
  `2026-01` -> 3 rows -> repeat call 0 rows -> list 3 rows) and the scratch rows
  and period were deleted afterwards, so the dev database is back to its prior
  state.

**Still open**

- `POST /periods` needs `accounting_period:create`, which the permission
  catalogue never grants (`accounting_period: ['read','close','reopen']` in
  `packages/common/src/authorization/erp-permissions.ts`). A period is therefore
  only created lazily by posting or by SQL. Not fixed here - it is a
  pre-existing gap that needs a decision, not a guess.
- No browser walk-through of the two pages yet, and no real-PG integration test
  (the repo has none for any module).
- `docs/database/` was updated (`docs.dbml` table + note) because this change
  adds a table.

## 2026-11-15 - Undone-work inventory, revision 2: `plans/2026-11-15_0538_todo_undone.md`

Wrote and then corrected `docs/plan/plans/2026-11-15_0538_todo_undone.md`:
every module and feature that has **no code**. Revision 1 read the plans and
`docs.dbml` only; revision 2 read the endpoint list, the web-admin route tree
and the test tree as well, which falsified five of revision 1's claims. No
application code, migration, seeder or test changed.

**Five corrections.** These are the reason revision 2 exists - each was a
"missing feature" that actually ships:

- Reporting has a backend: `GET /reports/profit-and-loss`, `/balance-sheet`,
  `/cash-flow` live in `accounting/controllers/payment.controller.ts` over
  `report.service.ts`. What is missing is the UI (`reports/index.tsx` and
  `reports/monthly-archives/index.tsx` are `ComingSoonPage`), the export
  surface, and the archive.
- M06 assets are built: `asset-operations.controller.ts` serves
  `POST /assets/:id/condition-checks`, `/maintenances`, `/depreciations`,
  `/documents`, `/disposals` (+ approve/execute/cancel), `/tool-sets` CRUD, and
  the `/assets/*` pages are real components. Missing: the **GL journal** for
  depreciation - `recordDepreciation` writes `assets.asset_depreciations` and
  never calls the posting engine (grep: no `posting` in
  `asset-operations.service.ts`).
- Document templates have `GET` and `POST /documents/templates`; missing are
  update/delete, the renderer, and the UI (`documents/templates.tsx` is a stub).
- Seven modules have zero code, not eight: `payroll`, `approval`, `budgeting`,
  `investor`, `commerce`, `ticket`, plus the dashboard. Reporting has a backend.
- The table counts: 274 table blocks, **145 unbuilt**, measured
  schema-qualified so a same-named table in another module does not count as
  built. `bun docs/database/validate-dbml.ts` prints `parsed: 274 tables, 235
  refs` / `cross-module refs: 0` / `timestamp gaps: 0` / `drizzle parity drift:
  0` / `OK`. Cross-check: 94 missing in shipped modules + 51 in the six unbuilt
  schemas = 145. Modules whose schema is complete: location, company,
  code_number, assets, document, audit, notification. Stale prose remains in
  `module-ownership.md` (268 tables / 524 refs) and `features.md` (270 tables,
  150 unbuilt).

**New findings, recorded not fixed:**

- **`finance` has no module.** `module-ownership.md` lists Finance as module 14
  owning the `finance` schema, but no `src/app/finance` exists: `accountingModule()`
  serves `/payments`, `/bills`, `/cash-bank/*`, `/ar/aging`, `/ap/aging`, and
  `accounting/repositories/*` imports both `accounting.schema` and
  `finance.schema`. That contradicts the one-schema-per-module rule in the
  `elysia-module` skill; either rename the module or split it.
- **Phantom backlog IDs**: ERP-0048 (signature requests), ERP-0049 (user
  signature image) and ERP-0050 (document templates) are cited by code comments
  and `features.md`, with no row in `backlog.md`.
- **`docs/architecture/modules/README.md` is stale**: it still calls finance,
  tax and asset-project "owner to be created", location and organization
  "scaffold", and user "partially implemented"; all five ship controllers and
  services.
- **`features.md` M12 mislabelled three rows** (fixed in this change): "Exports,
  monthly report archive - T30. Evidence: none", "Customer accounts +
  protected docs - T25. Evidence: dbml only" and "Cross-account security UAT -
  T31. Evidence: none" sat under `### implemented` while their own evidence said
  nothing exists. They now sit under `### planned`, and the report API that does
  exist is recorded as its own implemented row.
- **Live route drift**: `apps/web-admin/src/lib/invoice-api.ts` posts to
  `/invoices/:id/void`; `sales/controllers/invoice.controller.ts` serves
  `POST /invoices/:id/cancel` only, so the void action is broken against main.
- **No real-PostgreSQL test anywhere** - `test/helpers/mock-db.ts` is the only
  database double and `test/accounting/*` types its fixture as `BunSQLDatabase`
  without connecting. **No committed e2e**: no `playwright.config.*` or
  `cypress.config.*` exists; the five `apps/backend/scripts/smoke-*.ts` run by
  hand.
- Carried over from revision 1: ERP-0010 is `planned` while `src/app/accounting`
  ships COA/journals/posting/periods/reversals/AR-AP/bank rec/month-end close;
  ERP-0039 is used twice (org invitations and M04 stage 1); ERP-0037 appears
  twice in `features.md`; ADR-0010 is still `proposed` while ERP-0031/0032/0033
  depend on it; six UAT scripts written 2026-11-12 never ran.

`backlog.md` reviewed: no status moved, because nothing was built. `features.md`
carries one pointer line to the new file. `docs/database/` reviewed and
unchanged - no schema, column, index, constraint or cross-module reference
changed; `validate-dbml.ts` was still run and printed `OK`.

## 2026-11-15 - The remaining native date inputs: month, time and datetime

The last non-date native inputs followed `DatePicker`: 4 `type='month'`, 2
`type='time'` and 2 `type='datetime-local'` across 6 files now use
`MonthPicker`, `TimePicker` and `DateTimePicker` from `packages/ui`. No native
`type='date' | 'month' | 'time' | 'datetime-local'` input is left in
`apps/web-admin`.

Each keeps the value contract its call site already held, so handlers only lost
their `event.target.value`:

- `MonthPicker` — `YYYY-MM` (`todayBusinessDate().slice(0, 7)`), year stepper
  plus a 12-month grid.
- `TimePicker` — `HH:mm`, two scrollable columns; `step` defaults to 1 so no
  stored minute is unreachable, and an empty value still maps to `null` in the
  attendance handler.
- `DateTimePicker` — `YYYY-MM-DDTHH:mm`, the exact shape
  `toDateTimeInput`/`fromDateTimeInput` produce, so the CRM dialogs did not
  change. Calendar and time sit in one popover; picking either half fills the
  other with today / `00:00` so the emitted value is always complete.

All three share the `DatePicker` shell: `Button variant="outline"` trigger,
`data-empty` for the placeholder colour, a suffix icon in
`--muted-foreground` (so it follows light/dark — measured
`oklch(0.551 0.0234 264.364)` in light), and the off-screen `required` input that
keeps native form validation working. `parseTime`/`formatTime` moved to
`packages/ui/src/lib/time.ts` so `TimePicker` and `DateTimePicker` share one
parser instead of a component file exporting helpers.

Verified:

- `@ims-erp/ui` `typecheck` and `lint` → exit 0
- `bunx tsc -b` in `apps/web-admin` → clean; `lint` → exit 0; `test` → 100 pass, 0 fail
- Browser: `/hr/attendance` "Monthly recap" shows `November 2026` and the popover
  opens the 2026 month grid, picking March updates the trigger to
  `March 2026`; the day sheet's In/Out columns render `--:--` disabled for
  non-editable rows. `/crm/leads` "New lead" opens `dd/mm/yyyy --:--`, and
  picking the 20th, hour 09 and minute 30 sets `Nov 20, 2026 09:30`.
  `/hr/payroll` shows `November 2026` with the suffix icon.

`docs/database/` was reviewed and is unchanged. No locale keys added or removed.

## 2026-11-15 - Web admin date inputs become a `DatePicker`

Every `type='date'` input in `apps/web-admin` (40 across 28 files) is now
`DatePicker` from `packages/ui`, built from `Popover` + `Calendar` as the shadcn
date-picker docs prescribe. `captionLayout="dropdown"` gives the month and year
dropdowns of the "Date of Birth" example, so a date in another year is two
clicks instead of a paging walk.

The component keeps the repo's existing date contract: `value` is the
`YYYY-MM-DD` business-date string every call site already held, and `onChange`
returns that same string. No call site had to convert to `Date` or back, which
is why the whole conversion is a swap plus dropping `type='date'`.

Two details that are easy to get wrong and are handled in the component:

- **Suffix icon follows the theme.** The calendar icon renders in
  `--muted-foreground` rather than a hardcoded colour. Measured in the browser:
  `oklch(0.551 0.0234 264.364)` in light and `oklch(0.7155 0 0)` in dark, and
  the popover calendar re-themes with it.
- **`required` still blocks submit.** A popover trigger is a button, not a form
  control, so `required` renders an off-screen `required` input carrying the
  value; `checkValidity()` on it is `true` when a date is set. It is omitted
  when `disabled` so a disabled picker never blocks a form.
- `min`/`max` map to the calendar's `disabled` matchers, and `YYYY-MM-DD` is
  parsed by hand — `new Date('2026-11-15')` is UTC and lands a day early west of
  Greenwich.

`type='month'`, `type='time'` and `type='datetime-local'` are untouched: this
slice covers date-only inputs, which is what the request named.

Verified:

- `bun run --filter '@ims-erp/ui' typecheck` and `lint` → exit 0
- `bunx tsc -b` in `apps/web-admin` → clean
- `bun run --filter '@ims-erp/web-admin' lint` → exit 0; `test` → 100 pass, 0 fail
- Browser: `/projects/new` shows `dd/mm/yyyy` placeholders with the suffix icon,
  the popover opens a calendar with month and year dropdowns (123 years), and
  picking the 20th sets `Nov 20, 2026`; toggling the root `dark` class re-colours
  both the icon and the calendar. `/hr/leave` "Record leave" renders two
  DatePickers with the hidden `required` inputs bound to the form and valid.

`docs/database/` was reviewed and is unchanged. No locale keys added or removed.

## 2026-11-15 - Web admin UI consistency: shadcn `Select` everywhere, search icon prefix

Every native `<select>` in `apps/web-admin` that was not already a
`packages/ui` component is now the shadcn `Select` (`Select`, `SelectTrigger`,
`SelectValue`, `SelectContent`, `SelectItem`), and every `type='search'` input
is an `InputGroup` with a `Search` (lucide) prefix. 85 native selects across 51
files and 25 search inputs; the `const select = '...'` class strings they used
are gone. `NativeSelect` usages (`components/assets/borrowing-form.tsx`,
`assets/asset-detail.tsx`) and `inventory/adjustment-form.tsx` were already
`packages/ui` components and were left alone.

**Bug found and fixed in `packages/ui`, not at the call sites.** Base UI's
`SelectValue` reads the trigger label from the root's `items` prop, not from the
`SelectItem` children (the popup unmounts while closed). Without `items` every
filter trigger rendered its raw value — the pre-existing `hr/employees` status
filter already showed `all` on `main`, so this was not introduced here but the
conversion multiplied it. `packages/ui/src/components/select.tsx` now wraps
`SelectPrimitive.Root` and derives `items` from the `SelectItem` children when
the caller does not pass it, so all 110 call sites get labels with no per-file
churn.

Behaviour notes: empty/placeholder options use a `'none'` (or `'all'`) sentinel
mapped back to `''`/`undefined`/`null` in the handler; `disabled`, `id` (moved
to `SelectTrigger` so `<label htmlFor>` still works) and `aria-label` are
preserved. `required` no longer triggers the browser's native form validation —
each affected form already guards its submit button on the same state
(`!salesOrderId`, `!bastId`, `!itemId`, ...), so submission behaviour is
unchanged but the browser tooltip is gone.

Verified:

- `bun run --filter '@ims-erp/web-admin' lint` → exit 0 (pre-existing warnings only)
- `bunx tsc -b` in `apps/web-admin` → clean; `bun run --filter '@ims-erp/ui' typecheck` → exit 0
- `bun run --filter '@ims-erp/ui' lint` → exit 0
- `bun run --filter '@ims-erp/web-admin' test` → 100 pass, 0 fail
- Browser walkthrough on the dev server: `/crm/leads`, `/crm/customers`,
  `/hr/employees`, `/projects`, `/procurement/purchase-orders`,
  `/projects/new`, `/procurement/purchase-orders/new` — trigger labels render
  ("All statuses", "Pick a supplier", "Hardware"), the search boxes carry the
  icon, and selecting an option updates the trigger and the query.
  `/integrations/webhooks` could not be checked: the page fetches
  `http://localhost:3001/api/auth/get-session` and is blocked by CORS, a local
  env issue unrelated to this change.

`docs/database/` was reviewed and is unchanged (no schema, contract, or
lifecycle change). No locale keys were added or removed.

## 2026-11-15 - M04 lands on the current mainline: `main` merged into `feat/m04-on-main`

Branch `feat/m04-on-main` was 106 commits behind `main`; the M04 code (website
catalog, outbox to n8n, WhatsApp assistant) had never reached `main` at all —
the "carried onto main 2026-11-12" wording in `backlog.md` was wrong and is
withdrawn. Forty files were changed on both sides, 28 of them conflicting
(`git merge-tree --write-tree`), and the other 12 auto-merged into code that
would have compiled or run differently than either branch intended.

`git merge main` on `feat/m04-on-main`, then:

1. **Migrations.** Dropped the five hand-written, snapshot-less M04
   migrations (`20261113090000`..`090400`) that main's ERP-0052 squash had
   superseded, then `drizzle-kit generate` on main's 20-migration chain
   produced one migration for the M04 schemas:
   `20261115090000_m04_catalog_automation_schemas` (2 `CREATE SCHEMA`, 5
   tables, 2 intra-module FKs, 14 indexes, 9 checks). `drizzle-kit check`
   → `Everything's fine`, and `generate` afterwards → `No schema changes`.
2. **Backend.** `app.ts` mounts main's `realtimeGateway`/`notification`/
   `company`/`code-number`/`document`/`hr` modules plus M04's
   `catalogModule()` and `automationModule()`; `index.ts` keeps main's
   registration order, registers automation before CRM, and starts every
   worker (avatar, org logo, notification, outbox, WhatsApp, mail, license
   due) from the one `startWorkers` array with both schedules behind
   `scheduler.enabled`. The three conflicting services keep main's seams
   (`CODE_NUMBER_SERVICE_TOKEN` — `NUMBERING_SERVICE_TOKEN` is gone from
   main — and `DOCUMENT_SERVICE_TOKEN`) **plus** M04's `OUTBOX_SERVICE_TOKEN`:
   `invoice.issue` still splits into `issue` + `issueInTransaction` so
   `invoice.issued` publishes after the commit, and `receipt.recorded` sits
   next to the ERP-0044 `documents.register`; `serviceTicket.close` registers
   the document then publishes `'closed'`; licensing keeps documents and
   `publishDueNotices` together.
3. **`automation.outbox_messages.organization_id`** is `text` **nullable**
   (elysia-module 3.2/3.3, ADR-0014): M04 publishes company-wide events
   (ADR-0012), so no publisher fills it and no query filters on it; the
   column reserves the tenant scope. `docs.dbml` was rewritten to the
   **shipped** shape rather than main's target shape (`topic varchar(64)`,
   `payload jsonb NOT NULL`, `last_attempt_at`/`response_status` instead of
   `available_at`, status without `dead`, plus `dedupe_key`), and
   `catalog.web_listings`, `automation.faq_entries`,
   `automation.whatsapp_conversations` and `automation.whatsapp_messages`
   were added.
4. **Permissions.** `erpStatements.whatsapp` (new) and M04's grants, dropped
   for `investor`/`customer` because main moved those to application roles
   (ADR-0018); main's `company`/`code_number` split kept.
5. **Web/UI.** `nav-config.ts` taken from main — it already pointed at
   `/integrations/{website-catalog,whatsapp-ai,webhooks}`, which only exist
   on this branch, so the merge is what makes those three live; `item.
   notifications` kept from main (see the open defect below);
   `routeTree.gen.ts` regenerated by the router plugin (93 `integrations`
   references), never hand-merged.
6. **Docs.** `docs/architecture/modules/automation.md` created and
   `notification.md` taken from main (the old branch file described M04 under
   the name that now belongs to ERP-0047); `data-model.md` gained the
   `catalog`/`automation`/`notification` entries; user guide has both 8.6 (M08)
   and 8.7 (M04). The M04 ADR was **renumbered ADR-0015 → ADR-0020** because
   main claimed ADR-0015 for the company/document/code_number split;
   `README.md` indexes both.
7. **`docs/database/logical-references.md` regenerated**, not merged.

Verification (this machine, `ims_erp_local` + disposable
`ims_m04_merge_check`):

- `bun install` — no changes; `bun run typecheck` (backend, after adding the
  `documents` double to `sales-invoice-events.test.ts`), `bun run lint`
  (0 errors, 6 pre-existing warnings), `bun run test` — backend **1056 pass**,
  web-admin **100**, locales **94**, react-email **5**, 0 fail;
  `bun run --cwd apps/web-admin build` clean.
- `drizzle:migrate-reset` on `ims_m04_merge_check` → **21 migrations, 128
  tables**, `automation.*` (4) and `catalog.web_listings` present; a second
  `drizzle:migrate` is a no-op (21/128); `drizzle:seed` twice → `inserted: 0`
  both times.
- `drizzle:migrate` on the dev DB appended only the new migration (19 → 21
  journal rows, 116 → 128 tables).
- `docs/database/validate-dbml.ts` → 274 tables, 235 refs, 0 cross-module,
  0 timestamp gaps, 0 drizzle parity drift, `OK`;
  `gen-logical-references.ts` → 531 refs across 41 targets.

**Open defect inherited from `main` (not caused by this merge):**
`nav-config.ts` shows **Notifications → `/integrations/notifications`**, but
neither branch has that route (main's notification UI is the header bell,
`components/notification/notification-bell.tsx`). `SidebarItem.url` is a
plain `string`, so typecheck passes and the link 404s when clicked. Fixing it
means either dropping the item or building an inbox page — tracked here, not
done in a merge commit.

Gate for M04 itself: nothing changed in what is *verified*. Live WhatsApp and
n8n still need a WAHA instance, a dedicated number and an AI provider
(ADR-0020 stays `proposed`). Browser verification of the merged web screens
(`/integrations/website-catalog`, `/integrations/whatsapp-ai`, `…/faq`,
`/integrations/webhooks`, `/settings/company`, `/settings/code-numbers`) is
**not yet done**: the dev stack starts and those routes load with no console
errors, but each redirects to `/login` without a session, so the pages were
not walked through with data. Pending the owner's login in the browser.

## 2026-11-12 - WA/n8n guide (T32), plan-doc cleanup, UAT scripts (ERP-0024)

Owner asked for three small items on `feat/m04-on-main`. Docs only — no
code, migration, seeder or test changed; `docs/database/` reviewed and
unchanged (no table, column or reference touched).

1. **WA/n8n setup guide (M04 T32 handover):**
   `docs/user-guide/whatsapp-n8n-setup.en.md` and `.id.md` — `.env`
   variables, WAHA webhook (URL, `message` event, HMAC key), n8n webhook
   with a signature-check Code node and dedupe on `X-Erp-Event-Id`, one
   flow per topic, AI provider, troubleshooting by status code, go-live
   checklist. Facts checked against `adapters/waha.ts`,
   `adapters/n8n-webhook.ts`, `utils/assistant.ts` and the web labels. The
   n8n snippet is **not** tried against a real n8n instance. Linked from
   `docs/user-guide/README.md` and `notification.md`.
2. **Plan-doc cleanup:** `features.md` M02 "planned" no longer lists
   customers/leads and invoices/DP/receipts (they were already under
   implemented); the stale "ERP-0037 port in-progress" block (the port is
   ERP-0038) replaced; ERP-0038 → implemented (PR #58 → PR #68, merged to
   main 2026-11-09); ERP-0006 → implemented (location module, seeder,
   cache, test — built by programmer A; found while checking); ERP-0037
   (nullable cross-module refs) stays `planned`: `sales.quotations`
   `customer_id` is still `NOT NULL`. Last synced 2026-11-12.
3. **UAT scripts (ERP-0024 → in-progress):** `docs/plan/uat/README.md` plus
   one file per owned module (M02 13 cases, M03 11, M04 11, M05 11, M07 9,
   M08 10), each with steps, expected result, Pass/Fail/Blocked and a
   sign-off table. Cases come from each plan's Acceptance interpretation
   (U01–U32 Excel text is not in the repo). Not testable yet and marked
   N/T: payment gateway callbacks (ERP-0020), customer portal (ERP-0022),
   payroll journal (ERP-0018). Expected results were checked against the
   error codes in the services (e.g. licensing keys, receipt overpayment).

**Found, pre-existing on main (not fixed here, owner/programmer A to
decide):** the web billing card and invoice page call
`GET /invoices/orders/:id/summary`, `POST /invoices` with `term`, and
`POST /invoices/:id/void`; main's Sales invoice controller (since the PR
#68 merge) has only list/get/create (explicit items)/update/cancel (draft
only)/issue/receipts. Creating an invoice from a sales order and voiding an
issued invoice therefore fail in the browser on main. Recorded in the M02
UAT script (cases 09–11) and backlog ERP-0038.

Verification: `bun docs/database/validate-dbml.ts` → OK; locale and code
untouched (no test run needed for docs).

Next executable task: programmer A reviews PR #83 and #84; then run the UAT
scripts on a staging database with the owner (M02 first — after the invoice
API mismatch is fixed), and set up the sandbox WAHA + n8n with the guide.

## 2026-11-12 - ERP-0021 lead capture from WhatsApp chats

Closes the Phase 6 gap recorded in the compliance pass below. Owner said
"kerjakan"; the open choice (automatic on handoff vs an admin button) was
taken as **an admin button** — no lead is made from spam or chit-chat, and
the admin decides.

Gate 1: `docs.dbml` `crm.leads` (source `whatsapp`, `whatsapp` column,
nullable `owner_user_id`), `module-ownership.md` (CRM owns leads; the link
needs a contract method on the owning side), `logical-references.md`,
`integrity-and-consistency.md` 7.1, `data-dictionary.md` 1.10/1.14;
`implementation-phases.md` skipped (no dependency on an unlanded step).
Gate 2 (manual): ownership — CRM creates the lead through the new contract
`LeadService.captureFromChat`; automation keeps only the link; tenant — leads
and chats are company-wide; new column
`automation.whatsapp_conversations.lead_id` is a nullable logical reference
(ADR-0014); lead unassigned (`owner_user_id` null, like a website inquiry),
`created_by` the admin; permission `whatsapp:reply`; once per chat via a
conditional `UPDATE … WHERE lead_id IS NULL` (two admins at the same instant
could leave one unlinked duplicate lead in CRM — accepted, documented); no
service-level DI cycle (WhatsappService → LeadService → OutboxService).

Built: `docs.dbml` first (gen-logical-references → 539 refs, validate-dbml
OK), Drizzle `leadId`, hand-written migration
`20261113090400_m04_whatsapp_lead_link` (one nullable column);
`POST /automation/whatsapp/conversations/:id/lead`; web "Create lead" /
"Open lead" (only with `lead.read`; otherwise "Lead created in CRM"); en/id
keys; ADR-0015, `notification.md`, `data-model.md`, user guide 8.7, backlog
ERP-0021 (partial note removed), features.

Verification: `bunx tsc --noEmit` clean; `bun run lint` → 0 errors (warnings
unchanged from main); `NODE_ENV=test bun test` (apps/backend) → 843 pass;
web `bun run build` OK; locales 86 pass; new tests — CRM contract
(`lead.service.test.ts`) and chat → lead incl. idempotency
(`whatsapp-assistant.test.ts`); disposable `ims_erp_m04` rebuilt with
`database/migrate-reset.ts` → migrations and seed complete, `drizzle-kit
push --explain` → no automation/catalog/crm difference. E2E on the dev stack
against `ims_erp_m04` (temporary `POSTGRES_DB` and `WAHA_WEBHOOK_SECRET`,
restored): two signed webhook messages → chat handed off (`no_provider`);
customer service "Create lead" → 200, linked; second click → same lead;
sales manager reads the lead (`whatsapp`, unassigned, number and both
questions in `needs`); one `lead.created` outbox event; `sales` (no
`whatsapp:*`) → 403; screenshot of the chat page checked.

## 2026-11-12 - M04 compliance pass against AGENTS.md (ERP-0039, ERP-0021)

Owner asked to check M04 (PR #84) against `AGENTS.md` and `README.md` and fix
the gaps. What was missing before and what was done:

- **Skills read before the fixes:** `elysia-module`,
  `elysia-layered-architecture`, `elysia-tsyringe`, `tsyringe`. Module entry
  factories, cross-module access (type + token only; publishers inject
  `OUTBOX_SERVICE_TOKEN`, the assistant `CATALOG_SERVICE_TOKEN`), one path-
  param name per position, worker handles in `startWorkers`, and
  `container.resolve` only in `plugin()` / worker start: conform. No
  service-level DI cycle (assistant → catalog → licensing → outbox).
- **Gate 1 completed:** `docs.dbml`, `module-ownership.md`,
  `integrity-and-consistency.md`, `data-dictionary.md` and
  `logical-references.md` (regenerated) read for the M04 tables;
  `implementation-phases.md` skipped (no dependency on an unlanded step).
  Findings fixed:
  - integrity 7.1 (state transitions are conditional updates): WhatsApp
    handoff / resume / close now update only from the expected statuses
    (`updateConversation(..., from)`); a second handoff sends no second reply
    or event; resume / close of a chat already in that state → 409
    `automation.whatsappState.*` (en/id). The outbox `recordAttempt` no
    longer overwrites a `published` event.
  - data-dictionary 1.10 (actor columns): `whatsapp_messages.sent_by_user_id`
    renamed `sent_by` (`docs.dbml` first, Drizzle, the unmerged migration
    `20261113090300_m04_whatsapp_assistant`, code, tests).
  - data-dictionary 1.12 says structured payloads are JSON `text`; M04 keeps
    `jsonb` for `outbox_messages.payload` like 14 existing `docs.dbml` columns
    (CRM submissions, sales snapshots). Recorded, not changed.
  - `whatsapp_conversations.chat_id` is a full (not partial) unique index:
    a soft-deleted chat is revived by the upsert, never duplicated.
- **Phase 6 (ERP-0021) check:** FAQ/catalog-only answers, human handoff,
  untrusted-message tests, sandbox/mock gating, webhook authenticity,
  idempotency, retries: met. **Lead capture from WhatsApp chats is not
  built** → ERP-0021 marked partial in `backlog.md`. Exit criterion "outbox
  decision recorded": ADR-0015 (proposed) written and indexed in
  `docs/architecture/README.md`.
- **Phase 3 output:** `data-model.md` now lists the `catalog` and
  `automation` schemas.

Commands and results: `bun docs/database/gen-logical-references.ts` → 538
refs; `bun docs/database/validate-dbml.ts` → OK; `bunx tsc --noEmit` clean;
`bun run lint` → 0 errors (warnings unchanged from main: backend 6,
web-admin 11, ui 19; none in M04 files); `NODE_ENV=test bun test`
(apps/backend) → 841 pass (new: conditional handoff/resume/close, outbox
race); web `bun run build` OK; locales 86 pass. Disposable `ims_erp_m04`
rebuilt with `bun run database/migrate-reset.ts` → migrations and seed
complete; `drizzle-kit push --explain` → no catalog/automation difference.
`graphify update .` not run: graphify is not installed on this machine.

## 2026-11-12 - M04 carried onto main (ERP-0039, ERP-0021)

Status: **implemented** on branch `feat/m04-on-main` (from `origin/main`
89940c0), not yet accepted by the owner. Replaces PR #65 (based on
`merge/main-sync`). The four M04 commits (4a `1cd2799`, 4b `e6f407d`, 4c
`41053ee`, 4d `ee8f52d`; sections below) were cherry-picked and adapted:

- **Module entry factories** (main mounts modules): `catalogModule()` and
  `automationModule()`; `index.ts` starts the outbox, WhatsApp and
  license-due workers next to main's mail worker.
- **Billing events moved to sales:** invoices and receipts belong to sales
  on main (the finance module is gone), so `invoice.issued` is published by
  `sales/services/invoice.service.ts` after the issue transaction commits,
  and `receipt.recorded` after a receipt, with the invoice re-read
  (`sales/utils/invoice-events.ts`). `ar-flows.test.ts` asserts the event;
  new `sales-invoice-events.test.ts` (3 tests).
- **ADR-0014:** `catalog.web_listings.item_id` is nullable (`docs.dbml`,
  Drizzle, SQL); an unlinked listing is hidden and cannot be published.
  The other M04 cross-module references were already nullable.
- **Migrations** renamed after main's newest and **hand-written** (no
  `snapshot.json`), like `20261112000000_erp0034_hr_employees`, because
  drizzle-kit generate/migrate are blocked on main:
  `20261113090000_m04_catalog_web_listings`,
  `20261113090100_m04_automation_outbox`,
  `20261113090200_m04_outbox_dedupe_key`,
  `20261113090300_m04_whatsapp_assistant` (the SQL is the drizzle-kit
  output of the M04 branch; the sections below use the old names).

Verification: `bun docs/database/gen-logical-references.ts` → 538 refs,
`validate-dbml.ts` OK; `bunx tsc --noEmit` clean; `NODE_ENV=test bun test`
(apps/backend) → 839 pass; web `bun run build` OK; locales 86 pass.
Fresh disposable database `ims_erp_m04`: `bun run database/migrate-reset.ts`
→ migrations complete, seed complete; seeder run again → no new rows;
`drizzle-kit push --explain` shows **no difference for any catalog or
automation table** (only main's pre-existing `auth.organization_role` and
`sales.receipts` FK drift). Smoke test on the dev stack against
`ims_erp_m04` (`POSTGRES_DB` switched temporarily, restored): lead →
`lead.created` outbox row `pending` ("not configured"); catalog listings
200; public catalog without key 401; WhatsApp webhook without a configured
key 503; FAQ by marketing 201, by customer service 403. Invoice issue and
receipt events are covered by the unit tests above (an invoice flow on the
dev stack needs the chart of accounts set up).

Next executable task: review of PR #83 (M08) and PR #84 (M04; #65 closed as
superseded) by programmer A;
both edit `app.ts`, `index.ts`, permissions and locales, so the second to
merge needs a small rebase.

## M04 n8n, WhatsApp, website: gate 1, decisions and slices, 2026-11-07

Status: **implemented** (4a catalog API, 4b outbox to n8n, 4c stage 2
events, 4d WhatsApp assistant), not yet accepted by the owner. Live use
needs WAHA, a dedicated WhatsApp number (sandbox first), n8n flows and an
AI provider — none exist yet.

Next executable task: owner review of M04 on `feat/m04-integrations` (PR
with base `merge/main-sync`); then the go-live checklist in
`docs/architecture/modules/notification.md` (WAHA webhook + HMAC key, n8n
flows per event, AI provider) on a sandbox number.
Branch `feat/m04-integrations` (from `merge/main-sync`, so PR #58 stays as
reviewed).

Gate 1 (read): `docs/plan/erp-module-plans/m04-n8n-whatsapp-website.md`
(stage 1: public catalog + profile, requirements form → lead, one ERP event
to n8n with outbox log and manual retry; stage 2: WhatsApp AI on FAQ +
catalog, notifications, handoff to an admin, logs; the AI must never grant
discounts or transact — enforced by what it can call); docs.dbml MODULE
Catalog / Commerce / Automation (scaffolds; the automation workflow engine
is beyond baseline because n8n is the engine); the website repo
`entragate-platform` (`CatalogSource` contract: list / get / categories /
facets / stock / pricing / solutions / search / price cart, ERP routes
still empty); the website form → lead API already built in M02
(`/public/v1`, ADR-0011 step 3b).

Owner decisions (2026-11-07):
1. **WhatsApp via WAHA** (self-hosted WhatsApp HTTP API, not the official
   Business API): no template approval, but a risk of the number being
   banned — a dedicated number and a sandbox number first.
2. **No n8n yet**; n8n and WAHA are not added to the dev docker compose
   for now — the ERP side is built and tested against a fake receiver.
3. **Events**: stage 1 `lead.created` (n8n notifies the sales admin);
   stage 2 `invoice.issued`, `receipt.recorded`, `license.due`,
   `service_ticket.updated`; one outbox with send log, manual retry and an
   event id the receiver dedupes on.
4. **AI in scope (stage 2), logic in the ERP**: WAHA → n8n → an ERP endpoint
   that reads the FAQ and published catalog, asks the AI, answers or hands
   off, and logs the conversation; n8n only relays. **AI provider not chosen
   yet**: the ERP gets a provider-neutral port; with no provider configured
   every message is handed off to an admin.
5. **Routing (2026-11-07, refines 4)**: WAHA runs separately from the ERP.
   Customer chat goes WAHA → the ERP's inbound webhook directly (HMAC
   verified, deduped on the WhatsApp message id, answered at once and
   processed on the BullMQ queue), and replies go back through a WAHA
   adapter. n8n is used for the business events (the outbox): ERP → n8n →
   WAHA / email.

### 4a — website catalog API (implemented 2026-11-07)

- `docs/database/docs.dbml` MODULE Catalog: header (item master moved to
  inventory; scaffold target-only) + new `catalog.web_listings`
  (company-wide); `validate-dbml.ts` → OK. Drizzle
  `drizzle/schemas/catalog.schema.ts`; migration
  `20261107092348_catalog_web_listings` (generated, inspected, applied).
- Inventory contract `ItemCatalogService` (`ITEM_CATALOG_SERVICE_TOKEN`:
  live items with category, available stock over every warehouse —
  new `BalanceRepository.availableByItems` —, photo URL); test doubles of
  the balance repository extended.
- Module `src/app/catalog`: admin `/catalog/listings` (`catalog:read |
  create | update | publish | archive`; sales manager gains `catalog`,
  marketing had it) and public `/public/v1/catalog` (website key):
  `products`, `products/:slug`, `products/:slug/image` (no key; 302 to a
  short-lived photo URL; the link is only given when `APP_URL` is https),
  `categories`, `facets`, `stock`, `pricing`, `solutions` (own licensable
  applications, M03), `search`, `cart/price`. Whole-rupiah money; quotation
  listings have no price and are not purchasable in the cart; untracked
  items are "request"; stock is "ready" when available > 0, else the
  listing's out-of-stock mode. Repeated query keys (`?slug=a&slug=b`) are
  read as arrays (bug found in e2e, fixed).
- Web `/integrations/website-catalog` (list, publish / hide, edit, remove,
  item picker with slug suggestion); locale namespace `integrations`.
- Website route map for `entragate-platform` (`apps/web/src/lib/server/
  catalog/index.ts`): `listProducts: /public/v1/catalog/products`,
  `getProduct: /public/v1/catalog/products/:slug`, `listCategories:
  /public/v1/catalog/categories`, `getFacets: /public/v1/catalog/facets`,
  `getStock: /public/v1/catalog/stock`, `getPricing:
  /public/v1/catalog/pricing`, `listSolutions:
  /public/v1/catalog/solutions`, `search: /public/v1/catalog/search`,
  `priceCart: /public/v1/catalog/cart/price` (envelope: `unwrap` data).
- Verification: backend 688 pass (new `catalog.service.test.ts` 7),
  typecheck / lint clean, web build OK, locales 70 pass; e2e: listing
  created and published on the screen (sales manager), a quotation listing
  and a hidden one via the API; public API with a temporary website key
  (disabled afterwards): no key 401, hidden product 404, products / product
  / categories / facets / stock / pricing / search / cart as expected.

### 4b — ERP events to n8n: the outbox (implemented 2026-11-07)

- `docs/database/docs.dbml` MODULE Automation: header note (n8n is the
  workflow engine; the ERP keeps only the outbox) and
  `automation.outbox_messages` rewritten company-wide (topic, aggregate,
  payload, status `pending | published | failed`, attempts, last response);
  `bun docs/database/gen-logical-references.ts` then
  `bun docs/database/validate-dbml.ts` → OK. Drizzle
  `drizzle/schemas/automation.schema.ts`; migration
  `20261107093321_automation_outbox` (generated, inspected, applied with
  `NODE_ENV=development bun run drizzle:migrate`).
- Module `src/app/automation`: `OutboxService.publish` writes the event (row
  id = event id n8n dedupes on) and queues it on BullMQ `automation-outbox`
  (5 attempts, exponential backoff from 30 s); it never throws into the
  business action — a queue outage leaves the event `pending` for a manual
  send. Adapter `adapters/n8n-webhook.ts` posts the envelope with
  `X-Erp-Event-Id`, `X-Erp-Event-Type`, `X-Erp-Timestamp` and
  `X-Erp-Signature: sha256=<HMAC of "timestamp.body">`, 10 s timeout, never
  logs or echoes the URL. 5xx / 408 / 429 / network errors retry; other 4xx
  are final; no webhook configured keeps the event `pending`.
- Config `N8N_WEBHOOK_URL` / `N8N_WEBHOOK_SECRET` (optional; secret min 16
  chars; names in `.env.example`).
- CRM publishes `lead.created` from `LeadService.create` and
  `WebsiteInquiryService.capture` (`crm/utils/lead-event.ts`).
- Admin `/automation/outbox` (`automation:read_log`), `/summary`,
  `/:id/retry` (`automation:execute`); admin role gains `automation`. Web
  `/integrations/webhooks` (log, filters, "Send now", not-configured alert);
  locale keys `integrations:outbox.*` en/id.
- Verification: `NODE_ENV=test bun test` (apps/backend) → 694 pass (new
  `outbox.service.test.ts` 5, `lead.service.test.ts` + 1); `bun run
  typecheck` / `bun run lint` clean; locales 70 pass; web build OK. E2E
  against a local fake receiver (HMAC checked, first call 503, dedupe on
  event id; temporary `.env` entries removed afterwards): lead with no
  webhook → `pending` "not configured"; lead with webhook → 503 → BullMQ
  retry → `published` after 2 attempts; manual send of the pending one →
  `published`; resending a published event sends nothing; screenshot of the
  log screen checked. Note: two stale dev stacks were running at once and
  answered with an old env — stop ports 3000/5173/5174 before restarting.

### 4c — stage 2 events to n8n (implemented 2026-11-07)

- `docs/database/docs.dbml`: `automation.outbox_messages.dedupe_key`
  (varchar 200, unique) for once-per-fact events; gen-logical-references +
  validate-dbml → OK. Migration `20261107094748_outbox_dedupe_key`
  (generated, inspected: one column + unique index; applied).
  `OutboxService.publish(..., { dedupeKey })` skips a repeated key
  (`onConflictDoNothing`), nothing queued.
- Publishers (payload builders are pure utils): Finance `invoice.issued`
  (on issue) and `receipt.recorded` (with the invoice after the payment) —
  `finance/utils/finance-events.ts`; After-sales `service_ticket.updated` on
  every change (`created / assigned / started / resolved / reopened /
  closed`, customer contact via the CRM contract) —
  `aftersales/utils/ticket-event.ts`; Licensing `license.due` from
  `LicensingService.publishDueNotices` (thresholds 30 / 7 days / ended in
  grace, `dueNoticeThreshold` in `utils/license.ts`; dedupe key
  `license.due:<contract>:<end date>:<threshold>`; paid renewals activated
  first).
- Daily job: BullMQ queue `licensing-due` (`licensing/queues/`), scheduler
  `license-due-notices`, cron `SCHEDULER_LICENSE_DUE_CRON` (default
  `0 8 * * *`, tz Asia/Jakarta), only with `SCHEDULER_ENABLED=true`;
  schedule registration failure is logged, not fatal.
- Event contract for whoever builds the n8n flows:
  `docs/architecture/modules/notification.md` (rewritten; the old NestJS
  text was stale).
- Verification: `NODE_ENV=test bun test` (apps/backend) → 697 pass (new:
  outbox dedupe, `license.due` thresholds + once-per-threshold, event
  assertions in invoice and ticket tests); `bun run typecheck` /
  `bun run lint` clean. E2E (dev DB, fake receiver checking the HMAC,
  temporary `.env` entries with `SCHEDULER_ENABLED=true` and a per-minute
  cron, all removed afterwards; the temporary job scheduler removed from
  Redis): customer → quotation → approval → sales order → invoice issued →
  receipt → ticket → license contract ending in 10 days; the receiver got
  `invoice.issued`, `receipt.recorded` (status `partially_paid`),
  `service_ticket.updated` (`created`) and one `license.due` (threshold
  30) across several scheduler runs, all signed and `published`. E2E data
  (customer `E2E-4C` and its documents) stays in the dev database.

### 4d — WhatsApp assistant (implemented 2026-11-07)

Gate 1: `docs.dbml` MODULE Automation (no conversation/FAQ tables existed;
`notifications` / `notification_templates` stay target-only because n8n
sends the messages), `module-ownership.md` §21 (automation owns
notifications/integrations; queues stay in the Redis worker), M04 plan
stage 2 + controls (AI cannot discount or transact, enforced by what it can
call; inbound webhooks verified; secrets in server config). Skipped
`implementation-phases.md` (no dependency on an unlanded step).

Gate 2 (manual fallback; `grilling` is not installed) — answers:
- Ownership: `automation` schema (this module), tables `faq_entries`,
  `whatsapp_conversations`, `whatsapp_messages`; catalog data through the
  catalog contract (`CatalogService.matchProducts`), never its tables.
- Tenant: company-wide (ADR-0012), no `organization_id`.
- Soft delete: `deleted_at` on all three; FAQ removal is a soft delete;
  chats and messages are a log, never deleted by feature code.
- Types: unix-ms timestamps; no money or quantity columns.
- Logical references: only `auth.users.id` (`created_by`, `updated_by`,
  `assigned_user_id`, `sent_by_user_id`) with the standard note. No link to
  a CRM customer or lead yet (deferred: an admin creates the lead).
- Vocabularies: conversation `assistant | handoff | closed`; handoff reason
  `no_provider | not_found | human_requested | restricted | error`;
  message direction `inbound | outbound`, author `customer | assistant |
  admin | system`, status `received | processed | pending | sent | failed`.
- Dedupe: unique `(direction, external_id)`; one conversation per
  `chat_id` (unique), a closed chat reopens with the assistant.
- Deferred: per-chat rate limit, media handling (media = handoff), CRM
  lead/customer linking, OTP delivery.

Built:
- `docs.dbml` (3 tables + 2 intra-module refs) → gen-logical-references +
  validate-dbml OK; Drizzle in `automation.schema.ts`; migration
  `20261107095923_whatsapp_assistant` (generated, inspected, applied).
- `src/app/automation`: `WhatsappService` (receive, send, handoff, inbox),
  `AssistantService` (guards → AI → re-check), `FaqService`;
  `adapters/waha.ts` (sendText), `adapters/openai-compatible.ts` (optional
  model, text only); `utils/assistant.ts` (HMAC-SHA512 check, WAHA parsing,
  restricted / human patterns, FAQ ranking, holding replies); queue
  `whatsapp-inbound` + worker; controllers `/integrations/whatsapp/webhook`
  (public, signed), `/automation/whatsapp/*`, `/automation/faq`; outbox
  topic `whatsapp.handoff`. Config `WAHA_URL`, `WAHA_API_KEY`,
  `WAHA_SESSION`, `WAHA_WEBHOOK_SECRET`, `AI_BASE_URL`, `AI_API_KEY`,
  `AI_MODEL` (names in `.env.example`).
- Permissions: statement `whatsapp: read | reply | manage_faq`; admin all,
  sales manager + customer service read/reply, marketing read/FAQ;
  `packages/common` rebuilt; `bun scripts/refresh-role-grants.ts` → 5 roles.
- Web: `/integrations/whatsapp-ai` (status alerts, tabs with counts,
  search), `/$conversationId` (log, admin reply, resend, hand back, close),
  `/faq` (CRUD); locale keys en/id; the dead "Notifications" nav item
  (no page existed; notifications are n8n events) removed with its key.
- User guide 8.7 (en/id; 8.6 is HR on its branch); module doc
  `notification.md` updated.
- Verification: backend 709 pass (`whatsapp-assistant.test.ts` 12),
  `bun run typecheck` / `bun run lint` clean (no new warnings), web build
  OK, locales 70 pass. E2E with temporary `.env` entries (removed), a fake
  WAHA and a fake OpenAI-compatible model: FAQ created by marketing
  (customer service gets 403); FAQ question → assistant reply sent through
  WAHA with the FAQ in the model's context; the same webhook twice → one
  reply; bad signature → 401; discount request → refusal + handoff
  `restricted`, model not called; off-FAQ question → handoff `not_found`;
  admin reply sent and the chat assigned; two `whatsapp.handoff` outbox
  events; sales → 403 on the inbox; screenshots of list, chat and FAQ
  pages checked. E2E chats and FAQ entries stay in the dev database.
- Not verified: a real WAHA instance, a real AI provider, n8n flows.

`docs/database/` updated (3 tables, Automation header); the
`whatsapp.handoff` topic needs no schema change.
> on branch `refactor/company-document-numbering`. The code for them lives on
> that branch; this documentation set was written there first and then copied
> to the `erp` repository, so a reader on an older branch sees the docs before
> the code. Nothing here claims a commit that does not exist on that branch.

## 2026-11-15 - ERP-0054 `docs.dbml` vs Drizzle parity (branch `docs/dbml-schema-parity`)

Question that started it: does `apps/backend/drizzle/schemas/` match
`docs/database/docs.dbml`? Table-name sets already agreed in one direction -
`docs.dbml` 272 tables, Drizzle and the migrations both 122, and no migration
table was missing from the contract. The gap was column-level: 11 shipped
tables disagreed, plus two target tables that contradicted shipped code.

**Fixed in `docs.dbml` (canonical; migrations are append-only, so the shipped
shape wins and carries a `DEVIATION (shipped)` note):**

- `auth.users`: added `claimed_at`, `phone`.
- `auth.user_invitations`: removed `role_id` (code uses only `org_role`).
- `assets.assets`, `inventory.warehouses`: added `image_url`.
- `finance.payment_allocations`: `amount` (was `allocated_amount`), no
  `currency_code` / `allocated_at` / `deleted_at`; check is `amount > 0`.
- `finance.ap_open_items` / `finance.ar_open_items` / `sales.payments`: removed
  the invented `deleted_at` (all three are shipped without it).
- `validate-dbml.ts` timestamp-exempt set grew three entries for the above:
  `finance.payment_allocations` (cascade-deleted with its payment, never
  soft-deleted on its own) and the two open-item sub-ledgers (running balances
  cleared by `status`, projections by nature).
- `hr.employees`: `hire_date` / `termination_date` `date` -> `bigint`; widened
  `national_id varchar(32)`, `email varchar(320)`, `phone` / `whatsapp
  varchar(100)`; vocabulary checks now `active|inactive|terminated` and
  `permanent|contract|probation|internship|outsourced` to match
  `hr.schema.ts`. The four planned `department_id` / `position_id` /
  `branch_id` / `cost_center_id` columns stay - they are target columns, not
  shipped ones, and the parity check is one-way.
- `auth.roles` + `auth.user_role_assignments` removed, and the `auth.members`
  role note rewritten: ERP-0041 made organization roles a closed
  `erpRoleNames` enum read from `@ims-erp/common`, so there is no dynamic role
  table to consult (`static-permissions.ts`, `role.schema.ts` header). The same
  stale claim was corrected in `data-model.md`, `module-ownership.md`,
  `integrity-and-consistency.md`, `security-and-access.md` (the whole "dynamic
  per-organization roles" and "rank guard" sections described files that no
  longer exist), `modules/organization.md`, `m12-reports-access.md`, and a
  superseded note added to `plans/assets-equipment-location-and-borrowing.md`
  (D15/B3 built on `auth.roles.permissions`).

**`validate-dbml.ts` gained section 5 - Drizzle parity (one-way).** Every
`.table('name', {...})` block and every
`camelCase: sqlType('snake_case', ...)` column in
`apps/backend/drizzle/schemas/*.schema.ts` must exist in `docs.dbml`; a
shipped table or column the contract does not mention is the bug. The reverse
is not checked, because `docs.dbml` describes the target (150 unbuilt tables).
The check resolves a file that reuses an imported `pgSchema` instead of
declaring its own (`role.schema.ts` -> `auth`). Exit condition is now
`if (dups || cross || gaps.length || drift.length) process.exit(1)`.

**Stale counts corrected.** `AGENTS.md` "253 tables / 24 modules" ->
"270 tables / 27 modules"; `implementation-phases.md` target 268 -> 270 tables
and exit criteria 268/231 -> 270/233; `integrity-and-consistency.md`
268/231 -> 270/233.

**Commands and outcomes (all on this branch):**

- `bun docs/database/gen-logical-references.ts` -> `regenerated: 525 refs
  across 41 targets, 233 intra-module refs`.
- `bun docs/database/validate-dbml.ts` -> `parsed: 270 tables, 233 refs` /
  `cross-module refs: 0` / `timestamp gaps: 0` / `drizzle parity drift: 0` /
  `OK`. Before the fixes it reported 11 drifting tables plus a
  `role.schema.ts: no pgSchema() declaration` false positive.
- Gate probed, not assumed: adding `probeCol: text('probe_col')` to
  `audit.audit_logs` produced `drizzle parity drift: 1` +
  `audit.audit_logs.probe_col (audit.schema.ts): column missing from docs.dbml`
  and exit 1; removing it returned `OK`. `bunx oxlint docs/database/` clean for
  `validate-dbml.ts` (three pre-existing warnings in
  `gen-logical-references.ts` are untouched).

No migration, Drizzle schema, seeder or test file changed: the database is
untouched, only the contract and its validator moved. `docs/database/` was
updated (required: column sets and two table removals changed).

## 2026-11-15 - merge `main` into `feat/m08-hr-on-main` (PR #83), M08 rebased on the squashed migration baseline

Worktree `B:\ims\erp-m08-merge`, branch `feat/m08-hr-on-main`, merge of
`origin/main` @ `2b28fc46` (no rebase, no force-push; PR #83 stays open).
Base-main wins where the two disagree, except the deliberate deviations listed
below.

**Conflicts resolved (7).**

- `apps/backend/database/seeders/index.ts` — union: `seedHrEmployees` →
  `seedLeaveTypes` → `seedNotificationTemplates` → `seedNotificationDemo`.
- `apps/backend/src/app/app.ts` — both `documentModule` and `hrModule` mounted.
- `apps/backend/src/app/hr/services/employee.service.ts` — took main's shape
  (`toRow`/`withPersonal` mappers, `EmployeeInviteService`,
  `CodeNumberService`, `IUserPersonalFieldsPort`) and re-applied the M08 NIK
  masking on top: `canReadPrivate` on the context, `maskTail` on read/list/
  update responses, and the `nationalId` write gate on update.
- `apps/web-admin/src/components/sidebar/nav-config.ts` — `overtime` gated by
  `overtime.read`, `payroll` by `payroll.read`, M08 `hrTasks` by `task.read`.
- `docs/database/logical-references.md` — took main's file and regenerated.
- `docs/plan/backlog.md`, `docs/plan/progress.md` — main entries first, the
  M08 2026-11-12 entries kept after the header.

**Migrations.** Both orphan M08 folders (`20261112000000_erp0034_hr_employees`,
`20261112100000_m08_hr_records`) were deleted; `bun run drizzle:generate` on the
squashed 19-folder baseline produced `20261114173050_lush_darkstar`
(`migration.sql` + `snapshot.json`, `prevIds` = `f3e62ffa…` sales snapshot).
The SQL was read: 7 tables (`attendance_records`, `bank_accounts`,
`employee_tasks`, `leave_requests`, `leave_types`, `overtime_requests`,
`salary_summaries`) with their checks, partial unique indexes, and
`ON DELETE RESTRICT` FKs. `bunx --bun drizzle-kit check` → `Everything's fine`.

**Semantics.** `GLOBAL_ADMIN_ROLE` string compares became `hasAppRole(...)`
(`hr/controllers/hr-context.ts`, comma-joined `user.role`, ADR-0018) and
`parseRoleList` from `@ims-erp/common`. `docs.dbml` gained the missing
`Ref: hr.employees.manager_employee_id > hr.employees.id [delete: set null]`.
Both employee pickers are kept (`/hr/employees/picker` from main and
`/hr/active-employees` from M08).

**Deliberate deviation.** M08's `restrict` FK deletes were kept over main's
`cascade` for `attendance_records`, `leave_requests` and `bank_accounts` —
records must not disappear with an employee.

**Renumbering.** M08's backlog row is `ERP-0053` (main assigned `ERP-0040` to
the organization info dashboard); `progress.md`/`data-model.md`/`features.md`
M08 references are `ERP-0059` to avoid main's reserved `ERP-0053`…`ERP-0058`.

**Gates (executed here).**

- `bun run typecheck` → 4/4 tasks successful.
- `bun run lint` → 5/5 tasks successful (warnings only; none new in `hr/`).
- `bun run test` → backend 1021 pass, web-admin 100 pass, locales 90 pass,
  react-email 5 pass, 0 fail.
- `bun docs/database/gen-logical-references.ts` → `526 refs across 41 targets,
  236 intra-module refs`.
- `bun docs/database/validate-dbml.ts` → `parsed: 272 tables, 236 refs`,
  `cross-module refs: 0`, `timestamp gaps: 0`, `OK`.

**Database gates — run later the same day on a local PostgreSQL 5432 / Redis
6379 (native services, Docker not involved).** Disposable database
`ims_erp_m08_browser` (dropped afterwards):

- `POSTGRES_URL=…/ims_erp_m08_browser bun run drizzle:migrate` → `migrations
  applied successfully` from an empty database: all 20 folders including
  `20261114173050_lush_darkstar` replayed in order.
- `bun run drizzle:seed` twice → first run created 29 employees, 4 leave types,
  4 notification templates, 3 demo notifications; second run reported
  `created 0` / `inserted 0` for every seeder. Idempotent.
- `drizzle-kit push --explain` still **not** run (not needed for this merge;
  the chain is linear and `drizzle-kit check` is clean).

**Browser pass (Edge via `browse`, backend `:3001`, web-admin `:5173`,
2026-11-15).**

- Sign-in `admin@local.com` → shell renders; `/hr/employees` lists 29 seeded
  employees, `/hr/attendance` renders the day grid, `/hr/leave`,
  `/hr/overtime`, `/hr/tasks`, `/hr/payroll` render their empty states.
- Write path exercised through the UI: set the first attendance row to
  `present` and clicked **Save day** → toast `saved, 0 leave day(s) kept`, and
  `hr.attendance_records` holds one row (`status=present`, `source=manual`,
  `recorded_by` = the signed-in user).
- NIK masking, both directions: with `national_id` set to
  `3201234567890123` on `EMP-00011`, the org `owner` account
  (`admin@local.com`) reads `3201234567890123` from list and detail, while the
  org `admin` account (`admin.seed@entragate.local`, no
  `employee:read_private`) reads `••••••••••••0123` from both.
- Sidebar gating as org `admin`: Overtime, Payroll and Tasks are hidden
  (`overtime.read` / `payroll.read` / `task.read` absent), Leave hidden, and
  the **New employee** / **Archive** controls are gone; Attendance stays.
  Direct `/hr/payroll` returns **403 `Insufficient permissions`** from the
  backend — the server-side fact holds.
- Kept as observed, pre-existing from `main`: the route guard still renders
  `/hr/payroll` for that account instead of redirecting (ERP-0053 follow-up,
  `canOpenPath` fails open), and the realtime bell briefly shows
  `Live updates unavailable` on first mount in dev (React double-mount closes
  the socket before it opens; a raw `ws://localhost:3001/ws` handshake
  succeeds and stays open). Neither is caused by this merge.

**`docs/database/`:** reviewed and changed (the `manager_employee_id` `Ref`
above); `validate-dbml.ts` printed `OK`. `project-audit.md` re-checked: the
snapshot-chain and `docs.dbml` `hr.employees` rows are resolved and dropped,
the `hr.employees` status-vocabulary drift (`on_leave`/`suspended`/`freelance`/
`intern` in DBML vs `inactive`/`probation`/`internship`/`outsourced` in Drizzle)
is recorded as still open and not fixed here.

## 2026-11-12 - tooling: local skills copied into `.claude/skills/`

11 local skills from `.agents/skills/` copied into `.claude/skills/` (the
broken `tsyringe` symlink placeholder was replaced with a real copy), and
each was checked against its source with `diff -rq`. Details are in
`.agents/docs/skills.md`. Only tooling changed: no app code changed and
there is no backlog item to move. `docs/database/` was not touched.

## 2026-11-12 - M08 compliance pass against AGENTS.md (ERP-0059) and main-wide doc fixes

Owner asked to check M08 (PR #83) against `AGENTS.md` and `README.md` and fix
the gaps.

- **Skills read:** `elysia-module`, `elysia-layered-architecture`,
  `elysia-tsyringe`, `tsyringe`. `hrModule()` factory, module-internal access
  only (`HrPeopleService` over ERP-0034 employees), one `:id` per position
  (`/hr/employees/:id` and `/:id/bank-account`), `container.resolve` only
  inside `plugin()`: conform.
- **Gate 1 completed:** `integrity-and-consistency.md`, `data-dictionary.md`
  and `logical-references.md` now read in addition to `docs.dbml`, ADR-0012
  and ADR-0014; `implementation-phases.md` skipped (no dependency on an
  unlanded step). Checked: leave/overtime decisions and the salary approval
  are conditional updates; separation of duties (recorder cannot decide);
  money `CHECK`s and the net-pay identity; partial unique indexes on
  `deleted_at IS NULL`; actor columns `recorded_by` / `decided_by` /
  `approved_by` / `created_by`; cross-module references nullable (fixed in
  the entry below). No further change needed.
- **Phase 3 (ERP-0008 employees):** model + permissions + tests + idempotent
  seeder + permission-scoped bank reads: met. Output "`data-model.md`
  updates": the `hr` schema is now listed.
- **Main-wide docs (DoD 2):** the pre-existing issues found on main are in
  `project-audit.md` ("Pre-existing issues on main found 2026-11-12",
  including `DRIZZLE_TOKEN` in `sales/services/invoice.service.ts`);
  `runbook.md`, the `AGENTS.md` command-status table, `README.md` step 4
  and `data-model.md` migration policy now say that drizzle-kit
  generate/migrate are blocked on main and how migrations are verified
  meanwhile.
- `bun run lint` → 0 errors (warnings unchanged from main: backend 6,
  web-admin 11, ui 19; none in HR files). `graphify update .` not run:
  graphify is not installed on this machine.

No code change in this entry; `docs/database/` unchanged; no backlog status
move.

## 2026-11-12 - ERP-0059 fix: recorded_by nullable (ADR-0014)

`hr.leave_requests.recorded_by` and `hr.overtime_requests.recorded_by`
reference `auth.users`, so per ADR-0014 they are nullable (the services
always set them). Changed in `docs.dbml` (gen-logical-references → 535
refs, validate-dbml OK), the Drizzle schema and the unmerged hand-written
migration `20261112100000_m08_hr_records` (not applied to any shared
database). Disposable `ims_erp_m08` rebuilt with `migrate-reset`: migrations
and seed complete; `drizzle-kit push --explain` shows no `hr` difference.
`bunx tsc --noEmit` clean; `hr-records.service.test.ts` 16 pass.

## 2026-11-12 - ERP-0059: M08 stage 1 rebuilt on ERP-0034 employees

Status: **implemented** on branch `feat/m08-hr-on-main` (from `origin/main`
89940c0), not yet accepted by the owner. Replaces PR #64
(`feat/m08-employees-attendance`), whose own `hr.employees` collided with
ERP-0034. Owner decision 2026-11-12: keep ERP-0034's employees and stack the
M08 records on them (option 1).

Gate 1: `docs.dbml` MODULE HR (unchanged on main since the base; employees
table as ERP-0034 left it), ADR-0012 (multi-organization: only transaction
documents whose plan says so carry `organization_id`), ADR-0014 (nullable
cross-module references), `module-ownership.md` (hr owns `hr`). Gate 2
answers (manual fallback):
- Ownership: `hr` schema; employees stay ERP-0034's; M08 adds
  `bank_accounts`, `attendance_records`, `leave_types`, `leave_requests`,
  `overtime_requests`, `employee_tasks`, `salary_summaries` (intra-schema
  FKs to `employees`).
- Tenant: no `organization_id` on the M08 tables; a record is scoped through
  its employee with ERP-0034's rule (company-level + active organization; an
  application admin sees all) — lists, reads, decisions, imports and salary
  approval included.
- Soft delete on all; money bigint minor units; business dates `date`;
  status vocabularies unchanged from the M08 design (2026-11-07).
- Base salary: ERP-0034 employees carry none and the DBML's
  `employment_contracts` / `employee_salary_components` are not built, so
  "Fill from last month" copies last month's base and allowances (0 for the
  first month). Position field dropped (DBML has `position_id` → not built).
- Employee codes are unique per organization in ERP-0034, so an import code
  that matches two visible employees is reported (`employeeAmbiguous`).

Built:
- `docs.dbml` HR section: the seven M08 tables (from the M08 branch) with
  ERP-0034's `employees` kept as is; `bun docs/database/gen-logical-references.ts`
  → 535 refs; `bun docs/database/validate-dbml.ts` → OK.
- Migration `20261112100000_m08_hr_records`, **hand-written**: `drizzle-kit
  generate` and `migrate` refuse to run on main (pre-existing two-branch
  snapshot conflict, see findings). The SQL is the drizzle-kit output of the
  M08 schema minus the schema and employees statements. Applied to a fresh
  disposable database `ims_erp_m08` with `bun run database/migrate-reset.ts`
  (drizzle-orm migrator, all migrations); `drizzle-kit push --explain`
  against it shows **no difference for any `hr` table**.
- Backend `src/app/hr`: `HrPeopleService` / `HrPeopleRepository` (scope,
  bank account), attendance / leave+overtime / task / salary services,
  repositories and controllers ported with the scope; `hrModule()` mounts
  them **and ERP-0034's `EmployeeController`, which main never mounted**
  (`/hr/employees` answered 404). ERP-0034 reads mask the NIK without
  `employee:read_private` and an update never writes a masked NIK back.
- Permissions: `employee:read_private`, `attendance:record`, statement
  `overtime`; HR gets them plus `task`; admin `attendance:read, record`;
  finance `employee:read, read_private`, `payroll:read, create, update,
  export` (decision 2026-11-07); `permission-matrix.test.ts` finance case
  updated. `packages/common` rebuilt.
- Seeder `hr-leave-types.seeder.ts` (every environment): run twice on
  `ims_erp_m08` → inserted 4, then 0.
- Web: pages attendance / leave / overtime / payroll / tasks (stubs on main
  replaced), `lib/hr-records-api.ts`, bank account + leave balance cards on
  the ERP-0034 employee page, Tasks in the sidebar, HR crumbs; `hr` locale
  keys merged (en/id), dead-key prefixes and parity allowances.
- Docs: `docs/architecture/modules/employee.md` rewritten; user guide 8.6
  (en/id).

Verification: `NODE_ENV=test bun test` (apps/backend) → 824 pass
(`hr-records.service.test.ts` 16); `bunx tsc --noEmit` clean; web `bun run
build` OK; locales 82 pass. E2E against `ims_erp_m08` (dev `.env`
`POSTGRES_DB` switched temporarily, restored afterwards): `/hr/employees`
200; NIK and bank account masked for admin, clear for HR; day sheet saved;
leave 5 days, self-approval 403, another HR approves, 5 leave days in the
month recap; overtime 2.50 h approved; task created; finance saves a salary
row; generate → 29 rows; finance approve 403, owner approves; edit after
lock 409; finance reads attendance 403. Screenshots of attendance, payroll
and the employee page checked.

Findings on main (pre-existing, not changed here):
- `drizzle-kit generate` / `migrate` blocked: two snapshot branches from
  `20261106103434_add_asset_image_url`, two snapshots with id `d536237d…`,
  and hand-written migrations without snapshots. Only the drizzle-orm
  migrator (`migrate-reset`) applies migrations. Needs one agreed repair.
- `drizzle-kit push --explain` on a fresh database still wants to create
  `auth.organization_role` and drop two `sales.receipts` FKs: the schema and
  the migrations disagree there.
- `@ims-erp/react-email` dev preview also takes port 3000; whichever starts
  first wins `localhost`, so the web app can talk to the preview instead of
  the backend.
- `docker-compose.yml` publishes no Postgres/Redis ports for local dev; the
  runbook's `up postgres redis` needs a local override (used one outside
  the repo).
- `docs.dbml` `hr.employees` still shows the target design (NOT NULL
  `organization_id`, `date` columns) rather than ERP-0034 as built.

The developer database `ims_erp_sync` holds the old M08 branch schema; this
branch runs on a fresh database (`migrate-reset`).

PR #83 (`feat/m08-hr-on-main` → `main`) opened 2026-11-12; PR #64 closed as
superseded. Next executable task: review of #83 (programmer A), then
rebuild M04 (PR #65) on main the same way (invoice/receipt events now on the
sales module).

## 2026-11-14 - ERP-0051: delivery follow-ups recorded as a separate plan

Branch `refactor/app-roles-investor-customer`. Reviewing the PR #101 delivery left six items
that are not missing features, so they are recorded in
`docs/plan/plans/erp-0051-follow-ups.md` instead of reopening `side-nav-role-based.md`:

- **ERP-0053** - `canOpenPath` fails open for a path no nav leaf covers
  (`route-guard.ts:45`). `/inventory/items/$itemId` and `$itemId.edit` are real pages with no
  gate; the only leaf under `/inventory/items` is `/inventory/items/new` with `product.create`,
  which does not prefix-match either. The only behaviour bug in the set.
- **ERP-0054** - ADR-0018 still reads `proposed` while its code is shipped and `features.md`
  says `verified`.
- **ERP-0055** - plan decision 6 ("Administration section: app admins only") contradicts the
  shipped tree, where `/organizations` carries `permission: 'organization.read'`. The shipped
  behaviour matches the backend (`GET /organizations` is session-only, `GET /organizations/:id`
  needs `organization:read`), so decision 6 is the stale text.
- **ERP-0056** - `docs/database/module-ownership.md:402-408` says the database has three
  schemas; it has nineteen, and there is no `investor` schema at all.
- **ERP-0057** - `progress.md` quotes a per-build seeded organization id
  (`LwhLYWKg7I9qkzTSHXPqQColX3To0u5r`) that no longer exists; the current dev database holds
  `h7fUe07E5C4vzig3hE6yXzh73sM87EHs`.
- **ERP-0058** - `scopedUnique()` does not model the `deleted_at IS NULL` predicate on the two
  `items` code indexes; already recorded as known in ADR-0019.

`features.md` and the `side-nav-role-based.md` header now point at the new file, so ERP-0051
stays closed. `backlog.md` has no ERP-0053…ERP-0058 rows yet; the file states that and asks the
next worker to add them when work starts rather than duplicating the ledger.

`docs/database/` reviewed: no table, column, index, constraint, logical reference or status
vocabulary changed. The stale sentence in `module-ownership.md` is prose, tracked as ERP-0056,
not a schema change.

## 2026-11-14 - ERP-0051: CI caught a unit suite that needed a live database

Branch `refactor/app-roles-investor-customer`, PR #101. The first CI run on this branch failed
`Unit Test Backend`: **559 pass, 7 fail**, all seven in `test/unit/notification.controller.test.ts`.

**Cause, and why it hid locally.** ADR-0018 put the login gate inside `sessionGuard`
(`isWebAdminSessionAllowed`), and that gate reads `auth.users` + `auth.members` through
`drizzleDB`. The notification route suite mounts the real `sessionGuard` and stubs only
`@providers/better-auth/auth`, so the gate reached for a real connection. On this machine a
Postgres server answers, the query succeeds and the suite passes; on CI there is no database, the
driver raises `PostgresError: Failed to connect`, and because that is not an `APIError` the gate
rethrows it - a 500 where the test expects a 200 envelope. The suite had been green locally for
the whole branch, which is exactly why 14 unpushed commits were a risk.

**Fix.** `test/unit/notification.controller.test.ts` now also stubs
`@providers/better-auth/options/session.auth`, the same four exports and the same shape that
`test/authorization/test-app.ts` has used since the gate landed. The gate's own rule stays covered
by `test/unit/login-gate.test.ts` (pure predicate) and `test/authorization/login-gate.guard.test.ts`.

**Verified with the database made unreachable**, so the result cannot be a local-DB artefact:

```
cd apps/backend
POSTGRES_HOST=127.0.0.1 POSTGRES_PORT=1 bun test ./test/unit   # 566 pass, 0 fail
bun test                                                       # 1005 pass, 0 fail
bunx tsc --noEmit                                              # exit 0
```

**Also removed** the now-unused `erpRoleNames` import in
`src/providers/better-auth/ac/organization-ac.ts` - residue from ADR-0018, which took `investor`
and `customer` out of that catalog.

`docs/database/` reviewed: no table, column, index, constraint, logical reference or status
vocabulary changed, so it is unchanged.

## 2026-11-14 - Removed the two stale one-shot database scripts

Branch `refactor/app-roles-investor-customer`. `apps/backend/database/` held three TypeScript
files beside `migrations/` and `seeders/`; only one of them belonged there. Two were removed.

**Kept: `migrate-reset.ts`.** Wired to `package.json` as `drizzle:migrate-reset`, it owns the
`schema drop + migrate + seed` cycle over the sibling `migrations/` folder and is the sanctioned
rebuild path recorded in ADR-0019. It stays where it is.

**Removed: `cleanup-tool-items.ts`** (ERP-0036, written 2026-11-06). A one-shot data script that
hard-deleted `tool`/`service` items, their serialized units and ledger rows, behind a `--apply`
flag. It did its job once - the dry run reported `items: 8, byKind {tool: 4, service: 4}, units:
12` and the apply succeeded - and is now a permanent no-op: `ITEM_KINDS` is
`product|component|material`, so the query can never match again. Destructive data movement
belongs in a migration, not in a script that outlives its purpose.

**Removed: `verify-inventory-constraints.ts`** (plan `inventory-and-assets-hardening.md` Phase I-5,
written in `a9b28213`, extended in `e6677d16`, `52fee532`, `60d058d6` and `b0929a92`). A manual
verifier
that dropped six hardcoded schemas, replayed `database/migrations/` and asserted the CHECK
constraints against real PostgreSQL 18. It was outside `bun run test` (the backend suite never
opens a connection - every test runs against `test/helpers/mock-db.ts`) and outside the four
`typecheck` workspaces, so nothing ever caught it rotting. Re-run before deletion against a fresh
database it reported **14 failures**:

- `column "code" of relation "items" violates not-null constraint` (ERP-0043 added
  `inventory.items.code NOT NULL`, the verifier still inserted without it) - 2 checks;
- `relation "organization.document_sequences" does not exist` (relocated to
  `code_number.document_sequences` by ADR-0015/ERP-0042) - 4 checks;
- 4 checks that *passed when they should have been rejected* (`unknown status`,
  `provisional serial outside pre_order`, `zero quantity`, `borrowing_out without borrowing
  reference`) - the worst mode, because it reported safety that was not there;
- `TypeError: undefined is not an object` in 2 balance checks, and the D17 concurrency smoke
  reporting `expected exactly 3 winners, got 0`;
- a second run could not even start: `schema "accounting" already exists`.

**Docs updated** so nothing points at the deleted files: `docs/architecture/modules/inventory.md`
(both the evidence list and the Tests list),
`docs/plan/plans/assets-equipment-location-and-borrowing.md` (Slice 2 step 1 + the Slice 2
wrap-up), `docs/plan/plans/inventory-and-assets-hardening.md` (rows I-5 and D-5, and the Phase I-5
section), and the two 2026-11-06 claims in this file, which now carry a supersede note.

**Honest gap this opens:** no test or script currently asserts that the inventory/asset CHECK
constraints reject bad rows against a live server - the backend suite mocks the database entirely.
That proof existed until this change and has no successor. Recorded in
`docs/architecture/modules/inventory.md`; the cheapest replacement is a small live-DB smoke under
`apps/backend/scripts/` (the maintained convention - `smoke-warehouse-pic.ts` and nine siblings),
run on demand against a disposable database rather than from `bun run test`.

**Gates after the deletion:** `bun run typecheck` 4/4, `bun run lint` 5/5 (0 errors), `bun run test`
5/5 - backend 1005 pass / 0 fail, web-admin 100, locales 90, react-email 5.

## 2026-11-14 - ERP-0052: migration history squashed to one migration per schema

Branch `refactor/app-roles-investor-customer`. Closes ERP-0052: `drizzle-kit check` and
`drizzle-kit generate` now both work against the repo's own config, for the first time since the
ERP-0011 merge. Decision recorded as **ADR-0019**.

**Root causes** (all four had to be fixed; the reported error was only the first symptom):
1. Eleven migrations carried no `snapshot.json` - every hand-written one from `20261113150000`
   onward. `generate` diffs against the *last* snapshot, so those changes were invisible.
2. `20261106170000_drop_merge_side_finance_receipts` runs `DROP SCHEMA "finance" CASCADE` but has
   no snapshot, so the deletion was never recorded. `20261106221731` therefore looked like a second
   creation of `finance.receipts` - the "Two migrations gave one name to two different entities"
   error. `20261109090000_sales_owns_invoice_receipt` was just the next conflict in line.
3. On this drizzle-kit version (`1.0.0-rc.5`) `generate` writes a **base** snapshot, not a `diff`,
   whenever the out folder has no snapshot yet. My first build script moved each generated folder
   out of `--out` immediately, so every step saw an empty folder and produced a cumulative base -
   visible as 19 base snapshots instead of 1 base + 18 diffs. Fixed by leaving the folders in
   `--out` and copying at the end; the script now asserts `base` first and `prevIds` chaining.
4. After removing only the immediate conflict, `generate` asked for **40** interactive
   rename/create hints, so repairing the graph was not viable.

**What replaced it:** 19 migrations, one per Postgres schema, in dependency order - `auth` (with
`role`), `accounting`, `aftersales`, `assets`, `audit`, `code_number`, `company`, `crm`, `document`,
`finance`, `hr`, `inventory`, `licensing`, `location`, `notification`, `organization`,
`procurement`, `projects`, `sales`. The first is a `base` snapshot generated from
`drizzle/schemas`; the next 18 are `diff` snapshots chained by `prevIds`. Each folder adds exactly
one schema, so provenance survives the squash. Table adds per folder: 10, 11, 2, 14, 1, 1, 5, 5, 8,
10, 1, 12, 6, 4, 2, 1, 5, 5, 12 = **115**.

**Hand-written tails kept** (drizzle cannot express them; documented inline in the SQL):
`create_inventory_schema` carries `NULLS NOT DISTINCT` on both `stock_balances` scope indexes (the
bug `20261105185010` fixed - `inventory.schema.ts` explains why the builder cannot express it) and
the `deleted_at IS NULL` predicate on the two `items` code indexes (SQL `IF NOT EXISTS` made
`20261113130000` a no-op, so the live DB keeps the stricter definition).
`create_sales_schema` carries the intra-module `sales.receipts` -> `sales.invoices` FK.

**One foreign key deliberately dropped:** `receipts_payment_id_payments_id_fkey`
(`sales.receipts` -> `finance.payments`). It violates `elysia-module` rule 3.2 / ADR-0014, it was
created only by hand-written SQL (`sales.schema.ts` models `paymentId` as a plain id), and no code
depends on it (the only `paymentId` outside the schema file is a TypeScript type in
`web-admin/src/lib/finance-api.ts`). The database now has **zero** cross-schema foreign keys -
verified by `pg_constraint` where child namespace <> parent namespace: 0 rows.

**Evidence** (`ims_erp_local`, backup taken first at
`%TEMP%\opencode\ims_erp_local_backup_20261114_210952.sql`):
- `bun run drizzle:migrate-reset` -> 19 journal rows, 116 tables, 2 live PIC grants, 40 `auth.users`,
  seeds complete in 9.9s.
- `bunx --bun drizzle-kit check` (repo config) -> `Everything's fine`; `bunx --bun drizzle-kit
  generate` -> `No schema changes, nothing to migrate`.
- Positive test in a scratch copy of the chain: adding a probe column produced
  `ALTER TABLE "inventory"."warehouses" ADD COLUMN "probe_column" text;` (a diff, not a base);
  probe reverted, `git diff` on `drizzle/schemas` clean.
- Replay of the new chain on an empty database (`ims_erp_squash_check`): 116 tables, and a
  schema fingerprint (tables, columns, indexes, constraints, enums - 3759 lines) equal to the old
  chain's except for two constraint *names* (the `hr.employees` manager FK and the
  `notification.notifications` template FK now use drizzle's auto-generated names) plus the dropped
  cross-schema FK. Both fingerprints stored under `%TEMP%\opencode\fp-*.txt`.
- `drizzle:migrate` on the already-migrated DB is a no-op (still 19 journal rows, 116 tables).
- `scripts/smoke-warehouse-pic.ts` re-run against the freshly rebuilt DB: **47 passed, 0 failed**.
- Gates: `bun run typecheck` 4/4, `bun run lint` 5/5 (0 errors, pre-existing warnings only),
  `bun run test` 5/5 - backend **1005 pass / 0 fail**, web-admin 100, locales 90, react-email 5;
  `bun run docs/database/validate-dbml.ts` -> `269 tables, 232 refs, cross-module refs: 0,
  timestamp gaps: 0, OK`.

**Upgrade path:** a database migrated by the old 57-folder chain **cannot** be upgraded in place -
the first squashed migration starts with `CREATE SCHEMA`, which fails against an existing database
(verified). Rebuild it with `bun run drizzle:migrate-reset`. Acceptable while no production server
exists (ADR-0019 decision 6).

**Known follow-up, not introduced here:** `inventory.schema.ts`'s `scopedUnique()` helper does not
model the `deleted_at IS NULL` predicate that the `items` code indexes carry in the database, so the
snapshot understates them. It is **not** an active problem: a probe `drizzle:generate` against the
squashed chain emitted only the probe's own `ALTER TABLE`, so `generate` diffs against the snapshot
and will not try to drop those indexes. Worth closing so the two stay in sync if the indexes are
ever edited; recorded in ADR-0019 consequences.

**Superseded:** the `57 journal rows` / `57 migration folders` figures in the entries below describe
the pre-squash tree. They are left as written (append-only); the migration tree they refer to no
longer exists.

## 2026-11-14 - ERP-0051: dev DB reset to a fresh migrate + import/export guard proof

Branch `refactor/app-roles-investor-customer`. The earlier Phase 5 evidence ran on a disposable database
because `ims_erp_local` predated the PIC table and was recorded never-to-migrate. That constraint is gone:
`drizzle:migrate-reset` replays the whole migration chain, so the dev DB was rebuilt from zero and the same
checks were re-run against it.

**Backup first** (the reset drops every application schema):
`pg_dump` → `%TEMP%\opencode\ims_erp_local_backup_20261114_210952.sql`, 11,893,114 bytes. Before the reset
the DB held 21 tables, 40 `auth.users`, 2 `inventory.warehouses`, and no `inventory.warehouse_managers`.

**Reset:**
```
cd apps/backend
bun run drizzle:migrate-reset
```
Outcome: every app schema dropped, migrations replayed, seeders ran - `Migrate-reset complete` after 9.4s
(6.7s of it seeding). After: **116 tables, 57 journal rows**, `inventory.warehouse_managers` present, 2 live
PIC grants (`GLOBAL-MAIN` and `WH-MAIN` → `warehouse.seed@entragate.local`), 40 `auth.users`, organization
`Entragate` = `LwhLYWKg7I9qkzTSHXPqQColX3To0u5r`.

**Full Phase 5 smoke re-run against `ims_erp_local`** (backend on 3001, `SCHEDULER_ENABLED=false`):
`bun run scripts/smoke-warehouse-pic.ts LwhLYWKg7I9qkzTSHXPqQColX3To0u5r` → **47 passed, 0 failed**. The
same cases as the disposable-DB run, now on the real dev database. Cleanup verified afterwards: 0 leftover
`pic-check%` users, 2 warehouses, 2 live grants - the seeded rows were read, not mutated.

**The `import`/`export` question, answered.** Phase 5 recorded those two PIC rights as unexercised. Reading
the guard shows why: `warehouseGuard` copies `options.action` into the returned `warehouse` context and
never branches on it, so authorization is identical for all five values. `warehouse.controller.ts` passes
only `read` (2 routes), `update` (4) and `archive` (2) through its `picRoute(...)` helper - `import` and
`export` appear nowhere outside the `TWarehouseAction` union.

New tests in `test/authorization/warehouse-authorization.test.ts` (`warehouse routes — the guard is
action-agnostic (ADR-0017 §2)`, 6 cases) pin that down instead of leaving it as prose:
- every declared action (all five, `import`/`export` included) is allowed for a PIC of that warehouse, and
  the action survives into the context;
- every declared action gives 404 for a PIC of another warehouse;
- every declared action gives 403 with no live grant, and 401 with no session;
- `import`-style actions still admit an application admin with no grant;
- a source scan asserts the controller declares exactly `archive`, `read`, `update` - so the day an
  import/export route lands, this test fails and sends the reader back to this entry.

Verified the tests can fail: temporarily making the guard reject `export` turned 3 of them red (151 pass /
3 fail); reverted, back to 154 pass / 0 fail with `elysia-auth.ts` byte-identical to HEAD.

**Correction to my own earlier claim.** I told the user the default test suite never touches a real database.
That is true for the suite, but not for this work: the 47-case smoke script *is* a live HTTP check, and it
now runs against `ims_erp_local`. What the *unit* suite covers remains mocked, which is why the guard
matrix above is a unit test and the 47 cases are the live proof.

Gates after the new tests: `bun run typecheck` 4/4 successful; `bun run lint` 5/5, 0 errors; `bun run test`
5/5 - **backend 1005 pass / 0 fail** (999 + 6 new), web-admin 100, locales 90, react-email 5.
`bun run docs/database/validate-dbml.ts` → `269 tables, 232 refs, cross-module refs: 0, timestamp gaps: 0,
OK`. `docs/database/` unchanged (no schema delta).

Cleanup: backend stopped, port 3001 free. `ims_erp_local` is left in its fresh, seeded state.

Next executable task: none for ERP-0051. Open follow-ups, not claimed: ERP-0052 (`drizzle-kit
generate`/`check` still blocked by the duplicate `finance.receipts` migration - note the *replay* path used
here works, only snapshot generation does not) and the actual warehouse import/export endpoints.

## 2026-11-14 - ERP-0051: warehouse PIC Phase 5 (live HTTP smoke + browser pass)

Phase 5 of `plans/side-nav-role-based.md` executed on branch `refactor/app-roles-investor-customer`.
Evidence split by agreement: backend **enforcement** measured by me over real HTTP; **rendering**
measured by me in a real browser (Edge, through the browse tool), not handed off.

Environment: the dev DB `ims_erp_local` has no `inventory.warehouse_managers` table and is recorded
never-to-migrate, and `drizzle:migrate` is still blocked by the ERP-0052 duplicate
`finance.receipts` migration. All Phase 5 evidence therefore comes from a disposable database:

```
# create ims_erp_pic_check, then
POSTGRES_DB=ims_erp_pic_check bun run drizzle:push --force   # 115 tables
POSTGRES_DB=ims_erp_pic_check bun run drizzle:seed           # clean
POSTGRES_DB=ims_erp_pic_check bun run drizzle:seed           # idempotent: created: 0, inserted: 0
POSTGRES_DB=ims_erp_pic_check APP_PORT=3001 SCHEDULER_ENABLED=false bun run src/index.ts
POSTGRES_DB=ims_erp_pic_check bun run scripts/smoke-warehouse-pic.ts <organizationId>
```

**Backend enforcement - `apps/backend/scripts/smoke-warehouse-pic.ts`, 47 pass / 0 fail.** The script
creates its own accounts and grant, removes them at the end, and only reads seeded rows. Sections and
cases: login gate (app admin without membership 200, investor-only 403, customer-only 403,
investor+internal 200); no session (`/warehouses/mine`, `/warehouses/:id` → 401); app admin without
membership (`/mine` 200 listing every live warehouse, any `/:id` 200, `/:id/managers` 200,
`/manager-candidates` 200 with rows); PIC (`/mine` 200 returning exactly the granted warehouse with its
`storages`, own `/:id` 200, another warehouse 404 so existence is not leaked, admin list 403,
`POST /warehouses` 403, assign 403, managers list 403, organization links 403); internal member with no
grant (`/mine` 200 and empty - not 403, `/:id` 403); investor app role with an internal membership
(`/mine` 200 empty, `/organizations/mine` only internal-role organizations); direct admin-route calls
403; assign/unassign round trip (201, duplicate 409, unknown user 404, the new grant immediately widens
`/mine` and `/:id`, unassign 200 then idempotent 200, access refused again as 404); PIC of a warehouse
with **no** `inventory.warehouse_organizations` row (decision 3: 200, appears in `/mine`, PATCH 200,
PUT/GET address 200, `POST /storages` 201, PUT another address 404, archive 200).

Two corrections the run forced, both kept in the script as comments:
- Fixture emails must be lowercase. Better Auth normalizes addresses, so a mixed-case fixture answered
  401 `INVALID_EMAIL_OR_PASSWORD` while the lowercase form works.
- The `GET /items` 403 assertion was dropped: item reads ride the active organization's permissions and
  every web-admin account holds an internal org role, so 200 is legitimate. Hiding the item tabs from a
  PIC is a UX rule, not a route denial.
- The first run renamed and re-addressed seeded warehouses, so the DB was recreated before the recorded
  run and every write case now targets a warehouse the script creates itself.

**Browser pass - 7 scenarios, all confirmed** (`localhost:5173` Vite + backend on 3001, disposable DB,
one fixture account per role, password `fixture123456`):
1. App admin without membership: full sidebar, 2 warehouses, `New warehouse` + `Filters` present, all
   six detail tabs (Products, Components, Materials, Storage, Organizations, Persons in charge).
2. PIC without an organization link: `Warehouses` appears in the sidebar, list shows only
   `PIC-UNLINKED`, **zero** create controls, detail renders only the `Storage` tab, and a direct
   `/inventory/warehouses/new` redirects to `/`.
3. Multi-org user: switcher lists `Entragate` and `Second Co` only; switching applies (header becomes
   `Second Co`); the warehouse nav item disappears there (deny-by-default on the new org's permissions).
4. Investor-only: login rejected, inline message "Web-admin access requires an internal organization
   role", stays on `/login`.
5. Customer-only: same rejection.
6. Investor + internal membership: signs in; no warehouse nav item (no grant).
7. Direct URL without permission: `/inventory/warehouses`, `/inventory/warehouses/:id`,
   `/inventory/warehouses/new`, `/admin/users` each redirect to `/` with the toast "You do not have
   access to that page."
8. Assign/unassign in the UI: picker search `no-grant` resolves the account, `Assign` adds the row with
   a date and shows "Person in charge assigned"; `Unassign` (behind a `window.confirm`) removes the row
   and shows "Person in charge unassigned".

Observations and gaps:
- `Unassign` is guarded by `window.confirm`; an automated browser driver has to accept the dialog. Fine
  for a human, worth knowing for future UI automation.
- The PIC grant carries `import`/`export` actions in `TWarehouseAction`, but no warehouse route uses
  them today (routes use `read`/`update`/`archive` only), so those two rights are unexercised. They land
  automatically when a warehouse import/export route appears.
- Better Auth `trustedOrigins` allows only `appConfig.app.url` + `http://localhost:5173`, so a browser
  pass must run Vite on 5173 with the backend on 3001; a Vite on 5174 answers 403 `Invalid origin`.
- Two pre-existing Base UI `nativeButton` console warnings appear on the warehouse list and detail
  (`<Button render={<Link/>}>` without `nativeButton={false}`). The pattern is repo-wide and predates
  this change (`warehouse-list.tsx` had the same call before `11085e1`); not fixed here.

Cleanup: both servers stopped, `ims_erp_pic_check` dropped. No dev-database migration was attempted.

**Superseded 2026-11-14:** the disposable-database workaround above is no longer needed. `ims_erp_local`
was reset through `drizzle:migrate-reset` and the same 47 cases were re-run against it - see
"2026-11-14 - ERP-0051: dev DB reset to a fresh migrate + import/export guard proof" at the top of this
file.

Next executable task: none for ERP-0051 (plan `side-nav-role-based.md` complete). Open follow-ups, not
claimed: ERP-0052 (`drizzle-kit generate`/`check` blocked by duplicate `finance.receipts` migration) and a
PIC `import`/`export` route when warehouse import/export lands.

Gates re-run at the end of this entry: `bun run typecheck` 4/4 tasks, `bun run lint` 5/5 (warnings
only), `bun run test` 5/5 - backend 999 pass, web-admin 100 pass, locales 90 pass, react-email 5 pass,
0 fail. `docs/database/` reviewed and unchanged (no table, column, index, constraint, or cross-module
link delta in Phase 4.8/5).

## 2026-11-14 - ERP-0051: warehouse PIC Phase 4.8 (PIC UI + manager read surface)

Commit `11085e1` (26 files, +1004/-86).

Web admin:
- `lib/use-warehouse-access.ts` is the single source of `isAppAdmin` / `isPic` / `canAccess` /
  `isPending` (the grant query is skipped for app admins). The sidebar, list, detail page, route guard,
  and the new `components/inventory/warehouse-access-gate.tsx` all read it; the gate replaces
  `AdminOnly` on the warehouse routes.
- Nav: a dedicated `warehousePic` flag on `SidebarItem` plus `isPic` on `NavContext`, because a PIC
  grant is a table row, not a permission string. `leafVisible` order is `appAdminOnly` → `warehousePic`
  → `open` → `internalRole` → `permission`; a parent section hides when no child passes.
- `canOpenPath` resolves the PIC fact from `/warehouses/mine` and short-circuits
  `/inventory/warehouses/new` to app-admin only (a PIC grant has no `create`).
- List split into `AdminWarehouseList` (paginated, filters, create) and `PicWarehouseList`
  (`/warehouses/mine`, no create, client-side search), sharing `useWarehouseLifecycle`.
- Detail page hides the item tabs and the Organizations tab for a PIC and adds a Persons-in-charge tab
  for app admins only.

Backend manager read surface:
- `GET /warehouses/:id/managers` (app admin) returns live assignments decorated with account
  name/email; rows with a NULL `user_id` are skipped.
- `GET /warehouses/manager-candidates?search=&limit=` (app admin) searches every account through
  `UserService.paginateUsers`, which gained a `search` term over name/email/username. `GET /admin/users`
  cannot serve the picker: it needs `member:read` plus an organization context, and a PIC may have no
  membership at all (ADR-0017 decision 3).

i18n: 19 new `warehouses.*` keys in both `en` and `id`.

Tests added/extended: `filter-nav.test` (`warehousePic`), `route-guard.test` (PIC allow, create denied),
`warehouse-manager.service.test` (`listManagers`, `searchCandidates`), warehouse authorization fakes.

## 2026-11-14 - ERP-0051: warehouse PIC Phase 2 (guard, routes, assignment service)

Branch `refactor/app-roles-investor-customer`. ADR-0017 accepted by the owner; Phase 2 authorized
(grilled: auth seam port, 403/404 split accepted, `mine` includes storages, route/idempotency rules
accepted).

What landed:
- `src/authorization/warehouse-pic-resolver.ts` - `IWarehousePicResolver` +
  `WAREHOUSE_PIC_RESOLVER_TOKEN`, the guard's Drizzle-free port. `WarehouseManagerRepository`
  implements it and `registerInventory` wires it with `useFactory`, so `warehouseGuard` never touches
  Drizzle (mirrors how `erpGuard` reaches `IPermissionResolver`).
- `warehouseGuard()` + `TWarehouseAction` in `src/authorization/elysia-auth.ts`. Status mapping: no
  session 401; login gate closed 403; application admin allowed without a grant; PIC of `:id` allowed;
  PIC of another warehouse 404 (existence not leaked); no live grant at all 403.
- `'session+warehouse'` guard set in `src/http/plugin.ts`; both macros mount, each route opts into
  exactly one.
- `WarehouseManagerRepository` (alive-only reads, revive-on-assign, soft unassign) and
  `WarehouseManagerService` (`listMine`, `assign`, `unassign`, audit). Duplicate assign 409
  `inventory.warehouseManagerExists`; unknown/deleted user 404 `inventory.warehouseManagerUserNotFound`
  (checked through `UserService.getUser`, never `auth.users` directly); unassign idempotent
  `{ removed }`. Audit actions `warehouse.manager_assigned` / `warehouse.manager_removed`.
- `IWarehouseRepository.findAlive(ids?)` (one query for both the PIC view and the app-admin view).
- Routes: `warehouseGuard` on `GET/PATCH/DELETE /:id`, `GET/PUT/DELETE /:id/address`,
  `GET/POST /:id/storages`, `PATCH/DELETE /:id/storages/:storageId`. `POST /:id/storages` is
  `update` on the warehouse (the grant has no `create`; `create` belongs to the warehouse itself).
  Create, list, organization links, and `POST/DELETE /:id/managers` stay `requireGlobalAdmin`.
  `GET /warehouses/mine` is session-only and returns warehouses + `storages`; app admins get every
  live warehouse.
- `assignManagerSchema` / `managerParamSchema` in `warehouse.contract.ts`; three new domain errors;
  `en`/`id` locale keys for `inventory.warehouseManagerExists` and
  `inventory.warehouseManagerUserNotFound`.

Commands and outcomes:
- `bun test` (backend): 979 pass, 0 fail across 74 files. New coverage:
  `test/unit/warehouse-manager.service.test.ts` (9 tests: assign audit, 404 unknown warehouse/user,
  409 duplicate, unassign audit + idempotency, `listMine` PIC/admin/empty) and PIC denial cases in
  `test/authorization/warehouse-authorization.test.ts` (PIC read/update/storages allowed, PIC of
  another warehouse 404, no/soft-deleted grant 403, PIC create 403, PIC assign 403, `/mine` 401/200
  cases).
- `bunx tsc --noEmit`: exit 0. `bun run lint` (`oxlint`): exit 0, pre-existing warnings only.
- `bun run test` in `apps/web-admin`: 97 pass, 0 fail. `packages/locales` `bun test`: 90 pass, 0 fail
  (parity + dead-key guards green with the new keys).
- `bun docs/database/validate-dbml.ts`: `parsed: 269 tables, 232 refs`, `cross-module refs: 0`,
  `timestamp gaps: 0`, `OK`. `docs/database/` reviewed and unchanged: Phase 2 adds no table, column,
  index, constraint, or cross-module link (the table and its Ref landed in Phase 1).

Next executable task: Phase 4 item 8 (PIC nav item + warehouse UI in `apps/web-admin`), then the
remaining plan phases.

## 2026-11-14 - ERP-0051: warehouse PIC Phase 1 (schema, migration, seeder)

Branch `refactor/app-roles-investor-customer`. Phase 1 of `plans/side-nav-role-based.md`: the
`inventory.warehouse_managers` table only. Gate 1 (`docs/database/`) read: `docs.dbml` (header,
Inventory module, `warehouse_organizations` as the nearest sibling), `module-ownership.md` §10,
`integrity-and-consistency.md` §4-5, `data-dictionary.md` §1.3/1.9/1.10/1.13, `logical-references.md`
(`auth.users.id` → Identity). `implementation-phases.md` skipped: no sequencing question. Gate 2
(`grill-me` → `grilling`) run before coding; five answers recorded - stay on this branch, add
`updated_at` via the shared `softDeleteTimestamps` pair, hand-write the migration, keep `user_id`
nullable with no CHECK, add a small deterministic seeder.

Shape: `id uuid pk uuidv7()`, `warehouse_id uuid NOT NULL` (intra-module FK → `inventory.warehouses`,
`ON DELETE CASCADE`), `user_id text` and `assigned_by text` as logical references to `auth.users.id`
(cross-module FK omitted, nullable, per ADR-0014), `created_at` / `updated_at` / `deleted_at` from
`softDeleteTimestamps`. Partial unique `warehouse_managers_uq (warehouse_id, user_id) WHERE
deleted_at IS NULL`, index `warehouse_managers_user_id_idx`. No `organization_id` (the grant
deliberately ignores the warehouse↔organization link, ADR-0017 decision 3) and no status vocabulary.

Commands and outcomes:
- `bun docs/database/validate-dbml.ts`: `parsed: 269 tables, 232 refs`, `cross-module refs: 0`,
  `timestamp gaps: 0`, `OK`.
- `ims_erp_migrate_check` dropped and recreated empty, `POSTGRES_URL` pointed at it, `bun run
  drizzle:migrate`: `migrations applied successfully`; 57 journal rows (56 → 57), 116 tables
  (115 → 116), 21 schemas unchanged. Columns verified in `information_schema` (`id`/`warehouse_id`/
  `created_at` NOT NULL, `user_id`/`assigned_by`/`updated_at`/`deleted_at` nullable), indexes
  `warehouse_managers_pkey` / `_uq` / `_user_id_idx` present, FK `..._warehouse_id_warehouses_id_fkey`
  with `confdeltype = c` (cascade). Second `migrate` run a no-op.
- `bun run drizzle:seed` three times on that database: `created: 2` then `created: 0`, `created: 0`;
  final table state 2 rows / 2 distinct warehouses / 1 distinct user, one PIC per live warehouse.
- `bun test` (backend): 941 pass, 0 fail. `bunx tsc --noEmit`: exit 0. `bun run lint` (`oxlint`):
  no errors, only the pre-existing warnings already recorded in `project-audit.md`.

Deviation, deliberate: the migration is hand-written with no `snapshot.json`, like ERP-0041..0048,
because `drizzle-kit generate` is still blocked by the duplicate `finance.receipts` creation tracked
as ERP-0052. Append-only; no historical migration or snapshot touched.

Not done: `warehouseGuard`, `GET /inventory/warehouses/mine`, assign/unassign routes and the PIC UI
(Phase 2 and Phase 4 item 8) - both blocked on ADR-0017 acceptance. `docs/database/` was updated
(`docs.dbml` TableGroup entry, table, intra-module Ref).

Next executable task: owner review of ADR-0017 (accept or reject) before Phase 2 starts.

## 2026-11-14 - ERP-0051: ERP-0048 migration applied to a throwaway DB and inspected

Branch `refactor/app-roles-investor-customer`. Merge `cff48eb` brings `fix/migration-journal-conflict`
(`32b6c33`, ERP-0052) in so `drizzle-kit migrate` can run at all. Two doc conflicts were resolved by
keeping both entries (ERP-0052 row added, ERP-0051 row kept).

The migration `20261114120000_erp0048_investor_customer_app_roles` was rewritten before this run: its
first form deleted every `members` row whose `role` ended up empty, which also destroyed rows that were
already empty for unrelated reasons. It now deletes only rows whose roles are *all* portal roles, then
strips portal tokens from the mixed rows.

Commands and outcomes (database `ims_erp_migrate_check`, disposable; the dev database was never
touched):
- `bunx --bun drizzle-kit migrate` from empty: 56 journal rows, 115 tables, 21 schemas; second run a
  no-op.
- Data behaviour, with fixture rows injected after rolling the journal back to 55 and re-applying:
  `investor` / `customer` / `" investor "` / `investor,` memberships deleted; `sales,investor`,
  `investor,sales` → `sales`; `sales, customer ,owner` → `sales,owner`; `owner` untouched; a
  pre-existing empty-role row **survives** (the point of the rewrite). `user_invitations.org_role`
  `investor` / `customer` → NULL, `sales` and NULL untouched.
- `bun run database/seeders/index.ts` twice on the migrated database: 40 users / 40 members both runs
  (idempotent), zero memberships holding a portal role.
- Reference check: no table has a foreign key to `auth.members` or `auth.user_invitations`, so no
  child rows were orphaned by the deletes. `auth.invitations` (Better Auth's own organization-plugin
  table, unused by the app's invitation flow, 0 rows on `ims_erp_local`) still has a `role` column
  that this migration does not touch - nothing writes to it today.
- Live login gate, new script `scripts/smoke-login-gate.ts` run against the disposable database (the
  real Better Auth instance, so `session.create.before` fires as in production): 8/8 cases - app admin
  without membership 200, `admin,investor` 200, `investor` alone 403, `customer` alone 403, plain
  `user` without membership 403, `investor` + `sales` membership 200, `customer` + `sales` 200,
  `user` + `warehouse` 200. Users and memberships removed afterwards. Documented in `runbook.md`.

Not verified: the PIC half of the ADR-0017 verification list (no `warehouse_managers` table yet), and
the gate's own DB query still has no automated test (it is covered live, not in `bun test`).

Docs: `docs/database/` reviewed, unchanged (no table or column change; the migration only moves data
between existing columns). `ADR-0018` §Risks and §Verification updated to match the results above -
the earlier text still claimed the migration was unrun and a DB-backed gate test was missing.

Next executable task: owner review of ADR-0017 / ADR-0018; then warehouse PIC Phase 1-2.

## 2026-11-14 - ERP-0051: investor and customer move to app roles (ADR-0018), login gate in code

Branch `refactor/app-roles-investor-customer` (from `main`), commit `d63dfdc`.
Status: **implemented, partially verified**. Not accepted.

What changed:
- `investor` and `customer` removed from organization roles (`erpRoleNames`, `erpRoleLabels`,
  `erpRoleGrants`, backend and web-admin `organization-ac.ts`/`erp-ac.ts`).
- Added as Better Auth `admin()` app roles: `appRoleNames`, `appRoleGrants` (portal grants,
  data only), `parseRoleList`, `hasRole` in `@ims-erp/common`. Server `admin-ac.ts` and
  `plugins/admin.auth.ts` declare the roles; web-admin `adminClient` mirrors them.
- Every `user.role === 'admin'` check (backend and web-admin) replaced by `hasRole` / `hasAppRole`
  (multi-role, comma-joined `user.role`).
- Login gate (ADR-0017 §8 amended by ADR-0018): `providers/better-auth/ac/login-gate.ts`
  (`isWebAdminAllowed`). Enforced in `session.create.before` (`session.auth.ts`) and re-checked
  per request in `sessionGuard` (403). `erpGuard` unchanged. PIC without membership is rejected.
- Login hook default org = first membership with an internal role.
- Migration `20261114120000_erp0048_investor_customer_app_roles`: strips portal tokens from mixed
  `members.role` rows, deletes portal-only rows, NULLs `user_invitations.org_role` for portal roles.
  Dev-only; no production data.
- ADR-0018 written (`proposed`). ADR-0017 §8 and §9 amended in place.

Commands and outcomes:
- `bun test test/unit/global-role-contract.test.ts` (backend): 3 pass - `createUserSchema` and
  `setUserRoleSchema` accept only `globalRoles`.
- `bun test test/authorization/login-gate.guard.test.ts` (backend): 4 pass - `sessionGuard` answers
  403 (not 401) when the gate closes, for every fixture role, and 401 with no session. The harness
  gate is now a controllable stub (`setLoginGateAllowed` in `test/authorization/test-app.ts`).
- Full backend suite after those additions: 941 pass, 0 fail, 73 files; `bunx tsc --noEmit` clean.
- `bun test test/unit/login-gate.test.ts test/authorization/permission-matrix.test.ts` (backend): 32 pass.
- `bun test` (web-admin): 97 pass, 0 fail, 16 files.
- `bun run build` in `packages/common`: needed; web-admin and backend read `dist`, which was stale.
- `bun run typecheck` (root): pass. `bunx tsc --noEmit` (web-admin): clean.
- `bun run lint` (root): 0 errors, 12 warnings (pre-existing, in files not changed here).
- `bun docs/database/validate-dbml.ts`: OK (268 tables, 0 cross-module refs). No schema change.
- Seeders: no `investor`/`customer` role written. Comment in `organization-members.seeder.ts` updated.

Not verified yet:
- No DB-backed login-gate test: the repo has no test that touches a real database (DB is always
  mocked, `bun-test` skill). The guard wiring is covered over HTTP with a stubbed gate
  (`login-gate.guard.test.ts`); the gate's DB query is covered by neither.
- Manual checks (ADR-0017 verification list): the gate half is verified live by
  `scripts/smoke-login-gate.ts` (8/8 cases, see the entry above). PIC cases are not testable yet -
  `inventory.warehouse_managers` does not exist.
- Warehouse PIC (Phase 1-2, `inventory.warehouse_managers`, `warehouseGuard`) still not started.

Docs: `docs/database/` reviewed, unchanged (no table or column change).

Next executable task: owner review of ADR-0017 / ADR-0018, then warehouse PIC Phase 1-2. The
migration itself is applied and inspected - see the entry above.
## 2026-11-14 - ERP-0052: migration snapshot graph repaired, `drizzle:migrate` replays from empty

Branch `fix/migration-journal-conflict` (worktree `B:\ims\erp-migration-fix`, from `main` @ `a997778`).

Problem: `bun run drizzle:migrate` refused to run at all - `Conflicting migrations detected. Found 1
conflict across 2 migrations`, with `drizzle-kit generate --fix-conflicts` as the offered fix. That
fix deletes 14 migration folders (including the custom `20261106111000_stock_balances_nulls_not_distinct`),
so it was not run. Same failure on unmodified `main`, so it predates this work.

Cause (snapshot metadata only, no SQL was wrong):
- `20261106173111_erp0016_tax_slice1/snapshot.json` had `prevIds` = `add_asset_image_url`, making a
  second branch off that node instead of continuing from `20261106165521_merge_main_reconcile`.
- `20261109090000_sales_owns_invoice_receipt/snapshot.json` reused the snapshot id of
  `20261107090000_drop_dynamic_roles_org_role_enum` (`d536237d-...`) and pointed at the same parent,
  so two nodes shared one id.

Fix: two links corrected - `erp0016.prevIds` → `ad2beb0a-...` (`merge_main_reconcile`), and
`sales_owns` given a fresh unique id with `prevIds` → `d536237d-...`. No migration SQL edited,
deleted or reordered; no schema change.

Commands and outcomes:
- `bunx --bun drizzle-kit migrate` against fresh `ims_erp_migrate_check` (recreated empty first):
  `migrations applied successfully`. Result: 55 journal rows, 115 tables, 21 schemas - identical to
  `ims_erp_local`. Second run: no-op, success.
- `bunx --bun drizzle-kit check` on `main`: fails at conflict detection. After the fix it gets past
  that and stops on a different, pre-existing problem: `Cannot reconstruct the state of migration
  20261106221731_m09_finance_stage1: The create delta adds columns ["finance","receipts","received_date"]`.
  `20261106110700` and `20261106221731` both create `finance.receipts` with different shapes; the
  reconciling `20261106170000_drop_merge_side_finance_receipts` has no snapshot, so the chain cannot
  see the `DROP SCHEMA finance CASCADE`. Rebuilding that baseline is separate work - recorded as open
  in `backlog.md` (ERP-0052).
- `bun install --frozen-lockfile` in the worktree: 885 packages (worktrees start without
  `node_modules`). `.env` copied in locally, never committed.

Docs: `docs/database/` reviewed, unchanged (no table or column change).

Not verified: `drizzle-kit check` / `generate` still unusable for the 2026-11-06..11-09 merge window
(see above). `drizzle:seed` was not run on the throwaway database.

Next executable task: run the ERP-0048 migration (`refactor/app-roles-investor-customer`) against a
freshly replayed database now that `drizzle:migrate` works. **Done 2026-11-14** - see the entry above.

## 2026-11-14 - Role-based nav: Phase 4 complete (ERP-0051, web-admin side)

Claimed `ERP-0051` in `backlog.md` (in-progress; PIC and login gate stay blocked on ADR-0017).

- `/organizations/new` is app-admin only in `canOpenPath`. It was previously derived from the
  `/organizations` nav leaf (`organization.read`), which a non-admin org owner also holds.
- Decision 9: `organization-switcher.tsx` re-checks the current route after a switch, using a
  fresh `getSession()`. If the new organization does not allow the page → toast + `navigate('/')`.
- Plan correction: Phase 4.3 says "one `organization.hasPermission` call with every nav
  permission". That is not possible - the endpoint returns one boolean for the whole set, so
  per-item filtering needs one call per permission. `useQueries` is the correct shape; the plan
  text is wrong, the code is not.
- Plan correction: Phase 4.5 "unify the cache key" was replaced by a separate
  `['my-organizations']` key (`GET /organizations/mine`), approved earlier.

Commands and outcomes:
- `bun test` (web-admin): 97 pass, 0 fail, 16 files.
- `bunx tsc -b` (web-admin): exit 0.
- Browser (`localhost:5173`, dev DB):
  - `orgadmin.test` (`admin` in Entragate, `sales` in Live Org):
    - `/organizations/new` → redirected to `/` with the denied toast.
    - No active organization (session `set-active` null) → `/settings/company` redirected to `/`
      with the toast; sidebar showed Dashboard + Notifications only, so Settings is hidden
      without an active organization.
    - `/crm/customers` with Live Org active → switch to Entragate (no `customer.read`) →
      redirected to `/` with the denied toast.
    - `/documents/files` (allowed in both) → switch Entragate → Live Org → stayed on the page,
      toast "Organization switched". No false redirect.
  - `admin`: `/organizations/new` renders "New organization"; `/crm/customers` renders (member
    of Entragate as owner), no redirect.

Not verified: warehouse PIC nav item and PIC UI (Phase 4.8) - blocked on ADR-0017 and
`/warehouses/mine`; the item stays `appAdminOnly`.

Docs: `docs/database/` reviewed, unchanged (no schema change).

Dev database reset after the checks (owner request): `bun run drizzle:migrate-reset` in
`apps/backend` - all schemas dropped, migrations replayed, seeders run, `Migrate-reset
complete` in 9.7 s. Post-reset: `POST /api/auth/sign-in/username` `admin` → 200,
`GET /organizations/mine` → 200 with Entragate only. The throwaway accounts used for the
browser checks (`investor.test`, `investor2.test`, `customer.test`, `orgadmin.test`) no longer
exist; they were created through the API, never by a seeder.

## 2026-11-14 - Role-based nav: Phase 4 part 3 (route guard in `_authed`)

- `lib/route-guard.ts` `canOpenPath`: finds the governing nav leaf (`findNavLeaf`, longest url
  match), reuses `leafVisible` and the same permission cache (`orgPermissionQueryOptions`,
  exported from `use-nav-permissions.ts`) and `['my-organizations']`. Fails closed on error.
- `_authed.tsx` `beforeLoad`: denied path → `toast.error` (`nav:access.denied`, en + id) and
  `redirect({ to: '/' })`.
- `_authed.index.tsx`: Dashboard renders only for internal-role users; others get an empty page.
  Not a redirect, because redirecting `/` to `/` would loop.
- Decision: a path no nav leaf covers is allowed by the frontend; backend still enforces it.
- Known gap: first `/crm/customers` check showed a blank page; the cause was my test timing
  (DOM read before async i18n/session settled), not the guard. Re-test confirmed redirect.

Commands and outcomes:
- `bun test` (web-admin): 96 pass, 0 fail, 16 files (`find-nav-leaf.test.ts`,
  `route-guard.test.ts` added).
- `bunx tsc -b` (web-admin): exit 0.
- Browser, `investor2.test` (investor in Entragate only), `localhost:5173`:
  - `/crm/customers` by URL → redirected to `/`, toast "You do not have access to that page."
    (en) and "Anda tidak memiliki akses ke halaman tersebut." (id).
  - Dashboard hidden, sidebar shows Notifications only.

Not verified: guard for an internal-role user on a denied page (unit test only); `canOpenPath`
against real `hasPermission` responses beyond the investor case.

## 2026-11-14 - Role-based nav plan: Phase 4 part 2 (Dashboard gated on internal role)

- `internalRole` item flag: Dashboard shows only when the user holds an internal role in some
  organization. `open` stays for items every logged-in user may see (Notifications).
- Sidebar waits for `['my-organizations']` as well as permissions before rendering items.
- Browser checks (dev DB, test accounts created through the API, not the seeder):
  - `investor2.test` (investor in Entragate only): sidebar shows Notifications only; no Dashboard.
  - `customer.test` (customer in Entragate only): sidebar shows Notifications only.
  - Admin: unchanged.
- Correction: earlier `investor.test` run was not investor-only (it held `sales` in Live Org);
  its Dashboard was correct.
- Known gap: route guard not yet built. Typing `/` as an investor-only user still renders the
  Dashboard page content. Blocked on `_authed.tsx` `beforeLoad` (next step).
- Login gate (Phase 3) not built: investor-only and customer-only users still sign in.
- `bun test` web-admin: 85 pass, 0 fail. `bunx tsc -b`: exit 0.

## 2026-11-14 - Role-based nav: Phase 4 part 1 (nav model, switcher, `GET /organizations/mine`)

Branch `fix/side-nav-role-based`. Not merged. Phase 4 is partial: route guard and
PIC nav item are still open.

- Nav model: `sidebar-item.ts` (`permission?`, `open?`, `appAdminOnly?`; `adminOnly` removed),
  `filter-nav.ts` (`filterNav`, `collectPermissions`), `nav-config.ts` per-item gates.
  Items with no catalog resource are hidden (deny by default).
- `use-nav-permissions.ts`: one `hasPermission` batch under `['erp-has-permission', ...]`.
  `main-sidebar.tsx` uses `filterNav`, skeleton while pending.
- Backend: `GET /organizations/mine` (session-only, `OrganizationMembershipController`,
  mounted before `/:organizationId`). Repo `findMembershipsForUser`, service `listMyOrganizations`.
  Fix this session: route read `erp.session` but did not enable `erpSession: { session: true }`,
  so `sessionGuard` never set `erp` and the endpoint returned 500
  (`undefined is not an object (evaluating 'erp.session')`). Now 200.
- Switcher: `myOrganizationsQueryOptions` (`['my-organizations']`), filter `hasInternalRole`,
  `OrgLogo` (fallback `Building2`), invalidates `['my-organizations']` and `['organizations']`.
- `lib/internal-role.ts` (`hasInternalRole`), `org-logo.tsx`.

Commands and outcomes:
- `bun test` (web-admin): 84 pass, 0 fail, 14 files.
- `bunx tsc -b` (web-admin): exit 0.
- `bun test test/unit/organization-mine.test.ts` (backend): 2 pass, 0 fail.
- `bunx tsc --noEmit -p .` (backend): exit 0.
- Browser (`localhost:5173`, admin login): `GET /organizations/mine` 200 with 3 orgs, all role
  `owner`. Sidebar renders. Switcher lists Entragate (`Building2` fallback, logo null) and two
  "Live Org" entries with presigned logos.

Not verified:
- Filter for investor-only and investor+internal users: no such accounts exist, so the
  filter has only unit-test evidence.
- `findMembershipsForUser` SQL checked only through the endpoint, not directly against the DB.
- Route guard in `_authed.tsx`: not started.

Docs: `docs/database/` reviewed, unchanged (no schema change in this phase).

## 2026-11-14 - Role-based nav plan: Phase 0 (docs only)

Branch `fix/side-nav-role-based`. Docs only; no code, no migration, no `docs/database/` change.

- `docs/plan/plans/side-nav-role-based.md` added (status: planned). No `ERP-*` claimed.
- `docs/architecture/decisions/ADR-0017-warehouse-person-in-charge.md` added (status: `proposed`).
  Amends ADR-0008 §3 and ADR-0010 §5, §7, §10 by reference only. Those ADRs are not edited yet.
- `docs/plan/plans/features.md` gets a cross-cutting section (planned, evidence: none).
- Cross-checked ADR-0008 §3 (warehouse global, no org role holds `warehouse:*`) against the
  ADR-0017 wording: consistent.
- Owner sign-off on ADR-0017: **pending**. Backend PIC work does not merge before acceptance.
- `docs/database/` reviewed, unchanged in this phase (the `inventory.warehouse_managers` table lands in Phase 1).

Commits: `f8078e4` (plan), `93089f8` (ADR-0017). Tests not rerun for this phase: no code changed;
the pre-commit hook ran backend 923/923 and locales 90/90 on each commit.

## 2026-11-14 - Web admin: header shows the avatar only

Change: `apps/web-admin/src/components/sidebar/nav-user.tsx`. The header trigger now
renders the avatar alone (skeleton avatar while loading). The name and email text
were removed from the trigger and remain in the dropdown's profile row. The
trigger keeps `aria-label` set to the user's name, so screen readers still announce
the account. No locale keys added or removed.

Commands and outcomes:

```text
cd apps/web-admin; bunx tsc -b --noEmit                 clean
cd apps/web-admin; bun run test                          74 pass / 0 fail
cd repo;           bunx oxlint nav-user.tsx              exit 0
browser (in-app tab, user logged in, web-admin :5173):
  header innerText                                       "Toggle Sidebar Home Profiles 3" (no name, no email)
  trigger innerText                                      "" (avatar only)
  trigger aria-label                                     "Live User"
  dropdown open                                          "Live User / live.1475870968@local.com / EN ID / Account / Log out"
```

Not run: mobile width and the loading/error skeleton states in the browser.

## 2026-11-14 - Web admin: sticky header

Change: `apps/web-admin/src/components/layout/main-layout.tsx`, header class adds
`sticky top-0 z-10 border-b bg-background`. Nothing else in the shell changed;
`packages/ui` sidebar untouched. Login, forgot/reset password and invite pages
have no header and are unchanged.

Commands and outcomes:

```text
cd apps/web-admin; bunx tsc -b --noEmit                 clean
cd apps/web-admin; bun run test                          74 pass / 0 fail
cd repo;           bunx oxlint main-layout.tsx           exit 0
browser (in-app tab, user logged in, web-admin :5173):
  header computed style                                  position sticky, top 0px, z-index 10, border 1px
  scroll to 800px with a 2500px pad (removed after)      header top stays 0
  bell popover open while scrolled                       popover is the element at its own center point (above header and content)
  sidebar collapse                                       header 64 -> 48px, top 0 while scrolled
  sidebar expand                                         header back to 64px
```

Not run: print preview and mobile width. Print is covered by the existing
`print:hidden` class on the header, which this change did not touch.

## 2026-11-14 - ERP-0047 Phase 8 complete: second-user live pass, ERP-0047 verified

Status: **verified**. The second-user live step passed in two runs. This entry
supersedes the "Not verified in Phase 8" list in the partial entry below.

Setup: invited user `live.1475870968@local.com` (id `TJLcTxZJKmgrS9fZGxs2yeMABzn6yiP9`)
logged in through the login form in the in-app browser tab. Admin logged in through
the login form in the Firefox tab. Separate browser sessions, separate cookies.

- Run 1: user bell "Notifications, 1 unread" (baseline). Admin
  `POST /organizations/I40etZ.../members` (Live Org `live-zkc8m9`, role `sales`) → 201.
  User bell, no reload: "Notifications, 2 unread". Popover top item:
  "You joined Live Org live-zkc8m9".
- Run 2: user bell "Notifications, 2 unread" (baseline). Admin creates
  `Live Org live2-cpbmho` → 201, then adds the user as `sales` → 201.
  User bell, no reload: "Notifications, 3 unread". Popover top item:
  "You joined Live Org live2-cpbmho".
- Open risk, not reproduced: in run 2, the first add-member call was sent right after
  creating the org in the same script and returned 403. A second add-member to the
  same org, sent as a separate request, returned 201. Cause not established. If it
  recurs, check the org creator's membership state at the time of the call.
- Browser notes (test tooling, not product): the in-app tab showed a blank page right
  after navigate; a reload rendered the form. Typed input into the admin password field
  doubled the value (22 chars); the fix was setting the value by script before submit.

Dev DB side effects from this pass: `Live Org live2-cpbmho` created; the invited user
is now a member of `Live Org live-zkc8m9` and `Live Org live2-cpbmho` in addition to
Entragate.

Phase 9 close-out is unchanged (see the partial entry). Out-of-scope follow-ups are
unchanged: Web Push, notification preferences, email/WhatsApp channels, template
editor, chat on `/ws`, Redis pub/sub fanout, producers for sales invoice and document
signature templates.

## 2026-11-14 - ERP-0047 Phase 8: verification (partial) and Phase 9: close-out docs

Status: **Phase 8 partial**. Automated gates green, WebSocket smoke test
committed, login fix committed, and the browser pass covers most of the manual
walkthrough. The one step not run is a true second-user live arrival (see
"Not verified" below). **Phase 9 docs written**. ERP-0047 stays `in-progress`.

- **Login fix** (separate commit): `apps/web-admin/src/components/form/login-form.tsx`
  sends identifiers containing `@` to `authClient.signIn.email`; others still go
  to `signIn.username`. Root cause: accounts created by sign-up have no
  `username`, so the backend `email-identifier` hook fell back to the raw email
  and the username plugin returned 422 `INVALID_USERNAME` ("Username is invalid").
- **`apps/backend/test/notification/realtime.smoke.test.ts`** (new)
  — real `Bun.serve` `/ws` socket with a session cookie; `ExportedNotificationService`
  → dispatcher → `processNotificationSendJob` → in-memory repository → hub → socket.
  Asserts the frame `{ type: 'notification.created', status: 'success', sentAt, data }`
  with `data.status === 'sent'`, and that the stored row carries the same
  `templateCode` and `variables` the client renders. Second test: a second
  producer call delivers again.
- **Docs**: `docs/user-guide/en.md` + `id.md` gained section 11 (Notifications).
- **Plan files**: `backlog.md` ERP-0047 evidence line, `features.md` ERP-0047
  evidence, and "Next executable task" refreshed.

Commands and outcomes:

```text
cd apps/backend;  bun test test/notification/realtime.smoke.test.ts   2 pass / 0 fail
cd apps/backend;  bun test                                            923 pass / 0 fail (69 files)
cd apps/backend;  bunx tsc -b --noEmit                                clean
cd apps/web-admin; bunx tsc -b --noEmit                               clean
cd $repo;         bun run lint                                        0 errors; backend 12 warnings (pre-existing)
cd $repo;         bun docs/database/validate-dbml.ts                  OK (268 tables, 231 refs, 0 cross-module, 0 timestamp gaps)
cd apps/backend;  bun run drizzle:migrate-reset                       reset + seeders run; schemas recreated
cd apps/backend;  bun run drizzle:seed                                templates inserted 0/4, demo inserted 0 (idempotent re-run)

# live HTTP, backend :3001, scripted (not browser)
sign-up smoke.user@local.com                 200
admin adds user to Entragate (sales)         201
user GET /notifications                      total 1: org.member_added | You joined Entragate | sent | Entragate
user GET /notifications/unread-count         1

# browser, web-admin :5173 + backend :3001, after the login fix
new user smoke.user@local.com via login form  -> dashboard; bell "Notifications, 1 unread"
admin via login form, tab open                -> bell "Notifications, 2 unread"
admin POST /organizations (in-tab fetch)      -> 201; bell "Notifications, 3 unread" with no reload
admin popover                                 -> "Live Org ... is ready" listed first
```

Not verified in Phase 8:

- **Second-user live arrival**: the live step ran on the admin's own tab, where
  the notification is the admin's own org-creation. The plan's case (user tab
  open while an admin adds that user, badge updates) was not run; the user's
  badge was checked after login only. Open item before ERP-0047 can be `verified`.
- Earlier browser attempts (before the login fix) showed "Username is invalid",
  then "Invalid username or password"; cause was the username-only sign-in
  route (see the login fix above), not the notification path.
- Background `bun run src/index.ts` and `bun run dev` shells reported
  `Shell.NotFoundError` after starting. Ports still answered; tmp logs
  `apps/backend/tmp-boot.log` and `apps/web-admin/tmp-vite.log` deleted.
- Dev DB has test data from the browser pass: `live.*@local.com` user, an extra
  `Live Org live-zkc8m9`, and `smoke.user@local.com` as an Entragate member.

Phase 9 deliverables:

- `docs/plan/backlog.md` ERP-0047 stays `in-progress`; evidence lists Phases 0–7
  plus Phase 8 partial. Not moved to `verified` until the second-user live step runs.
- `docs/plan/plans/features.md` stays under `in-progress` (no rollup move).
- User guide section 11 explains the bell, unread badge, mark read, mark all,
  live-update indicator, and retention. It states that only the org templates
  have producers so far; invoice and signature templates are seeded but no
  module sends them yet.
- `docs/database/` reviewed: unchanged in this change; `validate-dbml.ts` OK.

Follow-ups recorded (out of scope): Web Push / Notification API (VAPID, service
worker, `push_subscriptions`), notification preferences, email/WhatsApp
channels, template editor, chat on `/ws`, Redis pub/sub fanout (multi-instance
only), producers for sales invoice and document signature templates.

## 2026-11-14 - ERP-0047 Phase 7: web admin bell and realtime client

Status: **Phase 7 done**. The header has a working notification bell fed by the
single `/ws` socket; `NavUser` moved out of the sidebar footer into the header.

- **`apps/web-admin/package.json`** — `zustand@5.1.0` added (the only new
  dependency).
- **`src/lib/realtime/realtime-client.ts`** (new) — one `WebSocket` to
  `ws(s)://<api>/ws`, exponential backoff (1s doubling, capped at 30s), exact
  `type` → handler registry. `onerror` is deliberately unwired: a browser error
  event is always followed by `close`, and reconnecting from both would double
  every retry. Exports `reconnectDelayMs` and `realtimeUrl` so the two pure
  pieces are testable.
- **`src/lib/realtime/realtime-store.ts`** (new) — zustand store holding the
  connection status only.
- **`src/lib/realtime/use-realtime.ts`** (new) — mounts the socket once, from
  `MainLayout`. `onOpen` refetches the inbox, because frames sent while the
  socket was down are not replayed.
- **`src/lib/notification-api.ts`** (new) — `notificationsQueryOptions`,
  `unreadCountQueryOptions`, `markNotificationRead`,
  `markAllNotificationsRead`, `refreshNotifications`, and the three socket
  handlers (`notification.created` / `.updated` invalidate,
  `notification.unread_count` writes the count into the cache).
- **`src/lib/notification-text.ts`** (new) — localized title/body per
  `templateCode` via an explicit `switch`.
- **`src/components/notification/notification-bell.tsx`** (new) — icon-only
  ghost `Button` with the unread badge and a disconnected dot, `Popover` with a
  header, "mark all as read" and a scrollable list of title / body / tag chips;
  an item marks itself read and navigates.
- **`src/components/layout/main-layout.tsx`** — header is now
  `[SidebarTrigger][Separator][Breadcrumb] … [NotificationBell][NavUser]`, and
  the layout calls `useRealtime()`.
- **`src/components/sidebar/nav-user.tsx`** — trigger is a ghost `Button`
  (avatar always, name/email `hidden md:grid`); `ChevronsUpDown` and the
  dead "Notifications" item removed.
- **`src/components/sidebar/main-sidebar.tsx`** — `SidebarFooter` / `NavUser`
  removed.
- **`packages/locales`** — new `notifications` namespace (`en` + `id`, including
  the four template copies), registered in `NAMESPACES`, both `index.ts`
  bundles and `i18next.d.ts`; `NotificationKey` type added; the now-dead
  `nav:user.notifications` removed from both bundles.

Deviations from the plan text:

- **`DYNAMIC_PREFIXES` needed no entry.** Every key is literal, so the dead-key
  guard already sees them; what the plan missed is the `i18next.d.ts`
  augmentation, without which `useTranslation('notifications')` does not type.
- **The store holds connection status only.** Buffered events and an optimistic
  badge were dropped: a buffer is stale after a long outage (refetch on open is
  correct), and the badge is already the server's count.
- **Template copy is a `switch`, not a key map** — a map of keys compiles to a
  union and i18next's overloads then reject the call, losing the interpolation
  check.
- **Template keys are camelCase** (`template.org.memberAdded.title`): i18next
  reads `_` as a plural suffix and rejects the snake_case code as a key.
- **`useRealtime()` lives in `MainLayout`**, not the `_authed` route.
- **Item navigation is shallow**: `organization` → the organization page,
  `organization_member` → `/organizations`, everything else marks read only.

Commands and outcomes:

```text
cd apps/web-admin; bun add zustand           -> zustand@5.1.0
cd apps/web-admin; bunx tsc -b --noEmit      (clean)
cd apps/backend;   bunx tsc -b --noEmit      (clean)
cd $repo; bun run test
  @ims-erp/web-admin  74 pass / 0 fail  (2 new files: realtime-client, notification-realtime)
  @ims-erp/locales    90 pass / 0 fail
  @ims-erp/backend   921 pass / 0 fail
  @ims-erp/react-email 5 pass / 0 fail
cd $repo; bun run lint                       0 errors (ui 19 / backend 12 / web-admin 11
                                             pre-existing warnings)
cd $repo; bun docs/database/validate-dbml.ts OK (no schema change)

# live, backend :3001 + vite :5173, signed in as admin@local.com
header (en)          "Notifications, 2 unread"  -> popover lists the 3 seeded rows
"Mark all as read"   badge cleared, both queries refetched
second session PATCH /notifications/:id/read  -> badge 3 -> 2, no reload (socket frame)
backend stopped      bell shows "Live updates unavailable"
backend restarted    dot cleared without a reload (backoff reconnect)
locale -> id         "Notifikasi, 3 belum dibaca", "Tandai semua dibaca",
                     "Anda bergabung dengan Entragate", "Invoice INV-DEV-0001
                     diterbitkan", "Tanda tangan diminta: BAST Swing Gate"
keyboard             bell focusable, Enter opens the popover, Escape closes it
```

Seeded demo rows were restored to their intended state after the manual pass
(two unread, one read).

## 2026-11-14 - ERP-0047 Phase 6: notification seeders

Status: **Phase 6 done**. A seeded database has the four templates and three
demo notifications for the seed admin; the bell (Phase 7) has data to render.

- **`database/seeders/seed/notification-templates.seeder.ts`** (new) — the four
  canonical templates (`org.member_added`, `org.org_created`,
  `sales.invoice_issued`, `document.signature_requested`) with English
  subject/body copy and their declared `variables`. Anchored on `code` with
  `deleted_at IS NULL`, so re-runs insert nothing and an operator's edited copy
  is never overwritten. Runs in **every** environment: a production database
  without templates would make every producer job skip.
- **`database/seeders/seed/notification-demo.seeder.ts`** (new) — three demo
  rows for `appConfig.auth.seedAdminEmail` only (two unread, one read, staggered
  `createdAt` so "newest first" is visible). Anchored on
  `(user_id, source_id)` with `source_type='seed_demo'`. Dev-only.
- **`database/seeders/index.ts`** — both wired after `seedHrEmployees()`:
  templates then demo, because the demo rows reference the templates and the
  seed admin created by `seedAuth`.
- **`test/unit/notification-seeders.test.ts`** (new) — drift guard between the
  schema's `NOTIFICATION_TEMPLATE_CODES`, the seed list, and each seed's
  placeholders vs declared `variables`.

Deviations from the plan text:

- **`.seeder.ts` suffix**, matching every other seeder in that directory.
- **The demo seeder stores `title`/`body` pre-rendered** rather than importing
  the worker's `renderNotificationText`: importing it pulls in
  `notification.queue`, which builds a BullMQ `Queue` at module load and opens a
  Redis connection from a seeder. The duplication is guarded by the new test.
- **The demo anchor is `source_id` + `source_type='seed_demo'`**, not just the
  user id, so a re-run is a no-op and a demo row is distinguishable from the
  rows the Phase 5 producers write.

Commands and outcomes:

```text
cd apps/backend; bun run drizzle:seed        # run 1
  inserted 4 / total 4   "Notification templates seeded"
  inserted 3             "Demo notifications seeded"
  Seeding complete (4.8s)

cd apps/backend; bun run drizzle:seed        # run 2 (idempotency)
  inserted 0 / total 4   "Notification templates seeded"
  inserted 0             "Demo notifications seeded"
  Seeding complete (4.4s)

# row inspection
notification.notification_templates -> 4 rows, channel 'in_app', is_active true,
  variables ["organizationName","role"], ["organizationName"],
  ["invoiceNumber","customerName","amount"], ["requesterName","documentName"]
notification.notifications (source_type='seed_demo') -> 3 rows for the seed
  admin, newest first: 'You joined Entragate' (sent), 'Invoice INV-DEV-0001
  issued' (sent, tags [Entragate, Invoice]), 'Signature requested: BAST Swing
  Gate' (read, tags [Entragate, Signature])

cd apps/backend; bun test
  921 pass, 0 fail, 2120 expect() calls (68 files; 2 new)
cd apps/backend; bunx tsc -b --noEmit   (clean)
cd apps/backend; bunx oxlint            exit 0
cd $repo; bun docs/database/validate-dbml.ts   OK (no schema change)

# live over HTTP, :3001, signed in as admin@local.com
GET /notifications                    -> 200, total 3, newest first
GET /notifications/unread-count       -> 200 { count: 2 }
GET /notifications?unreadOnly=true    -> 200, total 2
```

## 2026-11-14 - ERP-0047 Phase 5: notification producers

Status: **Phase 5 done**. Adding a user to an organization now produces an
in-app notification for that user; creating an organization notifies the
creator. No seeders (Phase 6) and no UI (Phase 7) yet.

- **`src/app/organization/services/organization.service.ts`** — injects
  `EXPORTED_NOTIFICATION_SERVICE_TOKEN` and notifies on three paths:
  `addMember` → `org.member_added`, `createOrganization` → `org.org_created`
  for the creator, and a nested **active** user attached at create time →
  `org.member_added`. The organization name is both the tag chip and the
  `organizationName` variable. `role` is the comma-joined Better Auth list
  rendered as `admin, sales`.
- **`src/app/user/services/invitation.service.ts`** — `claim()` notifies
  `org.member_added` **after** `attachMembership` succeeds, so the claim that
  actually creates the membership is the notification point. Invite send,
  resend, cancel, and a rejected or expired token notify nothing.
- **`src/app/notification/constants/di.ts` + `container.ts` +
  `services/exported-notification.service.ts`** — new
  `NOTIFICATION_DISPATCHER_TOKEN` registered with the real `dispatchNotification`
  as a `useValue`, and injected into `ExportedNotificationService`.
- **`test/unit/notification.producers.test.ts`** (new) — 7 tests over the three
  paths, including the real `ExportedNotificationService` over a throwing
  dispatcher to prove a queue outage never fails the business write.

Deviations / defects found:

- **The Phase 3 dispatcher seam broke the DI graph at boot.** A defaulted
  constructor parameter emits no design type, so tsyringe threw
  `Cannot inject the dependency at position #0 of "ExportedNotificationService"
  ... TypeInfo not known for "Object"` the first time a producer actually
  resolved the exported service — and it surfaced as a chain through
  `QuotationService` → `LeadService` → `OrganizationService` →
  `InvitationService`. Unit tests never resolve the container, so the whole
  suite stayed green while `bun run src/index.ts` failed. Fixed with an explicit
  token; constructing the class by hand in tests still works.
- Only nested **invited** users skip the create-time notification: they are
  notified once at claim, so one membership never yields two notifications.
- `sourceId` is the member row id where one exists, else the organization id, so
  the job id stays deterministic and a replay cannot double-notify.

Commands and outcomes:

```text
cd apps/backend; bun test
  919 pass, 0 fail, 2114 expect() calls (67 files; 7 new)

cd apps/backend; bunx tsc -b --noEmit
  (clean)

cd apps/backend; bunx oxlint
  exit 0

cd apps/backend; bun run src/index.ts
  "🦊 Elysia is running at localhost:3001" (boot re-verified after the DI fix)

# live, real queue + real worker, local Postgres/Redis
POST /organizations                     -> 201; queue completed +1
  job notification-org.org_created-<userId>-<orgId>
  data { templateCode: 'org.org_created', variables: { organizationName },
         tags: [organizationName], sourceType: 'organization', sourceId: <orgId> }
POST /organizations/:id/members         -> 201; queue completed +1
  job notification-org.member_added-<userId>-<memberId>
  data { templateCode: 'org.member_added',
         variables: { organizationName, role: 'member' },
         tags: [organizationName], sourceType: 'organization_member',
         sourceId: <memberId> }
notification.notifications row -> status 'sent',
  title 'Member added',
  body 'Admin added you as member of Phase5 Probe ...',
  tags ["Phase5 Probe ..."], source_type 'organization_member'
```

## 2026-11-14 - ERP-0047 Phase 4: notification REST surface

Status: **Phase 4 done**. The caller's inbox is reachable over HTTP; nothing
produces a notification yet (Phase 5) and there is no UI (Phase 7).

- **`src/app/notification/controllers/notification.controller.ts`** (new) —
  `GET /notifications` (paginated, newest first), `GET /notifications/unread-count`,
  `PATCH /notifications/:id/read`, `POST /notifications/read-all`. Mounted with
  `guards: 'session'` only (D13): app-scope, no `erp` macro, no
  `x-organization-id`. The caller's id always comes from the resolved session,
  never from a path or body field, so no request can widen the scope.
- **`notificationIdParamsSchema`** added to
  `contracts/notification.contract.ts` — `z.uuid()`, so a malformed id is a 400
  instead of a Postgres 500.
- **`notificationModule()`** added to the module `index.ts` and mounted in
  `src/app/app.ts` after `auditModule()`.
- **`src/authorization/elysia-auth.ts`** — `sessionGuard()` now carries its own
  `onError({ as: 'global' })` mapping `ErpAuthError` → envelope. It previously
  relied on being mounted beside `erpGuard()`, so an unauthenticated call to a
  session-only module answered with Elysia's default plain-text body. The
  notification routes are the first session-only surface with no `erp` macro.
- **`src/http/plugin.ts`** — the shared `VALIDATION` branch is fixed (see below).
- **`test/unit/notification.controller.test.ts`** (new) — 10 tests: 401 envelope,
  caller-scoped list + ordering, `unreadOnly`, malformed page, unread count,
  mark-read, another user's row → 404, non-uuid id → 400, `read-all`, and the
  same 400 asserted against a **listening** server.

Deviations / defects found:

- **`domainPlugin`'s `VALIDATION` branch was broken for Zod schemas.** It wrote
  `String(error.value)` into `errors[0].field`; with Zod-backed schemas Elysia
  puts the raw request input there, and stringifying it threw
  `TypeError: No default value`. On a **listening** server (AOT-compiled route)
  that turned every param/query validation failure into a 500 HTML page —
  `app.handle()` never reproduced it, which is why the suite was green. Fixed by
  a `validationDetail()` helper reading `error.valueError.path` (Zod array and
  TypeBox JSON-pointer both handled) and the validator's own message. Pre-existing
  shared-plumbing defect, not a notification bug.
- The 500 was first misread as an i18n/CORS problem; three probe files bisected
  it (`createApp().handle` → 400, `createApp().listen` → 500). Probes deleted.
- Another user's id returns 404, not 403 (D-decision), so a caller cannot probe
  which ids exist.

Commands and outcomes:

```text
cd apps/backend; bun test
  912 pass, 0 fail, 2102 expect() calls (66 files; 10 new)

cd apps/backend; bunx tsc -b --noEmit
  (clean)

cd apps/backend; bunx oxlint
  exit 0 (3 pre-existing warnings, none in notification files)

cd $repo; bun docs/database/validate-dbml.ts
  parsed: 268 tables, 231 refs; cross-module refs: 0; timestamp gaps: 0; OK
  (docs/database/ reviewed, unchanged: no schema change this phase)

# live, bun run src/index.ts on :3001, real signed-in session (admin@local.com)
GET  /notifications                     (anon) -> 401 envelope
GET  /notifications/unread-count        (anon) -> 401 envelope
GET  /notifications                            -> 200 { pagination:{page:1,limit:20,total:0} }
GET  /notifications?unreadOnly=true            -> 200
GET  /notifications?page=0                     -> 400 { message:"Validation failed" }
PATCH /notifications/not-a-uuid/read           -> 400 { field:"id", message:"Invalid UUID" }
PATCH /notifications/0190a1b2-...-0000000000ff/read -> 404 "Notification not found"
POST /notifications/read-all                   -> 200 { changed: 0 }
```

## 2026-11-13 - ERP-0047 Phase 3: notification module core

Status: **Phase 3 done**. The module exists with a repository, two services,
a BullMQ `send`/`prune` queue and its worker; nothing produces a notification
yet (Phase 5) and there is no REST route (Phase 4) or UI (Phase 7).

- **`src/app/notification/constants/di.ts`** (new) — three tokens:
  `NOTIFICATION_REPOSITORY_TOKEN`, `NOTIFICATION_SERVICE_TOKEN` (in-module
  read/ack surface) and `EXPORTED_NOTIFICATION_SERVICE_TOKEN` (the **only**
  entry point other modules may use, D7).
- **`contracts/notification.repository.interface.ts`** (new) — the data-access
  contract: `insert`, `findTemplateByCode`, `findByIdForUser`, `listForUser`,
  `countUnread`, `markRead`, `markAllRead`, `pruneRead`. Reads filter
  `deleted_at IS NULL`; `pruneRead` is the one hard delete, because retention
  (D10) is a storage rule.
- **`contracts/notification.contract.ts`** (new) — `notificationQuerySchema`
  (`page`, `limit`, `unreadOnly`) and `toNotificationView`, which maps a row to
  the wire shape with ISO dates so an HTTP body and a WebSocket frame describe
  a notification identically. `unreadOnly` is an enum of `"true"`/`"false"`, not
  `z.coerce.boolean()` — coercion turns the string `"false"` into `true`.
- **`repositories/notification.repository.ts`** (new) — every statement against
  `notification.*`; ownership is part of the WHERE clause, so a row belonging to
  another user is indistinguishable from a missing one.
- **`services/notification.service.ts`** (new) — `list`, `unreadCount`,
  `markRead`, `markAllRead`, `assertOwnedBy`. Every method takes the caller's
  `userId`; there is no "any user" variant to widen the scope by accident.
  Read-state changes publish `notification.updated` + `notification.unread_count`
  to that user's other tabs.
- **`services/exported-notification.service.ts`** (new) — `notify({ userIds,
  templateCode, variables, tags, sourceType?, sourceId?, metadata? })`.
  Enqueue-only, one job per recipient, duplicates and blanks collapsed; a queue
  failure is logged and never thrown into the caller's write.
- **`queues/notification.queue.ts`** (new) — queue `notification`, jobs `send`
  and `prune`, `upsertJobScheduler` for the retention job.
- **`queues/notification.worker.ts`** (new) — `send` resolves the template,
  renders `{{variable}}` placeholders into English `title`/`body`, inserts the
  row as `sent` with `sent_at`, then publishes `notification.created`; `prune`
  hard-deletes read rows past the window. A missing or inactive template
  **skips** the job instead of retrying — a retry cannot create a template.
- **`errors/notification.errors.ts`** (new) — `NotificationNotFoundError` (404).
- **`config/schemas/config.schema.ts` + `config/loaders/config.loader.ts`** —
  `scheduler.notificationRetentionCron` (`SCHEDULER_NOTIFICATION_RETENTION_CRON`,
  default `0 4 * * *`) and `scheduler.notificationRetentionDays`
  (`NOTIFICATION_RETENTION_DAYS`, default 90). `.env.example` documents both and
  the `SCHEDULER_ENABLED` master switch, which was undocumented before.
- **`src/index.ts`** — `registerNotification(container)`,
  `startNotificationWorker()` inside the existing `startWorkers(...)` call, and
  `registerNotificationSchedules(...)` behind `scheduler.enabled`.
- **`packages/locales/src/{en,id}/api.ts`** — `notification.notFound`.

Deviations from the plan text:

- **No `constants/tags.ts`.** Tags are caller-supplied display strings (today:
  the organization name); a closed `NOTIFICATION_TAGS` vocabulary would have to
  be edited per tenant name.
- **No `notificationModule()` yet.** Phase 4 owns the controllers; mounting an
  empty plugin would make `createApp()` claim a surface that does not exist.
- **The dispatcher is a constructor parameter** on `ExportedNotificationService`
  (defaulting to the real queue). The first attempt used `mock.module` on the
  queue in a test; bun's module mock leaks across files in the same run and
  replaced `notificationJobId` for the worker test (`Received: "job-1"`). A
  constructor seam is the honest fix and needs no global state.
- **`jobId` suffix** is `sourceId` when the producer has one, else a djb2 hash
  of the sorted variables, so a replayed producer call dedupes without
  colliding two organizations through the same template.

Commands and outcomes:

```text
cd apps/backend; bun test
  902 pass, 0 fail, 2077 expect() calls (65 files; 19 new notification tests)

cd apps/backend; bunx tsc -b --noEmit
  (clean)

cd apps/backend; bunx oxlint src/app/notification test/unit/notification.*.test.ts
  exit 0

cd $repo; bun run --filter @ims-erp/locales test
  86 pass, 0 fail

# live, real repository + real in-process hub, local Postgres/Redis
processNotificationSendJob(...)
  -> { status: 'sent', notificationId: '01a1d560-4dba-758d-...' }
  -> socket frame {"type":"notification.created","status":"success","sentAt":<ms>,
     "data":{"id":...,"templateCode":"org.member_added","title":"You joined
     Entragate","body":"Admin added you as member.","tags":["Entragate"],
     "status":"sent","sentAt":"2026-11-13T14:47:00.790Z",...}}
publish to a user with no socket -> 0
listForUser -> total 1; countUnread -> 1
markRead -> status 'read', readAt set; markRead by another user -> null
countUnread after -> 0; markAllRead -> 0
processNotificationPruneJob(0 days) -> { removed: 1 }

registerNotificationSchedules -> [{ key: 'prune', pattern: '0 4 * * *' }]
second call -> still 1 (idempotent)

# boot, real process
bun run src/index.ts -> "🦊 Elysia is running at localhost:3001" with the
  notification worker registered alongside the avatar/org-logo/mail workers
```

## 2026-11-13 - ERP-0047 Phase 2: the single realtime socket (`/ws`)

Status: **Phase 2 done**. One WebSocket endpoint exists, authenticated at
upgrade, with an in-process fanout hub. No notification module yet; Phase 3 is
next.

- **`src/providers/realtime/realtime.message.ts`** (new) — `TRealtimeMessage`
  (`{ type, status, sentAt, data }`) and `realtimeMessage()` which stamps
  `sentAt` at send time. `status` is the frame result; `data.status` stays the
  domain status.
- **`src/providers/realtime/realtime.hub.ts`** (new) — `IRealtimeHub` +
  `REALTIME_HUB_TOKEN` + `InProcessRealtimeHub`. Two maps (`byWsId` for close,
  `byUserId` for publish) so neither operation scans. `publish` serializes once
  per frame, delivers to every tab of the user, and drops a socket that throws
  instead of failing the producer.
- **`src/providers/realtime/realtime.gateway.ts`** (new) — `.ws('/ws')` with the
  Better Auth session resolved in `resolve({ as: 'local' })`; `open`/`close`
  register/unregister; a session-less upgrade throws `RealtimeAuthError` → 401
  envelope.
- **`src/di/provider.ts`** — hub registered with `useValue` (one map per
  process; `useClass` would hand out a fresh empty hub per resolve).
- **`src/app/app.ts`** — gateway mounted before the feature modules.
- **`docs/architecture/runbook.md`** — new "Realtime socket (`/ws`) and reverse
  proxies" section (nginx `Upgrade`/`Connection`/`proxy_read_timeout`, Caddy,
  Traefik, CDN caveat; the in-process hub's single-instance limit).

Two plan deviations, both measured rather than assumed:

- `websocket()` from `elysia/ws` **does not exist** in 1.4.31 — the module
  exports a handler object, so calling it throws `websocket is not a function`.
  The Bun adapter already installs its own handler in `Bun.serve`; `.ws()` alone
  is correct.
- `beforeHandle` cannot carry the user id: a value returned there does not reach
  `ws.data`. `resolve({ as: 'local' })` does — probed both ways before writing
  the gateway.

Commands and outcomes:

```text
cd apps/backend; bun test
  883 pass, 0 fail, 2033 expect() calls (62 files; 11 new realtime tests)

cd apps/backend; bunx tsc -b --noEmit
  (clean)

cd apps/backend; bunx oxlint src/providers/realtime test/unit/realtime.*.test.ts
  exit 0

# live, against `bun run src/index.ts` on :3001 with the seeded database
raw upgrade GET /ws without a session
  -> 401 {"requestId":...,"status":401,"message":"Authentication required",...}
signed in as admin@local.com, upgrade with the session cookie
  -> socket open

# live, inside the test harness (real Bun.serve, mocked Better Auth seam)
hub.publish('user-1', realtimeMessage('notification.created', { id: 'n-1' }))
  -> client received {"type":"notification.created","status":"success",
     "sentAt":<ms>,"data":{"id":"n-1"}}
```

## 2026-11-13 - ERP-0047 Phase 1: notification schema + migration

Status: **Phase 1 done**. `notification` schema exists in Drizzle and in the
local database. No application code yet; Phase 2 (`/ws` transport) is next.

- **`drizzle/schemas/notification.schema.ts`** (new): `notificationSchema`
  pgSchema; `notification_templates` (code `varchar(64)` unique partial on
  `deleted_at IS NULL`, body, declared variables, channel) and `notifications`
  (`user_id`, `template_code`, `title`, `body`, `tags`/`variables`/`metadata`
  jsonb, `channel`, `status`, `sent_at`, `read_at`, `source_type`/`source_id`,
  timestamps). No `organization_id` anywhere — app-scope per ADR-0016. The one
  FK is intra-module, `set null`. Exported `NOTIFICATION_CHANNELS`,
  `NOTIFICATION_STATUSES`, `NOTIFICATION_TEMPLATE_CODES`.
- **`database/migrations/20261113150000_erp0047_notification_schema/migration.sql`**
  (new, hand-written). `drizzle:generate` is not usable in this repo: there is
  no `meta/_journal.json` and no snapshot, so drizzle-kit reports a
  pre-existing branch conflict across 2 migrations and its only offered fix
  (`--fix-conflicts`) would delete 14 existing migrations. Every migration
  since 2026-11-13 is hand-written and append-only; this follows that
  convention (`CREATE SCHEMA/TABLE/INDEX IF NOT EXISTS`, one `ALTER ... ADD
  CONSTRAINT` for the FK).

Commands and outcomes:

```text
bun run drizzle:generate
  Conflicting migrations detected: 1 conflict across 2 migrations
  (no journal in repo; --fix-conflicts would delete 14 migrations) -> not used

bun run drizzle:migrate-reset
  Dropping schema ... (19 app schemas)
  Migrations complete
  Seeding complete (7.29 s)
  Migrate-reset complete (9.95 s)

# post-reset verification against pg_catalog
schemas: ..., notification, ...           (notification present)
tables: notification_templates, notifications
indexes: notification_templates_channel_idx, notification_templates_code_uq,
  notification_templates_pkey, notifications_created_at_idx, notifications_pkey,
  notifications_status_idx, notifications_template_id_idx,
  notifications_user_id_idx, notifications_user_status_idx
checks: notification_templates_channel_check, notifications_channel_check,
  notifications_status_check
fks: notifications_notification_template_id_fk

cd apps/backend; bunx tsc -b --noEmit
  (clean)
```

`docs/database/` was reviewed and is unchanged: the Drizzle schema and the
migration mirror `docs.dbml` exactly as Phase 0 wrote it. `validate-dbml.ts`
still prints `OK` (268 tables, 231 refs, 0 cross-module, 0 timestamp gaps).

## 2026-11-13 - ERP-0047 Phase 0: notification module contract + single realtime socket

Status: **Phase 0 done (docs/contract only)**. No application code changed.
`docs/plan/plans/ws-notification.md` Phase 1 (schema + migration) is next.

Notification left the tenant-scoped `automation` schema and became its own
app-scope module. A notification belongs to one user and must be readable from
every organization that user belongs to, so a tenant column would either hide it
in the wrong context or force one row per organization for one event. The same
change reserves **one** realtime socket (`/ws`) for every feature instead of a
socket per feature.

- **`database/docs.dbml`**: new `// MODULE: Notification (schema: notification)`
  section; `notification_templates` + `notifications` moved out of Automation
  and reshaped - `recipient_user_id` → `user_id`, `organization_id` /
  `recipient_type` / `recipient_value` / `subject` / `scheduled_at` /
  `error_message` dropped, `template_code` / `title` / `tags` (jsonb) /
  `variables` (jsonb) / `metadata` (jsonb) added, template `code` unique
  globally instead of per tenant. Header note 26 → 27 schemas/modules.
  `TableGroup "Notification"` added; `automation` header comment no longer
  claims notifications.
- **`database/module-ownership.md`**: module table 26 → 27 rows (Automation
  11 tables / 7 intra FKs / 16 logical refs → 9 / 6 / 13; Notification 2 / 1 / 1),
  totals 268 tables / 231 intra FKs / 524 logical refs, Automation profile
  updated and a new Notification profile with the contract and the app-scope
  rule.
- **`database/implementation-phases.md`**: S6 table list drops the two tables
  and a paragraph states the module lands through `ws-notification.md` Phase 1,
  not S6; schema-existence check list gains `notification`; exit criterion
  26 → 27 schemas.
- **`database/data-dictionary.md`**: `jsonb` exception for notification
  payloads (and the rule that payload data is never authorization), the
  app-scope carve-out in the tenant-column section, Notification glossary, and
  the `3.5` vocabulary list repointed at `notification.notification_templates`.
- **`database/logical-references.md`**: regenerated by script - 526 → 524
  referring columns (the two dropped `organization_id` columns),
  `auth.organizations.id` 188 → 186, `automation.notifications →
  recipient_user_id` replaced by `notification.notifications → user_id`.
- **`architecture/modules/notification.md`**: rewritten. The old file was the
  deleted NestJS audit ("scaffold only"); it now documents the boundary, the
  data ownership, the `ExportedNotificationService` contract, the envelope and
  the planned tests.
- **`architecture/decisions/ADR-0016-notification-module-and-single-realtime-socket.md`**
  (new, accepted) + index row in `architecture/README.md`: why the module is
  app-scope, why one socket, why the fanout starts in-process.
- **`architecture/api-conventions.md`**: notification endpoint family (session
  guard only, 404 not 403 for another user's row) and the socket envelope
  `{ type, status, sentAt, data }` with the rule that REST stays the source of
  truth.
- **`plan/plans/ws-notification.md`** (new): the 10-phase plan (Phase 0 docs →
  Phase 9 close-out) with locked decisions D1-D14 and a per-phase exit gate.
- **`plan/backlog.md`**: `ERP-0047` in-progress (Phase 0 done).
  **`plan/plans/features.md`**: new "Notification + realtime" section
  in-progress, plus a note that the in-app substrate is not part of M04.

Commands and outcomes:

```text
bun docs/database/validate-dbml.ts
  parsed: 268 tables, 231 refs
  cross-module refs: 0
  timestamp gaps: 0
  OK

bun docs/database/gen-logical-references.ts
  regenerated: 524 refs across 41 targets, 231 intra-module refs
  (re-run: no further diff)
```

## 2026-11-13 - Docs: ERP-0042 split documented end to end (schemas, modules, ADR-0015)

Status: **implemented (documentation only)**. No code changed; `docs/` grew to
match the ERP-0042 code that already exists on
`refactor/company-document-numbering`.

The split was implemented on 2026-11-13 but only partly documented: the schemas
were in `docs.dbml` and `module-ownership.md`, while `domain-map.md`,
`data-model.md`, `architecture.md` and `security-and-access.md` still described
the retired `erp` schema and Organization as the owner of the company profile,
and there was no module doc for the three new modules at all.

- **Modules docs (new):** `architecture/modules/company.md`,
  `code-number.md`, `document.md`. Each covers purpose and boundary, owned
  tables, the exported contract, the routes with their permissions, and the
  tests. `modules/README.md` now links them instead of saying "no doc yet".
- **`architecture/decisions/ADR-0015-company-document-code-number-split.md`
  (new, accepted).** Records *why* three modules instead of one, the
  one-module-one-schema rule, the verbatim rename of the numbering table, and
  the consequence that a field removed from the UI keeps its column.
  `architecture/README.md` indexes it.
- **`architecture/security-and-access.md`**: a new "Company-wide resources"
  section. It states the `company` / `code_number` / `document` resource-action
  pairs and, importantly, that company-wide is a *data scope*, never an
  authorization boundary - those routes still run the `erp` macro with a
  validated organization. The integration-gap section now separates the built
  modules from the signature-request flow (ERP-0048).
- **`architecture/data-model.md`**: `erp` replaced by per-schema entries for
  `company`, `code_number`, `document`, `audit`, `crm`, `investor`, with `erp`
  explicitly retired. `apps/backend-elysia` corrected to `apps/backend`. The
  location seeder note now points at `location.*`.
- **`architecture/architecture.md`**: the `erp` schema bullet became "retired"
  plus the one-module-one-schema rule naming the three new schemas.
- **`architecture/domain-map.md`**: the "Company, users, roles, permissions,
  audit" row now lists `company`, `code_number` and `document` as owners.
- **`database/docs.dbml`**: header 24 schemas/24 modules → 26/26, and the
  "Warehouse and Inventory are one module spanning two schemas" clause replaced
  by "every module owns exactly one schema" - the clause had been false since
  ADR-0008. `TableGroup "Documents"` → `"Document"`, `"CodeNumber"` →
  `"Code Number"`, and the Inventory module comment no longer describes a
  `warehouse` schema.
- **`database/module-ownership.md`**: `226 Ref:` → `231`, `522` logical
  reference columns → `526`, and the module-count paragraph rewritten (Company
  and Code Number split out of Organization; `location` and `ticket` reasons
  kept; ADR-0015 named). A dead `(see 10b)` cross-reference removed.
- **`database/integrity-and-consistency.md`**: `218 Ref:` → `231`,
  `parsed: 251 tables` → `268`, and §2.2 "The one exception" rewritten - there
  is no two-schema module left, so no cross-schema foreign key is allowed
  anywhere.
- **`database/implementation-phases.md`**: target 24/251 → 26/268; the
  `warehouse` schema row and the "generate both in the same step" instruction
  replaced by the folded `inventory` shape (14 tables); the `warehouse.schema.ts`
  stub dropped from the file list; the two `inventory <-> warehouse` exception
  clauses in the verification queries and exit criteria replaced by "no
  exception"; final checklist 24/251/218 → 26/268/231.
- **`database/data-dictionary.md`**: the warehouse-schema note now names
  `inventory.warehouses` / `inventory.warehouse_addresses` /
  `inventory.warehouse_storages`.
- **`user-guide/en.md` + `id.md`**: setup step 1 rewritten. It used to tell the
  admin to fill the signatory, the bank accounts, the default terms and the
  warranty texts on the company page - none of which are editable there since
  ERP-0045c. The steps now split into Settings → Company (identity + contact),
  Settings → Code numbering, Settings → Document (logo), with an explicit note
  that the removed fields cannot be edited from the UI and that stored values
  keep printing. "Settings → Document numbering" became "Settings → Code
  numbering"; the item code is called out as generated and immutable.
- **`plan/plans/features.md`**: the sidebar bullet no longer claims
  Administration holds Company and Code numbering (ERP-0045c moved them);
  the ERP-0042 bullet names the new module docs and ADR-0015 and says 32 code
  types, not 29.
- **`plan/backlog.md`**: unchanged in this entry - ERP-0042..ERP-0046 already
  carry their statuses.

Verified: `bun docs/database/validate-dbml.ts` →
`parsed: 268 tables, 231 refs` / `cross-module refs: 0` / `timestamp gaps: 0` /
`OK`. Grep for `organization.company_profiles`,
`organization.document_sequences`, `organization.company_bank_accounts`,
`documents.documents`, `TableGroup "Documents"`, `24 Postgres` and
`251 tables` returns only the deliberate historical mentions.

## 2026-11-13 - `/settings/documents`: logo only, company signature image removed from the UI

Status: **implemented and verified in the browser**.

The company signature image is not edited on the documents settings page any
more: signatures get their own module (ERP-0048 / ERP-0049). The page keeps the
letterhead logo and the `document` settings card.

- `routes/_authed/settings/documents/index.tsx`: one `DocumentImageField`
  (`/company/profile/logo`), not the `['logo','signature']` loop; the grid
  became a single column; `signatureUrl` is no longer read there.
- Locales: `companyProfile.section.images` is now "Logo" / "Logo" and
  `companyProfile.imagesHint` describes the letterhead only.
  `companyProfile.image.signature` was deleted from both bundles (dead key).
  `section.images` and `image.logo` were added to `ALLOWED_IDENTICAL` ("Logo"
  is the same word in Indonesian); the parity test caught this.
- Deliberately unchanged: `PUT`/`DELETE /company/profile/signature` still exist,
  `company.profiles.signature_object_key` stays in the schema and `docs.dbml`,
  and `quotation-document.tsx`, `purchase-order-document.tsx` and
  `warranty-document.tsx` still render `profile.signatureUrl`. Removing the
  endpoint would have stopped an already-stored signature from printing.
  No migration; `validate-dbml.ts` unchanged.

Consequence: a company signature can no longer be uploaded from any UI. An
existing image keeps printing; a fresh install prints documents without one
until the signature module fills it.

Verification (2026-11-13):
- `bun test` (packages/locales): 86 pass, 0 fail — after the first run failed on
  the identical "Logo" values, which the parity guard is meant to catch.
- `bun test` (web-admin): 70 pass. `bun test` (backend): 872 pass.
- web-admin `bun run build`: exit 0. `bun run lint` (root): 0 errors.
- Browser `/settings/documents`: two cards — "Logo / Printed in the letterhead
  of every document. / Letterhead logo" with exactly one file input, and
  "Document settings" ("No document settings yet"). No "Signature and stamp".
- Note: a plain `bun test` from the repo root runs the backend integration
  suites without their env and reports ZodError failures (missing `app.name`,
  `app.id`, `app.secret`, `database`). Pre-existing; run the backend and
  web-admin suites from their own workspaces.

## 2026-11-13 - ERP-0045c: Settings section, company form cut, profile patch

Status: **implemented**, browser check pending at the time of writing.

Scope moved from the sidebar request plus a follow-up decision to strip the
document-related blocks off the company page.

- Sidebar: new `section.settings` ("Settings" / "Pengaturan") placed **after**
  Administration, with Company (`/settings/company`), Code numbering
  (`/settings/code-numbers`) and Document (`/settings/documents`). Both items
  left Administration (`nav-config.ts`).
- Routes: `routes/_authed/settings/{company,code-numbers,documents}/index.tsx`.
  `/admin/company` and `/admin/code-numbers` became redirect-only routes, so old
  bookmarks keep working (`routeTree.gen.ts` regenerated by the router plugin).
  `build-crumbs.ts` labels the three `/settings/*` paths.
- Company form (`company-profile-form.tsx`) now renders **identity + contact
  only**. Removed from the page: Signatory, Bank accounts, Default terms,
  Warranty certificate, and (from the route) the Logo and signature card.
  `documentCode` is relabelled **Company code** / **Kode perusahaan**; its hint
  ("Used by document numbers ({COMPANY})") is unchanged.
- Why the backend had to change: `PUT /company/profile` used to require the
  whole body and overwrite every column. With those blocks off the page, the
  next save would have blanked signatory, banks, terms and warranty, which are
  still printed on quotations, invoices, purchase orders and warranty
  certificates. The route now parses `companyProfilePatchSchema`
  (`companyProfileSchema.partial()`) and the service merges the patch over the
  stored profile, so an omitted field keeps its value and an explicit `null`
  clears it. `legalName` and `documentCode` are still required in the merged
  result (`CompanyProfileRequiredError` when missing on an empty profile).
- `/settings/documents` carries the logo and signature upload (moved, not
  dropped) plus `CompanySettingsCard` filtered to `groups={['document']}`.
  `/settings/company` filters that group out (`excludeGroups`). The card gained
  `excludeGroups`, `groups`, `title`, `description`, `emptyText` props.
  The only `document.*` key in the design is
  `document.signature_request_expiry_days` (ERP-0048); the card edits settings,
  it does not create them, so the list is empty until ERP-0048 writes the row.
- Locales: `nav:section.settings`, `nav:item.documentSettings`,
  `settings:document.*`; `companyProfile.documentCode` retitled; 21 dead
  `companyProfile.*` keys removed (signatory, banks, terms, warranty). The
  parity exemption for `settings:companyProfile.bankName` went with it.

Verification (2026-11-13):
- `bun test test/unit/company.service.test.ts` (backend): 19 pass, 0 fail
  (4 new partial-update tests: omitted field keeps its value, explicit `null`
  clears, empty profile without `legalName`/`documentCode` rejected, patch
  schema normalises the company code).
- `bun test` (backend): 872 pass, 0 fail. `bun test` (web-admin): 70 pass.
  `bun test` (packages/locales): 86 pass.
- web-admin `bun run build`: exit 0. `bun run lint` (root): 0 errors.
- Browser (logged in as admin), after restarting both dev servers because the
  locale keys changed:
  - `/settings/company`: renders identity + contact only; "Company code" present,
    "Signatory", "Bank accounts", "Default terms", "Warranty certificate" and
    "Logo and signature" absent; the Settings card still lists
    `invoice / due_days / Number / 14`.
  - Saving only the tagline kept the other fields: before and after,
    `GET /company/profile` still returned `signatoryName: "Budi Santoso"` and
    `bankAccounts.vat.bankName: "Bank Central Asia"`; the tagline changed. This
    is the patch behaviour that matters, since the form no longer sends those
    fields.
  - `/settings/documents`: logo + signature upload cards and the `document`
    settings card ("No document settings yet") render.
  - `/admin/company` redirects to `/settings/company`; `/admin/code-numbers`
    redirects to `/settings/code-numbers`.
  - Sidebar order confirmed: Administration (Organization, Users, Audit Log)
    then Settings (Company, Code numbering, Document).
- Browser reading note: `document.body.innerText` came back empty on these
  pages while `textContent` was fine; use `textContent` for assertions there.

Known consequences:
- Signatory, bank accounts, default terms and warranty texts can no longer be
  edited from any UI, but their stored values are preserved and still printed.
  A fresh install has no way to set them; that gap is intentional per the
  request and would need a follow-up page if the documents are still wanted.
- Logo and signature upload still works (now under `/settings/documents`); the
  backend endpoints are unchanged.

## 2026-11-13 - ERP-0045: company settings KV CRUD

Status: **implemented** (uncommitted at time of writing). Scope narrowed from the
backlog text: `company.settings` only. `organization.settings` is split out as
**ERP-0045b** and not built.

- Contract: `COMPANY_SETTING_VALUE_TYPES` (string/number/boolean/json/date),
  `companySettingParamsSchema` (group/key = `^[a-z][a-z0-9_]{0,63}$`),
  `companySettingInputSchema` (`valueType` + nullable `value`, max 4000),
  `TCompanySettingView`.
- Repository: `findSettings()`, `findSetting(group, key)`, `upsertSetting(...)`.
  The upsert is a single `insert … onConflictDoUpdate` against the live
  `(setting_group, setting_key)` partial unique index, so two concurrent PUTs
  cannot both insert. Both reads filter `deleted_at IS NULL`.
- Service: `listSettings()`, `upsertSetting()` with `assertSettingValue` per
  `value_type` (`null` always allowed = cleared). Bad value →
  `CompanySettingInvalidError` (422, `company.settingInvalid`).
- Routes: `GET /company/settings` (`company:read`),
  `PUT /company/settings/:group/:key` (`company:update`). No delete route.
- `is_secret` decision: column stays, default `false`, reserved. The API neither
  accepts nor returns it, so there is no `hasValue` field. Recorded in
  `docs.dbml` and in the service comment.
- UI: `CompanySettingsCard` on `/admin/company` (table + Change → dialog with
  type select and value input). Empty value clears to `null`. en/id keys
  `settings:settings.*`; `settings:settings.type.` added to the dead-key
  `DYNAMIC_PREFIXES` and `settings:settings.type.json` to `ALLOWED_IDENTICAL`.
- Schema: no migration needed — `company.settings` and its constraints already
  exist from `20261113120000_erp0042_company`.

Verification (2026-11-13):
- `bun test test/unit/company.service.test.ts` (backend): 15 pass, 0 fail.
- `bun test` (backend): 868 pass, 0 fail.
- `bun test` (web-admin): 70 pass. `bun test` (packages/locales): 86 pass.
- web-admin `tsc`/build: exit 0. `bun run lint`: exit 0, 0 errors.
- Browser (`/admin/company`, logged in as admin): Settings card lists
  `invoice / due_days / Number / 14 / Change`. Change → `abc` → dialog stays open
  and the toast shows "The value does not match its type"; Change → `14` → dialog
  closes, row shows 14, `GET /company/settings` returns `value: "14"`.
- First browser attempt showed the raw key `company.settingInvalid`: the backend
  process was started before the locale key existed and `bun --watch` does not
  restart on changes under `packages/`. Restarting the backend fixed it. Note for
  future locale work: restart the backend after adding an `api` key.
- `bun docs/database/validate-dbml.ts`: OK.

Left in the local dev DB: the test setting `invoice.due_days = 14`.

Not built (ERP-0045b): `organization.settings`, per-organization scope, secret
values with `hasValue`. No feature reads `company.settings` yet.

## 2026-11-13 - sidebar: Files route, Signatures sub-items, Documents below CRM & Sales

Status: **implemented** (uncommitted at time of writing; see commit line below).
Supersedes the sidebar entry further down for the Documents section.

- Section order: Dashboard → CRM & Sales → Documents → Subscription ….
- Documents section: Files (`/documents/files`, the registry moved from
  `/documents`), Signatures (parent, no URL) with three sub-items, Templates
  (`/documents/templates`, flat, placeholder until ERP-0050).
- Signatures sub-items, all `ComingSoonPage` placeholders until ERP-0048 / ERP-0049:
  Document Signature (`/documents/signatures/documents`), Request Signature
  (`/documents/signatures/request`), My Signature (`/documents/signatures/mine`).
- `/documents` redirects to `/documents/files` (`routes/_authed/documents/index.tsx`).
- Registry detail moved to `/documents/files/$documentId`; back link and breadcrumb updated.
- Locales en/id: `item.files` (Files / Berkas), `item.documentSignatures`,
  `item.requestSignature`, `item.mySignature`, `breadcrumb.documentDetail`.
  `item.documents` removed (no longer used).
- Status label "Rejected" / "Ditolak" for `declined` is a UI copy decision for
  ERP-0048; not added yet because the page is a placeholder.

Verification (2026-11-13):
- `bun run build` (web-admin): exit 0 after dropping an unused `Send` import
  (first build failed with TS6133). `routeTree.gen.ts` regenerated.
- `bun test` (web-admin): 70 pass, 0 fail.
- `bun test` (packages/locales): 86 pass, 0 fail.
- `bun run lint` (web-admin): exit 0, 0 errors.
- Browser: sidebar order Dashboard, CRM & Sales, Documents (Files, Signatures
  with Document Signature / Request Signature / My Signature, Templates).
  `/documents` lands on `/documents/files`. `/documents/files` breadcrumb
  `Home > Documents > Files`. `/documents/signatures/request` breadcrumb
  `Home > Documents > Signatures > Request Signature` with Coming soon.

Not verified: `/documents/files/$documentId` in the browser after the move;
the other two signature placeholders in the browser; non-admin visibility.

## 2026-11-13 - sidebar: Documents / Signatures / Templates, Administration order (superseded for Documents)

Status: **implemented** (commit `7b1f699`, local branch only, not pushed). No
backlog ID claimed: the sidebar split is a UI follow-up to ERP-0042, not a
backlog row.

- Documents section: Documents (`/documents`), Signatures (`/documents/signatures`),
  Templates (`/documents/templates`). Signatures and Templates are `ComingSoonPage`
  placeholders until ERP-0048 and ERP-0050.
- Administration section: Company (`/admin/company`) first, then Organizations,
  Users, Code numbering (`/admin/code-numbers`, now a top-level entry instead of a
  child of Company), Audit log.
- Labels: Company / Perusahaan, Documents / Dokumen, Signatures / Tanda tangan,
  Templates / Templat.
- Breadcrumb `LABELS` in `build-crumbs.ts` gained the two new document paths.
- Fixed ERP-0043 gap found in the browser: `numbering.type.item_product`,
  `item_material`, `item_component` had no en/id label, so the code-numbers page
  showed raw keys. Added (`Product`/`Produk`, `Material`, `Component`/`Komponen`).
  `Material` is identical in both languages, so it is in `locale-parity.test.ts`
  `ALLOWED_IDENTICAL`.

Verification (2026-11-13):
- `bun run build` (web-admin, `tsc -b && vite build`): exit 0. Regenerated
  `routeTree.gen.ts` adds only the two document routes.
- `bun test` (web-admin): 70 pass, 0 fail.
- `bun test` (packages/locales): 86 pass, 0 fail (after the `ALLOWED_IDENTICAL` entry).
- `bun run lint` (web-admin): exit 0, 0 errors (pre-existing warnings only).
- `bun test` (backend): 868 pass, 0 fail. Turbo build OK.
- Browser (localhost:5173, logged in as admin): Documents, Signatures, Templates
  listed under Documents. `/documents/signatures` renders breadcrumb
  `Home > Documents > Signatures` with Coming soon. `/admin/code-numbers` renders
  breadcrumb `Home > Admin > Code numbering` and labels Product / Material / Component.

Not verified: sidebar clicks for Organizations, Users, Audit log, and the
`adminOnly` hiding for non-admin users.

Docs: `docs/database/` unchanged (no schema change).

## 2026-11-13 - merge `main` into `refactor/company-document-numbering`

Status: **implemented** (merge commit `8a4fcd1`, local branch only, not pushed).
Browser check 2026-11-13: `/admin/company` loads with seeded data after the
local DB reset (see "Local DB reset" below). `main` brought 21 commits (organization hardening PR #82,
server-side WebP normalisation, dependabot bumps).

Resolution, by conflict:
- **Images:** `main`'s server-side WebP normalisation (`utils/image.util.ts`)
  is the storage path for every image. The client keeps its WebP encode:
  `encodeWebp` (document logo/signature, 1024px cap, WebP only) and
  `encodeImage` (`main`, WebP or PNG fallback, organization images). Both share
  `decodeImage`/`scaleToCanvas`/`toBlob`. `DOCUMENT_IMAGE_MAX_BYTES` stays 2 MB,
  the cap on the converted output.
- **Schema:** `company.*` from the branch (ERP-0042) wins. `main`'s
  `organization.company_profiles` / `company_bank_accounts` moved to
  `company.profiles` / `company.bank_accounts`. Duplicate `company.bank_accounts`
  from `main` dropped. `company.profiles` keeps `logo_object_key` with `main`'s
  WebP note; email/phone/website stay in `company.contacts` (branch decision).
- **Files removed by the branch:** 14 `organization/*company-profile*`,
  `numbering*`, `document-sequence*` files are deleted by ERP-0042 and not
  modified by `main` since the merge base (checked per file), so nothing is
  lost. The one `main` change to `company-profile.service.test.ts` (real PNG,
  `.webp` expectation) is ported into `company.service.test.ts`.
- **Backlog ID collision:** `main` used ERP-0042 for the dependabot bun config;
  the branch uses ERP-0042 for the organization split. Dependabot is renamed
  **ERP-0046**. ERP-0041 row is `main`'s text.
- **Locales:** `common.imageInvalid` / `fileInvalid` from `main`. `image.*`
  keys stay on the branch values (2 MB for converted output, 20 MB source).

Verification (2026-11-13, after resolution):
- `bunx tsc --noEmit` (backend): exit 0. One test error fixed: a stale
  `CompanyProfileService` name in `company.service.test.ts`.
- `bun test` (backend): 863 pass, 0 fail, 60 files (branch was 856).
- web-admin `bunx tsc -p tsconfig.app.json --noEmit`: exit 0; `bun test`: 70 pass.
- `packages/locales` `bun test`: 86 pass (parity, dead keys).
- `bun run lint`: exit 0, 0 errors (warnings only, pre-existing).
- `bun docs/database/gen-logical-references.ts`: 526 refs, 41 targets, no diff
  against the resolved file.
- `bun docs/database/validate-dbml.ts`: `OK` (268 tables, 231 refs, 0 cross-module, 0 timestamp gaps).
- No conflict markers left in `apps/`, `packages/`, `docs/`; `git ls-files -u` empty.

Migration order: `main` ends at `20261113090000_erp0041_org_description`, which
the branch already contains. The branch's five `20261113*` migrations are
branch-only, so there is no sort collision.

- web-admin `bunx vite build`: exit 0 (4342 modules, 2026-11-13).

Not verified: a browser walk-through of the image flows after the merge.

Local DB reset (2026-11-13, dev only, user approved): `ims_erp_local` had the
pre-ERP-0042 schema (`organization.company_profiles`, no `company`/`code_number`/
`document` schemas), so `GET /company/profile` returned 500. Backup taken with
`pg_dump` to `%TEMP%\opencode\ims_erp_local_backup_20261113_054440.sql` (11.9 MB,
47 auth users). Then `bun run drizzle:migrate-reset` in `apps/backend`, exit 0:
schemas `company`, `code_number`, `document`, `organization` present, 40 auth
users after the seed. Backend restarted; `GET /company/profile` → 401 without
session, and the logged-in `/admin/company` page renders the seeded profile.

Docs (2026-11-13): `docs.dbml` `company.profiles` note and
`module-ownership.md` Company section now say one company per application, many
organizations under it, multi-company (`company_id`) not built, subsidiaries out
of scope. No schema change. `gen-logical-references.ts`: 526 refs, 41 targets.
`validate-dbml.ts`: OK (268 tables, 231 refs, 0 cross-module, 0 timestamp gaps).
`features.md`: ERP-0042 → ERP-0046 rename for the dependabot row, carried from
the merge.

Next executable task: **ERP-0045** (settings KV CRUD) - still waiting on the five open questions.


Status: **implemented** (2026-11-13) - ERP-0044 wires the document registry
(11 outward-facing types), `document.files`, public share links and the
`/documents/$documentId` detail page. Backend 856 tests, web-admin 66, locales
86, backend + web-admin typecheck clean, lint exit 0, migration
`20261113140000` verified on a disposable database, `validate-dbml.ts` OK. Not
`verified`: no live HTTP run of the share/download routes and no browser
walk-through. Next executable task: **ERP-0045** (settings KV CRUD). See
"2026-11-13 - ERP-0044" below.

Status: **implemented** (2026-11-13) - ERP-0043 gives the item master a
generated `code` per kind (`PRD-`/`MAT-`/`CMP-`), adds
`inventory.items.serial_number`, and keeps `sku` manual. Not `verified`: no
browser walk-through of the item form/list.

Status: **implemented** (2026-11-13) - ERP-0042 split `organization` into
three modules with their own Postgres schemas (`company`, `document`,
`code_number`) and the UI/nav/locale changes that follow. Backend 844 tests,
web-admin 62, locales 86, typecheck clean, migrations + seeders verified on a
disposable database, `validate-dbml.ts` OK. Not `verified` yet: no browser
walk-through of `/admin/company`, `/admin/code-numbers` or `/documents`, and no
reviewer sign-off. ERP-0043 (item codes per kind) landed afterwards - see the
next entry.

## 2026-11-13 - ERP-0044 document registry, files, public shares

Design answers (from the 2026-11-13 design session): share token is its own
uuid column, never the row id; expiry mandatory (default 30 days, cap 365);
registry rows are written when a business document becomes outward-facing;
file uploads are PDF/PNG/JPG/WebP up to 10 MB under a fresh key per upload.

**Registry wiring (S2).** `DocumentService.register(input, tx?)` inserts an
`issued` row without allocating; `issue` allocates then inserts. `voidBySource`
voids registry copies when a business document dies. Nine owning services call
it: quotation, sales order, delivery note, invoice (incl. receipts), purchase
order, goods receipt, handover/BAST, warranty, service ticket, licensing. Unit
tests updated with register/void doubles and assertions.

**Files (S3).** `document.files` upload, list, soft delete, presigned download
(300 s) writing `access_logs` with ip/user-agent. `providers/s3/document-file.ts`
holds the rule set. `DocumentService.uploadFile` refuses void documents.

**Shares (S4).** `document.shares.token` (uuid) via append-only migration
`20261113140000_erp0044_document_share_token` (`shares_token_uq` partial unique,
`shares_token_live_idx`). `createShare` / `revokeShare` on
`/documents/:id/shares`. `GET /public/v1/documents/:token` (anonymous) returns
only code, type, title, issuedOn, status, files, and logs a `view` row with no
user. Expired, revoked or void-document links answer 404.

**Web-admin.** `/documents/$documentId` with files (upload, download, delete),
share links (create, copy, revoke) and access trail. Registry list rows link
to it. `routeTree.gen.ts` regenerated via `bunx vite build`. Locales en+id:
`documents.*` keys, `api.ts` `document.fileNotFound` / `shareNotFound` /
`fileNotAllowed` and `common.fileInvalid`.

**Schema docs.** `docs/database/docs.dbml`: `document.shares.token` plus
`shares_token_uq` / `shares_token_live_idx`.
`gen-logical-references.ts` -> 526 refs across 41 targets; `validate-dbml.ts`
-> `parsed: 268 tables, 231 refs`, `cross-module refs: 0`, `timestamp gaps: 0`,
`OK`.

**Commands and outcomes.**
- `bunx tsc --noEmit` (apps/backend): clean (after locale keys added).
- `bun test` (apps/backend): 856 pass, 0 fail, 59 files (12 new in
  `test/unit/document.service.test.ts`).
- `bunx tsc -p tsconfig.app.json --noEmit` (apps/web-admin): clean.
- `bun run test` (apps/web-admin): 66 pass.
- `bun run test` (packages/locales): 86 pass after adding
  `documents:action.` to `DYNAMIC_PREFIXES` (the trail label key is composed
  from the server's action value).
- `bun run lint` (packages/locales and apps/backend): exit 0; backend warnings
  are pre-existing.
- `bunx vite build` (apps/web-admin): built; route tree regenerated.
- `psql -v ON_ERROR_STOP=1` on `verify_s6` for `20261113140000`: applies, and a
  second run is idempotent (notices only).

**Not done / open.** No live HTTP check of upload, download, share or public
routes; no browser walk-through of `/documents/$documentId`. The 11 registry
types are wired in code and unit-tested per owning service, not against a live
database. Changes are uncommitted in `B:\ims\erp-company`.

## 2026-11-13 - ERP-0043 item codes per kind

User decision: item `code` is **newly generated** per tenant (option 2), not
backfilled from `sku`. Assets needed no change - `AssetService.create` already
allocates `AST-` through the numbering authority, and adding a `sku` column with
no consumer would be dead code.

**Schema (canonical first).** `docs/database/docs.dbml`: `inventory.items` gained
`code varchar(32) [not null]` and `serial_number text`, the `sku` note now says
user-typed/immutable, the table note records ERP-0043, and the index block gained
the ADR-0008 pair `inventory_items_org_code_uq` / `inventory_items_global_code_uq`.
`code_number.series`' note records the three new types.
`bun docs/database/validate-dbml.ts` -> `parsed: 268 tables, 231 refs`,
`cross-module refs: 0`, `timestamp gaps: 0`, `OK`.

**Code.** `CODE_TYPES` += `item_product`/`item_material`/`item_component`;
`CODE_TYPE_CODES` `PRD`/`MAT`/`CMP`; `CODE_TYPE_MODULES` -> `inventory`;
patterns `{TYPE}-{SEQ:5}` with `reset: 'never'`. `ItemService` injects
`CODE_NUMBER_SERVICE_TOKEN` (`Pick<CodeNumberService, 'next'>`), maps kind ->
code type through `itemCodeType()` (narrowing helper, because `itemKind` arrives
as plain `text` from the insert type), allocates before the insert and audits
`code` in the meta. `IItemRepository.create(data, code)` keeps `code` out of
`TItemCreateData`/`TItemUpdateData`, so the type system enforces immutability.
`createItemSchema`/`updateItemSchema` gained `serialNumber`; `.strict()` rejects
a client-sent `code`.

**Migration** `20261113130000_erp0043_item_codes` (hand-written, append-only):
adds both columns, backfills `code` deterministically per kind with
`ROW_NUMBER() OVER (PARTITION BY item_kind ORDER BY created_at, id)`, sets
`NOT NULL`, creates the two partial unique indexes, and inserts the three
`code_number.series` rows at `used + 1` guarded by `NOT EXISTS`. The backfill is
explicitly a **synthetic** value for pre-existing rows, not a rename of `sku`.

**Seeder.** `SEED_ITEMS` entries carry a deterministic `code`
(`PRD-00001`..`CMP-00004`) alongside the `ITEM-###` SKU anchors, so idempotency
and the `ITEM-005`/`ITEM-009` opening-stock anchors are untouched; a new
`ensureItemCodeSeries()` pushes the three series to `seeded + 1` with
`GREATEST(...)` so the first API-created item continues instead of colliding.

**Web admin.** `TItem`/`TItemCreateInput` gained `code`/`serialNumber`; the item
form shows `code` read-only when editing and a serial-number input; the kind list
gained a Code column; the detail header renders `code · sku`. Locale keys
`inventory:items.code`, `items.codeAutoHint`, `items.serialNumber` in **en + id**.

**Verification (this worktree).**
- `psql` against a fresh disposable DB `verify_s6`: all **53** migrations applied
  in folder order with `ON_ERROR_STOP=1`, 0 failures (drizzle-kit migrate is
  still unusable on this branch - conflicting hand-written migrations).
- Seeders run twice: 12 items, 4 stock movements, series `next_number` 5 before
  and after the second run - 0 new rows.
- Backfill re-run proof: nulled every `code`, re-executed the migration SQL - the
  same deterministic codes came back, and the series counters did not move
  (`NOT EXISTS` guard).
- `apps/backend`: `bunx tsc --noEmit` clean; `bun test` **844 pass / 0 fail**
  (updated `item.service.test.ts` double for the numbering port and `create(code)`,
  `inventory-authorization.test.ts` registers a numbering double,
  `code-number.service.test.ts` asserts `CODE_TYPES.length` and the `item_product`
  default instead of a hardcoded 29).
- `apps/web-admin`: `bunx tsc -p tsconfig.app.json --noEmit` clean, `bun test`
  62 pass, `bun run lint` warnings only.
- `packages/locales`: `bun test` 86 pass. Root `bun run lint` 5/5.
- `docs/database/` reviewed and updated (table + index + series note).

**Deliberately not done:** no browser walk-through of the item form/list, and no
backfill of `code` into any other module's snapshot columns (nothing references
an item code yet).


Status: **verified** (2026-11-13) — live walk-through done: upload via the
edit page renders the WebP from MinIO, and the `/organizations` list renders
every card logo from a presigned URL; create page has the image picker only
(nested users removed 2026-11-12); detail page no longer hosts the card.
Object key is `organizations/<organizationId>/logo.webp` (plural, matching
`users/<id>/avatar.webp`). The server, not the user, owns image format: every
stored image (org logo, generated DiceBear logo/avatar, user avatar, document
images) is WebP produced by `toWebp` from PNG/JPG/WebP/GIF/BMP/TIFF/HEIC/AVIF
input (2026-11-13, below).

Image card placement fix (same day, user feedback): the profile-image card
moved from the org **detail** page to the **edit** page, and the create page
gained an optional image picker (file is client-encoded WebP and uploaded
right after the org exists, since the endpoints are id-scoped).
Verified live in the browser (dev servers already running): logged in as the
seed admin, POSTed a canvas-encoded WebP to
`/organizations/:id/image-profile` → 200 `imageKey: organizations/<id>/logo.webp`,
GET returned a MinIO presigned URL, and the edit page rendered the image
(72px preview, Replace/Delete buttons). `docs/plan/backlog.md` ERP-0041 →
**verified**.

## 2026-11-13 - ERP-0042: `organization` split into `company` / `document` / `code_number`

User request: the company profile, the document registry and the numbering
authority were all living in `organization` (one module, one Postgres schema,
`organization.company_settings` and `organization.document_sequences`). They are
different things with different owners, so each got its own module and its own
schema. Design settled over three grilled rounds (Q1-Q24) before any code;
answers recorded in `docs/plan/plans/features.md` and `docs/database/docs.dbml`.

**Persistence (`docs.dbml` first, then Drizzle, then migration).**

- New schemas with stutter-free table names: `company.profiles`,
  `company.head_office_addresses`, `company.contacts`,
  `company.bank_accounts`, `company.settings`; `code_number.series`;
  `document.templates`, `document.documents`, `document.files`,
  `document.signatures`, `document.access_logs`, `document.shares`,
  `document.tags`, `document.tag_links`.
- `organization.company_settings` never existed in Drizzle (docs only), so no
  data migration was needed; it split into `company.settings` (company-wide)
  and `organization.settings` (per organization), both created/dropped in the
  same migration.
- `organization.document_sequences` is a **verbatim** rename to
  `code_number.series` (column `document_type` → `code_type`), so existing
  counters survive. The vocabulary grew from 28 to 29 code types: `warehouse`
  was added so a warehouse code can be allocated (`WH-{SEQ:4}`).
- Three append-only migrations, each standalone: `20261113120000_erp0042_company_schema`,
  `20261113120100_erp0042_code_number_schema`, `20261113120200_erp0042_document_schema`.
- `document.documents.organization_id` is nullable (NULL = company-wide).

**Backend modules.** `src/app/company`, `src/app/code-number`,
`src/app/document`, each with the standard module shape. Published contracts:
`CompanyService.getProfile(tx?)`, `CodeNumberService.next(codeType, {date,
context, tx})`, `DocumentService.issue(...)`. `NUMBERING_SERVICE_TOKEN` is gone
with no alias - every import site moved to `CODE_NUMBER_SERVICE_TOKEN` (CRM
website-inquiry references, warehouse code allocation, asset operations, tests).
`WarehouseService` now injects the code-number service and `createWarehouseSchema.code`
is nullish, so an omitted code allocates one; existing codes are unchanged and
entity codes stay immutable after create. `organization` shrank to its settings
table, guard and slug resolver.

**Permissions.** `company_setting:*` removed from `erpStatements`;
`company: [read, update]`, `code_number: [read, update]` and `document: [read,
create, update, submit, approve, issue, void, download]` added. Owner/admin get
full, auditor read-only, and every role that had `document` keeps it.
`packages/common` rebuilt (`bun run build`) before the backend typecheck.

**API.** `/company-profile` → `/company/profile`, `/document-numbering` →
`/code-numbers`; no aliases kept (nothing outside this repo consumes them).

**UI.** `/admin/settings` and `/admin/settings/numbering` deleted with no
redirect; replaced by `/admin/company` and `/admin/code-numbers`. New top-level
`/documents` registry page (`lib/documents-api.ts`, list/search/status filter +
void). `lib/company-settings-api.ts` → `lib/company-api.ts` (`/company/profile`,
`/code-numbers`, `TCodeNumberSetting`, `CODE_TYPES`). `nav-config.ts`,
`build-crumbs.ts` and every print/document component repointed.
`routeTree.gen.ts` regenerated by `bunx vite build` (`bunx tsr generate` crashes
in this repo with `Cannot read properties of undefined (reading 'readFile')`).

**Locales.** New `documents` namespace (`en` + `id`, registered in both
`index.ts`, `NAMESPACES` and `i18next.d.ts`); `settings.numbering.*` reworded
from "document type" to "code type" plus six new type labels; `nav` gained
`section.documents`/`item.documents` and lost `item.settings`/
`item.documentNumbering` in favour of `item.codeNumbers`; `common.action.search`
added; `api` keys `company.profileRequired` / `numbering.unknownCodeType` /
`document.notFound` / `document.notVoidable` replace the old
`organization.companyProfileRequired` / `numbering.unknownDocumentType`.
`settings:numbering.type.sales_invoice` and `documents:status` were added to
`ALLOWED_IDENTICAL` (both words are already Indonesian).

**Verification (this worktree, `B:\ims\erp-company`).**

- `bunx --bun drizzle-kit migrate` is unusable on this branch: it aborts with
  "Conflicting migrations detected" across the 52 hand-written migrations (no
  drizzle journal). Migrations were verified instead by piping each
  `migration.sql` through `psql -v ON_ERROR_STOP=1` in folder order against a
  disposable database `ims_erp_erp0042_scratch`: **52 applied, 0 failed**, then
  `information_schema` confirmed `company.*` (5), `code_number.series`,
  `document.*` (8) and `organization.settings`.
- Seeders: `runSeeders()` twice on the same disposable DB - second run added 0
  rows; `company.profiles` 1, `company.contacts` 3,
  `company.head_office_addresses` 1, `company.bank_accounts` 2,
  `code_number.series` 1 (`employee`, next 30). New `company.seeder.ts` runs
  first and is skipped in production. Scratch DB dropped, scratch scripts
  deleted.
- `apps/backend`: `bunx tsc --noEmit` clean; `bun test` **844 pass / 0 fail**;
  `bun run lint` warnings only (pre-existing). Tests renamed:
  `test/unit/numbering.service.test.ts` → `code-number.service.test.ts`,
  `company-profile.service.test.ts` → `company.service.test.ts`; new
  `CodeNumberServiceDouble` in `test/helpers/numbering-double.ts`.
- `apps/web-admin`: `bunx tsc -p tsconfig.app.json --noEmit` clean, `bun test`
  62 pass, `bunx vite build` succeeds (regenerates `routeTree.gen.ts`),
  `bun run lint` warnings only.
- `packages/locales`: `bun test` 86 pass (parity + dead-key guards).
- Root `bun run typecheck` 4/4, `bun run lint` 5/5, `bun run test` 5/5.
  Note: `apps/web-admin` and `packages/common` have no `typecheck` script, so
  the root task does not cover them; both were checked directly.
- `bun docs/database/validate-dbml.ts` → `parsed: 268 tables, 231 refs`,
  `cross-module refs: 0`, `timestamp gaps: 0`, `OK`;
  `gen-logical-references.ts` re-run (526 refs).

**Deliberately not done:** PDF rendering of `document.documents` (explicitly out
of scope), item/asset code generation per kind (deferred here, landed as
ERP-0043 - see above), and no browser walk-through of the moved pages yet.

## 2026-11-13 - Images: the server normalises every upload and generated image

User request: stop asking people to convert images to WebP by hand — the web
admin converts on upload when it can, the backend converts always.

- **New `apps/backend/src/utils/image.util.ts`** (zero new dependencies):
  `sniffImageType` (magic bytes → png/jpeg/webp/gif/bmp/tiff/heic/avif),
  `toWebp(bytes, { maxSize, quality })` and `fileBytes`. `toWebp` decodes with
  Bun's built-in `Bun.Image` (verified on Bun 1.4.4: decodes JPEG/PNG/WebP/GIF/
  BMP/TIFF/HEIC/AVIF and emits `RIFF…WEBP`), downscales the longest side and
  re-encodes — which also strips EXIF/GPS and any appended payload. Undecodable
  bytes throw `UnsupportedImageError`.
- **The server is the format authority now:** `OrganizationService.setImage`,
  `UserService.setSelfAvatar` (`users/<id>/avatar-custom.webp`, 144px),
  `storeDocumentImage` (`<prefix>/<uuid>.webp`) and both DiceBear workers
  (`org-logo` 256px, `avatar` 72px) pass bytes through `toWebp`. Deleted:
  `isWebpBuffer`, the org `isSupportedImage` helper and the hand-rolled
  `AVATAR_TYPE_TO_EXT`/`AVATAR_MAGIC_BYTES`/`sniffAvatarType` table. The 2 MB
  upload cap is unchanged. `IObjectStorage.put` accepts `Blob | Uint8Array` so
  normalised bytes are written without a `Blob` copy. Old rows keep working:
  the DB stores object keys, so `avatar-custom.png` / `<uuid>.png` stay valid.
- **Web admin:** `encodeWebp` (organization-api) and `compressAvatar`
  (user-api) collapsed into one `encodeImage` in `lib/image-file.ts` —
  downscales to 512px, returns WebP when the browser can encode it and PNG
  otherwise, and decodes through `<img>` when `createImageBitmap` rejects the
  format. Call sites: org create, org edit, org image card, profile avatar,
  document images. `uploadOrganizationImage` names the part from the blob type.
  Profile/document pickers accept the formats the backend decodes.
- **Locales (`en` + `id`):** `common.imageInvalid`, `user.avatarUnsupportedType`,
  `profile.avatarInvalidType`, `profile.avatarHint`, `common.image.hint`,
  `common.image.tooLarge`, `orgImage.description`, `orgImage.decodeFailed`.
- **Bug found by the live check:** `POST /users/me/avatar` returned
  `500 Body already used` — the handler called `request.formData()` after
  Elysia had already parsed the multipart body. It now reads the parsed `body`
  (`avatarFileFrom`), like every other upload route.

Verification:

- `bun test` backend **849 pass / 0 fail** (new `test/unit/image.util.test.ts`,
  9 tests: sniffing incl. ISO-BMFF brands, PNG/JPEG→WebP, WebP re-encode,
  size ceiling, garbage bytes; `organization-create-nested.test.ts` and
  `company-profile.service.test.ts` updated for WebP keys and decode-time
  format rejection), web-admin **66 pass** (new
  `test/unit/encode-image.test.ts`: WebP path, PNG fallback, `<img>` decode
  fallback, nothing-encodable), `packages/locales` **82 pass**.
- `bunx tsc -b --noEmit` clean in `apps/backend`, `apps/web-admin`,
  `packages/locales`; `bun run lint` shows only the pre-existing warnings.
- Live (dev servers, seed admin, `bun run --watch` picked the change up):
  PNG 900×600 → org `image-profile` 200, stored key
  `organizations/<id>/logo.webp`, fetched bytes `RIFF/WEBP`, 512×341;
  JPEG 800×800 → `/users/me/avatar` 200 → `users/<id>/avatar-custom.webp`,
  144×144; PNG 640×400 → `PUT /company-profile/logo` 200 →
  `company/logo/<uuid>.webp`, 512×320; the same PNGs dropped into the edit
  page and the profile page preview from the presigned URL. Rejections:
  PDF bytes to the org image → 422 `common.imageInvalid`; garbage bytes to the
  avatar → 415; 2 MB + 10 bytes → 413.
- `docs/database/` reviewed: one note changed (no table/column/index/constraint)
  — `company_profile.logo_object_key` now documents the WebP normalisation.
  `bun docs/database/gen-logical-references.ts` regenerated 533 refs;
  `bun docs/database/validate-dbml.ts` → `OK: 0 cross-module refs, 0 timestamp
  gaps`. That validator had been failing on `main` with a `hr.bank_accounts`
  vs `company.bank_accounts` bare-name duplicate; both tables are real and
  always schema-qualified, so `bank_accounts` joined `DUP_ALLOWED` with a note.

## 2026-11-13 - Organization description field (create / detail / edit)

User request: the create page should lead with the logo and offer a free-text
description. Implemented as a new nullable column rather than metadata, so it
is queryable and shown on detail.

- `docs/database/docs.dbml` + `auth.schema.ts`: `auth.organizations.description
  text` (no DB length limit; the 2000-char cap is a zod boundary rule so
  widening it needs no migration). Migration
  `20261113090000_erp0041_org_description` is hand-written append-only (same
  convention as `20261112120000` / `20261112150000` — the repo carries no
  drizzle-kit journal).
- Better Auth: `additionalFields.description` added, and the plugin options
  changed from `: OrganizationOptions` to `satisfies OrganizationOptions` —
  the widened annotation erased `additionalFields` from the inferred API
  types, so `description` was rejected in create/update bodies. The adapter
  strips `description` before calling Better Auth and re-adds it (Better Auth
  forbids `null` in the inferred input for an additional `string`, while
  clearing the field is exactly a NULL write).
- zod: `trim().max(2000).transform(v => v.length ? v : null).nullish()`, so
  whitespace-only becomes `null`; `updateOrganizationSchema` counts
  `description` as a provided field.
- Web admin: create page logo is centered at 128px **above** the fields and a
  description textarea sits between Name and Slug; edit page has the same
  textarea (empty string clears); the info dashboard renders the value with
  `whitespace-pre-line` and `-` when unset. Locales added to `en` and `id`
  (`orgs.descriptionLabel`, `orgs.descriptionPlaceholder`,
  `orgDetail.description`).

**Cache bug found by the live check:** PATCH `/organizations/:id` returned the
pre-update row and the detail page kept showing the old description. Cause:
`findById` is cache-aside (5-min TTL) and profile updates go through Better
Auth, which writes the row directly — the repository never sees the write, so
nothing evicted the entry (`setLogo`/`softDelete`/`restore` only). Fixed by
exposing `invalidateCache(id)` on the repository and calling it from
`OrganizationService.updateOrganization` after the gateway write. The bug
predates this slice and also affected `name` updates.

Verification:

- `bunx tsc -b --noEmit` clean in `apps/backend` and `apps/web-admin`;
  `bun run test` backend **842 pass** (17 in
  `test/unit/organization-create-nested.test.ts`, including the new
  "update forwards description and evicts the cached row"), web-admin **62
  pass**, `packages/locales` **82 pass**; `bun run lint` no new warnings.
- Migration applied to disposable DB `ims_erp41_desc` via a one-off runner
  (`migrate-reset` + apply + `drizzle:seed` twice, idempotent); column
  `description text` present; database dropped afterwards.
- `bun docs/database/gen-logical-references.ts` + `validate-dbml.ts` →
  `OK: 0 cross-module refs, 0 timestamp gaps`.
- Live (dev servers): create form order Name → Description → Slug with a
  centered 128×128 dropzone above Name; submitted `Description Check` with a
  dropped PNG logo and a two-line description → detail page rendered both
  lines; edit page saved a new value and the detail page reflected it
  (PATCH 200 + fresh GET); the seed org without a description rendered `-`.
  Test org soft-deleted afterwards.

## 2026-11-13 - `/organizations` list: breakpoint and header layout fix

Cards were cramped: `lg:grid-cols-4` at a 1074px viewport gave **180px** cards
(3-up is 246px), too narrow for the 40px logo, the three stat columns and the
badge + `Restore` footer. The grid is now `1 / sm:2 / lg:3 / 2xl:4` — a fourth
column only appears at 1536px where it actually fits.

The page header stacked badly too: `flex items-center justify-between` with no
`flex-wrap` squeezed the title/description against the `New organization`
button on narrow widths. Now `flex-col gap-3` until `sm`, then
`sm:flex-row sm:items-start sm:justify-between`, with `min-w-0` on the text block
and `shrink-0` on the button.

Verified live at 1074px: three columns of 246px, no footer or stat-row clipping
on any card (`scrollWidth <= clientWidth`).

**Card footer height.** An active organization's footer held only the `Active`
badge (20px) while a deleted one also carried the `Restore` button (28px), so
the two footer heights differed (53px vs 61px) and the badges in one grid row
sat 4px apart. The badge is now wrapped in a `flex h-7 items-center` row pinned
to the small-button height, so every footer is 61px and every badge is 21px from
the footer's top edge (verified on all four cards).

## 2026-11-13 - `/organizations` list: logos presigned server-side

The list cards were broken because `GET /organizations` returned the stored
**object key** (`organizations/<id>/logo.webp`) where the UI expects a URL — the
browser cannot sign a SigV4 GET, so every thumbnail was a broken image while the
detail page (which presigns through `GET …/image-profile`) worked.

- `OrganizationService.listOrganizations` now presigns `logo` per row
  (`row.logo ? presignObjectUrl(row.logo) : null`), matching `listMembers`,
  which already presigns member avatars. `TOrganization.logo` is documented as
  a presigned URL on list responses.
- `apps/web-admin/src/routes/_authed/organizations/index.tsx` gained
  `OrganizationLogo`: a load error falls back to the name initial instead of a
  broken-image icon (a signed URL still expires on a long-lived tab), plus
  `loading='lazy'`/`decoding='async'` and `min-w-0` so long names truncate.

Verified live (dev servers, seed admin): all four cards render
`https://minio-s3.okifirsyah.my.id/ims-erp-local/organizations/<id>/logo.webp?X-Amz-Signature=…`
with `naturalWidth > 0`; the seed org's image is 100×100, uploads 512×320.
New unit test asserts the presign (raw key would fail the match) and that a
`null` logo stays `null`: backend **839 pass / 0 fail**, web-admin **62 pass**,
`tsc -b --noEmit` clean in both workspaces.

`docs/database/` was reviewed and is unchanged: the fix is a read-path
transformation (key → presigned URL), no table, column, index, constraint,
logical reference, or status vocabulary moved.

Known limitation (pre-existing, not fixed here): `GET /organizations` sits
behind `erpGuard`, so it 403s when the session has no active organization —
which is exactly the state after deleting the active organization
(`deleteOrganization` calls `setActive(null)`). The list page then shows
"No organizations yet" although rows exist; a re-login re-activates the first
membership (`sessionAutoActivateOrganizationHook`) and heals it. Making the
admin list session-scoped instead of organization-scoped needs a decision
because the same endpoint also serves the org switcher, the invite dialog, and
the warehouse-organization tab.

## 2026-11-12 - Create-org page: invitations dropped, single-card layout, robust image input

User decision: **no user/invite section on organization creation.** The page is
now name + slug + logo only; the nested-users block (`NewUserRow`, `addUser`,
`patchUser`, duplicate-email banner, `users` in the POST payload) is gone.
`POST /organizations` still accepts `users` — backend contract, service, and its
12 unit tests are untouched — but the UI no longer sends it, so an organization
is created empty and members are added from the detail page's invite dialog.

**Layout.** One `max-w-2xl` card, `sm:grid-cols-[8rem_1fr]`: the 32×32 logo
dropzone on the left (it is an organization attribute, not a user field), name
and slug on the right, actions in a bordered footer (`Cancel` / `Create`) instead
of stacked inline. The slug line under the input shows the resulting path and
turns into `orgs.slugInvalid` as soon as the value fails the backend regex.

**Image input hardening** (applies to the edit page too):

- `encodeWebp(file, { maxSize = 512 })` downscales the longest side — a 4000px
  photo previously re-encoded at full size and tripped the server's 2MB cap.
  Verified: a 1600×1000 source stored as **512×320, 1170 bytes**.
- `image-file.ts` gained `rejectImageFile` → `'type' | 'size'`, so the dropzone
  can distinguish "not an image" from "larger than 20MB" and the caller toasts
  the right message. Empty MIME types (Windows Explorer drags) now fall back to
  the extension.
- Drag highlight uses a depth counter: nested `dragenter`/`dragleave` from child
  elements no longer flicker the dashed border (verified: highlight survives one
  nested leave, clears on the real one).
- Dropzone got `busy` (spinner + input ignored), `focus-visible` ring, and
  `aria-busy`; the create page shows the picked file name + Remove.
- Decode failures (`createImageBitmap` rejects HEIC/corrupt bytes) show
  `orgImage.decodeFailed` instead of a raw English error.

**Real bug found by verifying the create flow: the DiceBear fallback overwrote
the uploaded logo.** The worker and the upload wrote the *same* key
(`organizations/<id>/logo.webp`); the worker's `findById` check ran before the
upload landed, so its DiceBear bytes were written last — the stored image was
256×256 initials instead of the 512×320 upload. Fixed by construction:

- generated fallback moved to its own key,
  `organizations/<id>/logo-generated.webp` (`organizationGeneratedImageObjectKey`),
  so it can never clobber `logo.webp`;
- new `IOrganizationRepository.setLogoIfEmpty` does the emptiness check inside
  the `UPDATE` (`WHERE logo IS NULL`, `returning`), so a stale read cannot win;
- the worker's lost race leaves an unreferenced generated object (bucket
  lifecycle rule's job, noted in the worker comment).

Verified live (dev servers running, seed admin): drop 1600×1000 PNG on the
create page → `POST /organizations` **201** with `members: []` (no `users` in the
payload) → `POST …/image-profile` **200** →
`GET …/image-profile` presigned key `/ims-erp-local/organizations/<id>/logo.webp`
serving **512×320**; both test organizations deleted (`DELETE` → 200). Reject
path: dropping a `.txt` leaves the preview empty.

Tests: backend **838 pass / 0 fail** (new worker case asserts the generated key
and the conditional write), web-admin **62 pass** (image-file now covers
extension fallback and the 20MB cap), locales **82 pass** (parity + dead keys
after removing the six `orgs.*` user keys), `bunx tsc -b --noEmit` clean in both
workspaces, `bun run lint` no new warnings. `docs/database/` changed only as a
`logo` column note (key layout), and `validate-dbml.ts` printed `OK`.

Note: the race fix needs a **backend restart** to take effect in the long-running
dev process; the live run above still used the old worker code.

## 2026-11-12 - Org logo key pluralised + real seed-image upload (`entragate-bg-white.png`)

**Key layout changed to plural:** `organizationImageObjectKey` now returns
`organizations/<organizationId>/logo.webp` (was singular), matching the user
avatar convention `users/<id>/avatar.webp`. Callers needed no change — both
`OrganizationService.setImage` and the DiceBear `processOrgLogoJob` go through
the builder, and reads presign whatever key is stored in
`auth.organizations.logo` (nothing parses the prefix). The worker's doc comment
and the `organization-create-nested` worker fixture were updated with it. No
data migration: ERP-0041 is unreleased, so a re-upload is enough.

**Seed data fix.** `database/seeders/raw/organization/organization.json` pointed
at `./entragate.webp`, a file that no longer exists in the tree; it now points
at `./image/entragate-bg-white.png`. Note: no seeder code reads that JSON —
`organization.seeder.ts` creates Entragate through the Better Auth API and no
`image_path` consumer exists, so the value is metadata only (left in place for
whoever builds the missing uploader).

**Seed re-run + real-file upload verification** (`bun run drizzle:seed` in
`apps/backend`, 5.1s, idempotent: "Role account already exists; reusing"):

- before: `auth.organizations.logo` for org `QJlMCRUQd4SgShQVK4t4PptOI909atvX`
  still held the old singular key.
- served the seed PNG over a throwaway local static server (browser pages
  cannot read local files), fetched it in the page as a `File`
  (`image/png`, 6420 bytes) and dispatched a synthetic `drop` on
  `button[aria-label="Profile image"]` of the edit page.
- `POST /organizations/:id/image-profile` → **200**,
  `imageKey: organizations/QJlMCRUQd4SgShQVK4t4PptOI909atvX/logo.webp`.
- `GET …/image-profile` → 200, presigned URL path
  `/ims-erp-local/organizations/<id>/logo.webp`; the dropzone preview now
  renders from it (`100x100` natural, the real asset).
- DB after: `logo = organizations/QJlMCRUQd4SgShQVK4t4PptOI909atvX/logo.webp`.
- old object under the singular prefix is untouched/orphaned in the dev bucket
  (unreleased feature, no migration).

Commands: backend `bun run test` → **837 pass / 0 fail** (58 files),
`bunx tsc -b --noEmit` clean. Temporary server/check scripts deleted.

## 2026-11-12 - Org logo upload: icon dropzone with drag & drop (create + edit)

Replaced the plain "Upload image" buttons with a click-or-drag dropzone
(`apps/web-admin/src/components/organization/image-dropzone.tsx`): a `<button>`
area with an `Upload` icon, dashed border, drag-highlight state, and a hidden
`input[type=file]` shared by click and drop. The edit page
(`OrganizationImageCard`) keeps Delete for an existing logo; the create page
uses the compact variant and keeps the pick-then-upload-after-create flow.

**Real bug found while verifying: multipart upload always failed from the UI.**
`organization-api.ts`'s `request()` set `Content-Type: application/json` for any
request with a body, so `uploadOrganizationImage`'s `FormData` lost its
multipart boundary and the server answered 400
(`common.validationFailed`). It only ever "worked" earlier because that check
POSTed with a hand-written `fetch`. `request()` now skips the JSON header for
`FormData`.

Verified live (dev servers already running, seed admin):

- edit page: dragging a canvas-encoded PNG onto the dropzone fired the upload —
  `POST /organizations/:id/image-profile` → 200
  `imageKey: organizations/<id>/logo.webp`, preview then rendered from the MinIO
  presigned URL (`32x32` natural size).
- create page: dropping an image shows an object-URL preview and the file name;
  submitting created the org (`POST /organizations` → 201) and uploaded the logo
  right after (`POST …/image-profile` → 200), confirmed by
  `GET …/image-profile` returning a presigned URL. The test org was deleted
  afterwards (`DELETE /organizations/:id` → 200).

New locale keys (en + id): `orgImage.dropHint`, `orgImage.replaceHint`,
`orgImage.invalidType`; the now-unused `orgImage.upload` / `orgImage.replace`
were removed (dead-key guard green). Image type filtering lives in
`apps/web-admin/src/lib/image-file.ts` (`pickImageFile`) with 3 unit tests —
web-admin has no DOM test environment, so the rule is tested as a pure
function. Commands: `bun run test` in `apps/web-admin` (60 pass / 0 fail),
`packages/locales` (82 pass), `bunx tsc -b --noEmit` clean, `bun run lint` no
new warnings. `docs/database/` reviewed — unchanged (UI-only change).

## 2026-11-12 - ERP-0041 bulk-invitation browser walk-through (multi-role)

Walked the org-scoped invite dialog (`Add member` → `Bulk paste`) live against
the running dev stack. Findings:

1. **Dev DB was missing the `org_role` enum → text migration.** The multi-role
   row inserted the role list as two params (`technician`,`sales`) → Postgres
   rejected the insert. `information_schema.columns` showed
   `auth.user_invitations.org_role` = `USER-DEFINED` (`auth.organization_role`).
   `drizzle-kit migrate` cannot run here (pre-existing journal two-branch
   conflict), so the exact statements of
   `database/migrations/20261112150000_erp0041_org_role_text/migration.sql`
   were executed directly; re-checked: `org_role data_type: text`,
   `organization_role` enum rows: `0`.
2. **The failure survived the migration until the backend restarted.** An
   identical drizzle insert from a fresh process succeeded while the API kept
   failing: the long-lived server's prepared statements had been prepared
   against the `org_role` enum type and broke once the migration dropped it
   (`ALTER COLUMN … TYPE text` + `DROP TYPE`). Touching a watched file
   restarted the dev backend and the same request returned 201 with
   `orgRole: "technician,sales"`. Not a code defect, but a deploy-order
   hazard: apply this migration, then restart the API process.
3. **Real bug found + fixed: retried invite on a leftover employee row.**
   `hr.employees` is inserted before the personal-field write; when that later
   step fails the row stays and the retry hits `hr_employees_user_uq`
   (`duplicate key value violates unique constraint`, surfaced as a raw
   "Failed query" string). `EmployeeInviteService.createOne` now looks the
   invited user up with `employees.findByUserId` and reuses the existing row
   when it belongs to the same organization (the invitation is still
   re-sent); a row owned by another organization stays an
   `EmployeeEmailTakenError`. New unit test: *retried invite reuses the
   employee row left by an earlier partial failure*.
4. **Locale copy corrected.** The bulk-paste hint claimed an unrecognized role
   "falls back to member"; both parsers (`parseBulkInviteRows`,
   `parseInviteSheet`) instead reject that row (`Row N: unknown role "x"`)
   while still sending the rows that parsed. `invite.rowsHint` now says the
   role joins with `|` and an unknown role fails the row (en + id).

Verified after the fixes, same dialog: `walkthrough.multi@example.com` →
`orgRole: "technician,sales"`, `EMP-00033`; `walkthrough.plain@example.com` →
reused `EMP-00030`; the pending-invitations panel listed both as `pending`
with expiry. Final check after the backend restart, two fresh rows in one
bulk POST: `finalcheck.multi@example.com` → `technician,sales` / `EMP-00035`
and `finalcheck.plain@example.com` → `member` / `EMP-00036`, both `ok: true`.
Cleanup: the probe scripts (`apps/backend/.tmp/*`) and the walk-through
pending invitations were removed (deleted through the org API, all 200); the
pre-created pending users and their employee rows from the walk-through stay
in the dev database.

Commands: `bun test test/unit/employee-invite.service.test.ts` (5 pass),
`bun run test` in `apps/backend` (837 pass / 0 fail),
`packages/locales` (82 pass), `apps/web-admin` (57 pass), `bunx tsc -b --noEmit`
clean in `apps/backend` and `packages/locales`. `docs/database/` reviewed — no
schema change in this step.

## 2026-11-12 - ERP-0041 CI unblocking (three rounds, pushed to PR #82)

CI (`Main Test and Build Backend`) failed 3× with unit tests timing out at
5s; every root cause was a side effect of org/invite creation awaiting live
infrastructure CI does not have:

1. `await this.provisionRoles(...)` → seeder uses the real drizzle client
   (`POSTGRES_CONNECTION_REFUSED` retries) → `void this.provisionRoles(...)`
   (commit `41232f4`).
2. `await dispatchOrgLogoGeneration(...)` → BullMQ needs Redis → fire-and-
   forget `void dispatchOrgLogoGeneration(...).catch(...)` (commit `c197505`).
3. `InvitationService.ensureAvatar` → `await dispatchAvatarGeneration(...)`
   → Redis; plus `organizationNameFor` dynamically imports Better Auth whose
   `$context` needs Postgres → `void` dispatch + unit tests mock
   `@providers/better-auth/auth` with a throwing `$context` getter (commits
   `c197505`, `496c986`).

All three paths were already documented as best-effort ("a queue outage
never fails the invite"), so awaiting them bought nothing — marking
fire-and-forget is semantically honest, not just CI appeasement. Local
836 pass after each fix; final CI run `43216792012` success (backend +
web-admin). Lint warnings shown in CI are pre-existing, not from ERP-0041.

## 2026-11-12 - ERP-0041 frontend slice + unit tests (same day, same task)

- **Nested-users UI.** `/organizations/new` gained an "Users to add"
  repeater: per row email + name + role checkboxes (closed
  `erpRoleNames` catalog via `erpRoleLabel`); client-side duplicate-email
  guard (submit blocked + inline message); per-item outcomes
  (`failed`/`skipped`) surfaced as toasts after redirect. Locale keys
  `orgs.usersTitle/addUser/removeUser/userEmail/userName/duplicateUserEmail`
  (en+id; `orgs.userEmail` in `ALLOWED_IDENTICAL` — "Email" is legitimately
  identical).
- **Image-profile UI.** New `org-image-card.tsx` on the org detail `info`
  tab: upload (any image client-side → `encodeWebp` canvas encode, ERP-0041
  decision that the client sends WebP), replace, clear; shows the presigned
  URL refreshed per mount (`staleTime` 60s, key `['org-image', id]`).
  Locale keys `orgImage.*` (en+id).
- **Member multi-role edit.** `$organizationId.members.$memberId.edit.tsx`
  replaced the single role `Select` with the role checkbox grid, seeded from
  the comma-joined member role; saves via `updateMemberRole(orgId, memberId,
  roles)` (contract `roles: string[]`); unchanged-joined-string check keeps
  the save button honest.
- **Backend unit tests** (`test/unit/organization-create-nested.test.ts`,
  12 tests): per-item isolation (creator skip, active-user `added`, invited
  with `sendInvites:false`, one failed row does not stop the rest, zod
  duplicate-email 400); WebP magic bytes (real header accepted, spoofed
  JPEG rejected, size 0 / >2MB rejected, missing `file` rejected); worker
  skip rules (logo already set, org deleted, org missing) + DiceBear URL
  determinism (pure `orgLogoApiUrl`, no network in tests).
- Full root run: `bun run lint` 0 errors (pre-existing warnings only),
  `bun run typecheck` 4/4 tasks, tests: backend **836** pass, web-admin
  **57** pass, react-email 5 pass, locales **82** pass (parity + dead-keys
  green after the fixes above).

## 2026-11-12 - ERP-0041: org CRUD robustness (backend slices)

Status: **in-progress** — backend implemented + migration verified; frontend
slice (org create nested-users UI, image-profile upload UI, member multi-role
edit) and new unit tests for the new paths still open.

- **Schema** (`docs/database/docs.dbml` edited first — canonical):
  `auth.user_invitations.org_role` documented as comma-joined `text`
  (multi-role, ERP-0041); the Postgres enum `auth.organization_role` is
  dropped. `bun docs/database/gen-logical-references.ts` +
  `bun docs/database/validate-dbml.ts` → `OK: 265 tables, 0 cross-module
  refs, 0 timestamp gaps`. Drizzle `role.schema.ts`: `pgEnum` removed,
  `orgRole: text('org_role')`; seeder `organization-roles.seeder.ts` is now a
  shape verifier (warns when the enum type still exists, logs
  "organization role catalog verified").
- **Migration** `20261112150000_erp0041_org_role_text` (hand-written,
  append-only): guarded enum recreate (fresh DBs vs 20261107090000-applied
  DBs) → `ALTER COLUMN org_role TYPE text USING org_role::text` →
  `DROP TYPE`. **Verified** on a disposable database
  `ims_erp41_verify` (created with `bun .tmp/create-verify-db.ts`, then
  `POSTGRES_DB=ims_erp41_verify bun run database/migrate-reset.ts` — full
  migrate + seed OK, `org_role data_type: text`, `organization_role enum
  rows: 0` via `.tmp/verify-org-role.ts`), then `bun run drizzle:seed` twice
  on the same DB — idempotent, second run `created: 0` / `inserted: 0`,
  "organization role catalog verified" logged both times. Note: the
  pre-existing drizzle-kit journal two-branch conflict still blocks
  `bun run drizzle:migrate` (same situation as ERP-0034, see 2026-11-10
  entry); `migrate-reset` on the fresh DB replays the full history cleanly.
- **Multi-role invitations.** Contracts now take `organizationRoles:
  string[]` (closed enum via `organizationRoleSchema`) on all three invite
  surfaces: app scope (`user/contracts/invitation.contract.ts`), org scope
  (`organization/contracts/organization-invitation.contract.ts`), HR
  (`hr/contracts/hr.contract.ts` — hand-rolled enum literal replaced by the
  shared schema). `InvitationService.invite` dedupes preserving order,
  comma-joins, and stores the joined string; claim attaches the joined list
  through `attachMembership` (Better Auth native comma-joined
  `auth.members.role`). Email `{{role}}` interpolates the joined list
  unchanged ("sebagai admin, finance" reads fine).
- **Multi-role members.** `addMemberSchema`/`updateMemberRoleSchema` take
  `roles: string[]` (`memberRolesSchema`); `OrganizationService.addMember`
  joins, `updateMemberRole` joins and keeps the last-owner guard
  (`!input.roles.includes('owner')`); gateway `addMember`/`updateMemberRole`
  pass the joined string (cast to `'owner'` against Better Auth's inferred
  literal type — custom runtime roles are valid). Member-list role filter is
  comma-aware: `(',' || role || ',') LIKE '%,<role>,%'` (whole-entry match,
  `sales` ≠ `sales_manager`).
- **Image-profile.** `POST/GET/DELETE /organizations/:id/image-profile`
  (guard `organization:update` on write/delete, `organization:read` on
  read). Client sends WebP; server validates magic bytes (`isWebpBuffer` —
  `RIFF`+`WEBP`) and size ≤ 2MB (`organizationImageFrom`,
  `utils/organization-image.ts`), stores under
  `organizations/<id>/logo.webp` (`constants/image-keys.ts`) via
  `IObjectStorage.put`, writes the object key into `auth.organizations.logo`
  through the new cache-invalidating `OrganizationRepository.setLogo` (the
  only direct logo write; the background worker has no caller session for
  the Better Auth gateway). Read returns a presigned URL.
- **DiceBear org avatar.** `queues/org-logo.queue.ts` (deterministic job id
  `org-logo-<id>`) + `queues/org-logo.worker.ts` (seed = slug, style
  `10.x/initials/webp`, 256px, 10s timeout, 3 attempts). Worker re-reads the
  org first and skips when `logo` is already set or the org is deleted — a
  real upload always wins. Dispatched fire-and-forget from
  `OrganizationService.createOrganization`; `startOrgLogoWorker()` added to
  `startWorkers` in `src/index.ts`, exported from `organization/index.ts`.
- **Nested users on create.** `createOrganizationSchema` extended with
  `users: [{ email, name, roles[] }]` (max 100, duplicate-email refine →
  400) and `sendInvites` (default true). `createOrganization(headers, input,
  actor?, creatorEmail?)` returns `{ organization, members[] }` with
  per-item isolated outcomes: creator email → `skipped` (already owner);
  active user (`UserManagementRepository.findActiveByEmail` — excludes
  pending placeholders) → direct `addMember` (`added`); other emails → the
  unified invite pipeline (`invited`) with email delivery skipped when
  `sendInvites: false` (new `deliver` flag on `InvitationService.invite`,
  honored on both overwrite and fresh paths); a thrown error → `failed` with
  the message, remaining rows still run. Bootstrap controller passes actor +
  creator email, returns the new shape. Cross-module access goes through
  `INVITATION_SERVICE_TOKEN` and `USER_MANAGEMENT_REPOSITORY_TOKEN` (user
  module exports) — no repository reaching across schemas.
- **Bulk multi-role parsing.** `packages/common invite-sheet.ts` and the
  web-admin paste parser both treat pipe `|` as the role separator inside
  the comma-separated field (`admin|finance`); an unknown role drops the row
  with a row error (paste path now matches the sheet parser — the old
  "send unvalidated and let the backend default" behavior is gone). Template
  sample rows show `admin|finance`.
- **Tests.** Backend 824 pass / 0 fail (updated `invitation.service.test.ts`
  + `multi-organization.test.ts` for the new ctor arg count), web-admin 57
  pass / 0 fail (`invite-parse.test.ts`: pipe multi-role, unknown-role drop),
  locales 82 pass. Root `bun run typecheck` green; `bun run lint` green
  (pre-existing warnings only; one stale `cacheIdKey` import in
  `user-management.repository.ts` removed).
- **Open (frontend + tests):** `/organizations/new` nested-users UI,
  org-detail image-profile upload/clear UI, member edit multi-role select;
  backend unit tests for per-item isolation, WebP validation, and the
  worker skip rule. `docs/plan/plans/features.md` rollup updated with the
  same status.

## 2026-11-12 - Organization info dashboard (dummy data)

Status: implemented; lint/typecheck/tests green. No backend, schema or
migration touched — `docs/database/` reviewed and unchanged (frontend-only
UI slice over hardcoded dummy data).

- Tab `info` of `/organizations/$organizationId` now renders
  `OrganizationDashboard` (`apps/web-admin/src/components/organization/
  org-dashboard.tsx`) replacing the plain details card. Seven sections from
  hardcoded dummy data (`apps/web-admin/src/lib/org-dashboard-data.ts`):
  users-by-role, projects (status badge + progress bar), sales (BarChart,
  6 months), inventory (totals + low-stock list), activity feed,
  profit & loss (revenue/expense BarChart), cash & bank (per-account
  balances + total). Charts use the existing `@ims-erp/ui/components/chart`
  (Recharts v3, already in `packages/ui`) — no new dependency.
- Money formatted via `Intl.NumberFormat('id-ID', IDR)`.
- Locale: new `orgDashboard.*` keys (en/id) in `packages/locales`; removed
  now-dead `orgDetail.details/name/slug`; added the composed-key prefixes
  (`orgDashboard.roles.` / `.projects.status.` / `.activity.actions.` /
  `.cash.`) to `locale-dead-keys.test.ts` `DYNAMIC_PREFIXES` and three
  legitimately-identical keys to `ALLOWED_IDENTICAL`.
- Verified: `bunx tsc --noEmit` (web-admin, clean), `bun run lint` (no new
  warnings), `bun run test` (backend 824 pass, locales 82 pass).

Next executable task: none claimed — ERP-0041 (incl. its bulk-invitation
walk-through) is `verified`; the next candidate from `backlog.md` is the
outstanding reviewer sign-off on ERP-0039/ERP-0041, or claiming the next
unimplemented item (ERP-0002 / ERP-0003 / ERP-0007 / ERP-0027 / ERP-0036 —
all still open per `backlog.md`).

## 2026-11-12 - Bulk invitations via CSV/XLSX file upload

Status: implemented and unit-tested (parser + backend + locale guards);
browser walk-through pending. Committed on `fix/org-hardening`.

- **Shared parser** `packages/common/src/files/invite-sheet.ts`
  (`papaparse` for CSV incl. BOM/semicolon tolerance, SheetJS `xlsx` for
  spreadsheets): case-insensitive headers, cell trimming, email lowercase,
  closed-ERP-role validation, in-file duplicate detection, per-row errors
  carrying the physical row number, hard caps (100 rows, 1 MB enforced at
  the caller). Unit-tested 8/8 in `packages/common/test/invite-sheet.test.ts`
  (first tests in that workspace; `test` script added).
- **Client-side parse, JSON send.** Per decision, the backend bulk endpoints
  are unchanged (no multipart). `InviteDialog` gained an "Upload file" tab:
  parse + inline preview (`invite.fileReady` / per-row error list), send the
  existing JSON array. `organizationSlug` resolves client-side against the
  loaded org list in admin mode; org mode pins to the page organization.
- **`organizationSlug` in the invite contract.** Optional on
  `TCreateInvitationInput`; `InvitationService.invite` resolves it through
  the new `IOrganizationSlugResolverPort` (adapter
  `organization/adapters/organization-slug-resolver.ts` over a new
  `OrganizationRepository.findBySlug` — live rows only). Unknown slug =
  `InvalidInvitationError.unknownOrganizationSlug` (422, new locale key
  `invitation.unknownOrganizationSlug` en/id), reported per row by the bulk
  loop. Slug chosen because `auth.organizations` has no code column; slug is
  the unique human-readable identifier.
- **Template download.** `GET /admin/invitations/template` (global admin)
  and `GET /organizations/:organizationId/invitations/template`
  (`member:read`), `?format=csv|xlsx` via the shared
  `user/utils/invitation-template.ts`; header contract from
  `INVITE_SHEET_HEADERS` so the file round-trips the parser. Web-admin
  download buttons in the file tab.
- **Verification.** Root `bun run typecheck` (4/4), `bun run lint`
  (12 warnings, 0 errors), `bun run test` all green (backend 824/824,
  locales 82/82 incl. new keys, web-admin 55/55, common 8/8 via workspace
  run). `docs/database/` reviewed — no schema change (slug already unique),
  no DBML edit needed.

## 2026-11-12 - ERP-0034 follow-up: invite creates the employee; personal fields move to `auth.users`

Status: implemented and unit-tested; migration written but **not yet run
against any database** (no disposable Postgres credentials available —
`.env` lacks `POSTGRES_*`, role `postgres` absent on `localhost:5432`, no
running containers). Branch `fix/org-hardening`, uncommitted on top of
`5f21778` (PR #82 open).

- **Personal fields moved from `hr.employees` to `auth.users`.**
  `docs/database/docs.dbml` edited first (canonical); `gender`
  (check `male`/`female`), `birth_date`, `birth_place`, `marital_status`
  now live on `Table auth.users`, dropped from `Table hr.employees`.
  `bun docs/database/gen-logical-references.ts` then
  `bun docs/database/validate-dbml.ts` → `OK: 0 cross-module refs,
  0 timestamp gaps`. Drizzle schemas hand-edited
  (`auth.schema.ts` + checks, `hr.schema.ts` −4 columns) and
  `auth.options.ts` gained the four `user.additionalFields`
  (`input: false`; `auth:generate` NOT run, per hard rule).
- **Migration** `20261112120000_erp0034_personal_fields_to_auth_users`
  (hand-authored SQL, ERP-0034 convention): `DO` block pre-check raises when
  `hr.employees` rows with `user_id` NULL carry personal values (fail-fast,
  no data dropped); then adds columns/checks, copies values from live and
  soft-deleted linked employees, drops the four columns. Append-only journal
  entry. **Unverified on a database.**
- **Cross-module port.** HR reads/writes the four fields through
  `IUserPersonalFieldsPort` (`user/contracts/user-personal-fields.port.ts`,
  adapter `user/adapters/user-personal-fields.ts`, token
  `USER_PERSONAL_FIELDS_PORT_TOKEN`) — HR never touches the user repository.
  API contract unchanged: the fields stay in the HR body/DTO, so the
  web-admin HR form needs no change.
- **Invite creates the employee (one step).** New HR orchestrator
  `EmployeeInviteService` (token `EMPLOYEE_INVITE_SERVICE_TOKEN`): per row —
  reject an email already an employee, run `InvitationService.invite`,
  reserve the code via `NumberingService.next('employee')`, insert the
  employee (defaults: `fullName` from the invite `name`, `active`/`permanent`/
  `onsite`), write personal fields; if the insert fails the new
  `InvitationService.rollbackPending` cancels the invitation and soft-deletes
  the pending user. Bulk is per-row isolated. `InvitationService` no longer
  depends on HR; `EmployeeService.create` delegates to the orchestrator.
- **Wiring without cross-module imports.** New port
  `IInvitationEmployeePort` in the user module
  (`user/contracts/invitation-employee.port.ts`, token
  `INVITATION_EMPLOYEE_PORT_TOKEN`), implemented by HR's
  `InvitationEmployeeAdapter`. Both invitation controllers (app scope
  `/admin/invitations` in `user`, org scope in `organization`) now call the
  port instead of `InvitationService.invite`, so **every invite path creates
  the employee record**; route ownership stays in `user` per decision.
- **Permissions/gates.** `hr` grants changed to
  `member: ['read']`, `invitation: ['create', 'cancel']`;
  org invitation routes guard on `invitation:create` (invite/resend) and
  `invitation:cancel` (cancel/delete). Web-admin gates moved:
  `$organizationId.tsx` invite button/dialog → `invitation.create`, Members
  tab + query → `member.read`; `pending-invitations-panel.tsx` resend →
  `invitation.create`, cancel/delete → `invitation.cancel`
  (`ADMIN_PERMISSIONS` gained `createInvitations`/`cancelInvitations`).
  No locale keys changed (no new strings).
- **Verification.** `bun run --cwd apps/backend typecheck` clean;
  `bun run --cwd apps/backend test` → **824 pass, 0 fail** (57 files; the
  `schema "auth" does not exist` line is the known DB-less integration-test
  noise). New `test/unit/employee-invite.service.test.ts` covers success,
  email-taken (pre-invite and per-row in bulk), and rollback on insert
  failure. `bun run typecheck` (root turbo) 4/4 clean; web-admin `tsc -b`
  clean; `bun run lint` 0 errors (11 pre-existing warnings);
  `bun run --cwd apps/web-admin test` 55/55; `packages/locales` guards
  82/82.
- **Open items.** Migration untested on a disposable DB (pre-check fail path,
  copy, drop). `hr.seeder.ts` writes no personal fields (safe — columns
  nullable). Members tab layout change unverified in the browser. `hr`
  seeder personal-field backfill optional.

## 2026-11-12 - ERP-0039: organization-scoped invitations + one shared invite dialog

Status: implemented and browser-verified end to end (invite → email → claim →
membership), unit-tested; reviewer sign-off and PR still open. Branch
`fix/org-hardening` (based on the merged `89940c0`).

- **Backend — org-scoped invitation surface.** New
  `app/organization/controllers/organization-invitation.controller.ts`
  (5 routes under `/organizations/:organizationId/invitations`:
  list, create/bulk, resend, cancel, delete) plus a local
  `contracts/organization-invitation.contract.ts`; mounted in
  `organizationModule()` and exported from `app/organization/index.ts`.
  It delegates to the user module's `InvitationService` through the DI token
  (no cross-module repository access). The **path** organization is
  authoritative — `organizationId` is never read from the body on these
  routes, and `assertPathOrganization` rejects a mismatch for non-global
  admins.
- **Backend — tenant scoping on single-id actions.** `InvitationService`
  gained `TInvitationScope` and `assertScope()`; `resend`/`cancel`/
  `deleteUnclaimed`/`requirePending` accept an optional
  `scope: { organizationId }` and report an out-of-scope row as
  `InvitationNotFoundError` (404, so a probe cannot confirm another
  organization's invitation). Application admins call unscoped.
- **Backend — duplicate rules** (`invite`): pending in org A + invite to org
  B → 409 (`InvitationPendingExistsError`); app-level pending + org invite →
  the existing row is **adopted** into the org context; org pending + app
  invite → 409; app → app and same-org → same-org overwrite (new token).
- **Backend — claim phone is E.164.** `claimInvitationSchema.phone` now
  validates with `isValidPhoneNumber` from `libphonenumber-js/min` and
  normalizes (`+62 812-3456-7890` → `+6281234567890`). Library added to
  `apps/backend` and `apps/web-admin` (`libphonenumber-js@1.13.16`).
- **Web admin — one dialog, two modes.**
  `components/invite/invite-dialog.tsx` (`mode: 'admin' | 'org'`) replaces
  `components/admin/invite-dialog.tsx` (deleted). Admin mode adds a searchable
  organization picker with an explicit **“Tanpa organisasi (tingkat
  aplikasi)”** item (a `null` selection, not an empty state) and hides the
  role field while no organization is chosen. Org mode pins the organization
  from the page and never renders the picker. Bulk paste:
  `email, name, org-code, role` (admin) vs `email, name, role` (org);
  `parseBulkInviteRows` returns `{ rows, rowErrors, error }` so an unknown org
  code or bad email drops only that row. The selector lists live
  organizations only (an invite into a soft-deleted org cannot be claimed).
- **Web admin — org admin manages its own invitations.** The
  organization-detail Members tab gained `Tambah anggota` (opens the dialog)
  and the `PendingInvitationsPanel`, which was refactored to take a `source`
  prop (`{ queryOptions, resend, cancel, remove, invalidate }`). The old
  `/organizations/$organizationId/members/new` page route was deleted along
  with `memberNew.*` locale keys and `breadcrumb.memberNew`. Org admins
  therefore never need the application-admin-only `/admin/invitations`.
- **Web admin — app-admin-only surfaces.** New `lib/use-is-app-admin.ts`,
  `adminOnly` flag on sidebar items (hides `Users` and `Audit log` from
  organization-only users, keeping `Organisasi` and `Pengaturan`), and a new
  `routes/_authed/admin.tsx` layout guard that renders an in-place 403
  (`accessDenied.*`) instead of redirecting.
- **Web admin — country-code phone picker.**
  `components/form/country-phone-field.tsx` (searchable shadcn `Combobox`,
  countries from `getCountries()` + `getCountryCallingCode()`, names via
  `Intl.DisplayNames([i18n.language])`, default `ID`/`+62`) + `lib/phone.ts`
  `toE164()`. Filtering is done in a `useMemo` over `onInputValueChange`
  rather than a `ComboboxList` function child: that child must be the list's
  **only** child, and the empty state also lives inside the list (a
  mixed array renders nothing — observed in the browser).
- **Locales.** `en`/`id` gained `invite.organization*`, `invite.noOrganization`,
  `invite.rowsPlaceholderAdmin`, `invite.rowsHintAdmin`, `invite.rowsEmpty`,
  `accessDenied.*`, `claim.form.phoneCountry*`, `claim.form.phonePlaceholder`
  (added to `ALLOWED_IDENTICAL` — a digit pattern, not prose); `memberNew.*`
  and `nav:breadcrumb.memberNew` removed.
- **`docs/database/` reviewed and unchanged.** The organization “code” the
  admin dialog accepts is the existing `auth.organizations.slug`; no table,
  column, index, constraint, status vocabulary or logical reference changed,
  so `docs.dbml` needed no edit and `validate-dbml.ts` was not re-run.
- **Tests.** `apps/backend/test/unit/invitation.service.test.ts` (12 pass:
  overwrite tenant rules, scoped resend/cancel/delete, unscoped admin reach,
  E.164 claim schema) and
  `apps/web-admin/test/unit/invite-parse.test.ts` (10 pass: both bulk
  layouts, per-row isolation, `toE164`).
- **Verified commands (repo root unless noted).**
  `bun run typecheck` → 4 tasks successful; `bun run lint` →
  ui 19 / backend 7 / web-admin 11 warnings, 0 errors (no new warnings in the
  changed files); `bun run test` → 5 tasks successful, backend 820 pass /
  0 fail, web-admin 55 pass / 0 fail, locales 82 pass / 0 fail,
  react-email 5 pass / 0 fail (`schema "auth" does not exist` log noise is the
  mocked-DB unit tests' expected output).
- **Browser verification (live stack, Firefox + Mailpit).**
  App-level: `/admin/users` → dialog → organization `Tanpa organisasi` → role
  field hidden → send → mail `You're invited to create your IMS ERP account`
  → claim page → account created, lands on `/` with no organization; sidebar
  hides `Users`, keeps `Organisasi`/`Pengaturan`. Org-level: organization
  Members tab → `Tambah anggota` (no org picker) → send → mail `You are
  invited to join Entragate` → claim page with the country picker defaulting
  to `Indonesia (+62)`, typing `Malay` narrows the list to `Malaysia (+60)` →
  claim → `auth.members` row (role `member`, org Entragate),
  `auth.user_invitations.status='accepted'`, `auth.users.phone='+6281399887766'`.
  Panel actions as org admin (`admin_seed`, no platform role): resend extends
  expiry and reissues the token, cancel moves the row to `cancelled` and drops
  it from the pending list, delete soft-deletes both the invitation and the
  pending user (`deleted_at` set on both). Same account hitting `/admin/users`
  gets the in-place 403. `GET /organizations/:id/invitations` unauthenticated
  → 401 envelope.

## 2026-11-13 - ERP-0046: dependabot bun config moved to the workspace root

Status: in-progress - config changed, waiting on the next dependabot run.

- **Symptom.** Every open dependabot PR failed CI at
  `bun install --frozen-lockfile`:
  `error: lockfile had changes, but lockfile is frozen` /
  `note: try re-running without --frozen-lockfile and commit the updated lockfile`.
  Evidence: `gh run view 43198878926 --log-failed` (PR #85, `Lint Backend` and
  `Unit Test Backend`) and the same step in `Lint Web Admin` / `Unit Test Web
  Admin` for PR #79 (run 43198821060); PR #70, #50, #36, #35 identical.
- **Cause.** `.github/dependabot.yml` declared four `package-ecosystem: bun`
  entries under `/apps/backend`, `/apps/web-admin`, `/packages/common`,
  `/packages/ui`. The only `bun.lock` lives at the repo root, outside every
  declared `directory`, so dependabot bumped `package.json` alone
  (`gh pr diff <n> --name-only` returned just that one file) and left the
  lockfile stale. `git log -- bun.lock` confirms no dependabot commit ever
  touched it.
- **Fix.** The four bun entries are replaced by one:
  `package-ecosystem: bun`, `directory: "/"`, `open-pull-requests-limit: 10`,
  `ignore: typescript`, group `workspace-minor-patch` (minor+patch).
  dependabot-core's bun fetcher reads `package.json["workspaces"]` and the
  updater rewrites the lockfile at the configured directory, so root is the
  only entry that can produce a consistent PR. `github-actions` and both
  `docker` entries are unchanged.
- **Docs.** `docs/database/` reviewed and unchanged (no schema, column,
  constraint, status vocabulary or lifecycle change).
- **Not verified yet.** No dependabot run has happened since the config
  change. Verification = a new dependabot PR whose diff contains `bun.lock`
  and whose `Lint Backend`, `Unit Test Backend`, `Lint Web Admin` and
  `Unit Test Web Admin` jobs pass.
- **Known limits.** Dependabot bun supports version updates only - security
  updates and `bun.lock`-based transitive alerts are unsupported by GitHub.
  Root `packageManager: bun@1.4.2` still differs from CI `bun-version: 1.4.4`;
  left alone here.
- **ID note.** ERP-0039/0040/0041 are claimed on `fix/org-hardening`, so this
  task took the next free ID (ERP-0042) even though this branch is cut from
  `main`.

## 2026-11-10 - ERP-0034: minimal HR employees + warehouse PIC (slices 1-8)

Status: implemented and browser-verified (create → list → detail; seeder;
picker). Commits: `8f5e8f3` (schema+module), `4594774` (numbering),
`513948c` (warehouse PIC), slice 7 (web-admin), `eaf7c90` (seeder+guard).

- **Slice 1 — schema/migration.** New `hr` Postgres schema, table
  `hr.employees`: nullable `organization_id` (NULL = company-level
  employee, permanent valid state), nullable `user_id` with partial unique
  index (`hr_employees_user_uq`, one login ↔ one alive employee),
  `employee_code`, identity/contact fields, employment/work enums via
  CHECK constraints, internal `manager_employee_id` FK, soft deletes. No
  cross-schema FKs (rule 3.2). Date/timestamp columns are **bigint** (unix
  ms) matching `drizzle/datatypes/unix-timestamp.ts` — an initial
  timestamptz version caused insert 500s and was re-applied by dropping the
  schema (empty at the time) and journaling the corrected hash
  (`973778ea8a2a…`) via a bun script. Migration is hand-written
  (`20261112000000_erp0034_hr_employees`) because the journal's
  pre-existing two-branch conflict blocks drizzle-kit; `--fix-conflicts`
  would discard 14 applied migrations.
- **Numbering.** `employee` document type (code `EMP`, module `hr`,
  pattern `{TYPE}-{SEQ:5}`, reset `never`) added to `DOCUMENT_TYPES`,
  codes, modules, and defaults; `numbering.service.test.ts` expects 28
  types.
- **Slices 3-4 — module.** `/hr/employees` REST: paginated list (own org +
  company-level), detail, create, patch, archive, and `/picker`. Create is
  **invite-first**: one call resolves the target org, reserves the EMP code
  via `NumberingService`, runs the user module's `InvitationService.invite`
  (pre-creating the `auth.users` row), then inserts the employee with the
  returned `user_id`. Company-level writes require the platform role
  (`GLOBAL_ADMIN_ROLE`, checked in `EmployeeService` via
  `isPlatformAdmin`). `ExportedHrService` exposes
  `findEmployeeById`/`findEmployeeByUserId` for cross-module consumers.
  Locale error keys `hr.*` (en/id).
- **Slice 6 — warehouse PIC.** `WarehouseService.assertPicAssignable`:
  unknown/terminated employees and org-scoped employees outside the
  warehouse's currently linked organizations are rejected with 422
  `inventory.warehousePicInvalid`; company-level always assignable. Wired
  into create and update.
- **Slice 7 — web-admin.** `/hr/employees` list (search + status filter,
  server pagination), invite-first new form, detail page; stub removed.
  New `hr` locale namespace (en/id, flat dotted keys), i18next typing,
  parity/dead-key allowances for composed enum labels. Build/test/lint
  pass.
- **Slice 8 — seeder + picker guard.** `seedHrEmployees` links seeded role
  accounts (admin, operations_manager, hr, warehouse, finance, sales) to
  employee rows and adds 2 company-level staff; codes via the numbering
  service; 29 rows seeded and verified in the UI. Picker guard changed
  from `warehouse:update` to `employee:read` — no organization role holds
  `warehouse:*` (ADR-0008), so the original guard was unusable.
- **Verification (Firefox @ localhost:5173, admin@local.com):** list empty
  state → create Budi Santoso via form → success → detail
  (EMP-00002) → seeder filled the list. Picker API 200 with admin session
  (403 without `employee:read`).
- **Not done / deferred:** manager picker UI on the form (API supports
  `managerEmployeeId`); export action; ERP-0034's remaining HR tables.
  Pre-existing: `multi-organization.test.ts` fails in the full suite
  (fresh `ims_erp_test` lacks the `auth` schema) — environment issue, not
  from this change.

## 2026-11-09 - warehouse: components split from products, materials counted from balances

- Contract change: `TWarehouseKindCounts` now has `componentsCount`. `productsCount` counts `product` only (was product + component). `materialsCount` counts distinct material items with `quantity_on_hand > 0` in `stock_balances` (was always 0, because it counted serialized units and materials are not serialized). `componentsCount` counts live serialized `component` units.
- Backend: `warehouse.repository.ts` (`countKinds`, new `materialRows` query), `warehouse.repository.interface.ts`, `warehouse.service.ts` (`getWarehouse` passes `componentsCount`), and test fakes in `warehouse.service.test.ts`, `warehouse-authorization.test.ts`, `stock-test-doubles.ts`, `stock.service.test.ts`.
- Web-admin: `warehouse-api.ts` type; list card and detail stats now 5 items (Products, Components, Materials, Equipments, Storages); detail page gets a Components tab (`itemKind='component'`); Materials tab unchanged (`itemKind='material'`).
- Locales: `inventory:warehouses.components` added (en "Components", id "Komponen").
- Enum and DB check constraint unchanged (`product|component|material`).
- Verified: `bunx tsc --noEmit` clean in `apps/backend`. `bun test` in `apps/backend` 803 pass / 0 fail (the `ims_erp_test does not exist` trace in `single-organization.test.ts` is logged, not a failure, as before). `bunx tsc -b` clean and `bun test` 45 pass in `apps/web-admin`. `bun run test` in `packages/locales` 70 pass.
- Not verified: the new materials query and component split against a real database; no unit test covers `countKinds` (its fakes return zeros). Not verified in browser.
- `docs/database/` not changed (no schema change). Backlog: no `ERP-*` status change.

## 2026-11-09 - warehouse detail: item image column (placeholder)

- `apps/web-admin/src/components/inventory/warehouse-item-table.tsx`: new first column `Image` in the product/material tables on `/inventory/warehouses/$warehouseId`. Static `picsum.photos` placeholder, same pattern as the warehouse card, with a TODO to render `item.imageUrl`.
- Backend unchanged. The list endpoint (`GET /items`) does not return `imageUrl`; only the detail (`getItem`) does via `withImageUrl`. Real images in lists need a backend change, not done here.
- Locales: `inventory:warehouses.image` added (en "Image", id "Gambar").
- Verified: `bunx tsc -b` clean in `apps/web-admin`. `bun test` in `apps/web-admin` 45 pass / 0 fail. `bun run test` in `packages/locales` 70 pass / 0 fail.
- Not verified in browser.
- `docs/database/` not changed (UI only). Backlog: no `ERP-*` status change.

## 2026-11-09 - warehouse detail: equipment count stat

- `apps/web-admin/src/routes/_authed/inventory/warehouses/$warehouseId.tsx`: added the `equipmentsCount` stat card (`inventory:warehouses.equipments`) between Materials and Storages, matching the list card. Backend already returns `equipmentsCount` on `GET /warehouses/:id` (`withEquipmentCounts` in `warehouse.service.ts`). No backend change.
- Verified: `bunx tsc -b` clean in `apps/web-admin`. `bun test` in `apps/web-admin` 45 pass / 0 fail.
- Not verified in browser: the detail page with a real warehouse id.
- `docs/database/` not changed (UI only). Backlog: no `ERP-*` status change.

## 2026-11-09 - dashboard: revenue chart bars rendered black

- Cause: `ChartContainer` config for `invoiced` had only `label`, so `--color-invoiced` was never defined and `fill='var(--color-invoiced)'` fell back to black.
- `apps/web-admin/src/components/dashboard/dashboard-page.tsx`: added `color: 'var(--chart-1)'` to the `invoiced` config entry.
- Verified: `bunx tsc -b` clean in `apps/web-admin`. `bun test` in `apps/web-admin` 45 pass / 0 fail. Firefox on `/`: 6 bars, computed fill `oklch(0.7156 0.0605 248.685)` (= `--chart-1`). Screenshot did not capture the page, so visual check is not done.
- Not applied: tweakcn theme `cmc45c7oo000f04jvfpbo2gf9`. The page did not expose its CSS variables; needs the export values.
- `docs/database/` not changed (UI only). Backlog: no `ERP-*` status change.

## 2026-11-09 - warehouse form: address section layout

- `packages/locales` `inventory:address.street`: en "Street" → "Address", id "Jalan" → "Alamat". Key unchanged.
- `apps/web-admin/src/components/inventory/warehouse-form.tsx`: label field moved into its own group, separated from the rest of the address by `Separator` (`@ims-erp/ui/components/separator`). Street input is now `Textarea` (`rows={3}`), spanning all three grid columns (`sm:col-span-3`). rt, rw, postal code stay in the grid below. `id` and `htmlFor` unchanged.
- Backend unchanged: `street` is still a plain string, multi-line values are stored as typed.
- Verified: `bun run test` in `packages/locales` 70 pass / 0 fail (run after the label change). `bunx tsc -b` clean in `apps/web-admin` after the separator and column-span change. `bun test` in `apps/web-admin` 45 pass / 0 fail (run after the textarea change, before the layout change).
- Verified in browser (Firefox via `firefox-devtools-mcp`, `--connect-existing`, logged-in profile, 1920×947 viewport): `/inventory/warehouses/new` renders the Label field, a separator, then the full-width Address textarea (1584×64 px, `TEXTAREA`), then RT, RW, Postal code, Province, Regency, District, Village. English only. Not checked: Indonesian locale, filled-in values, edit form `/inventory/warehouses/$id/edit`.
- Commit: `4de16b3` on `feat/adjust-shadcn-theme` (not pushed).
- `docs/database/` not changed (UI only). Backlog: no `ERP-*` status change.

## 2026-11-09 - warehouse list: status filter and sort (name, code, status)

- Backend `inventory`: `warehouseListQuerySchema` gained `status` (`all | active | inactive | archived`), `sortBy` (`name | code | status`), `sortDir` (`asc | desc`). `status` overrides the legacy `includeArchived` / `isActive` flags when present.
- `warehouse.repository.ts`: `lifecycleFilter(status)` maps `all` → alive, `active` → alive + `is_active = true`, `inactive` → alive + `is_active = false`, `archived` → `deleted_at IS NOT NULL`. Sort by `name` / `code` / `STATUS_RANK` (active 0, inactive 1, archived 2), then `name`, then `id` as tie-breakers so pages stay stable.
- Web-admin: `/inventory/warehouses` checkbox "Include archived" replaced by a `Funnel` popover (status, sort by, order) with draft/Apply/Reset, same pattern as `admin/users`. Route `validateSearch` and `listWarehouses` carry the new params.
- i18n: `inventory:warehouses.{filters,filtersTitle,filterStatus,statusAll,statusArchived,sortBy,sortName,sortCode,sortStatus,sortOrder,sortAsc,sortDesc,reset,apply}` added in en and id. `inventory:warehouses.includeArchived` removed from both bundles (dead-keys guard green). `listWarehouses` in `lib/warehouse-api.ts` still accepts `includeArchived` as a param, but the warehouse list no longer passes it.
- Parity allowlist: `inventory:warehouses.filterStatus` and `sortStatus` added to `ALLOWED_IDENTICAL` (the word "Status" is the same in Indonesian).
- Tests: `apps/backend/test/unit/warehouse-list-filter.test.ts` (4 tests, renders each lifecycle predicate to SQL via `PgDialect`, no DB). `lifecycleFilter` exported for that test.
- Verified: backend `bunx tsc --noEmit` clean; backend `bun test` 803 pass / 0 fail. The `ims_erp_test does not exist` / `organization_role` stack trace printed by `single-organization.test.ts` did not fail the run; cause not investigated (no test DB in this session). `bun run lint` backend and web-admin: warnings listed, none in files touched here; baseline not compared; `packages/locales` `bun test` 70 pass / 0 fail after removing unused `warehouses.archivedBadge`; web-admin `bunx tsc -b` clean, `bun test` 45 pass / 0 fail.
- Not verified: sort and status against a live DB (no DB run this session); browser walk-through of the popover and card grid.
- `docs/database/` not changed (no schema or column change). Backlog: no `ERP-*` status change; ERP-0027 stays `implemented`. `features.md` unchanged.
- Header "New warehouse" button now has a leading `Plus` icon (`lucide-react`, `mr-2 size-4`, `aria-hidden`). Empty-state action button with the same label is unchanged. Verified: `bunx tsc -b` clean in `apps/web-admin`. Not verified in browser.
- `graphify update .` run after code change.

## 2026-11-09 - web-admin: page padding and spacing made consistent

- Page padding now comes only from `components/layout/main-layout.tsx` (`p-4 pt-0 md:p-6`). Route roots no longer add their own `p-6` / `p-4`.
- `main-layout.tsx`: added `print:p-0` so printed documents keep zero page padding.
- Route roots standardized to `flex flex-col gap-6`. Detail pages that had `flex flex-col gap-4 p-6` moved to `gap-6`. Print pages (`flex flex-col gap-4 p-6 print:p-0`) keep `gap-4`, only `p-6` removed.
- Removed `p-6` from error and not-found `<p>` in routes, so they sit under the layout padding.
- Scripted rewrite over `src/routes/**/*.tsx` plus `components/inventory/item-category-list.tsx` and `components/finance/invoice-list.tsx`: 63 files changed (route files plus those two), 85 replacements. Script removed after use.
- Not changed: auth pages (`login`, `forgot-password`, `reset-password`, full-screen, outside the layout) and inner card or form padding. `space-y-*` on non-root containers kept. `max-w-*` widths in account, profiles, asset-form kept.
- Corrects the 2026-11-06 entry: that entry said self-padding was removed, but `p-6` root wrappers remained in ~60 route files. Fixed here.
- Verified: `bunx tsc --noEmit` clean in `apps/web-admin`; `bun run test` 45 pass / 0 fail; grep for leftover `flex flex-col gap-N p-N` root wrappers returns none.
- Not verified in browser. Print output not checked.
- `docs/database/` not read (UI-only). Backlog: no `ERP-*` status change.

## 2026-11-09 - web-admin: search icon on warehouse list search field

- `apps/web-admin/src/components/inventory/warehouse-list.tsx`: search input at `/inventory/warehouses` now `InputGroup` with leading `Search` icon (`InputGroupAddon align='inline-start'`). Input type `search`, `aria-label` added.
- Verified: `bunx tsc --noEmit` in `apps/web-admin` clean; `bun run test` in `apps/web-admin` 45 pass / 0 fail; root `bun run typecheck` 3/3 successful.
- Not verified in browser. No new i18n keys. Backlog: no `ERP-*` status change.
- `docs/database/` not read in this change (UI-only, no schema or cross-module change). Not formally reviewed.

## Completed - merge of main into merge/main-sync, stage 2 (Sales owns AR), 2026-11-09

Branch `merge/main-into-main-sync` (from `merge/main-sync` @ `0efffe1`),
`git merge main --no-commit --no-ff`; PR targets `main`.

Owner decisions (2026-11-09): invoice + receipt are owned by Sales with the
full terms model (term_kind, customer_snapshot, vat_enabled/vat_rate_bps,
terms, created_by, voided_by, paid/outstanding totals) merged into
`sales.invoices`; `code` nullable (draft may exist without a code); statuses
`draft|issued|partially_paid|paid|void|cancelled` (overdue is never stored);
`sales.receipts` uses main's statuses (`draft|verified|posted|reversed|void`)
with `sales_invoice_id` NOT NULL plus HEAD's `reference`/`notes`/`reversed_by`;
`payment_id` is a logical (nullable) ref to `finance.payments`; numbering
follows ADR-0013 option A (company-wide counters, `NumberingService.next` as
the only path, `DocumentNumberingService` fully removed); `sales_invoice` is
the single DocumentType (renamed from `invoice`; new types
`bank_reconciliation`, `cash_bank_transaction`, `payment`, `journal_entry`,
`supplier_bill`; codes INV/REC/CB/PAY/JE/SB).

What changed:
- Numbering: all 13 `allocate`/`format` call sites (accounting services,
  invoice service) converted to `NumberingService.next(type, { date, tx })`;
  `DOCUMENT_NUMBERING_SERVICE_TOKEN` and its registration removed everywhere;
  6 test doubles in `test/accounting/*` re-pointed to `next`.
- Helpers: `apps/backend/src/utils/money.util.ts` + `business-date.util.ts`
  (alias `@utils/*`); `packages/common/src/domain/` deleted.
- Sales: `InvoiceLookupService` + token moved to `sales`; repository gained
  `listByOrder`/`hasLiveInvoices`; receipt write path ported from the finance
  module (`findReceipt`, `listReceipts`, `paginateReceipts`, `addReceipt`,
  `reverseReceipt` + `paymentStatus` util, receipt zod schemas, receipt
  errors as `sales.*`, `ReceiptController` mounted at `/receipts` and
  `POST /invoices/:id/receipts`).
- `src/app/finance/` (12 files, the merge-side invoice module) deleted;
  `registerFinance` import dropped from `src/index.ts`; licensing and
  sales-order services import the lookup from `@app/sales`.
- Schemas: `sales.invoices` completed to the DBML terms model (term_kind,
  customer_snapshot, sales_order_code, quotation_code, title, description,
  percentage_bps, vat_enabled, vat_rate_bps, terms, created_by, voided_by,
  `code` nullable, term_kind index + checks); `finance.schema` invoice/receipt
  types removed; `db.ts` financeRelations removed.
- Migrations (append-only): `20261106170000_drop_merge_side_finance_receipts`
  (merge-reconciliation: the joined history had two finance.receipts
  definitions, main's survives) and `20261109090000_sales_owns_invoice_receipt`
  (sales.invoices terms columns + checks, sales.receipts created,
  finance.invoices/invoice_items/receipts dropped).

Verification (all green):
- `bun install` OK; lint: warnings only (pre-existing); typecheck: 0 errors.
- `bun test`: 799 pass, 0 fail (53 files); 3 fixed assertion updates for the
  `next`-based mock codes and the 27-type DOCUMENT_TYPES list.
- `drizzle:migrate-reset` (fresh DB `ims_erp_local`): migrate + seed OK.
- `drizzle:seed` second run: idempotent (all "already exists/skipping").
- `bun docs/database/validate-dbml.ts`: OK (265 tables, 231 refs, 0
  cross-module).

## Completed - merge of main into merge/main-sync (PR #58 conflicts), 2026-11-06/07

Status: **implemented** (merge commit on `merge/main-sync`; not merged into
main — PR #58 awaits programmer A's review). Backlog: ERP-0037 (the port,
renumbered from ERP-0036, which main uses for assets).

Owner decisions (2026-11-06): one numbering system, ours (ADR-0013); for
inventory conflicts main (programmer A) is the base and the M05 additions
are re-applied on top; merge `origin/main` into `merge/main-sync` (no push
to main, no history rewrite).

What changed besides the textual merge (30 main commits, 36 conflicting
files):
- Numbering (ADR-0013): `DocumentNumberingService` removed; stock movement,
  adjustment, asset, maintenance, disposal, tool set and borrowing codes come
  from `NumberingService.next` (new document types and default patterns,
  settings page + locales en/id); test double renders the real patterns
  (two asset tests' code regexes updated to `MNT-YYYY-#####` /
  `DSP-YYYY-#####`).
- Migrations: the 18 ported migrations renamed to `20261106110000…111700`
  (same order; first snapshot's parent = main's leaf; it no longer creates
  the `organization` schema or `document_sequences`); new
  `20261106165521_merge_main_reconcile` (generated with rename hints,
  hand-edited to keep counters). `drizzle-kit generate` afterwards: "No
  schema changes".
- Inventory: main's hardening kept (atomic non-negative `applyDelta`,
  audit writer, warehouse links, combobox adjustment form, three item kinds
  — tools are assets, services are not items); re-applied: item categories,
  unit list and category index, moving-average cost (`lockForCost` + cost on
  every movement and reversal), opening-stock unit cost on adjustments,
  inventory value, serial sale for delivery notes, document photo. The
  inventory borrowing code (moved to `assets` by main) and its locale keys
  are dropped; seeded `tool` / `service` items are gone.
- Fixed a main bug: `GET /warehouses/linked` had no `erp` macro option, so
  `erp` was undefined (500) and the adjustment form could not load
  warehouses; the route now opts in with `erp: {}`.

Verification:
- Fresh disposable DB `ims_erp_merge_check`: `drizzle:migrate` OK,
  `drizzle:seed` twice OK (idempotent); dropped afterwards.
- Upgrade check `ims_erp_upgrade_check`: main's 20 migrations applied first,
  ERP-0009 rows inserted (two `stock_movement` rows 43 and 10, borrowing 5,
  asset 7, adjustment 3), then the merged set: rows collapsed to one per
  type, `stock_movement` continues at 43, borrowing period `2026-11`;
  dropped afterwards.
- Dev DB `ims_erp_sync` rebuilt (drop / create / migrate / seed twice /
  `refresh-role-grants.ts`).
- `bun run typecheck` (apps/backend) clean; `NODE_ENV=test bun test` → 681
  pass, 0 fail; `bun run lint` no errors. Web: `bun run build` OK, lint no
  errors, 45 pass. Locales: 66 pass. `validate-dbml.ts` → OK.
- HTTP smoke as the initial admin: 19 list endpoints across sales, finance,
  procurement, delivery, projects, tickets, licenses, stock, items, assets,
  borrowings, numbering → 200; stock receipt → `MV-202611-000001`;
  adjustment with opening cost → `0001/ADJ/DEV/XI/26`. Screens checked:
  numbering settings (22 types), stock adjustment form, asset borrowings,
  subscription.
- `docs/database/`: `docs.dbml` merged (items checks, document_sequences
  note), `gen-logical-references.ts` re-run, `validate-dbml.ts` OK.

Next executable task: push `merge/main-sync`; programmer A reviews PR #58
(ADR-0013, the inventory re-applications, the `/warehouses/linked` fix);
then M08 employees & attendance (gate 1 and 2 with the owner).

## Completed — M03 subscription & licensing, stage 2 (license API, T23), 2026-11-06

Status: **implemented** (backend + web admin; not yet accepted by the
owner). Backlog ERP-0019 (stages 1–2; T24 pilot integration blocked).

Gate 1 (read): docs.dbml MODULE Licensing (`license_activations`,
`license_events`, `license_entitlements` / `usages`, `subscription_schedules`
scaffolds; `auth.apikeys` for the application key);
`docs/plan/erp-module-plans/m03-subscription-licensing.md` stage 2 (validate
/ activate endpoints with a per-application API key, grace then suspension,
renewal on verified payment, idempotent, every call logged, rate-limited,
DoD tests at each boundary); the existing website key pattern
(`public-api-auth.ts`, config `website`). Skipped: `implementation-phases.md`
(no dependency on an unlanded step).

Owner decisions (2026-11-06):
1. **Grace period 7 days**: after the end date validation still passes with
   a warning for 7 days, then it is refused.
2. **Renewal on full payment**: a draft renewal linked to a sales order
   activates by itself when that order is paid in full.
3. **Pilot source not available**: T23 only (API, keys, documentation);
   T24 stays blocked.

Gate 2 (manual grilling pass):
- Machine key: Better Auth API key plugin, new config `licensing` (prefix
  `elk_`, organization-owned, 120 calls / minute), created through an
  adapter on behalf of the organization owner (Better Auth checks the
  creator's organization permission); the ERP checks `license:manage_api`
  (new; owner, sales manager). `licensing.application_api_keys` maps the key
  to one **own** application; a key cannot reach another application's
  licenses (they look unknown). No second auth system.
- State (pure, clock injected): effective end = earlier of contract end and
  key expiry; `ok` until it, `grace` up to end + 7, then `expired`; revoked
  key, suspended, terminated, draft / not started are refused; a `renewed`
  contract's leftover key is `expired`. Derived, never stored.
- Seats: `license_activations` per (key, `instance_id`), active seats ≤
  `max_activations`, taken under a row lock on the key; activate is
  idempotent per installation; deactivate releases; staff can release.
- Renewal on payment: Finance `InvoiceLookupService.paidTotal(order)` (live
  invoices' paid total; receipts are verified when recorded, reversals
  already deducted) ≥ order grand total → the draft renewal activates (guard
  `draft`, so a payment renews once), the old contract becomes `renewed`, its
  keys (and seats) move to the renewal and keys that expired with the old
  contract get the new end. Checked when the register is read and when a key
  is validated / activated / released — no background job. A receipt reversed
  after that does not undo the renewal (staff suspend if needed).
- Log: `license_events` (append-only) for every machine call (result code,
  instance, IP, API key) and staff overrides (suspend with optional reason,
  reactivate, terminate, key revoke, seat release, renewal) with the actor.
  The M12 audit log is not extended (its action vocabulary belongs to the
  user module); the license log is the override trail.
- Validate always answers 200 with `valid` / `status`; activate / deactivate
  refuse with 403 / 404 / 409; bad API key 401, rate limit 429.
- Not built (out of v5.1 scope / not decided): entitlements and usage
  metering, subscription schedules, offline tokens, packages.

What landed:
- `docs/database/docs.dbml`: `license_activations` and `license_events`
  rewritten (company-wide), new `application_api_keys`, refs; header note
  (grace 7 days). `gen-logical-references.ts` re-run; `validate-dbml.ts` → OK.
- Drizzle schema + migration `20261106161026_licensing_api` (generated,
  inspected, applied to `ims_erp_sync`).
- Backend: `LicenseApiRepository`, `LicenseApiService`,
  `LicenseApiController` (`/licensing/v1/validate | activate | deactivate`),
  adapter `adapters/better-auth-api-keys.ts`, `utils/license.ts`
  `licenseState` / `GRACE_DAYS`; `LicensingService` gains paid auto-renewal,
  key move, override events, seats and log on the detail; staff endpoints
  `/licenses/applications/:id/api-keys` (list / issue / revoke),
  `/licenses/events`, `/licenses/:id/activations/:activationId/release`;
  Finance `InvoiceLookupService.paidTotal`; permission `license:manage_api`
  (`packages/common` rebuilt; `refresh-role-grants.ts` → 2 role rows).
- Web: `/subscription/api-keys` (own applications, issue with the secret
  shown once, revoke; replaces the stub), `/subscription/activations` (the
  validation & activation log; replaces the stub), contract detail with seats
  per key (release), activity log, grace badge, suspend with a reason;
  locales en + id (`licensing`, `api`).
- Docs: `docs/architecture/modules/licensing-subscription.md` rewritten,
  with the endpoint documentation and the pilot integration note (T32).

Verification:
- `bun run typecheck` (apps/backend) → clean.
- `NODE_ENV=test bun test` (apps/backend) → 678 pass, 0 fail (new
  `license-api.service.test.ts` 12 tests; `licensing.service.test.ts` 11).
- `bun run build` / `bun run lint` / `bun test` (apps/web-admin) → OK, no new
  lint findings, 45 pass; `bun test` (packages/locales) → 62 pass.
- e2e (Playwright + HTTP, dev servers): issued an `elk_` key on the API Keys
  screen (shown once); no key → 401, wrong key → 401; contract ended 3 days
  ago → `grace` with warning; activate PC-001 → seat; PC-002 → 409 (1 seat);
  validate with PC-002 → `not_activated`; unknown key → `unknown`; renewal
  draft linked to SO 0012, finance invoiced the remainder, issued it and
  recorded the full receipt → next validate returned `ok` until 2027-11-04
  (renewal activated by payment, key moved, old contract `renewed`);
  deactivate PC-001 then PC-002 activates. Screens checked: detail (seats,
  log), activation log, API keys. The two test API keys were revoked after
  the run; the test applications / contracts / invoice stay in the dev DB.
- `docs/database/` updated in this change (above).

Next executable task: superseded by the merge entry above.

## Completed — M03 subscription & licensing, stage 1 (register), 2026-11-06

Status: **implemented** (backend + web admin; not yet accepted by the
owner). Backlog ERP-0019 (stage 1 of 2).

Gate 1 (read): docs.dbml MODULE Licensing (tenant-scoped scaffold:
`licensable_applications` with `license_model`, `license_packages`
(duration, price), `license_contracts` (customer, package, dates, billing
cycle, value, auto-renew, `draft / active / expired / suspended / terminated
/ renewed`, renewal link), `license_keys` (hashed key, max activations,
`issued / active / suspended / expired / revoked`), activations,
entitlements, `subscription_schedules`, events); the old branch's
`licensing-subscription.md` (v5.1 M03: one pilot application, stage 1 manual
register T09, stage 2 API T23–T24, activation tied to verified payments).

Owner decisions (2026-11-06):
1. **Both kinds of license**: third-party software sold to customers (key
   typed in from the vendor, the ERP records and reminds) and the company's
   own pilot application (key generated by the ERP; the activation /
   validation API is stage 2, own application only).
2. **Billing through the sales flow**: a contract comes from SPH → sales
   order and is invoiced from the order; a renewal is a new SPH / order
   started from the due list. No invoice directly from a contract.
3. **Reminders in stage 1**: a due list (licenses ending in the next 30 days,
   filterable) and a dashboard flag; no WhatsApp/email yet (M04).
4. **Next module after M03**: M08 employees & attendance.

Gate 2 (manual grilling pass, within the owner decisions):
- New module `licensing` (schema `licensing`, programmer B), company-wide
  (ADR-0011/0012). Stage 1 implements three tables; the other scaffold tables
  (packages, activations, entitlements, usages, schedules, events) stay
  target-only until stage 2.
- `licensable_applications` rewritten: code, name, vendor, `source`
  (`third_party` — key typed in from the vendor — or `own` — key generated by
  the ERP), description, `active / retired`.
- `license_contracts` rewritten: code (new numbering type `license_contract`,
  `LIC`), customer (CRM contract, active customer) + name snapshot,
  application, `package_name` (free text: edition / plan), optional
  `sales_order_id` (the order that sold or renewed it — billing stays in the
  sales flow), start / end dates (end null = perpetual), `billing_cycle`
  (`monthly, quarterly, semi_annual, annual, one_time`, informative),
  `contract_value` (IDR minor units), `renewed_from_contract_id`, notes.
  Status `draft → active ⇄ suspended → terminated`; `active → renewed` when
  its renewal is activated. "Expired" and "due" are derived from the end date
  (active and ended / ending within N days), never a stored state, so no job
  is needed. A package table and auto-renew are dropped (not decided).
- `license_keys` rewritten: contract, `license_key`, `key_source`
  (`vendor` typed in, or `generated` by the ERP for own applications:
  `XXXXX-XXXXX-XXXXX-XXXXX`, crypto random), `max_activations` (seats),
  `expires_on` (defaults to the contract end), notes, `active / revoked`
  (revoked with a reason). Unique key among live rows. Stored readable in
  stage 1 (vendor keys must be handed to customers); masked (last 4) for
  everyone without the new `license:read_key`; stage 2 adds a hash for the
  validation API.
- Renewal: from an active (or ended) contract, `license:extend` creates a
  draft renewal (same customer / application / package, starting the day
  after the old end, same length) and the due list links to a new SPH for the
  customer; activating the renewal marks the old contract `renewed`.
- Permissions: `license:read | create | activate | extend | revoke` exist;
  `read_key` is added to the shared catalog. Grants: owner all; sales
  manager all; sales read / create / extend / read_key; customer service
  read / read_key; finance, admin, auditor read. `create` = applications,
  drafts, keys; `activate` = activate / suspend / reactivate; `revoke` =
  terminate, revoke keys. Existing roles pick the grants up with
  `bun scripts/refresh-role-grants.ts`.
- Due list `GET /licenses/due?days=30` (active contracts ending within N
  days plus ended-but-not-renewed); summary `GET /licenses/summary` (ending
  within 30 days, ended) feeds the M01 dashboard's subscriptions widget (the
  rest of that dummy dashboard is programmer A's and stays as is).
- Web: `/subscription` (contracts list with "due" and status filters),
  `/subscription/new`, `/subscription/$contractId` (detail, keys, actions),
  `/subscription/applications`; the stage-2 stubs (API keys, activations)
  stay.

What landed (2026-11-06):
- `docs/database/docs.dbml` MODULE Licensing: the three stage-1 tables
  rewritten as above (company-wide), refs fixed; `gen-logical-references.ts`
  re-run; `validate-dbml.ts` → OK.
- Drizzle `drizzle/schemas/licensing.schema.ts`; migration
  `20261106152004_licensing_register` (generated, inspected, applied to
  `ims_erp_sync`).
- Numbering type `license_contract` (`LIC`); permission `license:read_key`
  plus the grants above (`packages/common` rebuilt;
  `bun scripts/refresh-role-grants.ts` → 5 system role rows updated).
- Backend module `apps/backend/src/app/licensing/` (contracts + zod,
  `LicensingRepository`, `LicensingService`, errors with `api` keys en + id,
  `LicensingController` at `/licenses`, `utils/license.ts`), registered in
  `src/index.ts`, mounted in `src/app/app.ts`. CRM / Sales are reached only
  through `CustomerService.getActiveCustomer` and
  `SalesFulfilmentService.getLiveOrder`.
- Deviation from the design: the due list is `GET /licenses?dueWithinDays=30`
  (the list endpoint's filter; active contracts ending by then, ended ones
  included) instead of a separate `/licenses/due`. Renewal is allowed from an
  active contract (an ended contract stays `active` until renewed or
  terminated, so that covers "ended").
- Web: `/subscription` (list, status filter, "due for renewal (30 days)",
  search by code / customer / application / key; replaces the coming-soon
  stub), `/subscription/new`, `/subscription/$contractId` (terms, keys,
  activate / suspend / reactivate / renew / terminate, add / copy / revoke
  key, "Create SPH" → `/sales/quotes/new?customerId=`),
  `/subscription/$contractId/edit` (drafts), `/subscription/applications`;
  nav item and breadcrumbs; locale namespace `licensing` (en + id). The M01
  dashboard's subscriptions widget now reads `GET /licenses/summary` (only
  that widget; the rest of the dashboard stays dummy and keeps its banner).

Verification:
- `bun run typecheck` (root) → 3/3 tasks OK.
- `NODE_ENV=test bun test` (apps/backend) → 665 pass, 0 fail (new
  `test/unit/licensing.service.test.ts`, 10 tests; the numbering settings test
  now expects 16 document types).
- `bun run test` (root) → backend 665, web-admin 45, locales 62 pass.
- `bun run build` (apps/web-admin) → OK; `bun run lint` → no new findings.
- Browser (Playwright, Chromium, `sales_manager` and `finance` seed
  accounts): created a third-party and an own application; a contract ending
  in 20 days (badge "20 days left"), vendor key typed in, activated; renewed →
  draft for the next period with the same terms, activated → the old one shows
  `Renewed` with a link; own-application contract with a generated key, ended
  5 days ago ("Expired", "Ended 5 days ago"); due list; dashboard widget
  (0 ending soon, 1 expired); finance sees the key masked (`••••-XXXX`) and
  no actions. The test applications and contracts stay in the dev database
  `ims_erp_sync`.
- `docs/database/` updated in this change (above).

Next executable task: M08 employees & attendance — gate 1 (read
`docs.dbml` MODULE HR) and gate 2 with the owner before code. Stage 2 of M03
(activation / validation API for the own application) waits for the pilot
application's source access (T24).

## Completed — print margins of every document (owner feedback), 2026-11-06

Status: **implemented** (web admin only; owner feedback on the acceptance
walk-through: "mepet, tidak ada padding" on every printed document).

- `@page` margins widened to at least 18 mm left/right and 15–16 mm top
  (SPH 16/18 mm, invoice and PO 16/18/20 mm, surat jalan 15/18 mm, BAST
  18/20/15/22 mm, warranty 15/20/15/22 mm); the on-screen sheet preview
  uses `p-12`.
- Every document root sets `print-color-adjust: exact`: with the browser's
  default "Background graphics" off, the SPH amber bar, the PO teal / navy
  bars and the invoice table headers used to disappear.
- Surat jalan spacing tightened so it stays on one page; SPH totals labels
  no longer wrap.
- Verified by rendering the six prints to PDF with the print dialog's
  defaults (CSS page size, background graphics off; temporary script,
  deleted): SPH 1 page, invoice 2 (as the sample), PO 1, surat jalan 1, BAST
  1, warranty 2; colours present. `bun run lint` 0 errors, web-admin build
  and tests pass.
- Dev data: a failed 6b test run had left the private sample's address,
  phone and email in the dev company profile; they were cleared (dev DB
  only, never committed).

## Completed — user guide (EN + ID) and UML flow diagrams, 2026-11-06

Status: **done** (documentation only; no code, migration or test change).
Owner request: a user guide in English and Indonesian with notes, plus UML
diagrams.

- `docs/user-guide/en.md`, `docs/user-guide/id.md`: getting started, roles,
  first-time setup, quotation → revision → Deal → sales order, invoices / DP
  / receipts, PO → goods receipt → stock, opening stock and adjustments,
  inventory value, delivery notes, projects, BAST, warranty, service
  tickets, document numbering, and Notes (rules, required order, known
  limitations). Labels were checked against the `en` / `id` locale bundles
  and the statuses against the Drizzle schemas.
- `docs/user-guide/diagrams.md`: 11 Mermaid diagrams (end-to-end activity,
  sales / purchasing / delivery sequences, state machines of quotation,
  sales order, invoice, PO, stock adjustment, delivery note, project, BAST,
  ticket, serial unit, module contracts, cost flow). Verified by rendering
  every block with Mermaid 11 in Chromium (temporary script outside the
  repo): 11 diagrams, 0 failed.
- `docs/user-guide/README.md` index; `docs/architecture/README.md` points
  to it. Backlog: no `ERP-*` status change (documentation of ERP-0036).

## Completed — ADR-0011 port step 6c: service tickets with the warranty check, 2026-11-06

Next executable task: the ADR-0011 port is complete (steps 1–6). Open the
single pull request `merge/main-sync → main` for programmer A's review (the
inventory changes flagged in steps 4b, 5a and 5b need his approval), after the
owner's go; meanwhile the owner's acceptance walk-through of M02 / M05 / M07.

Status: **implemented** (backend + web admin; not yet accepted by the owner).
Step 6 (M07) is complete.

What landed:
- Migration `20261106083213_service_tickets` (generated, inspected, applied
  to `ims_erp_sync`): `aftersales.service_tickets` (company-wide).
- After-Sales: `ServiceTicketRepository`, `ServiceTicketService`,
  `ServiceTicketController` (`/service-tickets`, `/warranty-check`,
  `/technicians`, `/:id`, assign / start / resolve / reopen / close);
  `WarrantyService.check` (serial → shipment → live project → certificate,
  in warranty while the report date ≤ the end date). Errors with `api` keys
  en + id.
- Contracts: Sales `findShipmentBySerial` (delivery-note lines, jsonb
  containment), Projects `liveProjectOfOrder` / `getProject`.
- Web: `/projects/tickets` (list, filter, search; replaces the coming-soon
  stub), `/projects/tickets/new` (serial first: customer, project, device and
  the warranty badge fill in), `/projects/tickets/$ticketId` (assign, start,
  resolve with cost, reopen, close with the customer's confirmation).

Found while testing: a `${JSON.stringify([...])}::jsonb` parameter in a
Drizzle `sql` template did not match (the value arrived encoded twice with
bun-sql); `jsonb_build_array(${value}::text)` is used instead — worth
remembering for any other jsonb containment query.

Verification (2026-11-06):
- `bun docs/database/gen-logical-references.ts` + `bun
  docs/database/validate-dbml.ts` → `OK`. `docs/database/` updated
  (`aftersales.service_tickets` rewritten, module note).
- `NODE_ENV=development bun run drizzle:migrate` → applied.
- `bun run typecheck` → 3/3; `bun run lint` → 0 errors (warnings
  pre-existing); `bun run test` → backend 655 pass (new
  `service-ticket.service.test.ts`, warranty-check cases), web-admin 45,
  locales 58, 0 fail; `bun run build` → built.
- Browser + API check (temporary Playwright script, deleted): a serialized
  unit received by a goods receipt, sold, shipped by a delivery note; project,
  BAST and warranty (to 2027-11-05). Customer service typed the serial in the
  new-ticket form: customer, project and device filled in and "Bergaransi"
  showed; the ticket `0001/TKT/DEV/XI/26` stored the warranty code and end
  date; an unknown serial is out of warranty; the technician got 404 before
  assignment and 403 creating; after assignment the technician started and
  resolved (Rp 150.000) through the UI, closing as technician 403; customer
  service closed with the customer's confirmation (WhatsApp); no browser
  errors.
- Test data left in the dev DB: projects `0004`–`0006/PRJ/DEV/XI/26` with
  their BAST / warranty, ticket `0001/TKT/DEV/XI/26`, serials `TK-…`.

Gate 1 (read): docs.dbml `aftersales.service_tickets` (tenant-scoped scaffold:
`open / assigned / in_progress / on_hold / resolved / closed / cancelled`,
SLA, escalation, asset and employee references) and the Ticketing module
note (customer-portal tickets are a different module, programmer A; they may
escalate into an after-sales service ticket by logical reference);
module-ownership §15; numbering type `service_ticket` (`TKT`); role catalog
(`service_ticket:*` — customer service and project manager all, technician
read / update / resolve, admin read / create / update / assign); the old
branch's `service-ticket.service.ts` and tests (decisions of 2026-11-04);
`aftersales.warranty_certificates` (step 6b); delivery-note lines carry the
shipped serials. Skipped: `implementation-phases.md` (no unlanded dependency).

Gate 2 (manual grilling pass):
- `aftersales.service_tickets` rewritten to the decided model, company-wide
  (ADR-0011/0012): `code` (TKT), `customer_id` (CRM contract: active
  customer) + name snapshot, `project_id` (Projects contract; must belong to
  the customer), `serial_number`, `device_description`, `channel` (`phone,
  whatsapp, email, web, onsite, other`), reporter name / contact,
  `complaint`, `reported_at`; the warranty check stored on the ticket
  (`in_warranty`, `warranty_ends_on`, `warranty_code`); `status` `new →
  in_progress → resolved → closed` (resolved may reopen); assignee (must hold
  `service_ticket:update`, member of the caller's organization),
  `resolution`, `service_cost` (IDR minor units), resolved by / at, the
  customer's confirmation (name, channel, at) required to close, closed by /
  at. SLA, escalation, priority, asset and employee columns of the scaffold
  are dropped (not decided).
- Warranty check (also a read endpoint for the form): serial → the shipped
  delivery-note line carrying it (Sales contract `findShipmentBySerial`) →
  the order's live project (Projects contract) → its warranty certificate;
  in warranty when the report date ≤ the certificate's end date. Without a
  serial, the given project's certificate. A serial delivered to another
  customer → 422.
- Visibility: holders of `service_ticket:assign` or `:close` see every
  ticket; others only tickets assigned to them (404). Start / resolve /
  reopen: the assignee or an assigner. Create `service_ticket:create`,
  assign `:assign`, resolve `:resolve`, close `:close`.
- Web: `/projects/tickets` (list), new (customer, project, serial with the
  live warranty badge), detail with assign / start / resolve / reopen /
  close; replaces the coming-soon stub.

## Completed — ADR-0011 port step 6b: BAST and warranty certificate, 2026-11-06

Next executable task: step 6c (done, entry above).

Status: **implemented** (backend + web admin; not yet accepted by the owner).

What landed:
- Migration `20261106075940_bast_warranty_certificates` (generated,
  inspected, applied to `ims_erp_sync`): `projects.project_handover` (BAST)
  and schema `aftersales` with `warranty_certificates`.
- Projects: `HandoverRepository` / `HandoverService` (BAST create, edit,
  cancel, draft from the deal; Projects contract `requireProject` /
  `findBast` for After-Sales), routes `/projects/basts` (all visible),
  `/projects/:id/basts[/draft|/:bastId|/:bastId/cancel]`;
  `utils/project-context.ts` shared by both controllers.
- New module `src/app/aftersales`: `WarrantyRepository`, `WarrantyService`
  (one per project, start at the chosen issued BAST, end the day before the
  same date `months` later, number with the customer code, texts from the
  profile or the sample), `WarrantyController`
  (`/warranty-certificates/projects/:projectId[/draft]`).
- Sales fulfilment contract: `getOrder`, `orderLines`, `shippedLines`
  (`DeliveryNoteRepository.shippedLines`).
- Web: project page "Dokumen serah terima" card (BAST list with print / edit
  / cancel, warranty status), `/projects/$projectId/bast/new`,
  `/bast/$bastId` (edit), `/bast/$bastId/print`, `/warranty` (form),
  `/warranty/print`, `/projects/bast` (all BASTs, replaces the coming-soon
  stub); prints `bast-document.tsx` and `warranty-document.tsx` in the
  sample's layouts (Letter, Times; BAST date in words via
  `lib/terbilang.ts dateInWords`; warranty terms with "o" sub-items and bold
  phrases via `lib/document-terms.ts`). The project detail route moved to
  `$projectId/index.tsx` for the nested routes.

Verification (2026-11-06):
- `bun docs/database/gen-logical-references.ts` + `bun
  docs/database/validate-dbml.ts` → `OK`. `docs/database/` updated (BAST
  table rewritten, `aftersales.warranty_certificates` added, module notes).
- `NODE_ENV=development bun run drizzle:migrate` → applied.
- `bun run typecheck` → 3/3; `bun run lint` → 0 errors (warnings
  pre-existing); `bun run test` → backend 650 pass (new
  `handover-warranty.test.ts`: period arithmetic, several BASTs, numbering,
  frozen after close, warranty needs an issued BAST, customer code, profile
  texts), web-admin 45, locales 58, 0 fail; `bun run build` → built.
- Browser + API check (temporary Playwright script, deleted): deal shipped by
  a delivery note, project by the PM; the first BAST issued through the form
  (prefilled contract number from the customer PO, customer, "Project
  Manager") → `002/BAST/DEV/XII/2025` dated 2025-12-24; a second BAST for
  another contract → two on the project; the warranty form prefilled the
  shipped device and the sample's texts with sub-items; saved →
  `001/SG-GARANSI/DEV-SPHSKL8P/2026`, 2025-12-24 → 2026-12-23; a warranty on
  the cancelled second BAST → 422; the technician issuing a BAST → 403; the
  BAST list shows them; no browser errors. Both prints rendered to PDF and
  compared with the sample: BAST on one Letter page (title, number, date in
  words, parties, contract line, table, scope with bold, closing, two
  signatures), warranty on two pages (letterhead, number / date, company,
  statement, project, A table, B period, page 2 C ✅ / ❌ lists with "o"
  sub-items, D, closing, signatory). The dev company profile was filled for
  the print and restored afterwards.
- Test data left in the dev DB: projects `0002`–`0003/PRJ/DEV/XI/26`, BASTs
  `001`–`003/BAST/DEV/XII/2025`, warranty `001/SG-GARANSI/DEV-SPHSKL8P/2026`.

Owner decisions (2026-11-06, asked during this step): a project may have
**several BASTs** (the sample has two for one project, one per contract);
the network topology page of the sample is **not** built into the system.

Gate 1 (read): docs.dbml `projects.project_handover` (scaffold: tenant
scoped, `draft / scheduled / completed / cancelled`, no content columns) and
After-Sales (no certificate table; `warranty_policies` / `warranty_claims` are
a different concept); module-ownership §9 / §15 (warranty belongs to
After-Sales, BAST to Projects; numbering map `bast → projects`,
`warranty → aftersales`); numbering patterns `{SEQ:3}/BAST/{COMPANY}/{MM_ROMAN}/{YYYY}`
and `{SEQ:3}/SG-GARANSI/{COMPANY}-{CUSTOMER}/{YYYY}`; company profile
(legal name, address, phone, email, logo, signature image, signatory,
warranty coverage / exclusions / service terms); the old branch's
`handover.service.ts` / `domain/handover.ts` defaults; the private sample
(US Letter: BAST without letterhead, Times, date in words; warranty with the
letterhead, sections A–D with sub-bullets and bold phrases, signature).
Skipped: `implementation-phases.md` (no unlanded dependency).

Gate 2 (manual grilling pass):
- `projects.project_handover` rewritten as the BAST document (Projects,
  company-wide, no intra-module FK): `project_id`, `code` (numbered on
  creation by the BAST date), `bast_date`, first party (company, name,
  title), second party (company, name, title), `contract_number`,
  `work_title`, `project_name`, `items` (jsonb: description, volume,
  remarks), `scope` (jsonb list), `status` `issued / cancelled`. Several per
  project. Created, edited and cancelled only while the project is active
  (`project:update`); read with `project:read` and project visibility.
- New module `aftersales` (programmer B, M07) with
  `aftersales.warranty_certificates`: one live certificate per project;
  `project_id` and `bast_id` are logical references validated through the
  Projects contract (`ProjectHandoverContract`), `customer_id` through CRM
  (customer code in the number). Start = the chosen BAST's date; end = the
  day before the same date `months` later (clamped to month end); `months`
  1–120 (default 12). Snapshot of product summary, project name / location /
  owner, items, and the coverage / exclusions / service-terms texts (from the
  company profile, else the sample's texts). Text syntax: one item per line,
  a line starting with `o ` or `- ` is a sub-item of the previous one,
  `**…**` prints bold — needed to print the sample exactly. Editable while
  the project is not cancelled (also after closing).
- Defaults: BAST from the order (lines with "Telah selesai terpasang dan
  berfungsi dengan baik", attention, customer PO as contract number), the
  company and the PIC; warranty items from the shipped delivery-note lines
  with their serials (Sales fulfilment contract).
- Prints (Letter): the BAST copies the sample (Times, centered title, the
  day and date in words, the parties, "Dan berdasarkan kepada", the table, the
  scope list, the closing, two signature blocks); the BAST number is added
  under the title (the sample has none) as on the surat jalan. The warranty
  copies sample pages 3–4 (letterhead, A–D, ✅ / ❌ headings, sub-bullets,
  bold phrases, "Hormat kami," with the signature image and signatory). The
  sample's period sentence is printed as is.

## Completed — ADR-0011 port step 6a: projects (M07 part 1), 2026-11-06

Next executable task: step 6b (done, entry above).

Status: **implemented** (backend + web admin; not yet accepted by the owner).
Step 6 is split: 6a projects (from a deal, checklist tasks, evidence files,
direct costs, close / cancel), 6b BAST and warranty certificate with the
private samples' prints, 6c service tickets with the warranty check.

What landed:
- Migration `20261106071435_projects_core` (generated, inspected, applied to
  `ims_erp_sync`): schema `projects` with `projects`, `project_tasks`,
  `project_evidence`, `project_costs` (company-wide, no intra-module FKs).
- Module `src/app/projects`: `ProjectRepository`, `ProjectService`,
  `ProjectLookupService` (contract for Sales), `ProjectController`
  (`/projects`, `/open-deals`, `/staff`, `/:id`, close / cancel, tasks,
  evidence (multipart), costs (multipart, void)); errors with `api` keys en +
  id; `utils/project-files.ts` (type by magic bytes, 15 MB).
- Sales: `SalesFulfilmentService` (live deals, shipped material value from
  `DeliveryNoteRepository.shippedValues`); cancelling an order with a live
  project → 422 `sales.orderHasProject`.
- Web: `/projects` (list, filter, search), `/projects/new` (deal picker,
  PIC), `/projects/$projectId` (stage stepper, edit, close, cancel, checklist
  with assignee / state per task, evidence upload and gallery, direct costs
  with receipts, materials and margin). New locale namespace `projects`
  (en + id).

Verification (2026-11-06):
- `bun docs/database/gen-logical-references.ts` + `bun
  docs/database/validate-dbml.ts` → `OK` (260 tables). `docs/database/`
  updated (projects rewritten, evidence and costs added, module note).
- `NODE_ENV=development bun run drizzle:migrate` → applied.
- `bun run typecheck` → 3/3; `bun run lint` → 0 errors (warnings
  pre-existing); `bun run test` → backend 646 pass (new
  `project.service.test.ts`, sales-order guard), web-admin 45, locales 58,
  0 fail; `bun run build` (web-admin) → built.
- Browser + API check (temporary Playwright script, deleted): deal by sales /
  owner; the project manager created `0001/PRJ/DEV/XI/26` through the UI
  (stage "Persiapan", six default tasks), a second project on the deal 409;
  the technician got 404 until the PM assigned "Uji fungsi sistem", then
  marked it done, could not move another task, uploaded a test photo (a fake
  PNG was refused with the Indonesian message) and saw no costs or close
  button; the PM recorded Rp 750.000 with a receipt (margin Rp 110.250.000
  against Rp 111.000.000); close stayed disabled until training and BAST
  evidence existed, then closed → `closed / warranty`; finance reads costs
  but recording one is 403; cancelling the order → 422; no browser errors.
- Test data left in the dev DB: SPH / SO `Proyek uji …`, project
  `0001/PRJ/DEV/XI/26` and its files in object storage.

Gate 1 (read): docs.dbml MODULE Projects (scaffold: tenant-scoped
`projects.projects` with `planned / in_progress / on_hold / completed /
cancelled`, `project_tasks`, `project_handover`, no evidence or cost tables)
and After-Sales (`warranty_policies`, `warranty_claims`, `service_tickets`);
`module-ownership.md` §9 (Projects: zero intra-module foreign keys by design,
the service validates its own hierarchy) and §15; the old branch's M07
implementation (`feat/m05-inventory-purchasing`: `project.schema.ts`,
`project.service.ts`, `handover.service.ts`, `service-ticket.service.ts`,
tests, e2e spec — decisions of 2026-11-04); numbering type `project` (`PRJ`);
role catalog (`project:*` incl. `read_cost`, `task:*`; project manager,
technician, finance); `OBJECT_STORAGE_TOKEN`; the BAST / warranty sample.
Skipped: `implementation-phases.md` (no unlanded dependency).

Gate 2 (manual grilling pass):
- Ownership: new module `projects` (schema `projects`, programmer B, ADR-0011
  §13). Company-wide like the deals it comes from (ADR-0011/0012): no
  `organization_id`. Following module-ownership §9, no foreign keys inside the
  module either; the project service validates task / evidence / cost
  parents.
- `projects.projects` rewritten to the decided model: one live project per
  sales order (partial unique index), snapshot of order code, quotation code,
  customer id + name, title and contract value (the order's grand total incl.
  VAT); `site_name`; PIC (`pic_user_id`, must hold `project:update`);
  target start / end (Jakarta business dates); `stage` (`preparation,
  delivery, installation, testing, training, handover, warranty`) and
  `status` (`active, closed, cancelled`). The scaffold's budget, progress,
  handover status, type and branch columns are dropped (not decided).
- `project_tasks` rewritten: position, title, stage, assignee (must hold
  `task:update`), due date, `todo / in_progress / done`, done by / at; soft
  removal. A new project gets the six default tasks (one per stage up to
  handover).
- New `project_evidence` (function test, training, signed BAST, photo,
  other; JPG/PNG/WebP/PDF by magic bytes, 15 MB) and `project_costs`
  (material, transport, accommodation, subcontract, other; amount in IDR
  minor units, optional receipt; voided with a reason, never deleted).
- Rules (old branch, decided 2026-11-04): visibility — holders of
  `project:assign|read_cost|export` or `service_ticket:assign` see every
  project, others only projects they lead or have a task in (404). Only an
  active project changes. Close needs testing, training and BAST evidence and
  moves the stage to `warranty`; cancel needs a reason and frees the deal.
  Task status: the assignee, or a `task:assign` holder. Costs only with
  `project:read_cost`; the cost card adds the material value shipped by the
  order's delivery notes (at average cost) and compares with the contract
  value.
- Cross-module contracts: Sales exports `SalesFulfilmentService` (live
  orders for the deal picker, one order, shipped material value); Projects
  exports `ProjectLookupService.hasLiveProject(orderId)` so cancelling an
  order with a live project is refused (422 `sales.orderHasProject`), the
  same lookup pattern as Finance. Staff pickers list members of the caller's
  organization holding the permission (as leads do).
- Web: `/projects` list, new (deal picker), detail with stage, tasks,
  evidence and costs; replaces the coming-soon stub. BAST and tickets stay
  stubs until 6b / 6c.

## Completed — ADR-0011 port step 5b: adjustment cost, opening stock, inventory value, 2026-11-06

Next executable task: step 6a (done, entry above).

Status: **implemented** (backend + web admin; not yet reviewed by programmer A
or accepted by the owner). Step 5 (5a + 5b) is complete. Touches programmer
A's adjustment workflow and inventory module: **review required** in the
merge PR (ADR-0011 §6, §13) — `adjustment.service.ts` (`unitCost` kept on the
line, increases post at it), `adjustment.controller.ts` (cost stripped in and
out without `product:read_cost`), `adjustment-form.tsx` / `adjustment-detail.tsx`
/ `stock-list.tsx` (cost field and column, value link), new
`stock-valuation.*` files.

What landed:
- Migration `20261105192747_adjustment_item_unit_cost` (generated, inspected,
  applied to `ims_erp_sync`): `stock_adjustment_items.unit_cost` + check.
- Opening stock = an `increase` adjustment with reason `opening_stock` (form
  suggestion) and a unit cost per line; null = moving average.
- `GET /stock/valuation` (`stock:read` + `product:read_cost`):
  `StockValuationRepository` / `Service` / `Controller`, mounted before
  `StockController`. Web `/inventory/stock/value` (sidebar "Nilai
  Persediaan", link on the stock page).

Findings for programmer A (pre-existing, not changed here):
- `adjustment-form.tsx` loads `/warehouses` (application-admin only,
  ADR-0008), so the warehouse and purchasing roles get 403 and cannot pick a
  warehouse — they cannot raise adjustments (or opening stock) from the UI.
  The receipt and delivery forms use their own warehouse endpoints for this.
- Dev seed balances carry no cost (valued at Rp0); real opening stock must
  be entered through `opening_stock` adjustments. ITEM-013 (a serialized
  `tool`, not stock-tracked) still got a stock movement from a 4b goods
  receipt test, because goods receipts post for every line.

Verification (2026-11-06):
- `bun docs/database/gen-logical-references.ts` + `bun
  docs/database/validate-dbml.ts` → `OK` (258 tables, 0 cross-module refs, 0
  timestamp gaps). `docs/database/` updated (`stock_adjustment_items.unit_cost`).
- `NODE_ENV=development bun run drizzle:migrate` → applied.
- `bun run typecheck` → 3/3; `bun run lint` → 0 errors (warnings
  pre-existing); `bun run test` → backend 639 pass (new: opening-stock cost
  test, `stock-valuation.service.test.ts`), web-admin 45, locales 54, 0 fail;
  `bun run build` (web-admin) → built.
- Browser + API check (temporary Playwright script, deleted): the owner
  raised opening stock through the adjustment form (cost field shown, Rp
  25.000 → `unit_cost` 2,500,000, reason `opening_stock`), submitted,
  approved and posted → balance `10.000 @ 2,500,000 = 25,000,000` and the
  grand total rose by exactly 25,000,000; the warehouse role sees no cost
  field, a cost it sends is stored as null, `/stock/valuation` → 403; the
  value page lists the balances with per-warehouse totals; only browser
  errors: the two pre-existing `/warehouses` 403s above.
- Test data left in the dev DB: opening-stock adjustments for ITEM-012 and
  ITEM-006 (10 each at Rp 25.000), one cancelled warehouse adjustment.

Gate 1 (read): docs.dbml `inventory.stock_adjustments` /
`stock_adjustment_items` (no cost column), `stock_balances.average_cost` /
`total_value` (step 4b); `AdjustmentService.create` / `buildLines` / `post`
(posts `adjustment_in` / `adjustment_out` through `StockService.postMovement`,
creator cannot approve — `SelfApprovalForbiddenError` already exists);
`adjustment.controller.ts` grants (`stock_adjustment:create|approve|post`);
role catalog (purchasing "prepares opening stock / adjustments with costs").
Skipped: `logical-references.md` (no new cross-module link; same module),
`implementation-phases.md` (no unlanded dependency).

Gate 2 (manual grilling pass):
- `inventory.stock_adjustment_items.unit_cost` (bigint, nullable, IDR minor
  units): the cost an increase line enters stock at. Null = the current
  moving average (a recount surplus). Ignored for decreases (they always
  leave at the average). This is the opening-stock use of ADR-0011 §6: an
  `increase` adjustment with reason code `opening_stock` and a cost per
  line, through the existing approval chain (creator cannot approve). No
  second table, no new adjustment type.
- Cost visibility: only callers with `product:read_cost` may set or see
  `unit_cost`; for others the controller strips it from the body and the
  responses (the warehouse counts, purchasing/owner price).
- Inventory value view: read-only `GET /stock/valuation` (inventory module,
  `stock:read` + `product:read_cost`): non-zero balances with item SKU /
  name / unit and warehouse code / name, quantity, average cost and value,
  plus totals per warehouse and the grand total — computed in SQL from
  `stock_balances` (the ledger-maintained truth). Web `/inventory/stock/value`.
- No journal entries (accounting module not ported; ADR-0011 §5 covers the
  inventory value only).

## Completed — ADR-0011 port step 5a: delivery notes (surat jalan), 2026-11-06

Next executable task: step 5b (done, entry above).

Status: **implemented** (backend + web admin; not yet reviewed by programmer A
or accepted by the owner). Step 5 is split: 5a delivery notes with the surat
jalan print, 5b adjustment cost / opening stock and the inventory value view.
Touches programmer A's inventory contracts (review in the merge PR):
`ItemService.inStockSerials` / `sellUnits` and
`SerialUnitRepository.listInStockSerials` / `sell` (new, additive).

What landed:
- Migration `20261105190928_sales_delivery_notes` (generated, inspected,
  applied to `ims_erp_sync`): `sales.delivery_notes` (company-wide, rewritten
  per the DBML) and `sales.delivery_note_items`.
- Sales: `DeliveryNoteRepository`, `DeliveryNoteService`,
  `DeliveryNoteController` (`/delivery-notes`, `/warehouses`,
  `/deliverable-orders`, `/serials`, `/:id/ship|deliver|cancel`);
  `SalesOrderRepository.allocateDelivery` (row locks, open-quantity guard,
  line fulfilment) and `markInProgress`; cancelling an order with live notes
  → 422 `sales.orderDelivered`. Errors with `api` keys en + id.
- Shipping: stock-tracked lines post `issue` at the moving average (cost kept
  on the line, hidden without `product:read_cost`); serialized lines sell
  their units (`in_stock → sold`, customer set; the item kind must allow
  `sold`). The two item flags are handled independently: dev seed has
  serialized tools that are not stock-tracked (ITEM-013..016), which
  contradicts `assertItemShape` — flagged for programmer A.
- Web: `/sales/deliveries` (list, new with `?salesOrderId`, detail with
  ship / deliver / cancel, print), "Surat jalan" card on the sales order
  page, sidebar entry; print `delivery-note-document.tsx` in the sample's
  layout (Letter, Arial). Locale keys `deliveries.*`, `delivery.*`,
  `deliveryStatus.*`, `sj.*` in en + id.

Verification (2026-11-06):
- `bun docs/database/gen-logical-references.ts` + `bun
  docs/database/validate-dbml.ts` → `OK` (258 tables, 0 cross-module refs, 0
  timestamp gaps). `docs/database/` updated (delivery notes rewritten, lines
  added, sales header note).
- `NODE_ENV=development bun run drizzle:migrate` → applied.
- `bun run typecheck` → 3/3; `bun run lint` → 0 errors (remaining warnings
  pre-existing); `bun run test` → backend 637 pass, web-admin 45, locales 54,
  0 fail; `bun run build` (web-admin) → built.
- Browser + API check (temporary Playwright script, deleted): SPH by sales,
  approved by the owner, sales order; two serialized units received by a
  goods receipt; the warehouse role prepared a note through the UI (recipient
  prefilled from the order, serials ticked from the in-stock list) →
  `0005/SJ/DEV/XI/26`, order lines 3/4 partial, 2/2 and 1/1 fulfilled;
  over-delivery 422; cancelling the order 422; sales role reads notes 200;
  print rendered to PDF and compared with the sample (Letter, same blocks,
  seven-row table, Catatan box, three signatures); ship through the UI →
  balance `104.000 → 101.000`, value down exactly 3 × 7,272,727, both units
  `sold`, line cost visible to the owner and null for the warehouse, order
  `in_progress`; delivered with the receiver name; a second note cancelled
  gave its quantity back; no browser errors.
- Test data left in the dev DB: SPH/SO/PO `Uji SJ …`, notes
  `0001`–`0006/SJ/DEV/XI/26`, serials `SJ-…`.

Gate 1 (read): docs.dbml `sales.delivery_notes` (tenant-scoped scaffold, no
lines, statuses `prepared / shipped / delivered / returned`),
`sales.sales_orders` / `sales_order_items` (`quantity_delivered`,
`fulfillment_status` already exist), `inventory.stock_movements` (no
reference-type vocabulary except borrowing), `serial_tracked_items`
(`status`, `warehouse_id`, `customer_id`, `stock_movement_id`); ADR-0011 §4
(a shipped delivery note makes a unit `sold`), §5 (delivery notes post
`issue` movements), §7 (every delivery document names its warehouse,
storage optional); numbering type `delivery_note` (`SJ`); grants
`stock:issue` / `stock:read`; the private surat jalan sample (Letter size).
Skipped: `implementation-phases.md` (no dependency on an unlanded step).

Gate 2 (manual grilling pass):
- Ownership: `sales.delivery_notes` + new `sales.delivery_note_items`, owned
  by the sales module (programmer B, ADR-0011 §13). Company-wide like the
  orders (ADR-0011/0012): `organization_id` dropped. `warehouse_id`,
  `bin_id`, `item_id`, `stock_movement_id` are logical references validated
  through the inventory contracts (`StockService.resolveScope`,
  `WarehouseService.getWarehouse`, `ItemService.getItem`).
- Lifecycle: `prepared` (numbered `SJ` on creation so the driver's copy can
  be printed) → `shipped` (posts one `issue` movement per stock-tracked line
  at the moving average, records the cost on the line, marks the listed
  serial units `sold` to the order's customer) → `delivered` (receiver name
  and date). `prepared` may be `cancelled`; shipped notes are final
  (returns are `sales.sales_returns`, later). `returned` dropped from the
  vocabulary, `cancelled` added.
- Quantities: a line ≤ what the order line still has open; open = ordered −
  `quantity_delivered`, where `quantity_delivered` counts every live
  (non-cancelled) note, updated under a row lock on create and given back on
  cancel. Line fulfilment `partial` / `fulfilled`; the order goes
  `confirmed → in_progress` on the first shipment. Custom lines (no item)
  and non-stock items print but post no movement.
- Serials: serialized lines need one serial per unit at creation; shipping
  checks each unit is `in_stock` in that warehouse (atomic update guarded on
  status and warehouse), else 422. New inventory contract method
  `ItemService.sellUnits(itemId, serials, {warehouseId, customerId,
  stockMovementId}, tx)`.
- Unit of work: `TRANSACTION_RUNNER_TOKEN` (ship = movements + serials +
  status in one transaction). No service injects `DRIZZLE_TOKEN`.
- Print (sample, Letter): logo + company letterhead, "SURAT JALAN BARANG /
  PROYEK / KONSTRUKSI", Tanggal / Nama Proyek / Lokasi Proyek, Data
  Pengirim (company profile), Data Penerima (name, address, PIC, phone/email),
  table No. / Nama Barang / QTY / Satuan / Harga / Keterangan (padded to the
  sample's 7 rows; serials go in Keterangan), Catatan (defaults to the
  sample's warranty sentence, editable), three signatures Supir / Pengirim /
  Penerima. The sample has no number line; the SJ number is added as the
  first field ("No. Surat Jalan") because the document must be traceable.
- Permissions: create / ship / deliver / cancel with `stock:issue`
  (warehouse, owner); read with `stock:read` or `sales_order:read`. Cost on
  lines only with `product:read_cost`. Cancelling a sales order with live
  delivery notes → 422.

## Completed — ADR-0011 port step 4b: goods receipts and moving-average cost, 2026-11-06

Status: **implemented** (backend + web admin; not yet reviewed by programmer A
or accepted by the owner). Touches programmer A's stock ledger: **review
required** in the merge PR (ADR-0011 §5, §13) — `stock.service.ts`
(`postMovement` cost, `reverseMovement`, `recomputeFromLedger` cost replay),
`balance.repository.ts` (`lockForCost`, `setCost`), `movement.repository.ts`
(`ledgerRows`, ledger scope), `serial-unit.repository.ts`, `stock.controller.ts`
(cost hidden without `product:read_cost`).

What landed:
- Migration `20261105183351_stock_cost_goods_receipts` (generated, inspected,
  applied to `ims_erp_sync`): `stock_movements.unit_cost`,
  `stock_balances.average_cost` / `total_value`, `procurement.goods_receipts`
  / `goods_receipt_items` per the rewritten DBML.
- Inventory: `utils/moving-average.ts` (`applyMovementCost`,
  `exVatUnitCost`), cost in `postMovement` under a `FOR UPDATE` balance lock,
  reversal at the original cost, ledger replay in `recomputeFromLedger`;
  `ItemService.registerUnit(…, tx)` with PO line / movement links.
- `src/providers/database/transaction-runner.ts` (`TRANSACTION_RUNNER_TOKEN`)
  — the receipt, PO progress, movements and serial units commit together.
- Procurement: `GoodsReceiptService` / `GoodsReceiptController`
  (`/goods-receipts`, `/goods-receipts/warehouses`,
  `/goods-receipts/receivable-orders`), `PurchaseOrderRepository.receive`
  (locks the PO, refuses over-receipt), errors with `api` locale keys.
- Web: `/procurement/receipts` (list, new, detail), "Terima barang" on the PO
  page; locale keys `receipts.*` / `receipt.*` in en + id.

Pre-existing defects in programmer A's inventory code found and fixed here
(flag in the review):
1. `serial-unit.repository.create` never set `created_at` (NOT NULL, no
   default) — every serial unit insert failed with 500. Now set on insert.
2. The `stock_balances` unique indexes treated `bin_id IS NULL` as distinct,
   so every `ON CONFLICT` upsert of a bin-less balance inserted a new row
   (one row per movement). Custom migration
   `20261105185010_stock_balances_nulls_not_distinct` (`drizzle-kit generate
   --custom`, hand-written) merges duplicates into the oldest row and rebuilds
   both partial indexes `NULLS NOT DISTINCT` (PostgreSQL 15+; dev runs 18.6).
   Drizzle's index builder cannot express it, so the schema carries a comment;
   `drizzle-kit generate` afterwards printed "No schema changes". DBML index
   notes updated.
3. `recomputeFromLedger` selected movements by the movement's own
   `organization_id` (the poster), while balances are scoped by the
   warehouse's organization — a tenant user receiving into a shared warehouse
   was dropped from the recompute. `ledgerTotals` / `ledgerRows` now select by
   the warehouse's scope (`balanceScopeFilter`).

Verification (2026-11-06):
- `bun docs/database/gen-logical-references.ts` + `bun
  docs/database/validate-dbml.ts` → `OK` (257 tables, 0 cross-module refs, 0
  timestamp gaps).
- `NODE_ENV=development bun run drizzle:migrate` → applied (index definitions
  checked with `pg_indexes`: `NULLS NOT DISTINCT`; 0 duplicate balance keys).
- `bun run typecheck` → 3/3; `bun run lint` → 4/4; `bun run test` → backend
  630 pass, web-admin 45 pass, locales 54 pass, 0 fail; `bun run build`
  (web-admin) → built.
- Browser + API check (temporary Playwright script, deleted): recompute of
  the shared scope rebuilt `80.000 @ 5,000,000 = 400,000,000`; a partial
  receipt through the UI as the warehouse role (BPB numbered
  `0013/BPB/DEV/XI/26`, serials `in_stock`), over-receipt 422, the rest
  received → PO `received`, cancel of a received PO 422; a second PO at
  another price → one balance row `110.000 @ 7,272,727 = 800,000,000`
  (expected value and average match); the warehouse role sees no cost fields;
  no browser errors.
- `docs/database/` updated (DBML cost columns, goods receipts, balance index
  notes).
- Test data left in the dev DB: several test POs `Uji BPB …` with their
  receipts and serials `SN-…`.

Next executable task: step 5a (done, entry above).

Gate 1 (read): docs.dbml `inventory.stock_movements` / `stock_balances` (the
note says valuation was removed, OPEN-3) and `procurement.goods_receipts` /
`goods_receipt_items`; `StockService.postMovement` / `reverseMovement` /
`recomputeFromLedger`, `BalanceRepository.applyDelta`, `ItemService.registerUnit`
and the serial-unit columns `purchase_order_line_id` / `stock_movement_id`;
the old branch's goods-receipt rules (posted on creation, immutable,
corrections through adjustments; cost = ex-VAT unit price); numbering type
`goods_receipt` (`BPB`); grants `stock:receive` (warehouse, owner).

Gate 2 (manual grilling pass):
- Cost (ADR-0011 §5 supersedes OPEN-3 for the inventory value; the journal
  still waits for accounting): `stock_movements.unit_cost` (bigint, the cost
  each movement was valued at) and `stock_balances.average_cost` /
  `total_value` (bigint) per balance row. Inbound with a cost →
  `value += round(qty × cost)`, `average = round(value / qty)`; inbound
  without a cost takes the current average; outbound takes the average, and
  the last unit out takes the exact remaining value (no drift). Reversals
  use the original movement's cost. The balance row is locked (`FOR
  UPDATE`) for the cost update; quantities keep the atomic `ON CONFLICT`
  delta. `recomputeFromLedger` replays the ledger in order so cost is
  rebuilt too (the test oracle). Cost columns reach the client only with
  `product:read_cost`.
- Cross-module unit of work: new provider `TRANSACTION_RUNNER_TOKEN`
  (`run(work(tx))`) — the procurement service runs the receipt, its PO
  progress, the stock movements (`postMovement(input, tx)`) and serial units
  (`registerUnit(…, tx)`, new optional `tx`) in one transaction (the old
  branch's ADR-0009 rule). No service injects `DRIZZLE_TOKEN`.
- Goods receipts (`procurement.goods_receipts`, company-wide): only for
  `sent` or `partially_received` POs; one warehouse (bin optional) per
  receipt; posted on creation (status `posted`, DBML `draft / cancelled`
  dropped), numbered `BPB` on creation, immutable (corrections are stock
  adjustments); quantities ≤ what is still open per line; PO becomes
  `partially_received` / `received`; `receipt_date` business date,
  `supplier_delivery_ref` (supplier's surat jalan). Lines:
  `purchase_order_item_id` (same-module FK), item snapshot, `quantity`,
  `unit_cost` = ex-VAT unit price (VAT-included POs: price × 10000 /
  (10000 + rate), half-up), `serial_numbers` (jsonb array; one per unit for
  serialized items, which become `in_stock` units linked to the PO line and
  the movement). DBML `quantity_rejected` / `rejection_reason` / `lot_number`
  dropped (rejects are simply not received).
- Permissions: create with `stock:receive` (warehouse, owner); read with
  `stock:read` or `purchase_order:read`; receivable POs are listed through
  the receipt controller so the warehouse needs no PO grant.
- Web: `/procurement/receipts` (list, detail, new from a PO), "Terima barang"
  on a sent PO. No print (no sample).

## Completed — ADR-0011 port step 4a: suppliers and purchase orders, 2026-11-06

Status: **implemented** (backend + web admin; not yet reviewed by programmer A
or accepted by the owner). Step 4 is
split: 4a suppliers + purchase orders with the PO print, 4b goods receipts +
moving-average cost (ADR-0011 §5).

Gate 1 (read): docs.dbml Procurement module (`suppliers`, `supplier_contacts`,
`supplier_addresses`, `purchase_orders`, `purchase_order_items`,
`goods_receipts`, `goods_receipt_items`); the old branch's owner-approved
purchasing (`purchasing.schema.ts`, `purchase-order.service.ts`,
`po-totals.ts`, contracts); ADR-0011 §5 and §12 (module name `procurement`,
cost on the ledger); numbering (`PURCHASE_ORDER_PATTERN`
`{TYPE}/{COMPANY}-{SUPPLIER}/{CATEGORY}/{MM}{YY}/{SEQ:3}`); role grants
(`supplier:*` incl. `read_bank`, `purchase_order:*`); the private PO sample.
Skipped: purchase requests and returns (not in the approved scope).

Gate 2 (manual grilling pass):
- Ownership: new **Procurement** module (`app/procurement`, schema
  `procurement`), company-wide (no `organization_id`, ADR-0011).
- Suppliers: DBML columns plus the owner-approved ones (`website`,
  `address_line`, `village_id` → Location contract, `postal_code`,
  `pic_name/phone/email/title` printed on the PO, `payment_term_note`);
  `code` upper-case letters/digits (it is `{SUPPLIER}` in the PO number),
  unique among live rows; statuses `active | inactive` (DBML `blocked`
  dropped); `owner_user_id` dropped. Bank details only reach holders of
  `supplier:read_bank` (dynamic resolver); others neither see nor overwrite
  them. `supplier_contacts` / `supplier_addresses` stay unbuilt (one PIC and
  one address are printed).
- Purchase orders: `draft → submitted → approved → sent`, rejection returns
  to `draft` with the reason; `partially_received / received` come with 4b;
  `draft | submitted | approved | sent → cancelled` with a reason while
  nothing was received. One-level approval with `purchase_order:approve`,
  never by the PO's creator. Numbered on approval from the order date with
  the supplier code and the category code (`HW | SW | JS | LN`). Only drafts
  are editable.
- PO columns: DBML names (`code`, `supplier_id`, `status`, `order_date`,
  `expected_delivery_date`, `subtotal`, `tax_total`, `grand_total`,
  `currency_code`, `submitted_at`, `approved_by/at`, `sent_at`,
  `cancelled_reason`) plus `supplier_snapshot`, `category`, `subject`,
  `supplier_quote_ref/date`, `project_name`, `buyer_pic_name`, `vat_mode`
  (`none | included | added`, the sample's "PPN Included") and
  `vat_rate_bps`, `payment_terms`, `terms`, `notes`, `rejection_reason`,
  `created_by`, `submitted_by`, `sent_by`, `cancelled_by/at`, `deleted_at`.
  Dropped: `purchase_request_id`, `shipping_total`, `payment_terms_days`,
  `ship_to_address_text`, `closed_at`.
- PO items: `item_id` → `inventory.items` (active items only, validated
  through `ItemService.getActiveItems`); sku / name / specification / unit
  snapshot; `quantity numeric(18,3)`; `unit_price` defaults to the item's
  purchase price; `line_total = round(quantity × unit_price)`;
  `quantity_received` for 4b. Dropped: `tax_amount`, `unit_id`,
  `quantity_rejected` (VAT is per PO; units are a fixed list).
- Money: bigint minor units; VAT `added` = on top, `included` = derived
  from the total (DPP = total × 10000 / (10000 + rate)), half-up BigInt.
- Print: exactly the company's PO sample. No PO approval history table
  (statuses carry who/when).
- Web: `/procurement/suppliers` (list, form, detail), `/procurement/purchase-orders`
  (list, form, detail with submit / approve / reject / send / cancel,
  print).

What landed:
- docs.dbml first (`procurement.suppliers`, `purchase_orders`,
  `purchase_order_items` company-wide; the stale `purchase_request_id` ref
  removed); `gen-logical-references.ts` → 498 refs; `validate-dbml.ts` → OK.
- Migration `20261105180613_procurement_suppliers_purchase_orders`
  (`CREATE SCHEMA procurement`, 3 tables, partial unique codes, checks), read
  and applied to `ims_erp_sync`.
- Backend: new module `app/procurement` (`SupplierService` with bank
  masking, `PurchaseOrderService`, repositories, `utils/po-totals.ts`,
  `errors/procurement.errors.ts`, controllers `/suppliers`,
  `/purchase-orders`), registered in `src/index.ts`, mounted in
  `app/app.ts`; `procurement.*` API keys (en + id).
- Web: `lib/procurement-api.ts`, `components/procurement/{supplier-form-dialog,
  purchase-order-form, purchase-order-document}.tsx`, supplier and PO routes,
  breadcrumb labels, `procurement` locale namespace (en + id).

Verification (2026-11-06):
- Backend `bunx tsc --noEmit -p .` clean; `NODE_ENV=test bun test` → 619 pass
  (`test/unit/procurement.service.test.ts`, 7 tests).
- Web `bun run build` OK, `bunx tsc -b` clean, `bun test` → 45 pass; locales
  → 54 pass; lint: no warnings in new files.
- Browser (temporary Playwright script, deleted): `purchasing.seed` creates a
  supplier with bank details in the UI; `auditor.seed` reads it with the bank
  columns null (`bankVisible: false`); `purchasing.seed` creates a PO from
  an inventory item (33 × Rp 1.900.000, PPN included), submits it and gets
  no approve button; the owner approves → `PO/DEV-HIT9ND3/HW/1126/001`;
  purchasing marks it sent. PO printed to PDF and compared with the sample
  (header, teal bar, facts grid, buyer/supplier blocks, navy item table,
  subtotal / PPN Included* / TOTAL PURCHASE ORDER, terbilang, numbered terms
  with bold titles, notes, signatures, footer line). The company profile
  used for the print was restored.
- Test data left in the dev DB: supplier `HIT9ND3` and its PO.

Next: step 4b (done, entry above).

## Completed — ADR-0011 port step 3d-2: invoices, DP and receipts, 2026-11-06

Status: **implemented** (backend + web admin; not yet reviewed by programmer A
or accepted by the owner).

Gate 1 (read): docs.dbml Finance module (`finance.invoices`,
`invoice_items`, `payments`, `receipts`, `payment_allocations`); the old
branch's owner-approved billing (`invoice.service.ts`, `invoice-terms.ts`,
`payment-schedule.ts`: free terms, numbering on issue, receipts valid on
creation, corrections by reversal); role grants `invoice:*` / `receipt:*`;
the private invoice sample (layout). Skipped: `implementation-phases.md` S4
detail beyond the finance tables (S4 is the finance step; this lands its
invoice/receipt part only).

Gate 2 (manual grilling pass):
- Ownership: new **Finance** module (`app/finance`, schema `finance`):
  `InvoiceService`, `ReceiptService`, controllers `/invoices`, `/receipts`.
  Company-wide (no `organization_id`, ADR-0011).
- Cross-module: Finance reads orders through a Sales contract
  (`SalesBillingService.getOrderForBilling` / `listOrdersForBilling`, live
  orders only); Sales asks Finance before cancelling an order
  (`InvoiceLookupService.hasLiveInvoices`) — an order with live invoices
  cannot be cancelled. Two small services, so no DI cycle.
- Invoices (owner decisions 2026-10-31 / 2026-11-04): free billing terms per
  invoice — percentage of the order tax base, a VAT-inclusive amount, the
  remainder, or the next planned term; the term that reaches the order's tax
  base takes the exact remaining VAT (no rounding drift); terms are computed
  under a per-order advisory lock. `draft` (no number) → `issued` (numbered
  on issue, no gaps) → `partially_paid` → `paid`; unpaid `draft|issued` →
  `void` with a reason. `term_kind` is derived: the first live invoice of an
  order that does not settle it is `down_payment` (the DP menu), the one
  that settles it `settlement`, others `installment`. DBML `overdue` is
  shown from `due_date`, never stored; `cancelled` dropped.
- Receipts (kwitansi): valid on creation (no second verification, owner
  2026-10-31), numbered on creation, never more than the outstanding
  amount; corrections by `reversed` with a reason (no delete). The single
  ledger `finance.payments` is not built yet (S7 retires `sales.payments`);
  receipts carry no `payment_id` until then.
- Columns: invoices keep DBML names (`code`, `invoice_type`, `customer_id`,
  `sales_order_id`, `issue_date`, `due_date`, `subtotal` = the term's tax
  base, `discount_total` = 0, `tax_total`, `grand_total`, `paid_total`,
  `outstanding_total`, `status`, `issued_by/at`, `voided_at`, `void_reason`,
  `notes`) plus `term_kind`, `description`, `percentage_bps`,
  `customer_snapshot`, `sales_order_code`, `quotation_code`, `title`,
  `vat_enabled`, `vat_rate_bps`, `terms` (snapshot of the company's default
  invoice terms), `created_by`, `voided_by`, `deleted_at`; `approved_by/at`
  dropped (no invoice approval). `finance.invoice_items` stays unbuilt: an
  invoice bills a share of its order, and the print lists the order lines.
- Print: exactly the company's invoice sample (company block, INVOICE,
  Ditujukan kepada / Informasi invoice, Rincian barang, Ringkasan tagihan,
  terbilang; page 2 "INVOICE - LANJUTAN" with the payment schedule, bank
  accounts, signatures, terms; "Halaman x dari y"). No kwitansi sample
  exists, so receipts get no print in this step.
- Web: `/sales/invoices` (list + detail with issue / void / receipts /
  print), `/sales/down-payments` (DP invoices), `/sales/receipts`; "Buat
  invoice" with the billing summary on the sales order page.

What landed:
- docs.dbml first (`finance.invoices`, `finance.receipts` company-wide;
  receipts → invoices `restrict`, the `payment_id` ref removed until
  `finance.payments` exists); `gen-logical-references.ts` → 497 refs;
  `validate-dbml.ts` → OK.
- Migration `20261105173322_finance_invoices_receipts` (`CREATE SCHEMA
  finance`, 2 tables, partial unique code indexes, checks), read and applied
  to `ims_erp_sync`.
- Backend: new module `app/finance` (`InvoiceRepository` with the per-order
  advisory lock and atomic receipt / reversal updates, `InvoiceService`,
  `InvoiceLookupService`, `InvoiceController` `/invoices` incl.
  `/invoices/orders/:orderId/summary`, `ReceiptController` `/receipts`,
  `utils/invoice-terms.ts`, `errors/finance.errors.ts`), registered in
  `src/index.ts`, mounted in `app/app.ts`. Sales: `SalesBillingService`
  (contract for Finance); cancelling an order with live invoices → 422
  `sales.orderBilled`.
- Web: `lib/invoice-api.ts`, `components/finance/{invoice-list,
  billing-card, invoice-document}.tsx`, routes `/sales/invoices`,
  `/sales/invoices/$invoiceId` (+ `/print`), `/sales/down-payments`,
  `/sales/receipts`; billing card on the sales order page; `finance`
  locale namespace (en + id).

Verification (2026-11-06):
- Backend `bunx tsc --noEmit -p .` clean; `NODE_ENV=test bun test` → 612 pass
  (`test/unit/invoice.service.test.ts` 11 tests: odd-base 50/50 settles
  exactly, VAT-inclusive split, planned terms, DP/installment/settlement
  kinds, void frees the share, numbering on issue, due-before-issue,
  partial/full/over payment, reversal; sales-order billed guard).
- Web `bun run build` OK, `bunx tsc -b` clean, `bun test` → 45 pass; locales
  → 50 pass; lint: no warnings in new files.
- Browser (temporary Playwright script, deleted): SPH (DP 30% / BAST 70%) →
  approved → order `0002/SO/DEV/XI/26`; `sales.seed` gets 403 on
  `/invoices`; `finance.seed` creates the DP from the order page, issues it
  (`0001/INV/DEV/XI/26`); the manager cannot cancel the billed order (422);
  partial payment → `partially_paid`, overpayment → 422, rest → `paid`;
  the next term is `settlement` and DP + settlement = order total exactly;
  DP and receipt lists show them. Invoice printed to PDF (A4) and compared
  with the sample: page 1 company block / INVOICE / Ditujukan kepada /
  Informasi invoice / Rincian barang / Ringkasan tagihan / terbilang; page 2
  INVOICE - LANJUTAN / Jadwal pembayaran / Informasi rekening / Tanda tangan
  / Syarat dan ketentuan; "Halaman x dari 2". The company profile used for
  the print was restored afterwards.
- Test data left in the dev DB: SPH `0006/QT/DEV/XI/26`, order
  `0002/SO/DEV/XI/26`, invoices `0001`–`0002/INV/DEV/XI/26`, two receipts.

Deliberate differences from the invoice sample: table header text is white
on the navy bar (the sample's dark text is unreadable); the terbilang is of
the amount due (the sample's "sesuai dokumen asal" line spelled a
different figure). No kwitansi print yet: there is no sample.

Next executable task: ADR-0011 step 4 — procurement (suppliers, purchase
orders with the PO sample print) and moving-average cost; then step 5
(delivery notes with the surat jalan sample, adjustments, inventory value)
and step 6 (M07), then the PR to main.

## Completed — ADR-0011 port step 3d-1: sales orders (SPH → Deal), 2026-11-06

Status: **implemented** (backend + web admin; not yet reviewed by programmer A
or accepted by the owner). Step 3d is split: 3d-1 sales orders (this), 3d-2
invoices / DP / receipts with prints (next).

Gate 1 (read): docs.dbml `sales.sales_orders`, `sales_order_items`,
`order_status_history` and their refs; the old branch's owner-approved
`sales-order.service.ts` / `billing.contract.ts`; role grants
(`sales_order:*`); numbering type `sales_order` (`SO`). Skipped:
`logical-references.md` beyond the generated tables (no new target module
besides CRM/Inventory/Identity already documented in 3c).

Gate 2 (manual grilling pass):
- Ownership: Sales module, `SalesOrderService` / `SalesOrderController`
  (`/sales/orders`). Company-wide like quotations (no `organization_id`).
- Lifecycle (owner-approved 2026-11-04, mapped onto the DBML vocabulary):
  an order is created only from an `approved` or `sent` SPH and is
  `confirmed` (active) at once — no separate approval; creating it marks the
  SPH `won` ("Deal") in the same transaction; `confirmed → cancelled` with a
  reason reopens the SPH to `sent` (or `approved` if never sent).
  `in_progress / delivered / completed` stay in the CHECK for steps 4–5.
  One live order per SPH (partial unique index). Cancelling an order that
  has live invoices is refused once invoices exist (3d-2 adds that guard
  through the finance contract).
- Columns: DBML names kept (`code`, `quotation_id`, `customer_id`, `status`,
  `order_date`, `delivery_date`, money columns, `sales_person_user_id` =
  the SPH owner, `cancelled_at`, `cancellation_reason`, `notes`); added for
  the approved flow: `customer_snapshot`, `customer_po_number`, `title`,
  `attention`, `payment_terms`, `payment_schedule`, `guarantee`,
  `quotation_code`, `vat_enabled`, `vat_rate_bps`, `created_by`,
  `cancelled_by`, `deleted_at`; dropped: `organization_id`,
  `customer_address_id` (addresses not built), `shipping_total` (not in the
  flow), `warehouse_id` (chosen on the delivery note, step 5),
  `approved_by/at` (no order approval).
- Items: copied from the SPH lines (`quotation_item_id` same-module FK,
  `item_id` → `inventory.items` logical, sku/name/specification/unit
  snapshot, numeric quantity, money); `quantity_delivered` and
  `fulfillment_status` kept for delivery notes (step 5); `tax_amount` and
  `unit_id` dropped (VAT per document, fixed units).
- Visibility: holders of `sales_order:approve|export` or `invoice:read` see
  all orders; others only orders of their own SPHs (`sales_person_user_id`).
  Creating needs `sales_order:create` and a visible SPH; cancelling needs
  `sales_order:cancel` (sales manager / owner).
- Numbering: `NumberingService.next('sales_order')` on creation.
- Web: `/sales/orders` list and detail; "Buat sales order" on an approved/sent
  SPH; the SPH detail links its order. No print (no sample for orders).

What landed:
- docs.dbml first (three tables rewritten company-wide, refs to
  `quotations` / `quotation_items` as `restrict`);
  `gen-logical-references.ts` → 497 refs; `validate-dbml.ts` → OK.
- Migration `20261105172403_sales_orders` (3 × `CREATE TABLE`, indexes incl.
  the partial `sales_orders_live_quotation_uq`, FKs), read and applied to
  `ims_erp_sync`; a second `drizzle:generate` → no changes.
- Backend: `SalesOrderRepository` (create + SPH → `won`, cancel + SPH
  reopened, each with both history rows in one transaction),
  `SalesOrderService`, `SalesOrderController`, `errors/sales-order.errors.ts`
  (`sales.order*` keys, en + id). Quotation detail returns its live
  `salesOrder`; revising an SPH that has a live order is refused (409).
- Web: `lib/sales-order-api.ts`, `components/sales/create-order-dialog.tsx`,
  routes `/sales/orders` and `/sales/orders/$orderId`, nav "Sales order",
  breadcrumb label; SPH page buttons "Buat sales order" / "Sales order <no>".

Verification (2026-11-06):
- Backend `bunx tsc --noEmit -p .` clean; `NODE_ENV=test bun test` → 600 pass
  (`test/unit/sales-order.service.test.ts`, 7 tests).
- Web `bun run build` OK, `bunx tsc -b` clean, `bun test` → 45 pass;
  locales → 46 pass; lint: no warnings in new files.
- Browser (temporary Playwright script, deleted): `sales.seed` creates an
  SPH, `sales_manager.seed` approves; the salesperson creates the order from
  the SPH page (`0001/SO/DEV/XI/26`, PO number kept, status Aktif, no cancel
  button for sales); the SPH shows Deal with a link to the order; revising
  it → 409, a second order → 409; the manager cancels with a reason; the
  SPH is `approved` again with no order link; the list shows the order.
- Test data left in the dev DB: SPH `0005/QT/DEV/XI/26` (approved) and its
  cancelled order `0001/SO/DEV/XI/26`.

## Completed — SPH print matches the company's sample; document images, 2026-11-06

Status: **implemented** (module owner's request: "documentnya pakai yang ada di
sample-private, contoh layoutnya harus dipersis"; not yet accepted by the
owner on paper).

Gate 1 (read): the private SPH and invoice samples
(`.agents/samples-private/`, never committed); docs.dbml
`organization.company_profiles` (`logo_object_key` existed, no upload),
`inventory.items`, `sales.quotations` / `quotation_items`.

Gate 2 (owner answers, AskUserQuestion 2026-11-06):
- "Gambar" column: **one document photo per item** in the item master
  (`inventory.items.image_object_key`), snapshotted onto the quotation line
  (`sales.quotation_items.image_object_key`); custom lines have none. The
  website catalog gallery stays in M04.
- Coloured-bar title: **per-SPH field** `sales.quotations.heading`
  (varchar 120, null prints "QUOTATION").
- Signature: `organization.company_profiles.signature_object_key` (signature
  with stamp above the signatory name), next to the existing logo key.
- Images: PNG/JPG/WebP ≤ 2 MB, a fresh object key per upload so issued
  documents keep their picture; inline presigned URLs (1 h).
- No new cross-module link (the photo key is copied as a value, like the
  other snapshot columns).

What landed:
- docs.dbml first (4 columns); `gen-logical-references.ts` → 502 refs;
  `validate-dbml.ts` → OK. Migration `20261105170913_document_images`
  (4 × `ADD COLUMN`, read and applied to `ims_erp_sync`); a second
  `drizzle:generate` → no changes.
- Backend: `providers/s3/document-image.ts` (validation, storage, URL);
  `PUT|DELETE /company-profile/:kind` (`logo|signature`,
  `company_setting:update`), profile view gains `logoUrl` / `signatureUrl`;
  `ItemImageService` + `PUT|DELETE /items/:id/image` (`product:update`),
  item detail gains `imageUrl`; quotation `heading`, line photo snapshot,
  detail items carry `imageUrl`. Error `common.imageInvalid` (en + id).
- Web: `components/documents/document-image-field.tsx`; logo/signature card
  on `/admin/settings`; photo card on the item page; "Judul dokumen" in the
  SPH form; `quotation-document.tsx` rewritten to the sample: logo + serif
  name + tagline + double rule repeated on every page (table header),
  amber heading bar, bold Kepada/Up/Telp/Hal and Date/Ref/Payment/Guaranty,
  item table NO / DESCRIPTION / Gambar / PRICE / QTY (2) / SUBTOTAL with a
  bold row per item and its specification + photo below, amounts as
  "Rp 50,000,000", "Terbilang : … Rupiah." with Total in the last row (Sub
  Total / Diskon / PPN rows only when they apply), Term of Condition and
  "Hormat Kami," with the signature image. Sidebar and header are hidden
  when printing.

Verification (2026-11-06):
- Backend `bunx tsc --noEmit -p .` clean; `NODE_ENV=test bun test` → 593
  pass (company-profile image tests added; quotation photo snapshot test);
  lint: 5 warnings, all pre-existing.
- Web `bunx tsc -b` clean, `bun run build` OK, `bun test` → 45 pass;
  locales `bun test` → 46 pass.
- Browser (temporary Playwright script, deleted): logo and signature
  uploaded on `/admin/settings`, photo on an item page; SPH printed to PDF
  (A4) and compared with the sample: one-page and a 16-line three-page SPH —
  letterhead repeats on each page, an item never splits from its
  specification, VAT rows appear only with VAT. Test images removed from
  the dev profile and items afterwards; test SPHs `0002`–`0004/QT/DEV/XI/26`
  remain in the dev DB.

Known differences from the sample, deliberate: the last row reads "Total"
(the sample's "Total Jum" is a cut-off cell); a discount shows as its own
"Diskon" row (the sample has none).

## Completed — ADR-0011 port step 3c: quotations (SPH), 2026-11-05/06

Status: **implemented** (backend + web admin; not yet reviewed by programmer A
or accepted by the owner). Sales orders, invoices and receipts are step 3d.

Gate 1 (read): docs.dbml `sales.quotations`, `sales.quotation_items`,
`sales.quotation_status_history`, legacy `sales.payments`;
`implementation-phases.md` S3 (recreate, do not alter; empty
`sales.payments` in the same migration; total = sum of items); main's
scaffold sales module and `test/authorization/authorization.test.ts`
(drives the scaffold through `/sales/quotations` and `/sales/payments`);
the old branch's owner-approved SPH service, contract and domain helpers.
`logical-references.md` read for the new sales → crm / inventory links.
Skipped: `implementation-phases.md` steps other than S3 (nothing else is a
prerequisite).

Gate 2 (3c, manual grilling pass — `grilling` skill not installed):
- Ownership: Sales module (`app/sales`), new `QuotationService` /
  `QuotationController` (`/sales/quotations`). The scaffold quotation code is
  replaced; the transitional payment endpoints (`/sales/payments`, approve /
  execute separation of duties) stay until S7, now validating the quotation
  through the new repository.
- Tenant scope: none — quotations, items and status history are company-wide
  like customers (ADR-0011 §2, ADR-0012). `sales.payments` keeps its
  `organization_id` (transitional, "do not extend").
- Statuses (owner-approved, replace DBML `expired` / `cancelled`): `draft →
  submitted → approved | rejected`, `approved → sent`; any open status →
  `lost` ("Batal", reason `price | competitor | project_cancelled |
  no_response | other`, `other` needs a note); `won` ("Deal") is reached
  only by creating its sales order (step 3d); revising a non-draft SPH marks
  it `superseded` and creates draft revision `<base>-R<n>`. Expiry is shown
  (end of the `valid_until` Jakarta day), never a status.
- Separation of duties: the creator can never approve or reject their own
  SPH; no amount limit (owner decision 2026-10-31) — main's scaffold
  "approval limit configuration missing" denial is removed and its test
  rewritten.
- Visibility: holders of `quotation:approve` or `quotation:export` see all;
  billing staff (`invoice:read`) also see `won` SPHs and their revisions;
  everyone else only SPHs they created; anything else answers 404. Resolved
  with the dynamic permission resolver.
- Columns: DBML names kept where equivalent (`subtotal`, `discount_total`,
  `tax_total`, `grand_total`, `approved_by/at`, `submitted_at`, `sent_at`,
  `rejected_reason`, `customer_contact_id`, `quotation_date` /
  `valid_until` as `date`). Added for the approved flow: `base_code`,
  `revision`, `previous_revision_id`, `attention`, `payment_terms`,
  `payment_schedule` (jsonb, shares in bps summing to 10000), `guarantee`,
  `terms`, `customer_snapshot` (jsonb), `lead_id`, `vat_enabled`,
  `vat_rate_bps` (VAT per document, default 1100), `sent_by`, `closed_by`,
  `closed_at`, `lost_reason`, `lost_note`. Dropped: `price_list_id` (no
  catalog module, ADR-0011), `organization_id`.
- Items: `item_id` → `inventory.items.id` (logical reference, validated
  through the new `ItemService.getActiveItems`); snapshot `sku`, `name`,
  `specification`, `unit` (fixed unit list); `quantity numeric(18,3)`;
  money bigint minor units; `line_total = round(quantity × unit_price) −
  discount_amount`, recomputed by the service; per-line `tax_amount` and
  `unit_id` dropped (VAT is per document, units are a fixed list). Custom
  lines (no item) carry their own name, unit and price.
- Logical references: `customer_id`, `customer_contact_id` → CRM
  (`CustomerService.getActiveCustomer` / contact check); `lead_id` → CRM
  (`LeadService.noteQuotation`: moves `new/contacted/survey` to
  `quotation`); `item_id` → Inventory; user ids → Identity.
- Numbering: `NumberingService.next('quotation')` at creation (gaps
  accepted); revision codes append `-R<n>`. Code unique among live rows.
- Status history: every transition appends a `quotation_status_history` row
  in the same transaction (repository-owned).
- Money/datetime: bigint IDR minor units; `quotation_date` / `valid_until`
  are Jakarta business dates (`date`, `YYYY-MM-DD` strings); operational
  timestamps unix ms.
- Migration: one migration drops the scaffold `sales.quotations` (dev rows
  are scaffold test data, no customer/items — discarded, as S3 allows),
  creates the three tables and empties `sales.payments`.
- Web: `/sales/quotes` list, new/edit form, detail with actions, print view
  with the company profile; `sales` locale namespace (en + id).

What landed:
- `docs.dbml` first: `sales.quotations` / `quotation_items` /
  `quotation_status_history` rewritten to the shape above, company-wide;
  self-FK `previous_revision_id`. `bun docs/database/gen-logical-references.ts`
  → 502 refs; `bun docs/database/validate-dbml.ts` → `OK` (257 tables,
  0 cross-module refs, 0 timestamp gaps).
- Migration `20261105164421_sales_quotations_target`: generated with
  all-`create` hints, then hand-edited to the S3 procedure (`DELETE FROM
  sales.payments`; `DROP TABLE sales.quotations`; `CREATE TABLE` target; two
  child tables, indexes, checks). Scaffold tables were empty on
  `ims_erp_sync` (0 quotations, 0 payments) before applying.
  `bun run drizzle:migrate` applied; a second `drizzle:generate` → "No schema
  changes". `drizzle:seed` run twice: both complete, unchanged.
- `@ims-erp/common`: `domain/money.ts` (`bpsShare`, `quantityToMilli`,
  `quantityTimesPrice`, BigInt half-up) and `domain/business-date.ts`
  (`endOfBusinessDate`, `businessDateOf`), ported from the old branch.
- Backend `app/sales`: `QuotationService` / `QuotationController`
  (`/sales/quotations`: list, get, create, patch, submit, decision,
  revisions, send, lost), repository-owned transactions with history rows,
  `errors/quotation.errors.ts` (locale keys `sales.*`, en + id), `utils/`
  (totals, validity, schedule). The scaffold `SalesService` /
  `SalesController` keep only the transitional payments (`/sales/payments`).
  Main's "approval limit configuration missing" denial is gone (owner
  decision: no amount limit).
- Contract methods for review: `ItemService.getActiveItems` (inventory),
  `CustomerService.getContact` and `LeadService.noteQuotation` (CRM).
- Programmer A's `test/authorization/*`: harness now builds the real
  quotation controller/service over in-memory fakes; bodies use
  `quotationBody()`; "scoped to org A" became "company-wide, no organization
  column"; the owner-approves test now expects 200; the self-approval test
  asserts the key `sales.selfApproval`.
- Web: `lib/quotation-api.ts`, `components/sales/quotation-form.tsx` and
  `quotation-document.tsx` (print labels from the `id` bundle via
  `getFixedT`, the company's format), routes `/sales/quotes`, `/new`,
  `/$quotationId`, `/edit`, `/print`; lead detail gets "Buat penawaran" for
  converted leads; `formatIdr` moved to `lib/format.ts`; `lib/terbilang.ts`;
  breadcrumb labels for sales routes.

Verification (2026-11-06):
- `apps/backend`: `bunx tsc --noEmit -p .` clean; `bun run lint` no new
  warnings; `NODE_ENV=test bun test` → 590 pass, 0 fail (incl.
  `test/unit/quotation.service.test.ts`, 17 tests).
- `apps/web-admin`: `bun run build` OK; `bunx tsc -b` clean; `bun test` →
  45 pass (incl. `test/unit/quotation-helpers.test.ts`); lint no new
  warnings.
- `packages/locales`: `bun test` → 46 pass (parity + dead keys).
- Browser (Playwright, temporary script, deleted): owner creates an SPH from
  an inventory item + a custom line (1.5 paket) with DP 30% / Terpasang 70%;
  printed payment line derived; submit; creator sees no approve button and
  the hint; `sales_manager.seed` approves; owner marks sent; history
  Draf → Menunggu persetujuan → Disetujui → Terkirim; print view with
  letterhead, PPN 11%, terbilang; another salesperson gets 404.
- Live API on `ims_erp_sync`: revise sent → `-R1` draft with both lines,
  original `superseded`; revising the superseded one 422; editing it 422;
  reject without reason 400, with reason 200; lost `other` without note 400,
  `price` 200; revise lost → `-R2`; list shows only `-R2`.
- Test data left in the dev DB: customer `SPH-SKL8P` and SPH
  `0001/QT/DEV/XI/26` (+R1, R2, all closed).

Open (3c): breadcrumb shows the raw id on detail pages (same as customers
and leads); real-PG integration tests and e2e; a sales-order link and the
`won` transition arrive with 3d.

Next executable task: ADR-0011 step 3d — prints follow the private samples
(invoice sample read 2026-11-06) — sales orders (`sales.sales_orders`,
`sales_order_items`, `order_status_history`; SPH → `won` by creating its
order, cancelling reopens), then invoices / DP / receipts in the finance
module per docs.dbml, with prints. Gate 1 starts at docs.dbml `sales.sales_*`
and `finance.invoices` / `receipts`.

## Completed — restore multiple organizations (ADR-0012 multi-org), 2026-11-08

Status: **implemented** (supersedes the 2026-11-05 single-organization entry;
ADR-0012-multi-organization restores ADR-0007 §1).

- Backend: removed the `countActive()` 409 gate from
  `OrganizationService.createOrganization` and `restoreOrganization`;
  `SingleOrganizationError` and the `organization.singleCompany` locale keys
  (en/id) are deleted. `test/unit/single-organization.test.ts` is replaced by
  `test/unit/multi-organization.test.ts` (create a second organization goes
  through; restore no longer consults the live count).
- Web admin: the "new organization" button on `/organizations` and in the
  sidebar switcher is shown again (switcher: application admins only).
- Seeder: unchanged behavior — seeds only the first organization when none
  is live; JSDoc updated.
- Docs: `ADR-0012-single-organization.md` marked superseded;
  `security-and-access.md` notes multiple organizations are allowed.
- Checks: backend 802 tests, web-admin 45 tests, lint, typecheck, build pass.

## Completed — one company, one organization (ADR-0012), 2026-11-05

Status: **implemented** (module owner's decision; programmer A to acknowledge
in the merge PR).

- Owner: "dibikin 1 organisasi aja", seed it, hide the add button once it
  exists. ADR-0012 written (amends ADR-0007 §1 and ADR-0010).
- Backend: `OrganizationService.createOrganization` / `restoreOrganization`
  → 409 `organization.singleCompany` (en/id) when a live organization
  exists. `test/unit/single-organization.test.ts` (3 tests).
- Seeders: `organization.seeder.ts` runs in every environment and skips when
  any live organization exists; `organization-members.seeder.ts` (role
  accounts with `<role>123456` passwords) and `inventory.seeder.ts` (faker
  sample data) are now explicitly dev-only. Verified on a disposable
  `ims_erp_prodcheck` with `NODE_ENV=production`: 1 organization, 1 user
  (initial admin), 0 items, 9 website categories, no role accounts; the
  database was dropped afterwards. Dev seed run twice: unchanged.
- Web admin: "new organization" hidden on `/organizations` and in the sidebar
  switcher when a live organization exists.
- Also tidied the misplaced doc comment from step 3b in
  `organization.service.ts` (`getMemberRole` / `listMembers`).
- docs/database reviewed: no structural change.

## Completed — ADR-0011 port step 3b: leads, follow-ups, website API, 2026-11-05

Status: **implemented** (backend + web admin; not yet reviewed by programmer A
or accepted by the owner).

Gate 1 (read): docs.dbml `crm.leads`, `crm.lead_activities`, `auth.apikeys`;
main's `@better-auth/api-key` plugin (default config only), `providers/s3`
(`s3Client`, `presignObjectUrl`), the organization and user services, and the
dynamic permission resolver (`PERMISSION_RESOLVER_TOKEN`, roles from
`auth.roles`).

Gate 2 (3b):
- Ownership: CRM module (`app/crm`); the website endpoints are a separate
  public controller in the same module (`/public/v1/rfq|contact|demo`).
- Tenant scope: none — leads, activities and attachments are company-wide
  (ADR-0011 §2). The website key still belongs to an organization (Better
  Auth `references: 'organization'`), which only authenticates the website.
- `crm.leads`: docs.dbml shape adapted to the owner-approved M02 rules —
  statuses `new, contacted, survey, quotation, won, lost`; sources
  `website, whatsapp, instagram, phone, referral, walk_in, other`;
  `owner_user_id` = assigned salesperson; `customer_id` = converted
  customer (same-module FK, `restrict`); website columns `channel`,
  `reference`, `submission` (jsonb), `idempotency_key` (partial unique
  indexes `WHERE NOT NULL`); `needs`, `next_follow_up_at`; DBML `code`,
  `source_detail`, `expected_close_date` dropped (unused by the approved
  flow).
- `crm.lead_activities`: types `call, whatsapp, email, meeting, survey,
  note`; `occurred_at`, `created_by`; DBML `subject` / `next_action_*` /
  `assigned_to_user_id` dropped (the next follow-up lives on the lead).
- New `crm.lead_attachments` (RFQ files: PDF/DWG/JPG/PNG, ≤10 × 25 MB;
  storage key never leaves the server; downloads by 5-minute presigned URL).
- Visibility: holders of `lead:assign` (resolved with the dynamic
  permission resolver, not the static catalog) see all leads and may
  assign; everyone else only leads assigned to them; others answer 404.
  The assignee must be a member of the caller's organization holding
  `lead:read` (new organization-service method `getMemberRole`, read-only,
  for programmer A's review). Names of assignees/authors come from the user
  service (they may sit in another department).
- Conversion: links an active customer or creates one through
  `CustomerService` (3a contract); the lead becomes `won` atomically
  (409 on a race).
- Website: `ewk_` keys (config `website`, 600 requests/minute) in the
  Better Auth api-key plugin; `publicApiGuard` (Bearer key); numbering
  `web_rfq|web_contact|web_demo` (step 1); `Idempotency-Key` replays return
  the first reference; `scripts/create-website-api-key.ts`.
- Money: `estimated_value` bigint minor units. Datetimes bigint ms.
- Also fixed in this step: step 1's `canSeeBanks` used the static grant
  catalog; it moves to the dynamic resolver like every new check.

Implementation:
- `docs.dbml` first (crm.leads / lead_activities as above, new
  crm.lead_attachments, Refs `restrict`); generator 504 refs; validator OK.
- `crm.schema.ts` leads, lead_activities, lead_attachments; migration
  `20261105152712_massive_secret_warriors` (3 tables + FKs, additive),
  applied to `ims_erp_sync`.
- Backend `src/app/crm`: `LeadService` (visibility, assignment through
  `OrganizationService.getMemberRole` + `PERMISSION_RESOLVER_TOKEN`, names
  through `UserService.getUser`, conversion through `CustomerService`,
  5-minute presigned attachment URLs), `WebsiteInquiryService` (ported
  rules; `submitRfq` is async so size/type errors reject instead of
  throwing synchronously), `LeadController` (`/leads`, `/:id`,
  `/:id/attachments/:attachmentId/url`, `/:id/status|assign|activities|
  convert`, archive), `PublicWebsiteController` (`/public/v1/rfq|contact|
  demo`, JSON or multipart). `src/authorization/public-api-auth.ts`
  (`publicApi` macro, `AppError` keys `publicApi.*`), website api-key
  config (`website`, `ewk_`, 600/min), `providers/s3/object-storage.ts`
  (`OBJECT_STORAGE_TOKEN`, registered in `di/provider.ts`),
  `drizzle/search.ts` `likePattern` (shared with customers),
  `scripts/create-website-api-key.ts`. Organization module: read-only
  `findMemberRole` / `getMemberRole` (for programmer A's review).
- Web admin: `/crm/leads` list (search incl. reference, status, source,
  assigned filter for managers, follow-up due, pagination, create) replaces
  the stub; `/crm/leads/$leadId` (details, website attachments download,
  pipeline status with lost reason, assignee select for managers,
  follow-up log, edit, convert to new/existing customer, archive);
  `lib/lead-api.ts`; date helpers in `lib/format.ts`; `crm` locale keys.
- Checks: `bun run test` — backend 570 (9 new: lead + website inquiry),
  web-admin 41, locales 42; backend and web `tsc` clean; lint 0. Live
  public API (dev key created with the script, kept out of logs): no key /
  bad key → 401 (Indonesian), contact 201 `MSG-2026-00001`, same
  Idempotency-Key replay 200 with the same reference, invalid payload 400,
  RFQ multipart with a PDF 201 `RFQ-2026-00001` (file stored in MinIO).
  Browser (Playwright, Chromium 1161, id-ID, owner): website RFQ listed
  unassigned, attachment downloaded through a signed URL, manual lead with
  value/follow-up/status, conversion to a new customer; no console errors.
  Download changed from `window.open` to a link click (no popup blocker).
  Test rows archived afterwards.
- Behaviour change to tell the website team: invalid public payloads now
  answer **400** with main's validation envelope (the M02 branch answered
  422 with a per-field list).

## Completed — ADR-0011 port step 3a: customers and contacts, 2026-11-05

Status: **implemented** (backend + web admin; not yet reviewed by programmer A
or accepted by the owner).

Step 3 (M02) is split: 3a customers/contacts, 3b leads + website API,
3c quotations (SPH), 3d sales orders + invoices + receipts + prints. Module
owner's answers 2026-11-05: invoices and receipts go to the **finance**
module as in docs.dbml (not sales); lead and SPH statuses stay the ones the
owner approved on the M02 branch (SPH deal/lost/revisions, expiry is not a
status) and docs.dbml is updated to match.

Gate 1 (read): docs.dbml CRM (`crm.customers`, `customer_contacts`,
`customer_addresses`, `leads`, `lead_activities`), Sales (`quotations`,
`quotation_items`, `sales_orders`, `delivery_notes`) and Finance
(`invoices`, `receipts`, `payments`) modules; Location (`villages`) for the
address reference. `implementation-phases.md` read for the sales scaffold
note: the scaffold `sales.quotations` / `sales.payments` from
`dear_living_lightning` are replaced, not altered.

Gate 2 (3a):
- Ownership: CRM module (`app/crm`, schema `crm`).
- Tenant scope: none — company-wide (ADR-0011 §2); docs.dbml notes the
  exception.
- `crm.customers`: docs.dbml shape minus `organization_id` and
  `customer_group_id` (customer groups are out of scope; Ref removed), plus
  the primary address (`address_line`, `village_id`, `postal_code`) and
  `created_by`. Status `active | inactive` (M02 rule: inactive customers
  cannot be used on new documents); types as docs.dbml
  (`individual | company | government | partner`). Code upper-case,
  unique among live rows (partial index), race handled as 409.
- `crm.customer_contacts`: docs.dbml shape minus `organization_id`; one
  primary per customer kept by the repository; FK `RESTRICT` (soft deletes
  only).
- Cross-module refs: `village_id` validated through `LocationService.
  getVillage`; `owner_user_id`, `created_by` from the session;
  `portal_identity_id` stays null until the portal (M02 stage 2).
- Soft delete on both; datetimes bigint ms; no money columns.
- Permissions: existing `customer:read|create|update|archive`.
- Exported contract for later steps: `CustomerService.getActiveCustomer`.

Implementation:
- `docs.dbml` first (crm.customers / customer_contacts as above; Ref to
  customer_groups removed; contacts FK `restrict`); generator 506 refs;
  validator OK.
- `drizzle/schemas/crm.schema.ts`, migration `20261105150641_cold_sprite`
  (inspected, additive), applied to `ims_erp_sync`; relations registered in
  `drizzle/db.ts`. `drizzle/errors.ts` `isUniqueViolation` (from the M02
  branch).
- Backend `src/app/crm`: errors (`crm.customerNotFound`,
  `customerCodeTaken`, `customerAlreadyActive|Inactive`, `villageNotFound`,
  `contactNotFound`, en/id), contract (zod, strict), repositories (search
  escapes `%`/`_`; one primary contact per customer in a transaction),
  `CustomerService`, `CustomerController` (`/customers`, `/:id`,
  `/:id/activate|deactivate`, `/:id/contacts[/:contactId]`); registered in
  `src/index.ts`, mounted in `app/app.ts`.
- Web admin: `lib/customer-api.ts`; `/crm/customers` list (search, status
  filter, pagination, create) replaces the coming-soon stub;
  `/crm/customers/$customerId` detail (edit, activate/deactivate, contacts
  add/edit/remove with primary badge); dialogs reuse `LocationCascade`;
  new `crm` locale namespace (en/id).
- Checks: `bun run test` — backend 561 (5 new), web-admin 41, locales 42;
  backend and web `tsc` clean; lint 0; seed run twice OK. Live HTTP with
  `Accept-Language: id`: 404/409 messages in Indonesian. Browser
  (Playwright, Chromium 1161, id-ID, owner): create (code upper-cased, NPWP
  digits only), duplicate code refused with the Indonesian 409 message,
  primary contact, deactivate. Fixed during the check: the code input's
  `pattern` was invalid under the browser's `v` regex flag (now escapes
  `/` and `-`). Test rows archived afterwards in `ims_erp_sync`.
- Dev note: the dev backend does not watch `packages/locales`; after a
  locale change, stop the processes on 3000/5173 and restart (a plain
  restart once kept serving old bundles).

## Completed — ADR-0011 port step 2: item extensions, 2026-11-05

Status: **implemented** (backend + web admin; not yet reviewed by programmer A
or accepted by the owner).

Gate 1 (read): `docs.dbml` Inventory (`inventory.items`) and Catalog
(`catalog.item_categories`, `catalog.units`, `catalog.items` — superseded /
unadopted) modules, Commerce (`commerce.catalog_publications`,
`catalog_publication_items` — the website catalog's home). Skipped
`implementation-phases.md` (no dependency on an unlanded phase step).

Gate 2 (design pass; three answers from the module owner 2026-11-05):
- Website catalog fields and item photos: **deferred to M04** (Commerce
  module per docs.dbml) — owner's choice.
- Active flag: **yes** — `inventory.items.is_active` (boolean, default
  true). Not a `status` column: docs.dbml says status exists only on
  serialized units (ADR-0008). Inactive items stay listed (filter) but are
  not offered for new documents; archiving (`deleted_at`) is unchanged.
- Categories: **flat** (one level) — owner's choice.
- Ownership: inventory core belongs to programmer A; these extensions are
  programmer B's under A's review (ADR-0011 §13).
- New table `inventory.item_categories`: company-wide, no `organization_id`
  (ADR-0011 §2); `slug` (unique among live rows), `name`, `short_name`,
  `sort_order`, `description`, `is_active`, timestamps, `deleted_at`.
  `inventory.items.category_id` → same-module FK (`ON DELETE RESTRICT`);
  archiving a category with live items is refused (409). Replaces the
  free-text `category` column (dropped; no production data) and makes
  `catalog.item_categories` superseded.
- Units: fixed list in code + CHECK on `inventory.items.unit_label`
  (`pcs, unit, set, paket, titik, m, roll, kg, jam, bulan, tahun, lic, lot,
  pulau` — the M02 list plus the units programmer A's seeder uses),
  `NOT NULL DEFAULT 'pcs'`; `catalog.units` superseded.
- New columns: `brand varchar(100)`, `specification text` (printed on
  SPHs), `created_by text` (logical ref to auth.users, from the session).
- Money/datetimes: unchanged (prices stay bigint minor units).
- Permissions: categories read with `product:read`; create/update/archive
  with `product:create` / `product:update` / `product:archive`.
- Copy: `inventory` locale namespace (en/id).

Implementation:
- `docs.dbml` first: `inventory.items` (category_id, brand, specification,
  unit_label NOT NULL + CHECK, is_active, created_by), new
  `inventory.item_categories`, `catalog.item_categories` / `catalog.units`
  marked superseded; `validate-dbml.ts` allows the `item_categories` bare
  name twice (same precedent as `items`). `gen-logical-references.ts` →
  506 refs; `validate-dbml.ts` → OK (256 tables, 0 cross-module refs,
  0 timestamp gaps).
- Migration `20261105142244_polite_betty_brant` (generated with explicit
  `--hints` that the five columns are new, not renames of `category`),
  inspected, plus a hand-added backfill so empty/free-text units become
  `pcs` before `SET NOT NULL` and the CHECK; applied to `ims_erp_sync`
  (4 empty units backfilled).
- Backend `src/app/inventory`: `ItemCategoryRepository` / `Service` /
  `Controller` (`GET|POST /item-categories`, `PATCH|DELETE
  /item-categories/:id`); errors `inventory.categoryNotFound`,
  `categorySlugTaken`, `categoryHasItems` (409 with count),
  `categoryUnavailable` (422, en/id); `ItemService` checks the category
  (a new choice must be active; an item may keep its now-inactive one);
  item list filters `categoryId`, `activeOnly`, search also matches brand;
  `createdBy` from the session.
- Seeders: `item-category.seeder.ts` (the website's 9 categories in every
  environment, `tools` / `cabling` dev-only, idempotent by slug);
  `inventory.seeder.ts` picks category slugs and fixed units (services
  `paket`).
- Web admin: item form (category select incl. the item's own inactive
  one, fixed unit select, brand, specification, active checkbox), item
  list (category name + "Nonaktif" badge), item detail (category, brand,
  active, specification); new `/inventory/categories` page (list, create /
  edit dialog with fixed slug, archive confirm); sidebar "Barang → Kategori
  barang"; `lib/item-category-api.ts`. The unit-of-measure type is
  `TItemUnitLabel` / `ITEM_UNIT_LABELS` (`TItemUnit` already names a
  serialized unit).
- Checks: `bun run test` — backend 556 (5 new), web-admin 41, locales 38;
  web `tsc -p tsconfig.app.json` and backend `tsc` clean;
  `drizzle:migrate-reset` + `drizzle:seed` again → 11 categories, items
  linked, second run inserted 0 (idempotent). Browser (Playwright,
  Chromium 1161, id-ID, owner): category created; material item created
  with category, unit `m`, brand, two-line specification, inactive; list
  shows category + "Nonaktif"; detail shows all fields; archiving a used
  category refused with the Indonesian 409 message. Test rows archived
  afterwards in `ims_erp_sync`. Pre-existing console warning (not from this
  change): Base UI `nativeButton` on link-buttons in the item detail page
  and item list.
- Deferred (owner's choice): website catalog fields and item photos → M04
  (Commerce module per docs.dbml).

## Completed — ADR-0011 port step 1: numbering, company profile, role grants, 2026-11-05

Status: **implemented** (backend + web admin; not yet reviewed by programmer A or
accepted by the owner).

- `packages/common` role catalog: statements `product:read_cost`,
  `supplier:read_bank`, `project:read_cost`; grants for project manager
  (projects, tickets, customer read), technician (tickets), purchasing
  (item master + purchase price, adjustments prepare), finance (deal SPHs
  and sales orders read, project costs, purchase price, supplier bank),
  operations manager (approve/post adjustments). Finance does NOT get
  `stock_adjustment:read` (kept as programmer A's inventory tests expect;
  revisit at port step 5). Dev roles refreshed with
  `scripts/refresh-role-grants.ts`.
- Schema `organization` (`drizzle/schemas/organization.schema.ts`, migration
  `20261105131135_demonic_the_fallen`, inspected, applied to the disposable
  `ims_erp_sync`): `company_profiles` (singleton), `company_bank_accounts`
  (invoice usage vat/non_vat), `document_sequences` (one series per
  document type, atomic allocation). Company-wide, no `organization_id`
  (ADR-0011 §2). `docs.dbml` updated; `bun docs/database/validate-dbml.ts`
  OK (255 tables, 0 cross-module refs, 0 timestamp gaps);
  `logical-references.md` regenerated. Both scripts now resolve paths next
  to themselves (they pointed at `B:/ims/erp/...`).
- Backend (`src/app/organization`): `NumberingService` (`next(type, {date,
  context, tx})`, settings list/preview/update), `CompanyProfileService`
  (profile + invoice bank accounts in one transaction), routes
  `GET|PUT /company-profile`, `GET /document-numbering`,
  `POST /document-numbering/:type/preview`, `PUT /document-numbering/:type`.
  Errors are `AppError` keys (`organization.companyProfileRequired`,
  `numbering.*`) in en/id; `{COMPANY}` comes from the profile's
  `document_code`. Dev seeder `company-profile.seeder.ts` (idempotent,
  skipped in production).
- Checks: `bun run test` — backend 549 pass (16 new), web-admin 41,
  locales 34; `bun run lint` 0; `bun run build` 0; backend `tsc` clean;
  seed run twice after `drizzle:migrate-reset` (idempotent). Live HTTP on
  the dev server: profile required → 422 (id/en messages), save profile
  200, numbering list 200 (`0001/QT/IMS/XI/26`), bad pattern 422 with the
  translated token message, PO pattern preview. 50 concurrent `allocate`
  calls against PostgreSQL returned 50 unique numbers; a new period
  restarted at 1.
- Bank accounts: `PUT /company-profile` ignores `bankAccounts` when omitted
  or when the caller lacks `invoice:read` / `company_setting:read`, and the
  response hides them from such callers (no blanking or overwriting what
  they cannot see).
- Web admin: `/admin/settings` (company profile form, replaces the
  "coming soon" stub) and `/admin/settings/numbering` (series table + edit
  dialog with a server-rendered live preview); sidebar "Settings" now has
  both sub-items; breadcrumbs labelled. Copy in the new `settings` locale
  namespace (en/id); API client `lib/company-settings-api.ts` sends
  `Accept-Language`. Locale tests: dynamic prefixes for
  `settings:numbering.type.` / `.reset.` / `numbering.pattern.`; five
  business terms allowed identical in id (Email, Bank, Sales order,
  Invoice, Purchase order).
- Browser check (Playwright script against the dev server, Chromium 1161,
  locale id-ID, owner): half-filled bank account refused; profile saved
  (document code upper-cased to IMS); numbering table in Indonesian with
  `0001/QT/IMS/XI/26`; invalid pattern shows "Token {FOO} tidak dikenal";
  preview `SPH/IMS/2026/001`; saved. The test pattern was reset to the
  default afterwards in `ims_erp_sync`.
- Final checks: `bun run test` — backend 551, web-admin 41, locales 38;
  `bun run lint` 0; `bun run build` 0; web `tsc -p tsconfig.app.json`
  clean.
- Local note: the agent's shell has `NODE_ENV=production`; seeders and
  scripts were run with `NODE_ENV=development`. Logo upload for the
  letterhead (`logo_object_key`) is not wired yet; it comes with the
  printed documents in step 3.
- Rules follow-up (same day, after re-reading main's AGENTS.md):
  `CompanyProfileService` no longer injects `DRIZZLE_TOKEN` — the profile
  and its invoice accounts are saved in one transaction inside
  `CompanyProfileRepository.save`; `id/settings.ts` typed as
  `Record<keyof typeof en, string>`; `backlog.md` (ERP-0008 in-progress,
  ERP-0009 implemented, new ERP-0036) and `features.md` updated.
- Gate 2 design pass for step 1, recorded after the fact (it should have
  come before coding; the decisions themselves were made in ADR-0011):
  ownership — `organization` module per docs.dbml; tenant scope — none,
  company-wide (ADR-0011 §2); soft delete — `deleted_at` on all three tables
  with partial unique indexes; money — none; datetimes — bigint ms;
  cross-module refs — `address_village_id` (location, not accepted by the
  API yet, so no contract call needed) and `updated_by` (auth.users, written
  from the session only); status vocabularies — `status` active/inactive,
  `reset_policy`, `invoice_usage`, all CHECK-guarded. `docs/database/`
  updated and validated (see above).
- Next: see step 2 above, then port step 3 (M02).

## In progress — merge plan for M02/M05/M07 onto main (ADR-0011), 2026-11-05

Status: **in-progress** (ADR-0011 accepted 2026-11-05 after discussion with
programmer A and the owner, as reported by programmer B's module owner).
Porting starts on `merge/main-sync`.

- Trial merge of `feat/m05-inventory-purchasing` into main (dry run,
  `git merge-tree`): 49 conflicting files; both branches define
  `inventory.warehouses` / `stock_*` with different columns, two item
  masters, two serial tables, two migration chains.
- Decisions agreed with programmer B's module owner, recorded in
  `docs/architecture/decisions/ADR-0011-merge-sales-inventory-onto-main.md`:
  main is the base; one company (no tenant column on business data); one
  item master `inventory.items` (extended); one serial model; one ledger
  with moving-average cost; many warehouses (accept ADR-0010); borrowing in
  M06; dynamic roles; uuid IDs; migrations rebuilt on main's chain; module
  and docs names follow main; ownership per table.
- Next: programmer A reviews ADR-0011; the owner signs the change-control
  items (many warehouses + transfers, computed average HPP); then the port
  starts on `merge/main-sync` in the order the ADR lists.

## Completed (this session — dummy dashboard view, 2026-11-06)
## 2026-11-08 - docs consistency: invoices owned by Sales, ADR-0012

Status: **docs-only, not code.** Branch `fix/docs-consistency` from `main`.
No backend or web-admin change. Merge of `merge/main-sync` is not done; it was
aborted and split (see the open items below).

- Invoices are owned by Sales (`sales.invoices`, plan D2). Updated
  `data-dictionary.md`, `implementation-phases.md`, `logical-references.md`
  (`sales.invoices.id` → `resolveInvoice`), `module-ownership.md` (Finance no
  longer owns invoices), `erp-module-plans/m02-crm-sales.md`,
  `erp-module-plans/m09-finance.md`, `plans/features.md`.
- `ADR-0012-multi-organization.md` added: multiple organizations inside one
  company (ADR-0007 §1), master data company-wide, transaction documents record
  the issuing organization. `sales.invoices.organization_id` stays
  `NOT NULL`, and `docs.dbml` says so in its note.
- Commands and outcomes:
  - `bun docs/database/gen-logical-references.ts` → `regenerated: 522 refs
    across 39 targets, 226 intra-module refs` (exit 0)
  - `bun docs/database/validate-dbml.ts` → `parsed: 258 tables, 226 refs`,
    `cross-module refs: 0`, `timestamp gaps: 0`, `OK` (exit 0)
- Not verified: the rest of `docs/` against code. `plans/finance.md` still
  names `finance.invoices` in D2 and step 1 on purpose: those lines record the
  move, not the current state.

Open items (not done):

- Merge `merge/main-sync` into `feat/merge-main-sync-to-main` still needs
  the finance and invoice reconciliation. `origin/merge/main-sync` contains
  migration `20261106110700_finance_invoices_receipts`, which conflicts with M09
  `20261106221731` on `finance.receipts`.
- Draft `ADR-0012` (single organization) exists only on `merge/main-sync`. It
  conflicts with ADR-0012 here and is dropped during that merge.
- `sales.invoices.organization_id` stays under ADR-0012. Removing it is not
  planned.
- `finance.receipts` resolved 2026-11-08: moved to `sales.receipts` (kwitansi
  owned by Sales); `payment_id` is a logical reference to `finance.payments`.

## Completed (this session - M09 Finance Stage 1, F1..F9, 2026-11-07)

Status: **implemented** (Stage 1). Master plan `docs/plan/plans/finance.md`,
phases F1–F9 across commits `7a44dbd`, `06a1080`, `83ea8ad`, `903db39`,
`12a8dd4`, `509743c` (+ this docs commit). Decisions D1–D12 pinned in the
plan after a grilling session.

- F1 schema/migration, F2 posting engine + COA + periods
  (close→locked + audited owner-only reopen), F3 opening balances (batch
  draft + one-shot post) + cash/bank with GL links, F4 sales-invoice AR
  postings + payments workflow + AR sub-ledger + aging, F5 supplier bills +
  AP sub-ledger + aging, F6 on-demand reports (P&L / balance sheet /
  cash flow) + bank reconciliation with exact statement=book gate, F7
  month-end close checklist (advisory) + void-executed append-only payment
  reversal, F8 web-admin UI (9 routes, finance-api typed client, finance
  i18n namespace, `bill:*` permissions added to the shared erpStatements
  catalog).
- F9 docs sync: `docs/architecture/modules/finance.md` rewritten (the
  NestJS-era "historical audit" warning removed — the module is implemented),
  `features.md` M09 planned→done (Stage 1) with Stage-2 remainder,
  this progress entry.
- Money everywhere is exact integer minor units; corrections are append-only
  reversals; reports are computed from posted journal lines, never stored.
- Gates at each phase: backend typecheck/lint/tests (686 pass), locales
  tests (46 pass), web-admin `tsc -b` build + oxlint, plan table updated.
- Open business item (not a code blocker): final COA seed list from
  finance/owner; provisional codes `1-1300`/`1-1100`/`4-1000`/`2-1000`/
  `2-1100`/`5-1000`/`1-1800` in use.

## Completed (this session - sidebar: Stock + Stock Adjustment under Items, 2026-11-06)

Status: **implemented**. Nav-only reorg in `nav-config.ts`: the top-level
Stock entry is gone; the Items group now holds Products, Components,
Materials, **Stock** (`/inventory/stock`), **Stock Adjustment**
(`/inventory/stock/adjustments`), and New Item. The old Item Movements nav
entry was dropped and its `nav:item.itemMovements` key removed from both
bundles (dead-key guard); movements stay reachable from the Stock page. No
route or schema change — `routeTree.gen.ts` and `docs/database/` untouched.
Gates: web-admin `tsc -b`, root lint + test green.

## Completed (this session - ERP-0031 Slice 3 admin link UI + member pickers, 2026-11-06)

Status: **implemented**. Slice 3 closes ERP-0031: global admins can link and
unlink organizations from a warehouse, unlinking is refused while custody is
out, and member-facing pickers now read the organization-scoped warehouse list
instead of the application-admin-only one.

What landed:

- Audit vocabulary: `warehouse.linked` / `warehouse.unlinked` added to
  `AUDIT_ACTIONS` (TS-only — the column is text, so no migration).
- Port: `inventory/contracts/warehouse-borrowing-guard.port.ts`
  (`IWarehouseBorrowingGuard` + `NoopWarehouseBorrowingGuard`). Inventory
  cannot import Assets (the dependency points the other way), so the
  open-borrowing question is a port registered by `registerAssets` as
  `WarehouseBorrowingGuard` over
  `IBorrowingRepository.countOpenByOriginWarehouse(warehouseId,
  organizationId)` ("open" = header `issued`/`partially_returned`, line not
  returned, not marked lost). Inventory registers the noop, so the module
  stays usable standalone and in tests.
- Repository: `listOrganizations`, `linkOrganization` (idempotent; revives a
  soft-deleted pair because the partial unique forbids a second row) and
  `unlinkOrganization` (soft delete).
- Service: `listWarehouseOrganizations`, `linkOrganization`,
  `unlinkOrganization` — the last throws `WarehouseLinkConflictError` (409,
  key `inventory.warehouseLinkConflict`, locale bundles updated en+id) while
  open borrowings exist, and writes no link change when it refuses. Both link
  and unlink audit with the acting admin.
- Routes (admin plugin, `requireGlobalAdmin`): `GET/POST
  /warehouses/:id/organizations`, `DELETE
  /warehouses/:id/organizations/:organizationId`. New
  `warehouseLinkSchema` + `warehouseLinkParamSchema`.
- `GET /warehouses/linked` now returns each linked warehouse **with its
  storages** (`TWarehouseLinked`) so member pickers can choose a bin without
  the admin-only detail route. It carries **no** `warehouse:*` permission: the
  invariant test pins "no organization role holds a warehouse action"
  (ADR-0008), and the response is already scoped to the caller's own links, so
  the `erp` guard plus organization scope is sufficient. A `warehouse:read`
  grant was written, found to break that invariant test, and reverted together
  with its data migration — nothing shipped.
- Web admin: new "Organizations" tab on `/inventory/warehouses/$warehouseId`
  (`components/inventory/warehouse-organizations-tab.tsx`) — org picker from
  the organization API, link/unlink with confirmation, 409 surfaced as an
  error toast. API client gained the three link calls and
  `linkedWarehousesQueryOptions`. Asset place/transfer (`asset-detail.tsx`)
  and the adjustment form now source warehouses from the linked endpoint —
  they previously called the admin-only list and failed for organization
  users.
- Tests: 7 new cases in `warehouse.service.test.ts` (link creates + audits,
  idempotent retry, missing warehouse 404, unlink removes + audits, no-link
  `removed:false`, 409 refusal leaves the link alive, list returns alive links
  only). Test doubles updated for the widened repository interface and the
  new constructor dependency.

```text
bun run test (root)              → 536 pass, 0 fail, 993 expect (was 529)
bun run lint (root)              → 0 errors (6 pre-existing warnings)
bun run typecheck (root)         → green; web-admin `bunx tsc -b` green
drizzle:migrate x2               → applied successfully (no new migration)
drizzle:seed x2                  → clean, idempotent
DB end-state: GLOBAL-MAIN + WH-MAIN each linked to the dev org; 0 warehouses
with non-null organization_id; system admin roles still carry stock
[read,export] / stock_adjustment [read]
```

`docs/database/` reviewed: Slice 3 changes no table, column, index,
constraint, status vocabulary, or cross-module reference (the audit action
list is a TS union over a text column, and the borrowing count is a query over
existing columns), so `docs.dbml` is unchanged.

Still open for ERP-0031 acceptance: browser walk-through of the new tab and
the member pickers, and reviewer sign-off before the Slice 1 migration is
applied to any non-local database.

## Completed (this session - ERP-0031 Slice 2 enforcement + grants, 2026-11-06)

Status: **implemented**. Slice 2 of ERP-0031: the ERP-0036 reachability stub
(`assertWarehouseReachableByOrg`) now answers the real link question, and the
stock flows are gated.

What landed:

- Repository: `warehouse.repository.isLinked(warehouseId, organizationId)` and
  `listLinked(organizationId)` (alive links, alive warehouses, ordered by
  name); both added to `IWarehouseRepository`.
- Service: `assertWarehouseReachableByOrg` body swapped — warehouse must exist
  (404) and have an alive link (boolean, caller maps false→404). Signature
  narrowed: the org param is no longer nullable. `listLinkedWarehouses` added.
  `createWarehouse` forces `organizationId: null` (D1 freeze at the service
  boundary too).
- Assets: `assertLocation` throws `WarehouseNotFoundError` when the warehouse
  is unlinked (404, not 403 — ids cannot be probed).
- Routes: `GET /warehouses/linked` via a new `WarehouseController.linkedPlugin()`
  (`erp` guard; the permission check was dropped in Slice 3 — see below),
  mounted in `app.ts` **before** the admin `.plugin()` because the guards
  differ (session+admin vs erp).
- Stock: `StockService.assertWarehouseLinkedFor(warehouseId, actorOrganizationId)`
  called from the stock controller (`receipts`, `issues`) and the adjustment
  controller (create) via an `assertWarehouseAccessible` helper. Global-admin
  bypass lives at the controller boundary (`session.user.role === 'admin'`).
  Internal writers (borrowing engine returning to `origin_warehouse_id`, seeded
  opening stock) intentionally skip the check — system-established custody.
- Grants: `erpRoleGrants.admin` gains `stock: ['read','export']` and
  `stock_adjustment: ['read']`; common rebuilt. Data-only migration
  `20261106065700_erp0031_slice2_admin_stock_grants` (hand-written, no schema
  change) syncs already-seeded system `admin` roles in `auth.roles.permissions`.
  Lesson: `permissions -> 'stock' ? 'read'` is NULL (not false) when the key is
  missing — the WHERE needed `COALESCE(..., false)`; the first run silently
  matched zero rows and was caught only by verifying the DB end-state.
- Seeder: both `GLOBAL-MAIN` and `WH-MAIN` are linked to the dev org.
- Tests: `warehouse.service.test.ts` scope/is_default tests rewritten for D1
  (creation always global) plus a new "warehouse reachability (ERP-0031)"
  block (linked/unlinked/soft-deleted link/missing warehouse/listLinked);
  warehouse and stock test doubles gained `isLinked`/`listLinked`.

```text
bun run test          → 529 pass, 0 fail (was 526)
bun run lint/typecheck (root) → green
migrate+seed twice on ims_erp_local → clean
DB end-state: GLOBAL-MAIN + WH-MAIN each linked to dev org; 0 warehouses with
non-null organization_id; system admin roles carry stock [read,export],
stock_adjustment [read]
```

## Completed (this session - ERP-0031 Slice 1 warehouse↔org link schema, 2026-11-06)

Status: **implemented**. Slice 1 of ERP-0031 (warehouse↔organization links +
scoped access); decisions D1 (keep + null `warehouses.organization_id`) and
D2 (no WH-JKT/WH-SBY seeds — keep GLOBAL-MAIN/WH-MAIN) recorded.

What landed:

- `docs.dbml` already carried `inventory.warehouse_organizations` (Slice 0
  contract) — verified, unchanged; `gen-logical-references.ts` and
  `validate-dbml.ts` both OK (255 tables, 228 refs, 0 cross-module).
- Drizzle table `warehouse_organizations` added to
  `drizzle/schemas/inventory.schema.ts`: uuidv7 id, `warehouse_id` FK →
  warehouses (cascade), `organization_id` (logical ref to auth.organizations,
  cross-module FK omitted), soft-delete timestamps, partial unique
  `(warehouse_id, organization_id) WHERE deleted_at IS NULL`, indexes on both
  columns.
- Migration `20261106062510_erp0031_warehouse_org_links`: generated DDL plus
  hand-written backfill (one alive link per warehouse that still carries an
  `organization_id`) and the freeze (`UPDATE warehouses SET organization_id =
  NULL`). ASCII-only.
- Seeder retargeted to D1: `WH-MAIN` is created **global**
  (`organization_id: null`) and linked to the dev org through a new idempotent
  `ensureWarehouseOrganizationLink` (revives soft-deleted links rather than
  duplicating — the partial unique would reject a second alive row).
  `assets.seeder.ts` looks `WH-MAIN` up by code alone. Note: the first
  migrate+seed run silently re-scoped WH-MAIN because the seeder predated the
  freeze — fixed in this slice, which is why the seeder change ships with the
  migration (same pattern as ERP-0036 Slice 2).

```text
bun docs/database/gen-logical-references.ts → regenerated, OK
bun docs/database/validate-dbml.ts          → 255 tables, 228 refs, 0 cross-module, OK
drizzle:migrate + drizzle:seed run twice on ims_erp_local → clean
DB end-state: WH-MAIN global (is_default false), 1 alive link to dev org,
0 warehouses with non-null organization_id
bun run lint / typecheck / test (root)      → green (backend 526 pass)
```

## Completed (this session - web-admin page padding fix, 2026-11-06)

Status: **implemented**. Layout fix, no module behavior change.

What landed:

- `components/layout/main-layout.tsx` now owns page padding once: children
  render inside `<main class='flex flex-1 flex-col gap-4 p-4 pt-0 md:gap-6
  md:p-6'>` inside `SidebarInset`.
- Asset screens (register, detail, categories, disposals, service records,
  tool sets, depreciation, borrowings, forms) had **zero** page padding and sat
  flush against the sidebar/header; they now get it from the layout.
- Removed self-padding that would have double-padded: `p-6` from
  `inventory/item-kind-list.tsx`, `inventory/item-form.tsx`,
  `inventory/warehouse-list.tsx`, `inventory/warehouse-form.tsx`; `p-4 pt-0`
  from the two dashboard containers; `p-4 md:p-6` from the account and
  profiles path layouts.

```text
bun run build (apps/web-admin) → clean
bun run lint  (apps/web-admin) → 0 errors (pre-existing warnings only)
```

## Completed (this session - ERP-0036 Slice 5 UI/i18n/removals, 2026-11-06)

Status: **implemented** in code; locale and type gates green. Slice 5 of
`docs/plan/plans/assets-equipment-location-and-borrowing.md`.

What landed:

- Borrowing screens moved from `inventory` to `assets`: routes
  `/assets/borrowings`, `/assets/borrowings/new`,
  `/assets/borrowings/$borrowingId`, components under
  `components/assets/borrowing-*.tsx`. Links, query keys (`['assets',
  'borrowings']`), and translation namespaces re-pointed.
- `apps/web-admin/src/lib/borrowing-api.ts` retargeted to the ported engine:
  `TBorrowingLine.assetId`/`originStorageId`, `TBorrowingEvent.assetMovementId`,
  `TBorrowingLineInput.assetId`, `toolSetId` on create. `toDetail` now unwraps
  the flat service view (`{...borrowing, lines, events}`), which the previous
  nested-shape guess silently dropped.
- New read endpoint `GET /assets/types` (`asset.repository.listTypes` →
  `AssetService.listTypes`, guarded `asset:read`) returns active types ordered
  by name. Register list gained an `assetType` filter and renders the lookup
  `name`; the register form and category list load the same options; `ASSET_TYPES`
  and `assets:type.*` are gone.
- `ASSET_STATUSES` in the client fixed to `ready|borrowed|maintenance|inactive|
  disposed|lost`; movement types extended to the D3 vocabulary and rendered via
  `assets:movementType.*`.
- Asset detail: custody/assign/return UI removed (`asset_assignments` is gone),
  replaced by a location card with the place/transfer dialog (warehouse →
  storage picker over `/warehouses`), and a "Borrow" shortcut to
  `/assets/borrowings/new`.
- Removals: `routes/_authed/inventory/tools/index.tsx`,
  `routes/_authed/inventory/borrowings/*`, `routes/_authed/assets/loans/index.tsx`,
  `components/assets/asset-loan-list.tsx`; warehouse Tools tab/stat; nav
  `item.tools`; `ITEM_KINDS` trimmed to `product|component|material` (item form
  service branch dropped).
- Locales (en + id): borrowing copy moved `inventory:` → `assets:`;
  `inventory:tools.*`, `inventory:borrowings.*`, `assets:type.*`, `assets:loans.*`,
  `inventory:kind.tool`, `inventory:kind.service`, `inventory:form.serviceHint`,
  `inventory:warehouses.tools` and `nav:item.tools` deleted; new
  `assets:register.filterAllTypes|type`, `assets:detail.{place,transfer,placed,
  transferred,noWarehouse,locationDescription,selectWarehouse,selectStorage,borrow}`
  and `assets:movementType.*` added. `DYNAMIC_PREFIXES` re-keyed to
  `assets:borrowing*`, `assets:type.` dropped, `assets:movementType.` added.

```text
bun run test (packages/locales)          → 38 pass, 0 fail (parity + dead keys)
bun run build (apps/web-admin)           → tsc -b clean; vite build OK; routeTree
                                          regenerated (no inventory/borrowings,
                                          no inventory/tools, no assets/loans)
bun run typecheck (root)                 → clean (backend + locales + ui)
bun run lint (root)                      → 0 errors (6 pre-existing backend warnings)
bun run test (root)                      → backend 526 pass, 0 fail; all workspaces green
bun docs/database/validate-dbml.ts       → 255 tables, 228 refs, 0 cross-module,
                                          0 timestamp gaps, OK
```

No schema change in this slice, so no migration was generated. `docs/database/`
was reviewed and is unchanged (the new `/assets/types` endpoint reads an
existing table). `drizzle:migrate` + `drizzle:seed` run-twice evidence remains the
Slice 4 run; the destructive migration still needs reviewer confirmation of the
target `POSTGRES_URL` before it is applied outside the local database.

## Completed (this session - ERP-0036 Slice 4 permissions + seed, 2026-11-06)

Status: **verified** on the local database; **implemented** in code. Slice 4 of
`docs/plan/plans/assets-equipment-location-and-borrowing.md`.

What landed:

- `packages/common/src/authorization/erp-permissions.ts`: permission resource
  `borrowing` renamed `asset_borrowing` in all 10 role blocks that held it, with
  the same ten actions (`read/create/update/approve/issue/return/extend/
  mark_late/mark_lost/export`) — B6, nothing added or removed.
- Backend route guards plus the borrowing controller's `actorFor` capability
  probes use `asset_borrowing`; the same rename went into the service JSDoc.
- `ASSET_DOC_TYPES.borrowing = 'asset_borrowing'`; `BorrowingService` allocates
  through it and keeps the `BRW-YYYYMM-####` format (D14). `AssetService`
  allocates asset codes on the **global** (`null` → `''`) sequence (D13) so the
  globally-unique `assets.code` index cannot collide across scopes.
- Migration `20261105223616_erp0036_slice4_permission_rename` (custom,
  data-only, snapshot unchanged): idempotently moves `auth.roles.permissions`
  `borrowing` → `asset_borrowing`, and renames the
  `organization.document_sequences` row so an allocated BRW number is kept, not
  restarted (a pre-existing target row deletes the stale source instead of
  violating the unique key).
- New `database/seeders/seed/assets.seeder.ts`, wired after `seedInventory()` in
  `database/seeders/index.ts`: six `asset_types` upserts, six assets with
  warehouse/storage placement and `receipt` movements, the `TS-SEED-01` tool set
  with two members, and three borrowings (out, returned, out + `marked_lost`).
  All anchors are fixed codes/notes and fixed dates — re-runs are no-ops.
- `inventory-authorization.test.ts` retargeted to `asset_borrowing`.

```text
bun run build (packages/common)         → clean (dist rebuilt; tests import dist)
bun run typecheck                       → clean
bun test (backend)                      → 526 pass, 0 fail (979 expects)
bun run drizzle:migrate                 → migrations applied successfully
bun run drizzle:seed                    → complete (run 1)
bun run drizzle:seed                    → complete (run 2, idempotent)
bun docs/database/validate-dbml.ts      → 255 tables, 228 refs, 0 cross-module,
                                          0 timestamp gaps, OK
```

Post-migration DB checks (`ims_erp_local`): 19 `auth.roles` rows carry
`asset_borrowing` and 0 carry `borrowing`; 6 assets (`AST-SEED-001..006`) with
one `borrowed`, one `lost`, four `ready`; movements 5 `receipt` + 3
`borrow_out` + 1 `borrow_return` + 1 `lost`; 3 borrowings with one line each;
every physical borrowing event carries `asset_movement_id` and
`requested`/`approved` carry none; `TS-SEED-01` has 2 members.
`docs/database/` reviewed — no change required (permission and numbering keys
are not part of the persistence contract).

Note: the migration comment must stay ASCII-only — a `→` in a comment aborted
the run with `character with byte sequence 0xe2 0x86 0x92 ... has no
equivalent in encoding "WIN1252"`.

## Completed (this session - ERP-0036 Slice 3 borrowing port, 2026-11-06)

Status: **verified** on the local database; **implemented** in code. Slice 3 of
`docs/plan/plans/assets-equipment-location-and-borrowing.md`.

What landed:

- Borrowing engine moved from `inventory` to `assets` (`git mv` of service,
  repository, controller, contracts and both test suites); DI tokens, container
  registration, `app.ts` mounts and the asset `index.ts` export retargeted.
- `inventory` borrowing trio and `assets.asset_assignments` **dropped**, with
  their services, contracts, repository methods and routes. `BorrowingService`
  writes `asset_movements` through `AssetOperationsService`, and the event
  CHECK tying `issued|returned|marked_lost` to a movement id holds.
- `AssetOperationsService` gained `reconcileStatus` (D7), `syncCustody` (D8),
  `place` (`receipt`), `transfer` (`transfer` + source cleared), plus
  `borrowOut`, `borrowReturn`, `markAssetLost`, `setToolSetStatus`,
  `toolSetAssetIds` and a private `assertLocation`.
- Inventory exposes `assertStorageInWarehouse` (real) and
  `assertWarehouseReachableByOrg` (returns `true`; ERP-0031 stub with the call
  site kept real) through `WarehouseService`; Assets holds no inventory
  repository.
- Tool-set lending expands to N lines and flips `tool_sets.status`
  `available ↔ lent`; guest PII, approval chain and both sweeps unchanged.
- Locale keys re-keyed `inventory:borrowing.*` → `assets:*` (en + id); audit
  actions are `asset.borrowed|returned|lost|moved|placed|transferred|disposed`.
- Migration `20261105221923_erp0036_slice3_borrowing_engine` hand-edited:
  drop the manually-created
  `serial_tracked_items_current_borrowing_line_id_borrowing_lines_id_fkey`
  **before** `borrowing_lines`, since it never existed in Drizzle metadata.
  `serial_tracked_items.current_borrowing_line_id` stays superseded (D17).
- Tests retargeted asset-shaped (borrowing service + authorization, asset
  operations custody/location, kind×status matrix, item/inventory suites), and
  `verify-inventory-constraints.ts` now probes `assets.borrowing*` plus `ready`.

> **Superseded 2026-11-14:** that verifier was deleted after rotting to 14
> failing checks; see the entry at the top of this file.

```text
bun run typecheck                      → clean
bun run test                           → 526 pass, 0 fail (27 files, 979 expects)
bun run lint                           → 0 errors (6 pre-existing warnings)
bunx --bun drizzle-kit generate --hints-file … 
  → 20261105221923_erp0036_slice3_borrowing_engine
bun run drizzle:migrate                → migrations applied successfully
bun run drizzle:seed                   → complete (run 1)
bun run drizzle:seed                   → complete (run 2, idempotent)
bun docs/database/validate-dbml.ts     → 255 tables, 228 refs, 0 cross-module,
                                         0 timestamp gaps, OK
```

Post-migration DB checks (`ims_erp_local`): only `assets.borrowing_events`,
`assets.borrowing_lines`, `assets.borrowings` remain; `tool_set_id` exists;
the old manual FK is gone; `serial_tracked_items_status_check` is
`pre_order|in_stock|lost|sold|applied_warranty`. `docs/database/` reviewed —
no change required (no table/column/link/vocabulary moved in Slice 3).

## Completed (this session - ERP-0036 Slice 2 schema + destructive migration, 2026-11-05)

Status: **verified** on the local database; **implemented** in code. Slice 2 of
`docs/plan/plans/assets-equipment-location-and-borrowing.md`.

What landed:

- `apps/backend/database/cleanup-tool-items.ts` — one-shot, `--dry-run` first,
  refuses on mixed borrowings or adjustment lines, deletes `tool`/`service`
  items + units and their ledger rows behind a transaction, writing audit rows.
  Dry run on the old DB: `items: 8, byKind {tool: 4, service: 4}, units: 12,
  borrowings: 0, stockMovements: 0, stockBalances: 0`; then `--apply` succeeded.
- `apps/backend/drizzle/schemas/asset.schema.ts` rewritten to the 14-table
  contract: `asset_types` lookup + FKs, `assets` location columns,
  `borrowed_since`, nullable org, `ready|borrowed|...` status, global code
  unique, expression serial unique; `asset_movements` location ids + new
  vocabulary; the borrowing trio ported to `assets`.
- `apps/backend/drizzle/schemas/inventory.schema.ts`: `ITEM_KINDS` is
  `product|component|material`, the service CHECK is gone, the kind CHECK and
  item seeder shrink accordingly.
- `apps/backend/database/seeders/seed/inventory.seeder.ts`: tool/service blocks
  deleted, kinds trimmed, faker doc rewritten.
- `item.service.ts`, `asset.service.ts`, `asset-operations.service.ts`,
  `asset.repository.interface.ts`: status/vocabulary moves (`in_stock`→`ready`,
  `in_use`→`borrowed`, `loan`→`borrow_out`, `return`→`borrow_return`,
  `assigned_at`→`borrowed_since`).
- Tests updated: seeder data, kind×status matrix, item/asset operation suites,
  and the manual `verify-inventory-constraints.ts` verifier.
- New migration `20261105123204_faulty_ikaris`, hand-edited per plan: asset-type
  seed inserts before the FK adds, old status/movement CHECKs dropped before the
  backfills and re-added after, idempotent `in_stock→ready` / `in_use→borrowed`
  and `loan/return` backfills.

**Deviations from the plan, recorded deliberately:**

1. **The inventory borrowing trio and `assets.asset_assignments` stay until
   Slice 3.** Removing them in Slice 2 makes the live borrowing service and
   assignment endpoints reference dropped tables, so that commit could not
   compile or run. Their code moves in Slice 3 and the `DROP TABLE`s ride that
   migration. Same reason `serial_tracked_items.borrowed` and its CHECK stay for
   one more slice. The contract (`docs.dbml`) still describes the target state.
2. `database/seeders/index.ts` now imports `reflect-metadata` first. Both
   `drizzle:seed` and `drizzle:migrate-reset` crashed under Bun 1.4.4 with
   “tsyringe requires a reflect polyfill” before this; the backend entrypoint
   already imported it, the seeder entrypoint did not.
3. `docs.dbml` nullable-org/scoped-unique fixes for the eight asset tables and
   three index pairs landed here (they were drafted after the Slice 1 commit).

```text
bun run typecheck                      → clean
bun run test                           → 530 pass, 0 fail (27 files, 981 expects)
bun run lint                           → 0 errors (6 pre-existing warnings)
bun docs/database/gen-logical-references.ts
  → regenerated: 513 refs across 37 targets, 228 intra-module refs
bun docs/database/validate-dbml.ts
  → parsed: 255 tables, 228 refs; cross-module refs: 0; timestamp gaps: 0; OK
bun run database/cleanup-tool-items.ts --apply
  → items 8 (tool 4, service 4), units 12 deleted; Cleanup applied.
bun run drizzle:migrate-reset          → migrations + seed complete
bun run drizzle:migrate                → migrations applied successfully
bun run drizzle:seed                   → complete (second run, idempotent)
```

Post-migration DB checks (`ims_erp_local`): item kinds are exactly
`product|component|material` (4 each), units all `in_stock` (4), six
`asset_types` rows, `assets` schema 15 tables (11 old + asset_types + borrowing
trio, assignments pending Slice 3), `inventory` still 12 tables (trio pending
Slice 3), and the three CHECK definitions match the new vocabularies.

## Completed (this session - ERP-0036 Slice 1 contract, 2026-11-05)

Status: **implemented** for the contract only (`docs/database/` + plan docs); no
Drizzle schema, migration, seeder, service or UI touched yet.

`docs/database/docs.dbml` is now the target contract for ERP-0036:

- **Assets block rewritten** (now 14 tables). New `assets.asset_types` (global
  lookup, no `organization_id`, unique `code`); `assets.asset_categories` and
  `assets.assets` gain a real `Ref` to `assets.asset_types.code` and lose their
  `asset_type IN (...)` CHECKs; `assets.assets` gains `warehouse_id` /
  `storage_id` (logical refs into `inventory`), renames `assigned_at` →
  `borrowed_since`, drops `organization_id NOT NULL`, and switches the status
  CHECK to `ready|borrowed|maintenance|inactive|disposed|lost`.
- **Uniqueness settled** (Stage 0 B5 / D13): `assets.code` is a single global
  unique index (codes allocate on the global sequence); serials are unique per
  scope via an expression index on `(coalesce(organization_id,''), serial_number)
  WHERE serial_number IS NOT NULL AND deleted_at IS NULL`.
- `assets.asset_movements`: four location id columns, new vocabulary
  `receipt|transfer|borrow_out|borrow_return|project_site|disposal|lost`,
  location/type indexes.
- `assets.borrowings` / `borrowing_lines` / `borrowing_events` added (ported
  from inventory, `asset_id` and `asset_movement_id`, plus `origin_storage_id`),
  with intra-module FKs. `assets.asset_assignments` deleted (D6).
- **Inventory block**: borrowing trio + its 5 refs deleted (13 tables left);
  `item_kind` is `product|component|material` and the service clause is gone;
  `serial_tracked_items.status` drops `borrowed` and gains the superseded
  `current_borrowing_line_id` column + index for the later cleanup;
  `stock_movements` borrowing vocabulary annotated as superseded (D17).
- TableGroups updated for both modules (`inventory.borrowing*` out,
  `assets.asset_types` + `assets.borrowing*` in, `assets.asset_assignments` out).
- `module-ownership.md`: Inventory 16→13 tables / 24→19 FKs / 31→12 logical
  refs; Assets 11→14 / 11→16 / 26→33; module profiles rewritten (Inventory no
  longer owns borrowing, Assets owns it, placement asserts listed with the
  ERP-0031 stub called out); the nullable-org carve-out now covers Inventory
  **and** Assets, not Inventory alone.
- `data-dictionary.md`: nullable-org rule, the `assets.assets.code`
  global-uniqueness exception, `assets.borrowing_events` added to the
  no-`deleted_at` list, new scope-split/expression index conventions,
  `warehouse_id`/`storage_id` generic columns, Assets glossary rewritten
  (assignment → borrowing, location, movement, derived status).

```text
bun docs/database/gen-logical-references.ts
  → regenerated: 513 refs across 37 targets, 228 intra-module refs
bun docs/database/validate-dbml.ts
  → parsed: 255 tables, 228 refs
    cross-module refs: 0
    timestamp gaps: 0
    OK
```

Two gate defects were found and fixed rather than worked around:

1. **`docs.dbml` at `HEAD` did not parse.** `assets.assets.status` carried a
   `[note: …]` setting on a `Checks` entry; `@dbml/core` rejects it with
   `Unknown check setting 'note'`. The same construct existed in three other
   checks I touched. All check-level notes were moved into table `Note:`
   strings; the file parses again.
2. **The cross-module check was vacuous.** `validate-dbml.ts` iterated
   `db.refs`, which `@dbml/core` v11 leaves undefined — the parse result keeps
   all 228 refs on `schema.refs`. It now reads every ref and prefers
   `endpoint.schemaName` over the bare-name map (which is ambiguous because
   `items` exists in both `catalog` and `inventory`). First real run reported
   11 false positives from that ambiguity, then 0.

Also noted for later slices: `gen-logical-references.ts` anchors its regex at
the start of a column note, so any cross-module note must **begin** with
`Logical reference to …` or it is silently uncounted.

`docs/database/` **was** changed (this is the contract slice).
`docs/plan/plans/assets-equipment-location-and-borrowing.md` Slice 1 marked
DONE with these deviations.

## Completed (this session - assets/equipment Stage 0 review, 2026-11-05)

Status: **in-progress** (plan doc amended; still no code, schema, migration or
seed touched).

- Ran an execution review (`Stage 0`) of
  `docs/plan/plans/assets-equipment-location-and-borrowing.md` against the
  actual code before writing anything. Design holds; the plan as written was
  not executable. Nine defects found, six blocking:
  - **B1** D11's reachability rule needs `inventory.warehouse_organizations`,
    which exists only in `docs.dbml:2268` — not in Drizzle, not migrated; it is
    backlog **ERP-0031**, still `planned`. Resolved by keeping global assets but
    stubbing `assertWarehouseReachableByOrg` to return `true` (all warehouses
    are global today), with a real call site so ERP-0031 is a body swap.
  - **B2** Slice order broke the migration: the tightened `item_kind` CHECK
    would fail while seeded `tool`/`service` rows exist, and the cleanup script
    sat in Slice 4. Cleanup + seeder trim moved into Slice 2, before
    `drizzle:generate`.
  - **B3** The `borrowing` → `asset_borrowing` rename would silently revoke
    every role's access: grants are jsonb (`role.schema.ts:73`) and
    `organization-roles.seeder.ts` is insert-only. Added an idempotent jsonb
    key-rename data migration in the same slice.
  - **B4** D11's `document_sequences.organization_id` nullable change was wrong:
    the service already writes a `''` sentinel
    (`document-numbering.service.ts:62`) and `NULL` never conflicts in
    `ON CONFLICT (organization_id, doc_type)`, so it would have minted
    duplicate sequences. Clause dropped; no schema change.
  - **B5** Acceptance said a global asset and an org asset cannot share a code,
    but `(org, code)` unique plus code-unique-where-org-is-null does not deliver
    it. Ruling: `assets.code` globally unique, codes allocate from the global
    sequence; serials unique on `(coalesce(organization_id,''), serial_number)`.
  - **B6** D15 said "eight actions"; the real grant has ten (adds `mark_late`,
    `export`). Rename only, keep ten.
- Non-blocking defects (B7-B9) recorded and folded into the slices: the
  borrowing port needs `origin_storage_id`, the `asset_movement_id` FK policy,
  movement rows for disposal/maintenance and the `asset_types` seed before the
  FK is added; `reconcileStatus` needed explicit source rules; and the
  scheduler worker, warehouse `toolsCount`, borrowing errors living in
  `inventory.errors.ts`, asset-type endpoints, the `in_stock→ready` backfill and
  the affected tests were missing from the plan.
- Migrations will need one **hand edit**: the
  `serial_tracked_items.current_borrowing_line_id` FK exists in the database and
  in `20261102174836_colorful_rattler` but not in Drizzle metadata, so
  `drizzle:generate` cannot emit its `DROP CONSTRAINT`.
- `docs/database/` was reviewed and is **unchanged** so far; it changes in
  Slice 1. `bun docs/database/validate-dbml.ts` not run (no edits yet).
- Verified: nothing executed — reading only (`git status`, `Read`, ripgrep).

## Completed (this session - assets/equipment design plan, 2026-11-05)

Status: **design only** (no code, schema, migration or seed touched;
`docs/database/` reviewed but not yet edited - it changes in slice 1).

- **7-round grilling session** resolved the "tools are equipment" question and
  the follow-up "equipment movements must be tracked between warehouses /
  warehouse storages". Output: `docs/plan/plans/assets-equipment-location-and-borrowing.md`
  (D1-D20, five slices, acceptance criteria, accepted risks).
- Key calls: the **asset row is the physical unit**; assets gain
  `warehouse_id`/`storage_id` plus location ids on `asset_movements`; the
  **borrowing engine moves into `assets`** (guest PII, approval chain, sweeps
  retained, ported by `git mv`) and the inventory trio is dropped;
  `asset_assignments` is dropped because borrowing becomes the only custody;
  asset status becomes `ready|borrowed|maintenance|inactive|disposed|lost`
  derived by one reconcile; `item_kind` shrinks to
  `product|component|material`; `asset_type` becomes a seeded lookup table;
  asset tables go nullable-org (app-admin write, org read); `borrowing`
  permission renamed `asset_borrowing`.
- New backlog item **ERP-0036** (planned); `features.md` M06 updated in the
  same change.
- Destructive step accepted on the basis that **no production database
  exists**: one migration drops `inventory.borrowings`/`borrowing_lines`/
  `borrowing_events` and `assets.asset_assignments`, and a `--dry-run`-first
  script hard-deletes tool items and serial units. Must not run against any
  `POSTGRES_URL` the author cannot name.
- Verified: nothing (design only). No commands run beyond reading files.

## Completed (this session - dummy dashboard view, 2026-11-06)

Status: **implemented** (UI mock only; no backend, schema, migration, or seed
touched — `docs/database/` reviewed, unchanged).

- **M01 dashboard dummy view** per the grill-me plan: all Stage-1 widget
  placeholders (sales, cash per account, provisional profit, inventory,
  projects by status, subscriptions) plus a 6-month invoiced-sales bar chart,
  a sample activity feed, and quick links —
  `apps/web-admin/src/components/dashboard/dashboard-page.tsx` (new),
  rendered by `_authed.index.tsx` (replaced the shadcn placeholder boxes).
  Persistent "sample data" banner; profit carries its "provisional" badge
  (M01 labelling rule). Every widget links to its ComingSoon source route.
  All copy in `en`/`id`.
- **`apps/web-admin/src/lib/dashboard-api.ts` (new)**: typed mock summary +
  `fetchDashboardSummary()` (async signature, ready to swap for the real
  `/dashboard/summary`), `dashboardQueryOptions()`, `formatIdr()` (integer
  IDR minor units → `id-ID` currency string, pinned per ADR-0002). ponytail
  comment marks the swap point and the server-side permission-gating rule.
- **`packages/locales`**: new `dashboard` namespace (en/id, flat dot-keys)
  registered in `en/index.ts`, `id/index.ts`, `i18next.d.ts` and
  `NAMESPACES`. Quick links reuse `nav:item.*`; parity test's
  allowed-identical set gained `dashboard:widget.cash.total` ("Total" is the
  same word).
- **Test**: `apps/web-admin/test/unit/dashboard-api.test.ts` (new) — mock
  shape (all six widgets, integer minor units, provisional profit, 6-month
  series ending in the current month, route/nav-key sanity) and `formatIdr`
  output.

Verification: `bun test` in `apps/web-admin` — 41/41; `bun test` in
`packages/locales` — 34/34 (dead-key + parity guards pass); `bun run build`
in `apps/web-admin` (tsc -b + vite) — passes; `bun run lint` — only the 9
pre-existing warnings, none in new files. Docs changed: `progress.md` (this
entry), `plans/features.md` (M01 mock-scaffold note). Backlog: no status
moves (a UI mock is not an ERP ID; M01 stays blocked on source modules).

## UI — full ERP sidebar shell + placeholder routes (2026-11-05)

Status: **implemented** (UI-first; no backend, schema, migration, or seed
touched).

- **`apps/web-admin/src/components/sidebar/nav-config.ts` (new)**: single
  typed nav map covering the docs module plan M01–M12 plus Administration.
  Sections: Dasbor; CRM & Penjualan (CRM → `/crm/*` and Penjualan →
  `/sales/*` split as sibling parents); Langganan & Lisensi; Integrasi (flat
  — four items, no grouping parent); Inventaris & Pengadaan (Gudang, Stok,
  Barang, Pengadaan → `/procurement/*`, Aset & Peralatan → `/assets/*` merged
  in; Peminjaman stays at `/inventory/borrowings`); Proyek & Purnajual;
  Karyawan & Kehadiran; Keuangan (M09 + merged M10 Pajak at `/finance/tax/*`
  + merged M11 Bonus & Investor at `/finance/investors/*`; new Saldo Awal and
  Rekonsiliasi items per the m09 Stage-1 plan); Laporan & Hak Akses;
  Administrasi (Organisasi, Pengguna, Peran, Log Audit, Pengaturan).
- **Owner review changes applied during the session**: Assets & Equipment
  merged into the inventory section; CRM/Sales split; Integrations flattened;
  Finance made robust (opening balances + reconciliation added, Tax and
  Investors merged in as `/finance/tax/*` and `/finance/investors/*`).
- **`coming-soon-page.tsx` (new)**: shared placeholder page (icon, title,
  "Segera hadir" badge) rendered by 55 thin route stubs under
  `_authed/{sales,crm,subscription,integrations,procurement,assets,projects,hr,finance,tax→removed,investors→moved,reports,admin/settings}`.
  Real implementations replace the stub body; the route shell stays.
- **`sidebar-section.tsx`**: parent items with children now link to their
  hub route; sub-items get active highlighting (`activeProps` on the TanStack
  `Link` inside `SidebarMenuSubButton`, matching top-level behavior).
- **`main-sidebar.tsx`**: renders sections from `nav-config.ts`. The
  `role === 'admin'` gate on the Administration section is **removed for
  review purposes** (UI-first); backend authorization unchanged and
  authoritative. Restore item gating via the `erp-permissions` catalog when
  wiring ERP-0002 to the sidebar.
- **Deleted**: legacy `nav-main.tsx`, `nav-project.tsx`,
  `nav-inventory.tsx`, `nav-admin.tsx` (superseded by the config).
- **`packages/locales` nav bundles**: +~60 keys en/id (module + item labels,
  Indonesian-first per docs: SPH, BAST, Kuitansi, Tutup Periode, Saldo Awal,
  Pemotongan Pajak, Data Investor). Dead keys removed with their last
  references: `project.*` (legacy nav), `section.platform`, `section.assets`,
  `section.tax`, `section.investors`, `item.crmSales`, `item.integrations`.
  `nav:item.crm` added to the parity test's allowed-identical set (proper
  noun); `item.whatsappAi` given a real Indonesian translation.

Verification: `bun run build` in `apps/web-admin` (tsc -b + vite, regenerates
`routeTree.gen.ts`) — passes; `bun test` in `packages/locales` — 30/30.
Docs changed: `progress.md` (this entry), `plans/features.md` (sidebar shell
rollup note). Backlog: no status moves (UI shell is not an ERP ID; ERP-0005
customer-slice UI remains `planned`).

## Doc change — status rollup + plan-doc obligation (2026-11-05)

Instructions/docs-only change; no code, schema, migration, or seed touched.
Status: **implemented**.

- **`docs/plan/plans/features.md` (new)**: feature status rollup grouped by
  v5.1 module M01–M12, then backlog-only ERP IDs, then "Outside the plan"
  (shipped features in neither the module plans nor a backlog ERP ID —
  invitations/claim, dynamic roles, audit, admin users, username login,
  account pages, forgot/reset password, avatar pipeline, Redis sessions,
  location lookup, backend + web i18n, sales payments, stock adjustments,
  worker registry, HTTP envelope, toast bus). Each row carries one line of
  evidence (module path + test file or progress.md date).
- **`AGENTS.md` Hard rules**: "Statuses live in…" bullet replaced by
  **"Every code update writes to the plan docs"** — code, migration, seeder,
  or test changes update `progress.md` + `backlog.md` in the same change,
  with `features.md` moving alongside any `backlog.md` status move.
- **`AGENTS.md` → How to update these docs**: same-change paragraph for
  `progress.md`/`backlog.md` (a code change without either is incomplete;
  when neither applies, record one `progress.md` line instead of skipping).
- **`AGENTS.md` → Definition of done item 5**: now requires
  `docs/plan/plans/features.md` updated in the same change.
- **`backlog.md` stale statuses fixed** (code had outrun the ledger):
  ERP-0002 authorization core → `implemented` (2026-10-29 core, 2026-11-01
  shared catalog), ERP-0003 auth module → `implemented` (2026-10-29 live
  HTTP verified), ERP-0027 warehouses S2 → `implemented` (2026-11-03/04
  hardening, 23 tests), ERP-0028 stock ledger S3 → `implemented` (GL
  reconciliation portion of ERP-0014 still open via OPEN-3). ERP-0029's
  nonstandard "shipped" wording left as-is deliberately.
- **`progress.md`**: rollup link added at the top; "Next executable task"
  rewritten to the customer slice (ERP-0004/0005) — ERP-0002/0003 are no
  longer open, so the old "ERP-0002/3/4/5" framing was stale.

Verification: `Select-String AGENTS.md -Pattern 'Every code update'` matches
the Hard rules bullet and the docs-update section; `features.md` present at
`docs/plan/plans/features.md`. `docs/database/` reviewed and **unchanged**
(no schema change — docs only).

## Completed — org/inventory rebaseline design (ADR-0010) (2026-11-04)

Status: **implemented** (docs only; ADR-0010 `proposed`, owner sign-off
pending; no code touched).

Grilling pass (manual, `grilling` skill) resolved: organizations = internal
departments (one ledger, one tax identity); inventory rebaselined as built;
warehouses all global with `inventory.warehouse_organizations` links as the
only access rule (role in active org + link; unlinked 404; global admin
bypass; org `admin` read-only stock); transfers as `transfer_out`/`transfer_in`
pairs incl. storage→storage; `responsible_employee_id` display-only; borrowing
stays in `inventory` covering M06 loans; procurement own module; OPEN-1 and
OPEN-3 closed. Backlog ERP-0031..0035 added.

Docs changed: ADR-0010 (new); `docs/database/docs.dbml` (new table,
warehouse notes), `logical-references.md` (regenerated),
`module-ownership.md` (inventory 16 tables / 24 FKs / 31 refs);
`erp-module-plans/{README,m05,m06,m12}.md`; `phases/phase-3`, `phase-5`;
`plans/inventory.md`, `plans/warehouse-hardening.md`; `backlog.md`;
`features.md`. `erp-plan-en.md`/`-id.md` untouched until owner sign-off.

```text
bun docs/database/gen-logical-references.ts → 509 refs, 228 intra-module
bun docs/database/validate-dbml.ts          → 255 tables, 0 cross-module refs,
                                              0 timestamp gaps, OK
```

**Next executable task:** ERP-0032 (stock transfers) — ERP-0031 is now
implemented in full, so its dependency is satisfied. Start by reading the
transfer requirements in `backlog.md` and the `inventory` tables in
`docs/database/docs.dbml`; ERP-0031's remaining work is acceptance only
(browser walk-through, reviewer confirmation before a non-local migration).

## Completed — v5.1 per-module plans (2026-11-04)

Status: **implemented** (docs only; not owner-reviewed).

`docs/plan/erp-module-plans/` added: `README.md` (index, glossary, common
DoD, `beyond-baseline` table) + `m01`–`m12` files restating
`docs/plan/erp-plan-en.md` v5.1 per module (scope, limits, tasks, SOPs,
controls, acceptance, DoD, dependencies, current state vs plan). Inferred
detail is marked _interpretation, needs owner confirmation_. Finding: build
has drifted past v5.1 (multi-tenant organization, multi-warehouse, 24-module
`docs.dbml` vs 12 plan modules, while M09 Finance — the end of the plan's
main sequence — has no code). Cut/rebaseline decision is **open** for the
owner. `docs/database/` reviewed and **unchanged**; no code touched.

## Completed — module directory cleanup: errors/, adapters/, utils/ (2026-11-04)

Status: **verified** (typecheck + full test suite + lint).

Refactor of `apps/backend/src/app/` so `services/` holds only `*.service.ts`
files and every file type has a dedicated home:

- **errors/** (new dirs in `user`, `inventory`, `organization`):
  `user.errors.ts`, `invitation.errors.ts`, `inventory.errors.ts`,
  `organization.errors.ts` moved out of `services/` (git mv, history kept).
- **adapters/** (new dirs in `user`, `organization`): Better Auth wrappers
  moved out of `services/` and renamed — `better-auth-user.gateway.ts` →
  `adapters/better-auth-user.ts`, `better-auth-user-management.gateway.ts` →
  `adapters/better-auth-user-management.ts`,
  `better-auth-organization.gateway.ts` →
  `adapters/better-auth-organization.ts`, `logger-mailer.ts` →
  `adapters/logger-mailer.ts`. The `.gateway` suffix was dropped: "gateway"
  naming is reserved for future websocket gateways; external-system port
  implementations are adapters.
- **user/utils/token.ts** moved out of `services/` (pure helpers).
- **Contract split (user module only):** monolithic
  `contracts/repositories.interface.ts` → per-domain
  `invitation.repository.interface.ts`, `role.repository.interface.ts`,
  `user-management.repository.interface.ts` (+ `admin-listing.types.ts` for
  shared listing types); `contracts/gateways.interface.ts` →
  `user-management-auth.gateway.interface.ts` (with `TClaimTarget`) and
  `invitation-mailer.gateway.interface.ts`. All other `contracts/` files
  untouched. `middleware/` is a reserved optional module dir (documented,
  not created).
- **Imports:** ~40 lines updated across services, controllers,
  repositories, `constants/di.ts`, both containers, plus 9 test files.
- **Docs/skills synced:** `elysia-module` → v1.5.0,
  `elysia-layered-architecture` → v1.4.0 (checklists, layer tree, port
  implementations in `adapters/`), root `AGENTS.md` module-shape paragraph,
  `modules/organization.md` (stale `routes/`/`containers/` fixed), 
  `modules/user.md` (current layout note), `skills.md` inventory.

Verification actually run (2026-11-04):

```text
bun run typecheck (apps/backend)   → clean
bun test (apps/backend)            → 530 pass / 0 fail (26 files)
bun run lint (apps/backend)        → 0 errors; 2 warnings introduced by the
                                     refactor were fixed, rest pre-existing
```

`docs/database/` reviewed and **unchanged** (no schema change — code
layout only).

## Completed — admin users list presigns avatars (2026-11-03)

Status: **verified** (unit test + live endpoint + presigned fetch).

Root cause of "avatars show the fallback in the admin users table although
the S3 objects exist": `UserAdminService.list` projected `image` **raw** —
the S3 object key (`user/<id>/avatar.webp`), not a URL. The browser cannot
load a relative object key as `<img src>`, so Radix `AvatarImage` errored
and every row rendered the initials fallback. Only the profile path
(`UserService.withPresignedAvatar`) was remapping; the admin list bypassed
the convention.

Fix: `apps/backend/src/app/user/services/user-admin.service.ts` `list()`
now maps `image` through `presignObjectUrl` (null stays null) — the same
short-lived-URL convention as the profile path. Audit of all user-serving
services confirmed this was the only raw-`image` leak.

Verification actually run (2026-11-03):

```text
bun run typecheck (apps/backend)                     → clean
bun test test/unit/user-admin.service.test.ts        → 12 pass / 0 fail
bun test (apps/backend)                              → 526 pass / 0 fail
bun run lint                                         → pass
GET /admin/users (live, dev server)                  → image = https://…/avatar.webp
                                                       ?X-Amz-… (signed), not a key
presigned URL fetch                                  → 200 image/webp
```

Presigned URLs expire after 300s by design; react-query's refetch-on-focus
re-presigns. Same behavior as the profile page — no change.

`docs/database/` reviewed and **unchanged** (no schema change).

## Completed — avatar pipeline fix: DiceBear v10 + WebP (2026-11-03)

Status: **verified** end to end (DB → S3 → presigned URL → format).

Root cause of "no avatar on the web after seeding": the avatar worker's
DiceBear URL sent `backgroundColor=transparent`. The DiceBear **v10** HTTP
API validates `backgroundColor` against a hex-color pattern and rejects
`transparent` with **400**. Every avatar job therefore failed all 3 BullMQ
attempts, `auth.users.image` stayed `null`, and the web-admin avatar
components (`{user.image && <AvatarImage/>}`) rendered only the initials
fallback.

Fix (`apps/backend`):

- `src/app/user/queues/avatar.worker.ts`: style path
  `10.x/initials/png` → `10.x/initials/webp`; **no `backgroundColor`
  parameter at all** (per explicit decision — the style's seed-derived
  default applies; do not re-add it, including `00000000`);
  `generateAvatarPng` → `generateAvatarWebp`; temp file `.webp`.
- `src/providers/s3/s3.ts`: `avatarObjectKey` → `user/<id>/avatar.webp`.
- `src/app/user/services/user.service.ts`: comment-only key references.
- `test/unit/avatar.worker.test.ts`: WebP magic check (RIFF/WEBP), new
  guard test asserting `backgroundColor` is **absent** from the URL,
  `.webp` key expectation.

Verification actually run (2026-11-03):

```text
bun run typecheck (apps/backend)                     → clean
bun test test/unit/avatar.worker.test.ts             → 11 pass / 0 fail
bun test (apps/backend)                              → 525 pass / 0 fail
bun run lint                                         → pass (pre-existing warnings only)
drizzle:migrate-reset + reseed (user-run; a schema-reset
  deadlock occurs when the dev server holds locks — stop the
  server first for a scripted reset)                 → 17 seeded users all have
                                                       image = user/<id>/avatar.webp
presigned URL fetch                                  → 200, content-type image/webp
avatar queue after drain                             → waiting: 0 (1 stale pre-fix failed
                                                       job for a dead user id; ages out)
```

Pipeline confirmation: Better Auth `user.create.after` hook fires for
seeded users (admin + 16 role accounts) → jobs enqueued at seed time →
running dev-server worker drains them → S3 object written → key stored →
presigned per request. Closes the ERP-0029 follow-up "worker not yet
observed firing against real Redis".

`docs/database/` reviewed and **unchanged** (no schema change; `image`
remains a text key column).

## Completed — faker-based seeders + faker skill (2026-11-03)

Status: **implemented** for the skill/docs; the seeder run-twice idempotency
and a full fresh-database `migrate-reset` were **verified**. Not `accepted`
(no reviewer sign-off yet).

### Encoding fix (WIN1252 vs emoji, 2026-11-03)

`drizzle:migrate-reset` failed on a fresh database:
`faker.person.bio()` emitted an emoji (🧣) and the WIN1252-encoded dev
PostgreSQL cannot store 4-byte UTF-8. Fix: `seedSafeText()` helper
(`database/seeders/seed/faker-content.ts`) strips non-Latin-1 characters and
collapses whitespace; applied to every faker text field in
`organization-members.seeder.ts` (name, bio) and `inventory.seeder.ts`
(item name, category, material). Anchors are ASCII and untouched. A
char-code filter is used instead of a negated-class regex (oxlint
`no-control-regex`). Skill §3.1 records the rule.

- **Dependency:** `@faker-js/faker@10.6.0` added as a devDependency of
  `apps/backend` (`bun add @faker-js/faker --cwd apps/backend --dev`,
  clean install).
- **`apps/backend/database/seeders/seed/inventory.seeder.ts`**: curated
  `SEED_ITEMS` fixture array replaced by `generateSeedItems()` — a
  deterministic faker generator (`faker.seed(20261102)`, fixed constant),
  4 items per kind × 5 kinds = 20 items. Kind invariants preserved (tools
  serialized + unsellable; materials quantity-tracked with unit labels;
  services untracked). SKUs/serials are deterministic anchors
  (`ITEM-001`…`ITEM-020`, `<SKU>-S00n`) so the natural-key idempotency
  guards still hold; faker only fills names, categories, and integer-IDR
  prices per ADR-0002 (no `faker.finance.amount`). Opening-stock fixtures
  re-anchored to `ITEM-005` (first component) / `ITEM-009` (first material)
  with the mapping documented. Money and `organization_id` scoping
  conventions respected; location seeder untouched (real administrative
  reference data is never faker-generated).
- **`apps/backend/database/seeders/index.ts`**: stale final log message
  fixed ("Location seeding complete" → "Seeding complete"). No orchestration
  change; `migrate-reset.ts` reuse of `runSeeders()` unaffected.
- **Skill:** `.agents/skills/faker/SKILL.md` created (v1.0.0, local,
  dependsOn `erp-database-schema`): deterministic seeding, anchor vs
  content fields, never faker-generate canonical reference data /
  statuses / currency, money-datetime-quantity column mapping, 10–50
  rows/module sizing, anti-patterns.
- **Docs:** `AGENTS.md` backend skill table gained the `faker` row; the
  `drizzle:seed` command row notes faker-based deterministic seed content.
  `.agents/docs/skills.md` inventory gained `faker` as *present, not in
  lock*.

- **`apps/backend/database/seeders/seed/organization-members.seeder.ts`**
  (same session, 2026-11-03): the 16 role accounts' content fields are now
  faker-generated — `name` (`faker.person.fullName()`), `bio`
  (`faker.person.bio()`), `phone` (fixed `+62811` prefix + role index +
  `faker.string.numeric(6)`, collision-free on `users_phone_live_idx`).
  Identity anchors (`<role>.seed@entragate.local`, `<role>_seed`,
  `<role>123456`) are unchanged. `FAKER_SEED = 20261103`, seeded once in
  `addSeedMembersTo()`. `phone` is an `input: false` Better Auth
  additionalField, so it is written directly via Drizzle on the creation
  path — the same module-ownership rule the user-management module applies.
  Existing accounts are reused as-is (never password/name/phone reset).
  `seedIdentity` no longer returns a `name`; role remains discoverable via
  email/username/membership role.

Verification actually run (2026-11-03):

```text
bun run typecheck (apps/backend)                                → clean, no errors
bun run drizzle:migrate-reset (fresh DB, after encoding fix)    → migrations + full seed OK:
                                                                  16/16 role accounts created with
                                                                  faker name/bio/phone (emoji-safe),
                                                                  20 items, 4 opening-stock movements
bun run drizzle:seed  (run 2, same DB)                          → created: 0, all guards skip;
                                                                  idempotent (DoD #4)
DB spot-check (auth.users)                                      → 0 rows with non-Latin-1 text;
                                                                  member_seed bio = "adviser advocate,
                                                                  musician" (emoji stripped)
bun -e determinism check (faker.seed 20261103, 16 accounts)     → deterministic: true, phones unique
bun run lint   (apps/backend)                                   → pass; pre-existing warnings only
bun test       (apps/backend)                                   → 524 pass / 0 fail
```

Note: the dev DB still contains the old curated items (`CTRL-DOOR-01`, …)
from previous seeds; the faker items coexist by design — anchors differ. A
fresh database gets only faker-generated items.

`docs/database/` was reviewed and is **unchanged**: no table, column,
index, constraint, cross-module link, status vocabulary, or money/quantity/
date rule changed — seeders are data, not schema.

Next: the previous "next executable task" stands (unchanged by this
data-only slice).

## Doc change — feature module lifecycle gate (2026-11-02)

Instructions-only change; no code, schema, migration, or seed was touched.
Status: **implemented** (not `verified` — nobody has yet confirmed an agent
follows the new gate end to end).

- **`AGENTS.md`**: new `## Feature module lifecycle` section between `##
Backend` and `## Internationalization`. Every backend feature work item —
  and specifically creating / updating / deleting `apps/backend/src/app/<module>/`
  — must (1) read `docs/database/` in the `erp-database-schema` protocol order,
  (2) run the `.agents/skills/grill-me` design interview before writing code,
  and (3) update `docs/database/` afterwards **when required** (table / column /
  index / constraint change, new cross-module logical reference, or a
  status / money / quantity / date / lifecycle rule change). Sync-back order is
  `docs.dbml` → `gen-logical-references.ts` → `validate-dbml.ts`.
- **`AGENTS.md`** `## Definition of done`: items 8–10 added (gates respected,
  `docs.dbml` updated-or-recorded + validator `OK`, module deletion leaves no
  orphans).
- **`AGENTS.md`** `## How to update these docs`: paragraph making
  `docs/database/` a same-change obligation, canonical over Drizzle.
- **`.agents/docs/README.md`**: named the 5 companion MDs explicitly (the count
  was right; the list was implicit) and pointed at the new gate.
  **Correction:** an earlier edit in this same change bumped the count to "6"
  on the assumption `implementation-phases.md` was uncounted. It was not —
  `docs/database/` has exactly 5 MDs, and the "6" was wrong. Reverted.
- **`.agents/docs/skills.md`**: `grill-me` added to the inventory as
  *present, not in lock*, with the honest caveat that its `SKILL.md` delegates
  to a `grilling` skill **that is not installed**.

Verification actually run:

```text
Select-String docs/database/docs.dbml -Pattern '^// MODULE:'   → 26 markers
Test-Path .agents/skills/grilling                              → False (absent, as documented)
bun docs/database/validate-dbml.ts                             → parsed: 253 tables, 0 standalone refs
                                                                  cross-module refs: 0
                                                                  timestamp gaps: 0
                                                                  OK   (exit 0)
```

`docs/database/` needed no change under the new rule: no table, column, index,
constraint, logical reference, or status vocabulary was modified. Noted here
rather than silently skipped.

Known inaccuracy left in place, flagged not fixed: the new `## Feature module
lifecycle` section describes the contract as 253 tables, the verified parser
count; `docs/database/module-ownership.md`, `implementation-phases.md` and the
`validate-dbml.ts` header comment still say **251** (`progress.md` line 481 above
already recorded 253). The count is not the contract — a follow-up docs pass
should reconcile 251 → 253 across the companions in one place.

Also verified while checking: `gen-logical-references.ts` writes
`logical-references.md` from `docs.dbml` using **absolute** paths
(`B:/ims/erp/...`), as does `validate-dbml.ts`. Neither script had to run in
this change (`docs/database/` was unchanged), so this was not exercised; the
hardcoded root is a portability defect worth fixing separately.

## Doc change — feature module lifecycle gate (2026-11-02)

Instructions-only change; no code, schema, migration, or seed was touched.
Status: **implemented** (not `verified` — nobody has yet confirmed an agent
follows the new gate end to end).

- **`AGENTS.md`**: new `## Feature module lifecycle` section between `##
Backend` and `## Internationalization`. Every backend feature work item —
  and specifically creating / updating / deleting `apps/backend/src/app/<module>/`
  — must (1) read `docs/database/` in the `erp-database-schema` protocol order,
  (2) run the `.agents/skills/grill-me` design interview before writing code,
  and (3) update `docs/database/` afterwards **when required** (table / column /
  index / constraint change, new cross-module logical reference, or a
  status / money / quantity / date / lifecycle rule change). Sync-back order is
  `docs.dbml` → `gen-logical-references.ts` → `validate-dbml.ts`.
- **`AGENTS.md`** `## Definition of done`: items 8–10 added (gates respected,
  `docs.dbml` updated-or-recorded + validator `OK`, module deletion leaves no
  orphans).
- **`AGENTS.md`** `## How to update these docs`: paragraph making
  `docs/database/` a same-change obligation, canonical over Drizzle.
- **`.agents/docs/README.md`**: named the 5 companion MDs explicitly (the count
  was right; the list was implicit) and pointed at the new gate.
  **Correction:** an earlier edit in this same change bumped the count to "6"
  on the assumption `implementation-phases.md` was uncounted. It was not —
  `docs/database/` has exactly 5 MDs, and the "6" was wrong. Reverted.
- **`.agents/docs/skills.md`**: `grill-me` added to the inventory as
  *present, not in lock*, with the honest caveat that its `SKILL.md` delegates
  to a `grilling` skill **that is not installed**.

Verification actually run:

```text
Select-String docs/database/docs.dbml -Pattern '^// MODULE:'   → 26 markers
Test-Path .agents/skills/grilling                              → False (absent, as documented)
bun docs/database/validate-dbml.ts                             → parsed: 253 tables, 0 standalone refs
                                                                  cross-module refs: 0
                                                                  timestamp gaps: 0
                                                                  OK   (exit 0)
```

`docs/database/` needed no change under the new rule: no table, column, index,
constraint, logical reference, or status vocabulary was modified. Noted here
rather than silently skipped.

Known inaccuracy left in place, flagged not fixed: the new `## Feature module
lifecycle` section describes the contract as 253 tables, the verified parser
count; `docs/database/module-ownership.md`, `implementation-phases.md` and the
`validate-dbml.ts` header comment still say **251** (`progress.md` line 481 above
already recorded 253). The count is not the contract — a follow-up docs pass
should reconcile 251 → 253 across the companions in one place.

Also verified while checking: `gen-logical-references.ts` writes
`logical-references.md` from `docs.dbml` using **absolute** paths
(`B:/ims/erp/...`), as does `validate-dbml.ts`. Neither script had to run in
this change (`docs/database/` was unchanged), so this was not exercised; the
hardcoded root is a portability defect worth fixing separately.

## Completed (this session — inventory S4 borrowing, 2026-11-03)

**Nothing committed yet** — uncommitted working-tree state on top of S0–S3.
Design: `docs/plan/plans/inventory.md` §5–§11, D19–D22.

### S4 — borrowing: state machine, sweeps, API, UI

- **Step 1 was already done.** `borrowings`, `borrowing_lines`,
  `borrowing_events`, their constraints, and all 23 indexes were already in
  `inventory.schema.ts` and applied by `20261102133850_talented_jubilee`; every
  §6 `borrowing:*` permission was already granted in `erp-permissions.ts`. The
  plan doc's step 1 ("schema + ALTER for the circular FK") understated this —
  only the FK was genuinely missing.
- **Migration `20261102174836_colorful_rattler`** adds
  `serial_tracked_items.current_borrowing_line_id` + its index (generated) and,
  hand-written, the `REFERENCES borrowing_lines(id) ON DELETE SET NULL` that
  `drizzle-kit generate` cannot emit because no `CREATE TABLE` order satisfies
  the cycle. Applied to the live database and verified: `confdeltype = 'n'`.
- **`StockService.postMovement` gained an optional `tx`.** It previously opened
  its own `database.transaction()`, so borrowing could not commit custody,
  movement, balance, and event together — a nested call is a savepoint, so an
  outer rollback would have left a committed movement behind.
- **`BorrowingService`** (new): transition matrix as data, `BRW-YYYYMM-####`
  codes, skippable approval keyed on `borrowing:issue`/`:approve`, per-line
  issue/return, `mark-lost` reducing stock at the line's snapshotted origin
  warehouse, and guest-PII projection with `guestIdentityRedacted`.
- **Real BullMQ worker** (decision: `harden`, not the plan's `setInterval`
  fallback): `providers/queue/inventory-scheduler.queue.ts` +
  `.worker.ts`, two `upsertJobScheduler` schedules (late sweep `*/15 * * * *`,
  retention `0 3 * * *`) on `redis.queueDb`. `scheduler.enabled` defaults to
  `false` so tests never open a connection. SIGTERM drains the worker before
  `closeQueueConnection()`.
- **OPEN-2 closed**: guest PII nulled 24 months after `closed_at`, exposed as
  `scheduler.guestPiiRetentionMonths` / `GUEST_PII_RETENTION_MONTHS`.
- **API**: `/borrowings` GET/POST, `/:id` GET, and
  `submit|approve|reject|issue|return|extend|mark-lost|cancel|close`
  transitions, each with its own `borrowing:*` permission.
- **UI**: `borrowing-api.ts`, list, `new` (three borrower paths as a
  discriminated union), detail with the event timeline rendering the movement
  id behind every physical event, plus an `inventory` nav entry. `en`/`id`
  bundles extended; the dead-key and parity tests both drove real fixes
  (an untranslated `status`/`serial`, a duplicated `extend` key, and two keys
  that no component used).

### Verified (exact commands, 2026-11-03)

| Command | Result |
|---|---|
| `bun run lint` (root) | 0 errors; 29 pre-existing warnings, none in borrowing files |
| `bun run typecheck` (root) | 3 successful, 3 total |
| `bun run test` (root) | backend **518 pass / 0 fail** (24 files, +60 new), locales 30 pass, web-admin 21 pass |
| `bun run build` (web-admin) | built; `_borrowingId` and `new` chunks emitted |
| `bunx --bun drizzle-kit generate` | `20261102174836_colorful_rattler` |
| `bunx --bun drizzle-kit migrate` | applied successfully |
| `bun run drizzle:seed` ×2 | second run wrote nothing (idempotent) |

**Not yet done:** no browser walk-through of the new screens; the worker has
not been observed firing against a real Redis. Both are worth doing before S4
is called accepted.

## Completed (this session - inventory module S0 + S1, 2026-11-02)

Branch `feat/inventory-module`, base `4fd67b4`. **Nothing committed yet** — all
of this is uncommitted working-tree state. Design: `docs/plan/plans/inventory.md`
(D1–D24), ADR-0008, ADR-0009.

### S0 — contract and permission model

- **ADR-0008** (nullable-organization inventory) and **ADR-0009** (serialized
  units and borrowing custody) written under `.agents/docs/decisions/`.
  ADR-0008 explicitly amends ADR-0007 §2 (which forbade `organization_id` on
  master tables) for `inventory` only.
- `docs/database/docs.dbml` inventory block rewritten to match the migration
  exactly: +`inventory.items`, `warehouse_addresses`, `borrowings`,
  `borrowing_lines`, `borrowing_events`; −`warehouse_zones`, `lot_batches`,
  `cycle_counts`, `cycle_count_items`; nullable `organization_id` everywhere;
  partial-index pairs; 23 intra-module `Ref:` lines. `catalog.items` marked
  SUPERSEDED. TableGroup "Inventory" corrected (it still listed the three
  dropped tables).
- `docs/database/module-ownership.md`: Inventory is now **one** schema (the
  `warehouse` schema is retired), row updated to 15 tables / 23 intra-module
  FKs / 30 logical refs, and the "Tenant" obligation restated with the
  inventory carve-out (`NULL` = global, never "any organization"). Totals
  refreshed to 254 tables / 227 refs / 524 logical refs.
- `docs/database/validate-dbml.ts` had to be taught two facts, not relaxed:
  `items` is an allowed bare-name duplicate (catalog.items is superseded and
  retained only until the catalogue satellites are adopted), and an
  append-only event row may carry `occurred_at` instead of `created_at`.
  `borrowing_events` added to the timestamp exemptions.
- `packages/common/src/authorization/erp-permissions.ts`: `borrowing` statement
  (10 actions) added; `warehouse:*` **stripped from every organization role**,
  including `owner` — which spreads `...allErpStatements`, so
  `warehouse: []` is set explicitly *after* the spread.
- `.agents/docs/backlog.md`: ERP-0014 re-scoped and sliced into ERP-0027 (S2
  warehouses), ERP-0028 (S3 stock ledger), ERP-0029 (S4 borrowing).
- `.agents/docs/modules/inventory.md` rewritten (it described the deleted
  NestJS backend); `.agents/docs/modules/warehouse.md` reduced to a pointer at
  Inventory.

### S1 — items and serialized units

- `apps/backend/drizzle/schemas/inventory.schema.ts` — 10 tables, vocabularies,
  partial-unique pairs, CHECKs; registered in `drizzle/db.ts`.
- Migration `database/migrations/20261102133850_talented_jubilee/` (66
  statements). **Regenerated** after index renames: `items_org_sku_uq`,
  `items_org_name_idx` and `items_barcode_idx` collided with `catalog.items`
  and are now `inventory_items_*`.
- Full domain: `constants/di.ts`, contracts, repositories, `ItemService`,
  `inventory.errors.ts`, `item.controller.ts`, `container.ts`, wired into
  `src/index.ts`.
- i18n `api` keys (en/id) consumed by the typed errors; new `inventory`
  namespace (en/id) registered in the bundles, `i18next.d.ts` and
  `NAMESPACES`; `nav.item.newItem` added.
- UI: `src/lib/inventory-api.ts`, `components/inventory/{admin-only,
  item-kind-list,item-form}.tsx`, four kind routes under
  `/inventory/{products,components,materials,tools}`, and
  `/inventory/items/{new,$itemId,$itemId.edit}`. `nav-inventory.tsx` points
  the two unbuilt routes at the `'#'` non-link sentinel instead of 404s.

### Verification (commands and exact outcomes)

- `apps/backend`: `bunx tsc --noEmit -p tsconfig.json` → clean;
  `bun test` → **214 pass / 0 fail** (403 expect calls, 15 files).
- `packages/locales`: `bun test` → **30 pass / 0 fail** (parity + dead-keys).
- `apps/web-admin`: `bunx tsc --noEmit -p tsconfig.app.json` → clean (the plain
  `tsc --noEmit` checks *nothing* here: `files: []` plus project references);
  `bun run build` → succeeds, inventory chunks emitted.
- `docs/database/validate-dbml.ts` → `parsed: 254 tables`, `cross-module
  refs: 0`, `timestamp gaps: 0`, **OK**.
- Real PostgreSQL 18 (throwaway `postgres:18-alpine`, since removed;
  **no containers left**):
  - `database/verify-inventory-constraints.ts` → **ALL CHECKS PASSED**, run
    twice consecutively (the script now drops `inventory` and replays the
    migration, so it is repeatable).

    > **Superseded 2026-11-14:** the script was deleted; by then it failed 14 of
    > its own checks and could no longer run twice (the `DROP` list never grew
    > past six schemas). The "repeatable" claim above held on 2026-11-06 only.
  - The **entire migration chain** (all 8 directories, in order) replays on a
    fresh database with `ON_ERROR_STOP=1` → 0 failures.
  - `pg_indexes` shows **zero** duplicate index names across schemas, and the
    five `inventory.items` indexes carry the `inventory_items_*` names.

### Known follow-ups (deliberate, not forgotten)

- Circular FK `serial_tracked_items.current_borrowing_line_id` →
  `borrowing_lines` arrives in a later `ALTER TABLE` migration (S4); the column
  is intentionally absent from the schema today.
- All 11 `catalog.*` satellite tables left in place (OPEN-1). `item_variants`
  will be needed before serialized units are usable at volume.
- Guest PII retention defaulted to **24 months** (OPEN-2).
- Valuation **out of scope** (OPEN-3): `average_cost` / `total_value` are never
  advanced.
- S4.3 pre-check outstanding: confirm `@providers/queue` supports repeating
  jobs before writing the late-return sweep; fallback is `setInterval` behind a
  config flag.
- `modules/product.md` still describes the NestJS-era sales catalog with a
  single type-discriminated entity. The item master is now `inventory.items`
  (ADR-0008); a pointer was added there.

## Completed (this session — user-management → user merge, 2026-11-03)

The deferred repository/contracts/tokens merge is done; `app/user-management/`
is deleted. All names kept verbatim (no token collisions existed):

- **Files moved** (git mv, content untouched): 4 contracts
  (`admin.contract`, `gateways.interface`, `invitation.contract`,
  `repositories.interface`), 2 controllers (`user-admin.controller`,
  `invitation.controller`), 3 repositories (`user-management.repository`,
  `role.repository`, `invitation.repository`) into `app/user/`.
- **Tokens merged** into `user/constants/di.ts` (8 tokens appended).
- **One container**: `registerUserManagement` folded into
  `registerUser` in `user/container.ts`; `src/index.ts` updated.
- **Barrel**: `user/index.ts` now exports the admin + invitation controllers;
  `app.ts` imports them from `./user`.
- **Dedupe**: `admin.contract.ts` re-exports `userIdParamsSchema` /
  `TUserIdParams` from `user.contract.ts` instead of duplicating them.
- Two `UserNotFoundError` classes remain deliberately: the self-service one
  (`user.errors.ts`, plain `Error`) and the admin one (`invitation.errors.ts`,
  i18n `UserManagementError` with HTTP 404) are caught by different
  controllers.
- `tsc --noEmit` clean; 301 unit tests pass.

## Completed (this session — backend tidy-up W1–W4, 2026-11-02)

Conformance pass against the `/elysia-module`, `/elysia-tsyringe`,
`/elysia-layered-architecture` and `/tsyringe` skills. Waves W1–W9 done;
W8 (docs pass) complete. **URLs changed** — backend and web-admin moved
together, nothing pushed.

Remaining known follow-up (deliberately deferred, not forgotten): ~~the
`user-management` **repositories/contracts/tokens** have not yet been merged
into `user`; `user-management/container.ts` is the seam.~~ **Done** — see
"Completed (this session — user-management → user merge, 2026-11-03)" below.

### W1 — DI tokens have one home (`03625fc`)

- `src/di/tokens.ts` is the single definition site for `DRIZZLE_TOKEN` and
  `REDIS_TOKEN`; `provider.ts` imports and re-exports them (pure alias, never
  a second `Symbol(...)` call), so modules needing only a token avoid pulling
  the Drizzle/Redis clients into their import chain.
- `organization/containers/organization.container.ts` → `organization/container.ts`
  (matches every other module); its imports changed `../x` → `./x`.
- Deleted 0-byte dead files: `src/contracts/repositories/repository.interface.ts`
  (and the now-empty `src/contracts/` dir) plus five unused drizzle schemas
  (`warehouse`, `inventory`, `employee`, `document`, `project`).

### W2 — no SQL in services (`03625fc`)

- Deleted `user-management/services/role.service.ts`; `findMemberRole` folded
  into `RoleRepository` + `IRoleRepository`, and `InvitationService` now
  injects `ROLE_REPOSITORY_TOKEN` — it was the only reason the service held a
  Drizzle handle.
- `TAuditEntry` moved to `contracts/repositories.interface.ts` (it is the
  repository's write DTO); `AuditRepository.insert()` added; `AuditService`
  now goes through `AUDIT_REPOSITORY_TOKEN` + `pinoLogger`.
- Gate: `Select-String -Path src/app/*/services/*.ts -Pattern DRIZZLE_TOKEN`
  → **CLEAN, no service injects the DB**.

### W3 — one shared HTTP layer (`c9d8cd3`, `69f53e9`)

New `src/http/` with `response.ts` (`buildMeta`/`ok`/`created`/`noContent`/
`okPaginated`/`errorEnvelope`), `errors.ts` (`AppError`, `DomainHttpError`,
`NotGlobalAdminError`, `toErrorResponse`) and `plugin.ts`
(`domainPlugin({name, prefix, tags, guards})`). All six controllers migrated.

- Six hand-rolled envelope copies had drifted apart: two controllers
  hand-built the 201 body because only one had a `created()` helper, and
  `okPaginated` had two incompatible signatures.
- Success envelopes deliberately **omit** `errors` (matching what most
  controllers shipped) while `errorEnvelope` always carries it; `noContent()`
  stays **200**, not 204, so existing client parsing is unaffected.
- `UserManagementError` now extends `AppError`; `NotGlobalAdminError` was
  declared privately and identically in three controllers and is now one class.
- **Bug fixed**: `createPayment` threw a bare 404 meaning "referenced
  quotation not found", and the controller re-labelled every `SalesStateError`
  404 as `sales.quotationNotFound` — telling the client the wrong resource was
  missing. New `ReferencedQuotationNotFoundError` + a dedicated onError arm.
- `QuotationRepository.list` now returns `TPaginationResult<T>` (was
  `{data,total}`, which forced the controller to hand-compute `totalPages`).
- `test/unit/http-response.test.ts` (7 tests) pins the wire shapes.

### W4 — `/admin` URL restructure (`69f53e9`)

| Surface | Before | After |
|---|---|---|
| Admin accounts | `/users` | `/admin/users` |
| Roles / catalog | `/roles`, `/roles/permissions` | `/admin/roles`, `/admin/roles/permissions` |
| Audit trail | `/audit` | `/admin/audit` |
| Invitation admin | `/invitations` | `/admin/invitations` |
| Self profile | `/users/me`, `/users/me/avatar` | unchanged |
| Public claim | `/invitations/claim/:token` | unchanged |
| Username check | `/users/username-available` | `/username-availability` |

- `OrganizationController` split into
  `organization/controllers/{organization,organization-bootstrap}.controller.ts`
  (`routes/` dir removed, matching every other module).
- `InvitationClaimController` extracted so the public, sessionless claim flow
  no longer shares a plugin with the admin-gated invitation routes;
  `UsernameCheckController` moved off `/users/username-available`, which
  collided with `UserController`'s `/:userId` parameter route.
- `src/index.ts`: the mount-order comment is gone — with the `/admin` prefix
  the old `GET /users` collision cannot recur, so ordering no longer matters.
- **SECURITY FIX (found while migrating)**: `GET /users/:userId` was declared
  `erp: {}` — no permission at all. `auth.users` is Better Auth-owned and has
  no organization column, so **any authenticated member could read any user's
  profile across tenants**. Now `{ erp: { policy: requireGlobalAdmin } }`,
  matching every other route on that controller. No web-admin consumer of the
  id lookup existed to break.
- web-admin: `lib/admin-api.ts` paths, both sidebars (`nav-admin.tsx` and the
  unused `sidebar.tsx`), routes moved `_authed/{users,roles,audit}` →
  `_authed/admin/*`, `routeTree.gen.ts` regenerated by the TanStack router
  Vite plugin during `bun run build` (no dev server needed).
- `scripts/smoke-admin-api.ts`: 23 endpoint references updated + 2 new checks
  for the `/users/:userId` guard.

### W5 — typed DI tokens (`94a43fc`)

`sales` and `organization` were the last two modules on bare `Symbol(...)`.
Both now declare `InjectionToken<T>`, so `container.register(TOKEN, {useClass})`
type-checks the implementation against its contract and `resolve<T>(TOKEN)`
infers `T` instead of `unknown`.

Typing the tokens immediately caught **two real defects** in
`test/authorization/test-app.ts`, both invisible while the tokens were `any`:

1. The sales fakes were loose object literals registered via `useValue` — they
   compiled only because nothing checked them against the repository contracts.
2. The quotation fake's `list()` still returned the **pre-refactor**
   `{ total, data }` shape, while `QuotationRepository.list` had moved to
   `TPaginationResult<T>` in W3. The fake was silently stale.

Both fakes are now annotated with the real contract types.

### W6 — audit module extracted (`94a43fc`)

New `src/app/audit/`: `container.ts`, `index.ts`,
`contracts/{audit.repository.interface,audit.contract}.ts`, `constants/di.ts`,
`repositories/audit.repository.ts`,
`services/{audit,audit-query}.service.ts`, `controllers/audit.controller.ts`.

- The ledger is cross-cutting — every module writes to it — while
  `user-management` only happened to be its first writer. Moving it gives
  future modules a module to inject instead of reaching into user-management.
- `GET /admin/audit` moved out of `UserAdminController` into a dedicated
  `AuditController.plugin()`.
- Direction of dependency preserved: user-management services still inject
  `AUDIT_SERVICE_TOKEN` (modules own their events, audit owns the ledger).
- Audit types (`auditQuerySchema`, `TAuditQuery`, `TAdminAudit`,
  `TAuditEntry`, `IAuditRepository`) removed from
  `user-management/contracts/` and `constants/di.ts`.

### W7 — user-management services merged into `user`

The seven service files moved `user-management/services/` →
`user/services/`: `invitation.service.ts`, `role-management.service.ts`,
`user-admin.service.ts`, `invitation.errors.ts`,
`better-auth-user-management.gateway.ts`, `logger-mailer.ts`, `token.ts`.
**Repositories, contracts and tokens stay in `user-management`** — the
repository merge was deliberately deferred, so `user-management/container.ts`
is now the documented seam where the two halves still meet.

- **Dead code removed**: `paginationQuerySchema`, `TPaginationQuery`,
  `userQuerySchema` and `TUserQuery` in
  `user/contracts/user.contract.ts` had **zero consumers** and collided by name
  with the live pair in `user-management/contracts/admin.contract.ts` (which is
  what `GET /admin/users` actually parses). The dead pair is gone, which also
  removed the name collision the merge would otherwise have created.
- **CACHE-INVALIDATION BUG FIXED.** `UserRepository` caches `auth.users` rows
  in Redis for 300s (`user:id:<id>`, `user:all`), but
  `UserManagementRepository` — the admin lifecycle path — wrote `status` and
  `deletedAt` to the same table **without evicting anything**. Consequences
  before the fix: a soft-deleted user kept serving from the cache on the
  self-service read path for up to 5 minutes, and a deactivated user read back
  as `active`.
  - New `src/app/user/constants/cache.ts` defines the shared key layout
    (`USER_CACHE_PREFIX`, `USER_CACHE_TTL_SECONDS`, `userListCacheKey()`,
    `userCacheKey()`); **both** repositories import it, so the keys cannot drift.
  - `UserManagementRepository` now injects `REDIS_TOKEN` and calls
    `invalidate(id)` after `createPendingUser`, `setStatus`, `setClaimed`,
    `delete`, `restore` and `reactivate`.
  - Proven live by `scripts/smoke-cache-invalidation.ts` (9 checks):
    deactivate → `GET /users/:id` immediately reports `deactivated`; restore →
    immediately `active`; soft delete → immediately **404**. The script restores
    its fixture, so it is safe to re-run.

### Verification (all run this session)

- `apps/backend`: `bunx tsc --noEmit` → exit 0; `bun test` → **131 pass,
  0 fail**; `bunx oxlint` → 0 errors, 4 pre-existing warnings (no new ones).
- `apps/web-admin`: `bun run build` (tsc -b + vite) → clean, admin routes
  code-split; `bun test` → **21 pass, 0 fail**.
- repo root: `bun run test` → 4/4 turbo tasks successful.
- **Live smoke** (`bun run scripts/smoke-admin-api.ts` against backend :3001):
  **18 passed, 0 failed**, stable across repeated runs.
- **Live cache probe** (`bun run scripts/smoke-cache-invalidation.ts`):
  **9 passed, 0 failed**, idempotent across repeat runs.
- Manual probes: `/username-availability` → 200; anon `/admin/users`,
  `/users/me` → 401; anon `/invitations/claim/<bad>` → 422.

### W9 — controller mounting moved to `src/app/app.ts`

`src/index.ts` no longer mounts controllers. It keeps the `register*`
container calls, the i18n/CORS/logger plugins, `.listen()` and the avatar
worker; `src/app/app.ts` owns every `.use(<Module>Controller.plugin())`
inside an exported **`createApp()` factory**. A factory, not a module-level
`const app`, because controllers resolve inside `plugin()`: an eager
instance would build at import time and make correctness depend on hoisted
import order between `app.ts` and `index.ts`.

`app.ts` also hoists the two `await OpenAPI.*` calls to a module-level
`betterAuthOpenApiDocument` so `/docs` stays a static snapshot while
`createApp()` remains synchronous.

**Corrected a wrong skill rule.** The `tsyringe` skill claimed "the current
codebase imports no `reflect-metadata` and injection works. Do not add the
polyfill speculatively". Removing the import to follow it crashed boot:

```
error: tsyringe requires a reflect polyfill. Please add 'import "reflect-metadata"'
to the top of your entry point.
  at node_modules/tsyringe/dist/cjs/index.js:5:15
```

tsyringe's CJS entry asserts `Reflect.getMetadata` at load; Bun's native
`design:paramtypes` emission does not define it, so the guard fires on Bun
too. The import is restored with a comment, and both skills now document the
real mechanism instead of the "Bun needs no polyfill" myth.

Skill bumps: `elysia-tsyringe` 1.0.0 → **1.1.0** (mount split + rule 2.5
correction), `elysia-module` 1.1.0 → **1.2.0** (checklist §3.6 split),
`tsyringe` 1.0.0 → **1.1.0** (rule 2.1 correction). Recorded in `skills.md`.

Verification after the change: `bunx tsc --noEmit` → exit 0; `bun test` →
**131 pass, 0 fail**; `bunx oxlint` → 0 errors, same 4 pre-existing warnings;
`smoke-admin-api.ts` → **18/18**; `smoke-cache-invalidation.ts` → **9/9**;
`/docs` → 200, anon `/users/me` and `/admin/users` → 401.

### W10 — avatar worker lifecycle owned by the user module

`src/index.ts` imported `./app/user/queues/avatar.worker` — the user module's
*internals* — and owned the worker's lifecycle (`.on('error')`, `.close()`,
SIGTERM). `app/user/` could not be lifted out without editing the composition
root.

Fixed without moving any file (the worker already lived in
`app/user/queues/`):

- `app/user/queues/avatar.worker.ts` — `startAvatarWorker()` now returns an
  `AvatarWorkerHandle` (`onError`, `close`) instead of a raw BullMQ `Worker`.
  The BullMQ event name, shutdown order and `Worker` type stay inside the
  module; `index.ts` no longer depends on BullMQ at all.
- `app/user/index.ts` (new) — public entry re-exporting `registerUser`,
  `startAvatarWorker`, `AvatarWorkerHandle` and `avatarUserCreateHook`.
  `index.ts` now imports `./app/user`, mirroring `./app/audit`.
- `src/index.ts` — imports `{ registerUser, startAvatarWorker } from './app/user'`;
  also removed a duplicated JSDoc block above `const bootstrap` left by W9.

**Rejected:** a `src/app/queue-worker.ts` with a generic `startBullQueue()`
mounted in `app/app.ts`. `app.ts` builds the HTTP app and returns an `Elysia`;
a worker returns a process handle with deliberately **non-fatal** failure
semantics. Merging them would repeat the mistake W9 undid, one layer up.

`closeQueueConnection()` deliberately stays in `index.ts`: the queue
connection is a shared provider, not the avatar worker's to close.

**`docs/database/` reviewed, unchanged.** No table, column, index, constraint,
cross-module reference or status vocabulary changed. The only column written is
`auth.users.avatar_object_key` (already canonical at `docs.dbml:512`).
`bun docs/database/validate-dbml.ts` → `parsed: 253 tables`, `cross-module
refs: 0`, `timestamp gaps: 0`, `OK`, exit 0.

`grill-me` gate: its `grilling` dependency is not installed in this repo, so the
manual pass was run. Ownership → module owns worker lifecycle (above); tenant
scoping / soft delete / money / datetime / status vocabulary / cross-module
contracts → all unaffected by a lifecycle refactor.

Skill: `elysia-module` 1.2.0 → **1.3.0** (§3.6 gained a worker-handle step and
the "do not mount workers on `app/app.ts`" rule); `elysia-layered-architecture`
1.1.0 → **1.2.0** (rule 1.2 reference now states the lifecycle contract).

Verification: `bunx tsc --noEmit` → exit 0; `bun test` → **131 pass, 0 fail**;
`bunx oxlint` → 0 errors, same 4 pre-existing warnings; `smoke-admin-api.ts` →
**18/18**; `smoke-cache-invalidation.ts` → **9/9**; `/docs` → 200, anon
`/users/me` → 401.

### W11 — background workers go through one registry

Anticipated second queue (`elysia-module` §3.6 now requires this seam).
`src/index.ts` had one `const` per worker plus a `SIGTERM` branch per worker;
adding a queue meant editing the composition root three times.

New `src/providers/queue/worker-registry.ts` — a **collector, not a container**:
`startWorkers([...], onError)` attaches the shared failure sink, `stopWorkers()`
closes them all. Modules still own their workers; the registry only delegates.

- `QueueWorker` = `{ onError, close }` is the shared contract;
  `AvatarWorkerHandle` is now an alias of it, so the registry never imports the
  user module.
- `stopWorkers()` uses `Promise.allSettled` — one worker hanging on `close()`
  must not block the others or hold up exit. Failed closes are returned and
  logged.
- `startWorkers()` throws on a second call instead of leaking the first set.
- Construction stays at the call site (after `registerProvider` +
  `register<Module>`). A registry that resolved its own workers would move
  correctness back into import order — the failure mode `createApp()` avoids.
- `closeQueueConnection()` stays in `index.ts` and still runs **after**
  `stopWorkers()`: the shared connection must outlive the workers draining.
- Rejected the names `app/queue-worker.ts` and `startBullQueue()`: `app/` is
  feature modules, and "start queue" would be wrong for a producer-only queue.

Adding a queue is now one array entry in `index.ts`.

Tests: `test/unit/worker-registry.test.ts` (6) cover sink forwarding,
double-start rejection, restart-after-stop, `allSettled` isolation when one
close throws, and the empty case.

New live probe `scripts/smoke-avatar-worker.ts`: dispatches a job and asserts
the worker **consumed** it. Important limitation found while writing it —
avatar rendering calls DiceBear, exposed only as an internal Compose service
(`http://dicebear:3000`, no published port), so a bare local `bun run dev`
cannot complete a render: the job is consumed and then fails `ECONNREFUSED` to
DiceBear. The probe therefore asserts consumption, not the rendered image, and
the runbook documents why.

**`docs/database/` reviewed, unchanged** — no schema change.
`validate-dbml.ts` → `253 tables`, `0 cross-module refs`, `0 timestamp gaps`, `OK`.

`grill-me` gate: `grilling` is not installed; manual pass run. No tenant
scoping, soft delete, money/datetime, status vocabulary or cross-module
contract is touched by a worker-lifecycle refactor.

Skills: `elysia-module` 1.3.0 → **1.4.0** (§3.6 now names the registry and the
shared `QueueWorker` shape); `elysia-layered-architecture` 1.2.0 → **1.3.0**
(rule 1.2 reference documents the registry contract and `allSettled`).

Verification: `bunx tsc --noEmit` → exit 0; `bun test` → **137 pass, 0 fail**
(131 + 6 new); `bunx oxlint` → 0 errors, same 4 pre-existing warnings;
`smoke-admin-api.ts` → **18/18**; `smoke-cache-invalidation.ts` → **9/9**;
`smoke-avatar-worker.ts` → **consumed**, re-runnable; `/docs` → 200, anon
`/users/me` → 401.

## Completed (this session — multi-organization, 2026-11-02)

ADR: `.agents/docs/decisions/ADR-0007-multi-organization.md` (supersedes the
single-organization reading of ADR-0001; the "one company" decision stands).
Root cause of the reported `422 "An organization already exists; only one is
allowed"`: `OrganizationService.createOrganization` enforced a literal
single-org invariant that ADR-0001 never required.

- **Removed** `OrganizationAlreadyExistsError` + `existsAny()` (repository,
  interface, service) and the controller's 422 mapping/swagger text.
- **`organization.auth.ts`** — `allowUserToCreateOrganization: (user) =>
  user.role === GLOBAL_ADMIN_ROLE` (defense-in-depth behind the HTTP gate;
  skipped by Better Auth for server-side `userId` creates, so seeders work).
- **`createOrganization`** now forwards caller headers, so Better Auth
  enforces the admin gate AND activates the new org for that session; the
  creator becomes `owner` (`crud-org.mjs` behavior, verified live).
- **Role provisioning** — `seedRolesForOrganization(organizationId)` extracted
  from `organization-roles.seeder.ts` and called on every create (best-effort,
  logs on failure) so API-created orgs get the real `auth.roles` catalog
  instead of silently falling back to the static catalog.
- **Last-org guard** — `LastOrganizationError` (409) via
  `repository.countActive()`. Because delete is a SOFT delete, Better Auth's
  own session cleanup never runs, so `deleteOrganization(headers, id)` also
  calls `gateway.setActive(headers, null)` to release the caller.
- **Controller split (option a)** — `OrganizationBootstrapController.plugin()`
  owns `POST /organizations` on `sessionGuard()` + `requireGlobalAdmin`, so a
  membershipless app admin can bootstrap the first org; every other route
  stays on `erpGuard`. `sessionGuard`'s `erpSession` macro gained an optional
  `policy` hook (and kept the existing `{ session: true }` flag form used by
  `user.controller.ts`).
- **Seeders** — `organization.seeder.ts` skips in `prod`/`production` (new
  `config/providers/env.ts` `isProductionEnv()`, first consumer of the
  never-read `instance.env`), keyed by slug via `ensureOrganization()`;
  `addSeedMembersTo(organizationId)` joins seeded accounts to any org; a
  missing org is now a no-op instead of throwing.
- **Frontend** — switcher lists ALL live orgs for app admins (first-party
  endpoint) and memberships otherwise; `useActiveOrganizationId()` dropped its
  `organizations[0]` fallback (cross-org leak) and returns `null`; create
  gated on `user.role === 'admin'`; stale single-org copy removed; create and
  switch invalidate `erp-organizations` + `erp-has-permission`.

Verification (2026-11-02):

- `bun run typecheck` clean (backend); `bunx tsc -b` clean (web-admin).
- `bun test` — backend 113 pass / 0 fail; web-admin 20 pass / 0 fail.
- `bun run database/seeders/index.ts` — idempotent, org-aware skip logs.
- Live smoke (server on :3001, seeded admin):
  - create 2nd org → **201** (was 422); new org auto-activated; 19 role rows
    provisioned in every org including API-created ones.
  - org owner (`admin_seed`, global role `user`) create → **403
    "Application administrator role required"**; anonymous → **401**.
  - **membershipless** global admin (0 `members` rows) create → **201**, own
    membership role `owner`, 19 roles provisioned — the bootstrap case works.
  - delete non-last org → 200 and the caller's `activeOrganizationId`
    switched off the deleted org; delete the final live org → **409**.
  - Test users/orgs removed afterwards; DB back to the single `entragate` org.

## Completed (this session - user-management phase 4: admin UI + admin API, 2026-11-01)

Plan: `docs/plan/plans/user-management.md`. Phase 4 of 7 complete (backend +
admin UI; `/members` page enhancements + member role-change UI remain).

Backend — new surface, all gated by the phase-3 dynamic guard:

- `contracts/admin.contract.ts` — zod schemas for users/roles/audit.
  `createRoleSchema`/`updateRoleSchema` `rank` accepts **1..100** (was
  `max(99)`). Rationale: schema validation must not cap below a rank the
  escalation guard is responsible for rejecting — the guard, not the schema,
  is the authorization boundary. With `max(99)` an owner's `rank: 100` POST was
  rejected as a 400 *validation* error and the rank guard never ran.
- `repositories/role.repository.ts` — Drizzle role CRUD: list (with live
  member counts), findById/findByName/findByNameIncludingDeleted, create,
  update, softDelete, undelete, countMembers.
- `repositories/audit.repository.ts`, `services/audit-query.service.ts` —
  filterable audit reads (action, targetType, actor, org, from/to range;
  `created_at` is unix-seconds so ranges convert via
  `new Date(floor(ms/1000)*1000)`).
- `services/role-management.service.ts` — rank/escalation guard (target rank
  strictly below caller's), grant validation against the shared catalog
  vocabulary, system-role and in-use delete guards, soft-deleted name revive.
- `services/user-admin.service.ts` — deactivate (revokes sessions, keeps
  memberships), restore, soft delete, outrank checks.
- `controllers/user-admin.controller.ts` — `/admin/users`, `/admin/roles`,
  `/admin/roles/permissions`, `/admin/audit` (the `/admin` prefix arrived in
  the W4 tidy-up; see the top entry); `callerRank()` = highest live role rank
  in the validated org, with app-admin-without-dynamic-role ceiling 80 (never
  owner).
- Permission mapping: user list / role list / `/admin/roles/permissions` →
  `member:read`; role create → `member:create`; user+role update,
  deactivate/restore → `member:update`; delete → `member:delete`; audit list →
  `audit_log:read`.

Frontend (`apps/web-admin`) — UX-only gating, backend enforces everything:

- `lib/admin-api.ts` — users/roles/audit/invitations fetchers, `queryOptions`,
  `parseBulkInviteRows` (resolves pasted role *names* to ids; unknowns fall
  through to the backend's `member` fallback), `BULK_INVITE_LIMIT = 100`,
  `ADMIN_PERMISSIONS`.
- `lib/use-active-organization.ts` — resolves the active org from the session
  (the "first org" fallback was removed on 2026-11-02; it returns `null`
  instead, see the ADR-0007 entry at the top).
- Routes `/_authed/admin/users`, `/_authed/admin/roles`, `/_authed/admin/audit`
  (moved under `/admin` in the W4 tidy-up — see the entry at the top);
  components `admin/invite-dialog.tsx` (single + bulk paste),
  `admin/pending-invitations-panel.tsx` (expiry display, resend/cancel/delete).

### Bugs found and fixed this phase

1. **Double-encoded `owner` grants in the live DB.** `auth.roles.permissions`
   for the `owner` row was a JSON **string** (a serialized object stored
   through an extra `JSON.stringify`), i.e. `jsonb_typeof = 'string'` with 3786
   numeric-index keys. `grantsAllow()` iterates `Object.entries(grant)`, which
   on a string yields indices — so owner was denied **every** permission and
   all phase-4 endpoints 403'd. Repaired by `scripts/refresh-role-grants.ts`
   (`rolesUpdated: 1`). Hardened `sameGrants()` in
   `organization-roles.seeder.ts` to treat non-object/array values as drift so
   the ops script can self-heal this class of corruption.
2. **`GET /users` route shadowing + missing guard.** Two controllers register
   `GET /users`: the legacy `UserController` (prefix `/users`) and the new
   `UserAdminController`. With prefix-wrapped plugins the **FIRST** registration
   wins (verified: `new Elysia().use(prefixed).use(literal)` → prefixed handler
   answers; reversing swaps the winner). The legacy listing was also declared
   `erp: {}` — no permission — so **any authenticated member could enumerate
   the entire user base**. Fixed both: legacy `/` now uses
   `{ erp: { policy: requireGlobalAdmin } }` (matching every other route on
   that controller), and `UserAdminController.plugin()` is mounted **before**
   `UserController.plugin()` in `src/index.ts` so the permission-gated
   `member:read` listing wins.
   → **Superseded structurally** by the W4 `/admin` prefix (see the top entry):
   the admin listing is now `GET /admin/users`, so the two modules no longer
   register the same path and mount order is irrelevant. The legacy listing was
   subsequently removed outright, and the same class of hole on
   `GET /users/:userId` (bare `erp: {}`) was found and gated in W4.
3. **Revive path crashed with 500** (`undefined is not an object (evaluating
   'role.id')`). `RoleRepository.update()` filtered `.where(isNull(deletedAt))`,
   but `create()` revives a soft-deleted role by updating it *before*
   `undelete` — the predicate matched zero rows, `.returning()` yielded
   `undefined`, and the caller dereferenced it. Removed the `deletedAt`
   predicate from `update`; who may edit is decided by the service (rank guard,
   system-role rules), not by the query.
4. **React purity warnings** in `pending-invitations-panel.tsx` from calling
   `Date.now()` during render; moved "now" into a cached `useQuery`.
5. **`user.organizations` undefined in the admin users table** (runtime crash:
   `can't access property "length", user.organizations is undefined`).
   `GET /users` was still being answered by the *legacy* `UserController`
   handler, which returns bare user columns with no membership join. The two
   handlers do not actually collide: the legacy plugin is `prefix: '/users'`
   + `.get('/')`, so it registers the distinct path `/users/` while the admin
   controller registers `/users` — and Elysia serves `/users/` for a bare
   `/users` request. Reordering the mounts could never fix it (my earlier
   "first registration wins" note was measured on prefix-less toy plugins and
   is **wrong** for this case; the two routes simply never competed).
   Fixed by making the admin controller the single owner of the listing:
   the legacy `GET /users` handler (and its now-dead `okPaginated` helper and
   `userQuerySchema` import) was deleted. The users table also uses
   `user.organizations ?? []` defensively, and a unit test pins that the
   admin projection always emits the field.

   → **Superseded structurally** by the W4 `/admin` prefix (see the top
   entry). The admin listing is now `GET /admin/users` and the legacy
   `UserController` no longer registers a collection route at all, so the
   `/users` vs `/users/` ambiguity this entry describes cannot recur. The
   accurate lesson survives: the "first registration wins" rule was measured
   on prefix-less toy plugins and did **not** apply to prefix-wrapped ones.

### Verification (exact commands)

- `apps/backend` (follow-up fix): `bunx tsc --noEmit` → clean; `bun test` →
  **113 pass / 0 fail**; `bun run scripts/smoke-admin-api.ts` → **16 passed, 0
  failed** (added a check that every `/users` row carries `organizations`;
  that surface is now `/admin/users` and the same check reads
  `every /admin/users row carries an organizations array` — see the W4 entry).
- `apps/backend`: `bun run scripts/smoke-admin-api.ts` → **15 passed, 0
  failed**, stable across consecutive runs (the second run exercises the revive
  path the same script would otherwise mask).- `apps/web-admin`: `bunx tsc --noEmit -p tsconfig.app.json` → clean (plain
  `tsc --noEmit` checks NOTHING here — root `tsconfig.json` has `"files": []`);
  `bun run build` → clean, all three routes code-split.
- repo root: `bun run lint` → 0 errors (5 web-admin warnings + ui/backend
  warnings are pre-existing); `bun run docs/database/validate-dbml.ts` → OK
  (253 tables, 0 gaps).

Scripts kept: `scripts/smoke-admin-api.ts`, `scripts/cleanup-smoke-roles.ts`,
`scripts/refresh-role-grants.ts` (+ pre-existing ops scripts). All `diag-*.ts`
throwaways deleted.

## Completed (this session - user-management phase 3: dynamic hasPermission guard + single grant source, 2026-11-01)

Plan: `docs/plan/plans/user-management.md`. Phase 3 of 7 complete.

- **Single grant source enforced**: `packages/common/src/authorization/
  erp-permissions.ts` now owns the merged catalog — built-in organization
  statements (`organization/member/invitation/ac`, via `builtInOrgStatements`)
  are folded INTO `erpRoleGrants` (owner = all ERP statements + full built-in
  org administration; admin = `organization:['read','update']`,
  `member:['create','read','update','delete']`, `invitation:['create','cancel']`,
  `ac:['read']` + prior catalog grants). Server `organization-ac.ts` and client
  `erp-ac.ts` had their local `ownerGrants`/`adminOrgGrants` layering DELETED —
  both build roles purely from `erpRoleGrants`; both spread the shared
  `builtInOrgStatements` into their statement vocabulary, so server/client/db
  seeds cannot drift. `packages/common` rebuilt.
- **Guard DB seam**: `src/authorization/permission-resolver.ts` —
  `IPermissionResolver` interface + `PERMISSION_RESOLVER_TOKEN` +
  `grantsAllow()` (union-of-grants checker). No DB imports in this file.
  `src/authorization/dynamic-permissions.ts` — `DynamicPermissionResolver`
  (`@injectable`, `@inject(DRIZZLE_TOKEN)`) unions `auth.roles.permissions`
  jsonb of the member's live roles for the validated org; falls back to static
  `authorizeErpPermissions` ONLY when no live row matches the member's role
  names. `src/authorization/container.ts` — `registerAuthorization()`
  registered in `src/index.ts`. `elysia-auth.ts` `erpGuard()` resolves the
  resolver from the tsyringe container once at plugin build.
  `src/di/tokens.ts` split out of `provider.ts` (token-only, no DB client
  imports) so importing the token never opens a connection.
- **Tests fixed**: `test/authorization/test-app.ts` registers an in-memory
  `IPermissionResolver` mock (`installPermissionResolverMock`, seeded with
  catalog grants; `setRoleGrants` overrides per test; `resetFixture` resets).
  No test opens a DB connection. New `test/unit/permission-resolver.test.ts`
  (9 tests, `mockDb` helper): live-row grant/deny, multi-role union,
  live-rows-authoritative (no fallback when a row exists), static fallback,
  `grantsAllow` semantics. `authorization.test.ts` gained 3 integration tests
  proving live rows decide access in the real Elysia pipeline.
  `bun test` = **90 pass / 0 fail** (was 61/17).
- **Seeder refresh path**: `organization-roles.seeder.ts` stays insert-only
  for re-runs (never overwrites admin-edited rows) but gained
  `refreshSystemRoleGrants()` — re-syncs existing `isSystem=true` rows whose
  permissions differ from the catalog (order-insensitive comparison), so a
  catalog change reaches already-seeded orgs on demand. Ops script
  `scripts/refresh-role-grants.ts` runs it. Custom roles are never touched.
- **Live verification** (dev server :3001):
  - `scripts/refresh-role-grants.ts` → 2 rows updated (owner/admin now carry
    the built-in org grants in `auth.roles.permissions`).
  - owner `GET /organizations/:id/members` → **200** (dynamic; was 403 before
    the catalog merge — root cause fixed).
  - member `GET /sales/quotations` → **403** (dynamic deny).
  - `scripts/smoke-dynamic-authoritative.ts`: owner row narrowed to
    `{dashboard:['read']}` → quotation read **403** even though the static
    catalog grants it (dynamic set is authoritative); row restored.
  - `scripts/smoke-fallback.ts`: owner row soft-deleted → quotation read
    **200** via static catalog fallback; row restored.
- `bunx tsc --noEmit` clean (backend); root `bun run typecheck` clean;
  `bun run lint` warnings pre-existing only; web-admin `bun run build` clean
  (consumes rebuilt common).
- **Not done (next)**: phase 4 admin UI (users → invitations → roles →
  members → audit), 5 username login tab, 6 deactivate/restore, 7 avatar
  claim hook check.

## Completed (this session - user-management phase 2: invitation module + claim flow, 2026-11-01)

Plan: `docs/plan/plans/user-management.md`. Phase 2 of 7 complete.

- **Module** `apps/backend/src/app/user-management/`: contracts (gateways/
  repositories/services interfaces + DI tokens), errors, token utils
  (SHA-256 hash, `timingSafeEqual` compare), `InvitationRepository`,
  `UserManagementRepository`, `BetterAuthUserManagementGateway`,
  `LoggerInvitationMailer` (SMTP later), `AuditService`, `RoleService`,
  `InvitationService`, `InvitationController` (public claim routes +
  requireGlobalAdmin admin routes) and `UsernameCheckController`, both
  static-`plugin()` house style; wired in `src/index.ts`.
- **Audit schema** `drizzle/schemas/audit.schema.ts` (`audit.audit_logs`):
  text id, actor logical ref + denormalized email, AUDIT_ACTIONS vocabulary,
  target_type/target_id, nullable organization_id, meta jsonb, insert-only
  ledger. DBML entry REPLACED the stale aspirational one (was uuid/entity_id
  shaped); `bun run docs/database/validate-dbml.ts` → OK, 253 tables.
- **Better Auth internals learned (root-caused the claim 401)**:
  `auth.api.addMember` needs NO session when `organizationId` is in the body
  (orgMiddleware only), but `getFullOrganization` runs `orgSessionMiddleware`
  and 401s without a caller session. All org access moved into
  `BetterAuthUserManagementGateway.attachMembership` — addMember inside
  `runWithEndpointContext`, org name via internal adapter
  `ctx.adapter.findOne({model:'organization'})`. Claim order:
  claimCredentials → setClaimed → attachMembership → markStatus(accepted) →
  createSession, so a failed attach leaves the invitation retryable.
- **Invite edge cases fixed**: repository gained `findAnyByEmail` +
  `restore` (clears deletedAt, re-pends). Re-inviting a claimed email →
  clean 409 `InvitationPendingExistsError` (was 500 `users_email_key`);
  soft-deleted wrong-email user is restored and re-invited.
- **Live smoke (dev server, all via PowerShell Invoke-RestMethod)**: app-path
  claim + auto-login (newhire@entragate.test, set-cookie present), org-path
  claim with member role (fallback@entragate.test) and CUSTOM role
  (tech2@entragate.test → membership row `role='technician'`), reused token
  → 422, cancel → 200, delete claimed invitation → 409, resend kills old
  token (old → 422, new → 200), duplicate pending overwrite (`overwritten:
  true`, resentCount increments), bulk invite with bogus roleId → member
  fallback. Audit rows confirmed: invitation.sent 6, user.precreated 6,
  invitation.resent 1, invitation.cancelled 1
  (`bun run scripts/audit-summary.ts` from apps/backend).
- **Verification scripts** (run from apps/backend cwd): `verify-claim.ts`,
  `audit-summary.ts`. Note: PowerShell breaks backticks in `bun -e` — always
  write script files. Watch-mode logging can land in a different child than
  the shell output file; when responses look stale, kill all bun processes
  and restart clean.
- `bunx tsc --noEmit` clean; `bun test` 78/78 pass; lint warnings only
  pre-existing empty schema stubs.
- **Not done (next)**: phase 3 dynamic-role `hasPermission` guard swap,
  phase 4 admin UI, 5 username login tab, 6 deactivate/restore, 7 avatar
  hook check. Commit pending for phases 1+2.

## Completed (this session - user-management phase 1: schema + role seeding, 2026-11-01)

Plan: `docs/plan/plans/user-management.md` (grilled/approved). Phase 1 of 7:
database shape for the invitation-only user lifecycle.

- **New schema** `apps/backend/drizzle/schemas/role.schema.ts` (auth schema,
  ERP-owned): `auth.roles` (per-org dynamic role master data: name, rank,
  permissions jsonb, isSystem, soft-delete + partial unique
  `(organization_id, name) WHERE deleted_at IS NULL`) and `auth.user_invitations`
  (unified invitation pipeline: type app|org, tokenHash SHA-256 unique,
  status pending|accepted|cancelled|expired, 3-day expiry via expiresAt,
  resentCount, deliveryFailed, claimedAt, soft delete). Named
  `user_invitations` because Better Auth owns `auth.invitations` (untouched).
- **`auth.users.status`** text column added (`active` default): pending |
  active | deactivated lifecycle. Declared in auth.schema.ts (hand-applied
  delta, same 1.4.x codegen caveat as deletedAt) AND registered as a
  `user.additionalFields.status` (`input: false`, default 'active') in
  auth.options.ts so Better Auth passes it through. drizzle-kit quirk: the
  partial-index `.where()` needs `sql` from `drizzle-orm` (not pg-core).
- **Relations**: `roleRelations` added to `drizzle/db.ts`.
- **Migration** `20261101021221_ancient_luckman` (generated, human-inspected,
  applied): 2 tables, users.status column, 6 indexes, 4 FKs.
- **Seeder** `database/seeders/seed/organization-roles.seeder.ts`:
  materializes the shared catalog (`erpRoleNames`/`erpRoleGrants`) as
  per-org `auth.roles` master data; ranks owner=100, admin=80, hr=60,
  member=10, other catalog roles=50; `isSystem=true`; idempotent (live-row
  existence check, never overwrites). Wired into `seeders/index.ts` after
  `seedOrganizationMembers`.
- **Verified**: migration applied to dev DB; seeder ran twice (19 inserted,
  then 0 = idempotent); `scripts/verify-user-management-schema.ts` shows
  owner/admin/hr ranks correct, 17 existing users `active`, 0 invitations.
  `bun run typecheck` clean (after adding `status: 'active'` to the
  user.service.test.ts fixture), root `bun run lint` 0 errors, backend
  `bun test` 78 pass / 0 fail. DBML updated (roles, user_invitations,
  users.status; now 253 tables) and `validate-dbml.ts` passes (0 cross-module).
- **Not done (next phases)**: invitation module + claim flow (phase 2),
  dynamic-role `hasPermission` guard (phase 3), admin UI (phase 4),
  login username tab (5), deactivate/restore (6), avatar claim hook check (7).
  Note: `@dbml/core` was missing from node_modules (progress line 618
  overstated) — re-added as root devDependency to run the validator.

## Completed (this session - auth UX fixes: /users/me session guard + session org auto-activation + menu warnings, 2026-10-31)

- **Bug**: `GET /users/me` sat behind the full `erpGuard`, which 403s when
  neither `x-organization-id` nor `session.activeOrganizationId` is present.
  Fresh logins have no active org → sidebar showed `…` with no name/email.
- **Fix A** — `sessionGuard()` in `src/authorization/elysia-auth.ts`: a
  session-only plugin (macro `erpSession`) resolving the Better Auth session
  and 401-ing when absent; no organization/membership resolution, so
  `ErpContext.organizationId`/`member` stay non-nullable for existing
  consumers. `/users/me` (user.controller.ts) opts in via
  `{ erpSession: { session: true } }` and `.use(sessionGuard())`.
- **Fix B** — `sessionAutoActivateOrganizationHook`
  (`src/providers/better-auth/options/session.auth.ts`, previously an empty
  placeholder), wired as `databaseHooks.session.create.before` in
  `auth.options.ts`: stamps the user's first `members` row as
  `activeOrganizationId` on session creation. Existing sessions unaffected
  (need one re-login or manual switch). See
  `modules/organization.md` → "Session auto-activation".
- **Elysia macro typing quirk (1.4.30)**: an EMPTY option object
  (`{ macroKey: {} }`) drops the macro's resolved context from handler
  types (TS2339 at the handler). Boolean `{ macroKey: true }` does NOT fix
  it; a NON-EMPTY object (`{ macroKey: { anything: true } }`) does. This
  mirrors the already-documented `erp: {}` vs `erp: { permission: [] }`.
- **Frontend** — Base UI `MenuGroupContext` console warning on dropdown
  open: `DropdownMenuLabel` renders `Menu.GroupLabel`, which requires a
  group context; wrapped labels in `DropdownMenuGroup` in
  `organization-switcher.tsx` and `nav-user.tsx` (unstyled
  `div[role=group]`, no visual change).
- **Verified live** (backend :3001): fresh login → `GET /users/me` (no
  header) → 200 `admin / admin@example.com`; `GET /organizations` (no
  header) → 200, Entragate (auto-activated). `bun run typecheck` clean,
  `bun test` 78 pass / 0 fail, web-admin `bun run build` clean.

## Completed (this session - organization module + member CRUD + seeders, 2026-10-31)

Backlog: **ERP-0026** (implemented; live smoke verified).

- **Schema** `auth.organizations.deleted_at` timestamp added via hand-written
  delta + migration `20261031032506_chief_phil_sheldon`
  (`ALTER TABLE "auth"."organizations" ADD COLUMN "deleted_at" timestamp;`),
  applied with `bun run drizzle:migrate` (verified). Plugin side: Better Auth
  org plugin `schema.organization.additionalFields.deletedAt` (date, not
  required, `input: false`) in `plugins/organization.auth.ts`. `auth.schema.ts`
  remains hand-maintained (never `auth:generate`).
- **Permissions** `builtInOrgStatements` (@ims-erp/common) extended with
  `organization.create|read`, `member.read`; `organization-ac.ts` merges them
  into `organizationStatements` + owner/admin roles (admin keeps catalog
  member create/update/delete, layered with read). `PermissionRequirement`
  widened to accept `organization:*`/`member:*`/`invitation:*`/`ac:*`.
- **Backend module** `src/app/organization/` (contracts/repo/gateway/service/
  controller/container/di; registered in `src/index.ts`): routes per the table
  in `modules/organization.md`; soft delete +
  restore, last-owner 409, member list joined with users. Org DELETE never
  uses `auth.api.deleteOrganization`. (The single-org invariant present at
  the time was removed on 2026-11-02 — see the ADR-0007 entry at the top.)
- **Seeders** `organization.seeder.ts` (Entragate + initial admin as owner via
  one `createOrganization({ userId })`) and `organization-members.seeder.ts`
  (16 internal-role accounts, `<role>.seed@entragate.local`, per-role dev
  password `<role>123456`).
  Registered after `seedAuth()` in `database/seeders/index.ts`.
- **Web-admin**: `team-switcher.tsx` → `organization-switcher.tsx` (`git mv`,
  real org data, active-org switch, Manage/New entries); organization API
  client (`src/lib/organization-api.ts`); dedicated route pages
  `routes/_authed/organizations/` (index / new / $organizationId / .edit /
  members.new / members.$memberId.edit); minimal toast bus
  (`components/toast.tsx`, `<Toaster />` in root) — sonner not installed.
  Create button gated `organization.create` (now the application-admin role
  since 2026-11-02); edit/delete/member actions
  gated `organization.update|delete`, `member.create` (UX only).
- **Docs** `modules/organization.md` rewritten; `security-and-access.md`
  stale `erp.audit_logs` fixed (schema never existed; table is future
  `audit_logs` per docs/database/). Verified no stale `erp` schema in the
  live DB (`auth, drizzle, location, sales` only).
- **Verified 2026-10-31** (commands + results):
  - `bun run typecheck` (backend + web-admin via `tsc -b`) clean.
  - `bun test` (backend) 78 pass / 0 fail (one permission-matrix assertion
    updated to catch an admin-grants regression found during the work).
  - `bun run build` (web-admin) clean.
  - Migration applied; `bun run drizzle:seed` run twice — second run all
    skip (`created: 0`), idempotent.
  - Live smoke (dev server + seeded admin cookie + `x-organization-id`):
    `GET /organizations` → 1 org "Entragate"; duplicate
    `POST /organizations` → 422; `GET /members` → 17 members;
    `PATCH .../members/:id` role change + revert → 200; `DELETE`
    non-owner member → 200; re-add → 201; demote/remove last owner → 409.
  - NOT yet verified in a browser: org pages end-to-end (login → switcher →
    list → edit → members flows). Redis avatar-worker "Connection closed"
    boot warning is pre-existing (Redis not running locally), unrelated.

## Completed (this session - dashboard session user + tanstack-router-auth skill, 2026-10-30)

- **New skill** `.agents/skills/tanstack-router-auth/` (present, not in
  lock): guide-derived pattern from
  https://tanstack.com/router/latest/docs/guide/authenticated-routes —
  `_authed` guard with redirect preservation, `isRedirect` re-throw,
  login-side `redirect` param consumption, TanStack Query session-user
  flow, sidebar degradation rules.
- **Backend** `GET /users/me`: self profile via guard-resolved session id
  (server-side, `erp: {}` — self-scoped, no admin gate), declared before
  `/:userId`. Elysia typing quirk found: `erp: {}` (empty option object)
  drops the macro's resolved `erp` from handler types — `/me` uses
  `erp: { permission: [] }` with a NOTE comment. Verified: unauth curl →
  401 envelope; boot smoke clean.
- **Web-admin**:
  - `main.tsx`: `QueryClientProvider` mounted (was missing — `useQuery`
    would have crashed anywhere).
  - `_authed.tsx`: guard upgraded to guide spec — `search.redirect`
    preservation + `isRedirect(error)` re-throw (backend stays
    authoritative via `getSession()`).
  - `login/index.tsx`: `validateSearch` (`redirect` param); `LoginForm`
    takes `onSuccess`; login navigates `router.history.push(search.redirect ?? '/')`.
  - `src/lib/user-api.ts`: `selfUserQueryOptions` (`['users','me']`,
    60s stale, retry 1) unwrapping `TApiResponse<TSelfUser>`; local
    `TSelfUser` type mirrors backend `TUserProfile`.
  - `main-sidebar.tsx`: hardcoded sample user removed; `NavUser` fed by
    `useSelfUser` (`useQuery(selfUserQueryOptions)`); loading → `…`
    initials, error → degraded (no email/avatar).
  - `nav-user.tsx`: real-name initials fallback (was hardcoded `CN`),
    placeholder items (Upgrade to Pro / Billing) removed, Log out wired
    to `authClient.signOut()` → `/login`.
- Verified (2026-10-30): backend `bun run typecheck` clean, `bun test`
  78/78, boot smoke + unauth curl 401; web-admin `bun run build`
  (tsc + vite) clean, lint no new warnings in touched files. NOT yet
  manually verified in a browser: login → dashboard shows real
  name/email/avatar; deep-link round-trip through the `redirect` param.

## Completed (this session - avatar queue moved into user module, 2026-10-30)

- `src/providers/better-auth/avatar/` (queue + worker) moved to
  `src/app/user/queues/` (`avatar.queue.ts`, `avatar.worker.ts`) —
  avatar generation is user-domain logic, not provider infra; keeps the
  module folder pattern open for future queues.
- One behavior fix in the move: `processAvatarJob` previously wrote
  `auth.users.image` via raw `drizzleDB.update(users)`; it now writes
  through `IUserRepository.update()` (resolved once inside
  `startAvatarWorker()`), gaining Redis cache invalidation and
  soft-delete filtering (a job arriving after the user was deleted
  no-ops instead of resurrecting an image row for a deleted user).
- Import updates: `auth.options.ts` (create-hook), `src/index.ts`
  (worker start/SIGTERM), `scripts/dispatch-avatar.ts` (scratch script),
  `test/unit/avatar.worker.test.ts` (path only). `avatarObjectKey`/
  `presignAvatarUrl` stay in `@providers/s3/s3` (S3 = infra).
- Verified (2026-10-30): `bun run typecheck` clean; `bun run lint` no new
  warnings; `bun test` 78 pass / 0 fail; boot smoke test OK (worker up,
  queue connected, clean shutdown).

## Completed (this session - user module ERP-0007 slice, 2026-10-30)

**Status: implemented, typecheck + lint + unit suite green (78 pass), boot
smoke-tested. NOT e2e-verified against live admin session + Better Auth
runtime (see below).**

- **User module rebuilt to the location-module layered shape** (contracts/
  constants/ controllers/ services/ repositories/ container.ts):
  - `contracts/user.contract.ts` — zod boundary schemas (list query,
    create, update, ban, role, path params) + `z.infer` types.
  - `contracts/user.repository.interface.ts` — `IUserRepository extends
    IBaseRepository` + `paginate`; TSDoc pins the write-surface invariant:
    the repository touches ONLY `deletedAt`.
  - `contracts/user-auth.gateway.interface.ts` — `IUserAuthGateway` port
    over the Better Auth admin API; all methods take the caller's
    `Headers` because `/admin/*` endpoints run Better Auth's own
    admin-authorization check (`requireHeaders`); only `/admin/create-user`
    is server-facing.
  - `services/better-auth-user.gateway.ts` — wraps `auth.api.createUser`,
    `adminUpdateUser`, `setRole`, `banUser`, `unbanUser`; translates
    `APIError` 422→`UserEmailTakenError`, 404→`UserNotFoundError`.
  - `services/user.service.ts` — orchestration + avatar mapping.
    `getUser()` returns `TUserProfile` (`image` = short-lived presigned S3
    URL via `presignAvatarUrl`, or null; raw key never leaves the
    service). Replaces the old `getAvatarUrl()`/`GET /users/:userId/avatar`
    302 redirect. Invariant: soft delete = repo sets `deletedAt` AND
    gateway bans (reason `deleted`) — Better Auth ignores `deletedAt`
    during auth, so the ban is what blocks logins; restore = unban +
    clear `deletedAt`.
  - `repositories/user.repository.ts` — implements `IUserRepository`,
    soft-delete filtering (`isNull(users.deletedAt)`) on all reads,
    Redis cache-aside (5-min TTL, `user:all` / `user:id:<id>` keys,
    invalidated on `deletedAt` writes), never caches `paginate`.
  - `controllers/user.controller.ts` — envelope helpers
    (`ok`/`okPaginated`/`errorEnvelope` per `@ims-erp/common`), plugin-local
    `onError({ as: 'local' })` mapping VALIDATION/PARSE/ZodError→400,
    domain errors→404/409, non-admin→403. Authorization: `erpGuard()`
    session+membership on every route; mutations additionally gated by
    `erp: { policy: requireGlobalAdmin }` (session-resolved role ===
    `admin`; no `user` resource exists in the org AC catalog — user admin
    is Better Auth's global admin domain, with a second enforcement layer
    inside Better Auth itself).
  - `constants/di.ts` — tokens typed `InjectionToken<T>`;
    `container.ts` registers repository + gateway + service.
- **Endpoints** (prefix `/users`, self-service + Better Auth admin surface;
  the org-scoped admin lifecycle moved to `/admin/users` in the W4 tidy-up):
  `GET /me` (self profile), `GET /:userId` (full profile, presigned image —
  **global-admin gated** since W4), `POST /` (201), `PATCH /:userId`,
  `PATCH /:userId/role`, `POST /:userId/ban`, `POST /:userId/unban`,
  `DELETE /:userId` (soft delete), `POST /:userId/restore`.
- **Soft delete added to `auth.users`**: `deletedAt` declared as Better
  Auth `user.additionalFields` (`type: 'date'`, `input: false`) in
  `auth.options.ts`; column added to `drizzle/schemas/auth.schema.ts` +
  `TUserSelect`/`TUserInsert` exports.
  - **Codegen caveat**: `bunx --bun @better-auth/cli generate` (resolves
    1.4.x for this config) REGRESSES the schema file (drops
    `pgSchema('auth')`, plural tables, relations). The column was applied
    as a hand-written append-only delta replicating the generated
    declaration; revisit when the CLI matches better-auth 1.7.
  - Deviation note: generated/auth-schema `deletedAt` is a plain
    `timestamp`, not the project's `unixTimestampNullable` — Better Auth
    owns this file's shape.
- **Migration**: `database/migrations/20261030230723_parched_human_cannonball/`
  (`ALTER TABLE "auth"."users" ADD COLUMN "deleted_at" timestamp;`),
  applied to the local dev DB via `bun run drizzle:migrate`.
- Stale `auth:generate` script path fixed? NO — `package.json` still points
  at `./src/drizzle/schemas/auth.schema.ts`; output was passed explicitly.
  Left for ERP-0001 housekeeping.
- Verified commands (2026-10-30, `apps/backend`):
  - `bunx --bun @better-auth/cli@latest generate ... -y` → regressed (see
    caveat); reverted, hand-applied instead.
  - `bun run drizzle:generate` → migration emitted; inspected SQL before
    applying; `bun run drizzle:migrate` → applied to local dev Postgres.
  - `bun run typecheck` → clean (after fixes: `adminUpdateUser` endpoint
    name, role-literal casts on `setRole`/`createUser` with `ponytail`
    notes, `erp: { policy }` instead of `beforeHandle` for typed ctx).
  - `bun run lint` → no new warnings; `bun test` → 78 pass / 0 fail (was
    67; +13 in rewritten `test/unit/user.service.test.ts`: image mapping
    presigned/null/absent, delete=ban+deletedAt pairing + no-write on
    missing user, restore=unban+clear, gateway delegation, null-prop).
  - Boot smoke test: `bun src/index.ts` → `🦊 Elysia is running at
    localhost:3001`, clean shutdown.
- NOT yet verified: e2e with a real admin session (create/ban/restore
  against live Better Auth runtime; permission catalog lacks a `user`
  resource by design — global-admin policy is the first-party gate).

## Completed (this session - avatar generation pipeline, 2026-10-29)

**Status: implemented (unit-verified), NOT integration-verified against a
running server + real S3.**

- On user creation (email sign-up, OAuth, admin-created — anything through
  the Better Auth instance, incl. the auth seeder), the
  `databaseHooks.user.create.after` hook in
  `src/providers/better-auth/auth.options.ts` enqueues an `avatar` job
  (`src/providers/better-auth/avatar/avatar.queue.ts`). Enqueue errors are
  logged and swallowed — sign-up never fails because of the queue.
  Deterministic `jobId: avatar:<userId>` dedupes replays; 3 attempts,
  exponential backoff.
- Worker (`avatar.worker.ts`): deterministic DiceBear `initials` avatar,
  seed = user name (falls back to userId), 72×72; SVG→PNG via
  `@dicebear/converter` (new dep; brings sharp/resvg); PNG written to
  `.tmp/avatars/<userId>.png` (repo-local temp dir, gitignored, always
  removed in `finally`); uploaded to S3 key `user/<userId>/avatar.png`;
  `auth.users.image` stores the **object key**, never a URL.
- S3 provider `src/providers/s3/s3.ts`: Bun-native `S3Client` from existing
  `S3_*` env (no new dependency); `avatarObjectKey()` +
  `presignAvatarUrl()` (5-min presigned GET).
- BullMQ runs on the existing Bun Redis client via `createBunRedisClient`
  (`src/providers/queue/queue.connection.ts`); no ioredis. Worker started in
  `src/index.ts`; SIGTERM closes worker then queue connection (wrapper
  `quit()`, never raw `redisClient.close()`).
- Show endpoint (outside Better Auth routes):
  `GET /users/:userId/avatar` in `src/app/user/controllers/user.controller.ts`
  — guarded by `erpGuard()` (session + org membership required, any member
  role; no permission needed); 302 redirect to a freshly presigned S3 URL;
  404 when the user has no avatar key yet. Fills the previously empty user
  module (repository/service/container + DI tokens).
- Verified commands (2026-10-29, `apps/backend`):
  - `bun install` after adding `@dicebear/converter@10.7.0` → resolved,
    21 packages installed.
  - `bun run typecheck` → clean; `bun run lint` → no new warnings (only
    pre-existing stub-file warnings).
  - `bun test` → 67 pass / 0 fail (was 54; +6 new: `test/unit/
    avatar.worker.test.ts` PNG magic bytes, determinism, blank-name
    fallback, key pattern; `test/unit/user.service.test.ts` presigned URL
    contains signature, 404 path; 67 total incl. 7 pre-existing auth tests).
- NOT yet verified (needs live server + reachable S3/Redis): end-to-end
  sign-up → job processed → object in bucket → endpoint 302. The presign
  unit test runs against real local config (offline signing only; no S3
  request made).

## Completed (this session - two-layer authorization core, 2026-10-29)

- **Permission catalog (single source of truth)**:
  `packages/common/src/authorization/erp-permissions.ts` - full ERP
  resource/action vocabulary, portal statements, built-in org statements,
  18 role grants (`erpRoleGrants`), all browser-safe and typed; exported
  from `@ims-erp/common`. `packages/common` rebuilt (`bun run build`).
- **Backend access control** `apps/backend/src/providers/better-auth/ac/`:
  - `organization-ac.ts` - `createAccessControl` over `defaultStatements` +
    ERP catalog + portals; 18 `erpRoles`; `authorizeErpPermissions`
    (multi-role union, deny-by-default).
  - `admin-ac.ts` - global admin/user constants; admin() defaults preserved.
  - `auth-hooks.ts` - Better Auth `hooks.before` blocking owner-role grants
    via add-member / update-member-role / create-invitation unless actor is
    an owner; org admins restricted to non-owner roles.
  - `plugins/organization.auth.ts` now passes `ac` + `roles`; `teams: false`.
- **Username plugin** added (`plugins/username.auth.ts`); `auth.users`
  gained `username` (unique) + `display_username` in append-only migration
  `20261029044823_dear_living_lightning` (also creates `sales` schema).
- **Elysia guard** `src/authorization/elysia-auth.ts`: `erpGuard()` macro
  (`erp: { permission: [...], policy }`) resolving session from real
  request headers (401), organization context (`x-organization-id` header >
  active org; membership validated against the SAME id via
  `auth.api.getFullOrganization`, 403 when not a member - global admins
  NOT exempt), permission checks (403), optional record-level policy hook.
- **Sales vertical** (`src/app/sales/`, schema `drizzle/schemas/sales.schema.ts`):
  quotations + payments with tenant-scoped repositories (conditional
  `WHERE status = from` state transitions), FK-ownership validation
  (cross-org quotation references rejected 404), self-approval blocks
  (quotation + payment), execution-only-after-approval, explicit
  configuration-missing denial for approvals (no invented thresholds),
  whitelisted update fields (no mass assignment). Wired into
  `src/index.ts` bootstrap.
- **Auth seeder** `database/seeders/seed/auth.seeder.ts` - idempotent;
  creates initial global admin via Better Auth instance
  (`createUser` + `setUserPassword`), never resets existing users, no org
  membership. Credentials from new `AuthConfigSchema` (`auth` section in
  `config.schema.ts` + loader; `INITIAL_ADMIN_EMAIL/USERNAME/PASSWORD`,
  dev-only defaults, never logged; `.env.example` updated). Wired into
  `database/seeders/index.ts` (runs before location seeding).
- **Frontend** `apps/web-admin`: `lib/erp-ac.ts` (client ac+roles from the
  shared catalog), `organizationClient({ ac, roles })` in `auth-client.ts`,
  `permissions.ts` types from shared vocabulary, `use-permission.tsx`
  org-aware `usePermission`/`Can`/`useOrganizations`/`switchOrganization`,
  sidebar nav migrated to the new permission strings. `vite build` passes.
- **Tests** (`apps/backend/test/authorization/`, bun:test, offline):
  - `permission-matrix.test.ts` (18): all 18 roles defined; owner full;
    org-admin no payroll/payments/secrets; member baseline; sales
    create-not-approve; finance no HR; hr no approve/execute; auditor
    read-only; technician/freelancer scoping; portal-only roles; marketing
    restrictions; multi-role union; deny-by-default.
  - `authorization.test.ts` (24, real Elysia `app.handle()` with auth+DB
    mocked at seams): 401s; global-admin-no-membership; owner permissions;
    member baseline; sales create permitted + approve denied (permission);
    technician denied; cross-org read/FK rejection (404/403); org-context
    header mismatch; multi-role self-approval blocked in service;
    missing-approval-config denial; payment execute-before-approval (422);
    self-execution blocked; revoked membership denied; multi-permission
    checks.
- **Docs**: `security-and-access.md` rewritten (two layers, where things
  live, route/query/how-to guides, approvals, escalation, audit, cache,
  seeding, gaps); ADR-0006 added.
- **Verified commands (2026-10-29, from repo root unless noted)**:
  - `bun run lint` → 3 tasks successful (remaining warnings pre-existing)
  - `bun run test` → 2 tasks successful; backend 54 pass / 0 fail
  - `bun run typecheck` → 2 tasks successful
  - `bunx tsc -b` (apps/web-admin) → pass; `bun run build` (web-admin) → pass
  - `bunx drizzle-kit generate` (apps/backend) → append-only migration
    generated & inspected (sales schema + username columns)
  - `bun run build` (packages/common) → pass
- NOT yet verified (needs disposable DB / running server): `drizzle:migrate`
  against a real database, live login/cookie flow through the mounted auth
  handler, seeder execution against a real DB. These remain Phase 2 exit
  items.

## Completed (follow-up - runtime verification, 2026-10-29)

- **drizzle-kit driver fix**: migrate/push/generate/studio scripts in
  `apps/backend/package.json` now run under the Bun runtime
  (`bunx --bun drizzle-kit ...`) - the DB uses `drizzle-orm/bun-sql`, and
  drizzle-kit otherwise resolves no DB driver and exits with "please install
  either of 'pg', 'postgres', 'bun'...". Documented pattern; use the same
  prefix for any new drizzle-kit script.
- **Auth seeder corrected**: `auth.api.listUsers` requires an authenticated
  session (admin endpoint), so the seeder now checks existence via Drizzle
  (`drizzle/schemas/auth.schema.ts` users table) and creates via
  `auth.api.createUser` with inline `password` (single call; no
  `setUserPassword` follow-up needed).
- **Verified against the real dev DB (2026-10-29)**:
  - `bun run drizzle:migrate` → migrations applied successfully
    (sales schema + username columns).
  - `bun run drizzle:seed` → initial admin created
    (`admin@example.com`, global role `admin`, username `admin`) + location
    seeding; second run skipped the admin ("password NOT reset") →
    idempotency confirmed by running twice.
  - DB row verified: user has role=admin, username/displayUsername set.
  - Live Better Auth flow via `auth.api`: `signInEmail` with seeded
    credentials → 200 + `better-auth.session_token` cookie issued;
    wrong password → `UNAUTHORIZED`.
- Remaining Phase 2 exit item: boot `bun dev` and exercise cookie-based
  requests through the HTTP-mounted handler + `erpGuard` end-to-end
  (server-side `auth.api` verification above covers the credential/session
  path; HTTP cookie round-trip still pending).

## Completed (follow-up - login wiring + live HTTP verification, 2026-10-29)

- **Trusted origins** (`options/social-providers.auth.ts` +
  `auth.options.ts`): `trustedOrigins` now includes the app URL and
  `http://localhost:5173` (web-admin dev server). Without it, Better Auth's
  origin check rejects state-changing requests (`MISSING_OR_NULL_ORIGIN` /
  `INVALID_ORIGIN`) - sign-in itself worked but `set-active` did not.
- **Frontend login wired** (`apps/web-admin`):
  - `components/form/login-form.tsx` - was a static placeholder; now calls
    `authClient.signIn.email`, shows backend error messages, disables
    submit while pending, redirects to `/` on success.
  - `routes/_authed.tsx` - new authenticated layout route; `beforeLoad`
    calls `getSession()` (backend-authoritative) and redirects to `/login`
    when no session.
  - `routes/_authed.index.tsx` - moved from `index.tsx` under the guard;
    route tree regenerated (`routeTree.gen.ts`).
  - web-admin `tsc -b` + `vite build` pass.
- **Live HTTP verification (bun dev on :3000, real requests)**:
  - `POST /api/auth/sign-in/email` (correct creds) → 200 + session cookie.
  - `GET /sales/quotations` without cookie → **401** (guard rejects before
    handler); with cookie but no org membership (seeded global admin) →
    **403** ("Organization context required") - global admin ≠ ERP access
    confirmed over real HTTP.
  - `POST /api/auth/organization/set-active` (origin included) → 200;
    `get-session` shows `activeOrganizationId`.
  - `POST /sales/quotations` as org member (owner role) → **201**;
    `GET` list → **200** (tenant-scoped row visible, `erp` context logged:
    organizationId/member.role resolved server-side).
  - Foreign `x-organization-id` header with valid session → **403**
    ("Organization membership required").
  - Submit own quotation (200) then attempt own approval → **403**
    ("Self-approval is not allowed") - SoD enforced over live HTTP.
  - Wrong-password sign-in → 401 rejected.
- Dev server stopped after verification. Backend typecheck + 54 tests +
  web-admin typecheck all pass after changes.

## Completed (this session - backend unit tests + husky pre-commit, 2026-10-28)

- New local skill `bun-test` (`.agents/skills/bun-test/`, recorded in
  `skills.md`): bun:test conventions — mock() / mock.module(), Drizzle DB and
  Bun RedisClient always mocked via constructor injection, never real
  connections or connection strings. Reference: https://bun.com/docs/test.
- `apps/backend`: `"test": "bun test"`, `"lint": "oxlint"` added;
  `bunfig.toml` (test root `test/`, preload `test/preload.ts` importing
  `reflect-metadata` for tsyringe under the test runtime).
- Shared mock helpers `test/helpers/mock-db.ts`: chainable Drizzle query
  builder mock (captures calls, resolves configured rows/count, supports
  paginate-style count→rows alternation) and Redis mock (in-memory store,
  TTL capture, deletion).
- Unit tests (11, all offline, no network):
  - `test/unit/location.service.test.ts` — pass-through delegation to the 4
    repository interfaces, null propagation.
  - `test/unit/province.repository.test.ts` — cache-aside (miss→DB→set with
    300s TTL, hit skips DB), cached `null` short-circuit, soft-delete `where`
    applied, create invalidates list+id cache keys.
- `apps/backend` gained devDependency `reflect-metadata` + `oxlint`.
- `.husky/pre-commit` uncommented: `bun run lint` + `bun run test` (`build`
  stays commented — too slow for a hook). Turbo `test` task set
  `cache: false` so cached PASS cannot mask stale state.
- Verified (exact commands, from repo root):
  - `bun run lint` → 3 tasks successful
  - `bun run test` → 2 tasks successful; `apps/backend`: 11 pass / 0 fail
  - `bun test` in `apps/backend` run twice → identical pass (idempotent)
  - Remaining oxlint warnings are pre-existing (empty stub files, unused
    stub params in `src/app/user`, `src/providers/better-auth`); no
    warnings in new test files.
- User scope decision: database and Redis are **mocked**, not real, in this
  slice; repository integration tests against disposable Postgres remain a
  documented future layer (see `testing-strategy.md`).

- New local skill `nestjs-layered-architecture` (`.agents/skills/` +
  `.claude/skills/` mirror, recorded in `skills.md`): module layout, layer
  rules, DTO/contract patterns, soft-delete + cache repository patterns from
  `modules/user/`.
- Cross-feature isolation rule (modular monolith) added to that skill,
  `architecture.md` (module rules + ERP schema ownership), and root
  `AGENTS.md` hard rules: each feature module owns a Postgres schema
  (`customer.*`, `sales.*`, ...), no cross-feature FKs/joins/table imports,
  cross-module access only via exported `External<X>Service` facade; Better
  Auth `auth-schema` tables are the explicit shared-infrastructure exception
  (existing `erp.audit_logs.actor_id → auth users.id` FK allowed). Stop
  growing the shared `erp` schema; migrate existing feature tables as each
  feature is built.
- Audit evidence: only cross-boundary DB references found are
  `erp-schema.ts` → `auth-schema.ts` (`auditLogs.actorId` FK +
  `erpRelations`); module repositories each import only their own domain's
  schema. No violations beyond the documented exceptions.
- No code was changed; no database touched.

- Audited the repository (see `project-audit.md`) — evidence-based
  classification of all modules, with baseline commands executed.
- Wrote this documentation set: `README.md`, `project-audit.md`,
  `stack-compatibility.md`, `skills.md`, `architecture.md`, `domain-map.md`,
  `data-model.md`, `api-conventions.md`, `security-and-access.md`,
  `plan.md`, `backlog.md`, `testing-strategy.md`, `runbook.md`,
  `decisions/ADR-0001..0005`, `phases/phase-1..7` — plus rewrote root
  `AGENTS.md` (Turborepo managed block preserved).
- Pin decisions recorded: ADR-0001 (one company, internal multi-organization),
  ADR-0002 (money = integer IDR minor units), ADR-0003 (structured Indonesian
  address references), ADR-0004 (Relational v2), ADR-0005 (drizzle client DI).
- No code was changed; no skills installed; no database touched.

## Partially done (pre-existing, not touched this session)

- `user` domain: repository is complete and documented; controller/service are
  stubs; 2 specs failing.
- `customer` domain: schema/migration real; code scaffold-level.
- Auth: configuration complete; runtime unverified.

## Blocked

- ERP-0003 runtime sign-off needs a real dev server + DB (available locally —
  unblocked for next session, pending execution).

## Latest checks (exact commands, 2026-10-25)

| Command (cwd) | Outcome |
|---|---|
| `bun run lint` (apps/backend) | pass, 6 warnings (empty `role-permission.ts`, unused imports/params) |
| `bunx vitest run` (apps/backend) | 7 failed / 25 passed files; 2 failed / 25 passed tests — all pre-existing; causes in `project-audit.md` |
| `bun run test` (repo root) | fail (backend red) |

## Latest checks (exact commands, 2026-10-27)

| Command (cwd) | Outcome |
|---|---|
| `bun run lint` (apps/backend) | pass, warnings (empty files, unused vars — pre-existing set) |
| `bunx vitest run` (apps/backend) | **no spec files found** — all `src/**/*.spec.ts` gone from tree since 2026-10-25 baseline (only `test/app.e2e-spec.ts` remains, needs e2e config). Not caused by Dockerfile work. |
| `bunx tsc -p tsconfig.build.json` (apps/backend) | pass; grep of fresh `dist/` shows zero `@providers/@config/@modules` alias imports |
| `docker build -f apps/backend/Dockerfile .` (repo root) | **blocked** — Docker daemon not running during session; image build unverified |

### Dockerfile slice (2026-10-27)

- Wrote `apps/backend/Dockerfile` (bun 1.4-alpine multi-stage: deps →
  `nest build` → prod-only runtime, non-root `USER bun`, port 3000) +
  `apps/backend/Dockerfile.dockerignore`.
- Replaced 3 `@providers/...` alias imports with relative paths
  (`bootstrap.module.ts`, `mail-queue.service.ts`, `mail.processor.ts`) so
  compiled `dist/` resolves at runtime.
- `config.loader.ts`: missing `.env` (ENOENT) no longer throws — compose
  injects env vars; avoids hard dependency on a `.env` file in containers.
- Image build + container boot **verified** (2026-10-27):
  `docker build -f apps/backend/Dockerfile .` succeeds; running the image
  with env-only config bootstraps all Nest modules (no `.env`, no aliases in
  `dist/`, decorator DI works under Bun). Full compose boot against real
  Postgres/Redis still unverified. Dockerfile gotchas fixed during build:
  `!apps/web-admin/package.json` needed in dockerignore (lockfile lists all
  workspaces), `--ignore-scripts` needed (root `prepare: husky` fails in
  prod-only install), runtime must `COPY --from=build` (not host `dist/`).

## Session 2026-10-28 — backend-nest removal

- Deleted `apps/backend-nest/` (package `backend`) entirely; `bun install`
  regenerated `bun.lock` (workspace + `backend@workspace` entries gone).
- Removed `backend` from docker matrix in `.github/workflows/build-main.yml`
  and `deploy-main.yml`; removed the `test-backend` job from `build-main.yml`.
- Removed `backend` service from `docker-compose.yml` and
  `docker-compose.override.yml`; `web-admin` no longer depends on it.
- Deleted NestJS skills (`nestjs-best-practices`, `nestjs-better-auth`,
  `nestjs-drizzle`, `nestjs-layered-architecture`) from `.agents/skills/` +
  `.claude/skills/`; removed lock entry from `skills-lock.json`.
- Updated `drizzle-unix-timestamp` / `drizzle-soft-deletes` skills: canonical
  path now `apps/backend-elysia/drizzle/datatypes/unix-timestamp.ts`.
- Rewrote docs around `apps/backend-elysia`: `AGENTS.md`, `architecture.md`,
  `api-conventions.md`, `stack-compatibility.md`, `runbook.md`,
  `testing-strategy.md`, `modules/README.md`; marked ADR-0005 superseded;
  added historical notes to `project-audit.md` and `modules/*.md`; fixed
  `apps/web-admin/src/lib/permissions.ts` header comment.
- Commands run: `bun install` (clean, 16 packages); no tests/typecheck run
  (backend-elysia has no test script yet).
- Follow-up tasks created: backend-elysia Dockerfile + compose service, CI
  test job for elysia, authorization core port to elysia.

## 2026-10-31 - Docs sync: AGENTS.md, runbook.md, architecture.md

No code changed; docs only. Reconciled with README.md, package scripts, and
verified history in this file.

- `AGENTS.md`: Drizzle driver corrected to `drizzle-orm/bun-sql` (was
  `node-postgres`). Command table updated to verified reality: `bun install`,
  `bun run dev` (`turbo run dev`, not `start:dev`), lint/test/typecheck,
  `drizzle:generate|migrate|seed` (all `bunx --bun drizzle-kit`). New hard
  rule: never run `auth:generate` (1.4.x CLI regresses `auth.schema.ts`;
  hand-written append-only deltas instead). Reading order now includes
  `stack-compatibility.md` and `modules/`.
- `runbook.md`: stale `apps/backend-elysia` paths → `apps/backend`; command
  statuses flipped from proposed to verified with dates; `auth:generate`
  removed with explanation; Docker section updated (compose now has
  backend + web-admin services; source-build Dockerfile still open backlog).
- `architecture.md`: backend path fixed; `auth` schema bullet now documents
  the `auth:generate` regression caveat.

## 2026-11-07 - ERP-0016 tax Phase 1 backend (in-progress)

Implements `docs/plan/plans/tax.md` Phase 1: tax rate master, period working
papers, corrections, withholding, recap. Routes under `/tax/*` (not `/admin`).
Permissions use the existing `tax` resource (D9): `tax:read`, `tax:update`,
`tax:verify`. CSV/XLSX export and the web UI are not started.

- DBML: `accounting.tax_types` unique is now `(org, code, effective_from)`
  partial on live rows; `tax_records` unique per `(org, tax_type, year, month)`;
  new `accounting.tax_corrections`. `gen-logical-references` run;
  `validate-dbml.ts` printed `OK` (256 tables, 0 cross-module refs, 0 gaps).
- Migration `20261106173111_erp0016_tax_slice1` (only `accounting` schema)
  applied to dev `POSTGRES_URL` via `bunx --bun drizzle-kit migrate`: success.
- Code: `app/accounting/` (container, index, controller, service, repository,
  contracts, errors, utils/tax-math). Mounted in `src/index.ts` and `app/app.ts`.
  Locale keys `accounting.*` added to `en` and `id`.
- Rounding: half-up to whole rupiah (100 minor units). Finance gate D14 still open.
- Recap code is `TR-<yyyymm>-<random8>` (unique per record, not per tax code).
- Seed: `database/seeders/seed/tax.seeder.ts`, placeholder PPN 11%, PPh 23 2%,
  PPh 4(2) 10% (D18). `bun run drizzle:seed` run twice: inserted 3, then 0.
- `bunx tsc --noEmit -p apps/backend/tsconfig.json`: exit 0.
- `bun test test/accounting/tax-math.test.ts`: 6 pass, 0 fail.
- `bun run lint`: 0 errors (9 pre-existing web-admin warnings).
- `bun run test`: backend 542 pass, 0 fail; web-admin green.
- Not done: service/state-machine tests, controller authorization tests,
  web UI, CSV/XLSX export, `docs/architecture/modules/tax.md` (stale, says
  `tax.configuration.*`), plan doc permission names still `tax.configuration.*`.
- `docs/database/` reviewed as part of this change (updated).

## 2026-11-07 - ERP-0016 tax Phase 2 (frontend + CSV) — implemented

Builds on the Phase 1 commit `229b668`. Plan endpoints aligned to
`docs/plan/plans/tax.md`; CSV columns remain a finance gate (D12).

Backend additions:
- Route renames to plan names: `GET /tax/recap`, `POST /tax/records/preview`
  (body, not query), `POST /tax/records/:id/transition` (replaces the separate
  `/verify` and `/file` routes), plus the new `PATCH /tax/withholding/:id`
  (editable only while `recorded`; new `accounting.withholdingLocked` key in
  en + id).
- New `GET /tax/export.csv?year=&month=` under `tax:export`, served with a
  UTF-8 BOM so Excel opens it correctly. Placeholder columns: tax_code,
  taxable_base, tax_amount, correction_total, net_payable, filing_status, plus
  a TOTAL footer row. **D12 is still open** — the column list needs finance
  sign-off.
- Tests: `test/accounting/tax.service.test.ts` (11 tests: state machine,
  draft-only edits, corrections, overlap, preview, foreign-tenant behavior)
  and `test/authorization/tax-authorization.test.ts` (76 cases: 401 without a
  session on all 19 routes; finance = read/export only, write 403; sales 403
  everywhere; a full `tax:*` role passes the guard on all routes).

Web-admin:
- `lib/tax-api.ts` client (types, recap, records, preview, corrections,
  withholding; CSV via a plain URL so the session cookie flows).
- Components under `components/tax/`: recap (period picker + CSV button +
  total row), rate rows with toggle/delete, records (create + preview +
  verify/file), corrections (record picker + signed-amount table), withholding
  (create/edit-while-recorded + verify/pay/reverse). Permission-gated
  (`tax.read|update|verify|export` via `usePermission`).
- Routes replaced the `ComingSoonPage` stubs under
  `routes/_authed/finance/tax/` (index = recap, types, records, corrections,
  withholding); `routeTree.gen.ts` regenerated by the vite build.
- New `tax` locale namespace (en + id), registered in both `index.ts` files
  and `i18next.d.ts`; dead-key + parity tests pass (three "Status" headers on
  the parity allowlist).

Gates:
- `bunx tsc --noEmit -p apps/backend/tsconfig.json`: exit 0.
- `cd apps/web-admin && bun run build`: green (route tree regenerated).
- `bun run lint`: 0 errors (7 pre-existing backend warnings).
- `bun run test`: backend 629 pass, 0 fail; locales 42 pass.

Still open: finance gates D12 (CSV columns), D14 (rounding), D18 (placeholder
rates); Phase 3 XLSX via `exceljs`. Nothing is marked verified without finance
review.

## 2026-11-07 - ERP-0016 tax Phase 3 (XLSX export) — implemented

Closes the tax slice delivery (Phases 1–3). Dependency review first, per D12:

- **Dependency:** `exceljs@4.4.0` added to `apps/backend`. Advisory check:
  four unpatched 2026 advisories (decompression DoS, prototype pollution via
  cell notes, path traversal via `addImage`, CSV formula injection) — all on
  the **read/parse path this module never calls**; the export is write-only.
  Two transitive moderates ride along (minimatch via archiver, uuid). Choice
  to use upstream over the `exceljs-hardened` fork confirmed with the user;
  recorded in the plan doc (D12).
- Code: `utils/tax-xlsx.ts` (`recapToXlsx` — headers, numeric rupiah rows
  divided from minor units, bold TOTAL footer, `#,##0.00` money formats) and
  `GET /tax/export.xlsx?year=&month=` under `tax:export`, mirroring the CSV
  route. Column layout still the placeholder set; **D12 sign-off still open**.
- UI: `Export XLSX` button on the recap page next to the CSV button
  (`recapXlsxUrl` in `tax-api.ts`; `tax:recap.exportXlsx` en + id).
- Tests: `test/accounting/tax-xlsx.test.ts` (3 tests: content round-trip via
  exceljs load of our own output, empty-period TOTAL, number formats) and the
  XLSX route added to the authorization matrix (80 cases now).

Gates:
- `bunx tsc --noEmit -p apps/backend/tsconfig.json`: exit 0.
- `cd apps/web-admin && bun run build`: green.
- `bun test` targeted: authorization 80 pass; locales 42 pass; xlsx 3 pass.

Still open: finance gates D12 (CSV/XLSX columns), D14 (rounding), D18
(placeholder rates). Nothing is marked verified without finance review.

## 2026-11-07 - Fix: tax recap route placement and missing nav entry

Corrects a Phase 2 miss: the `ComingSoonPage` stub at
`routes/_authed/finance/tax/recap/` was never replaced — the recap component
had been mounted on the index route `/finance/tax` instead, while the sidebar
still linked "Tax Recap" to the stub.

- `TaxRecap` (with its `validateSearch` year/month) moved to
  `/finance/tax/recap`, matching the sidebar; `/finance/tax` index is now a
  `beforeLoad` redirect to the recap so there is exactly one canonical URL for
  the active period (no duplicate render, no divergent `?year=&month=`).
- Sidebar: added the missing "Tax Records" item (`/finance/tax/records`,
  `item.taxRecords` en + id) — the page existed but was unreachable from nav.
- Also cleared the three `react(purity)` lint warnings introduced in Phase 2
  (`new Date()` during render in `tax-recap.tsx` / `tax-record-list.tsx`;
  now computed once at module load). Web-admin warnings back at the 9
  pre-existing baseline.

Gates: web-admin build green (route tree regenerated), `bun run lint` 0
errors, locale tests 42 pass (new `item.taxRecords` key mirrored in en/id).

## 2026-11-07 - Refactor: tax row edits use UI Dialog instead of window.prompt

Replaces the prompt-based row edits from the Phase 2 UI with proper dialogs,
following the `storage-dialog.tsx` pattern (Base UI Dialog from
`packages/ui`):

- New `components/tax/tax-record-edit-dialog.tsx`: edits a draft record's
  taxable base (context line with code + period; invalidates `tax-records`
  and the derived `tax-recap` on success).
- New `components/tax/withholding-edit-dialog.tsx`: edits a recorded
  withholding row's tax amount (backend still enforces recorded-only edits;
  a late rejection surfaces as the `withholdingLocked` toast).
- Both lists drop their inline edit mutation and `window.prompt`; the edit
  button opens the dialog with the row. The dialogs mount only while a row is
  being edited (`key={row.id}`), which avoids the `set-state-in-effect`
  resync pattern and keeps oxlint at the 9-warning baseline.
- Locale keys `tax:records.editTitle` and `tax:withholding.editTitle`
  (en + id).

Gates: web-admin build green, oxlint 9 warnings (pre-existing), locale tests
42 pass.

## 2026-11-08 - Docs: nullable cross-module references (ADR-0014) and ADR-0012 multi-org

Status: implemented (docs only, branch `fix/docs-consistency`). No code, no
migrations, no seeders touched. `docs/database/` reviewed and updated.

- ADR-0014 added (accepted): every cross-module logical reference is nullable;
  presence is a service-layer fact. ADR-0012 rewritten as multi-org with a
  nullable issuing `organization_id` and per-org codes. ADR-0007/0008 headers
  cross-reference both.
- `AGENTS.md`: hard rule "Cross-module references are nullable" added.
- Companion docs aligned: `data-dictionary.md` (§1.2, §1.6),
  `integrity-and-consistency.md` (§3.3, §3.5, §5.1), `logical-references.md`
  (rules 3, tenant scope, code uniqueness), `module-ownership.md` (counts,
  obligation 4), `implementation-phases.md`, `architecture.md`,
  `data-model.md`.
- Backlog: ERP-0031..0034 moved to `proposed` (ADR-0010 still `proposed`);
  `backlog.md` status legend gained `proposed`. ERP-0037 added (ADR-0014 schema
  flip, `planned`). `features.md` moved to match.
- Verified: `bun docs/database/gen-logical-references.ts` → `522 refs across 39
  targets, 226 intra-module refs`. `bun docs/database/validate-dbml.ts` →
  `258 tables, 226 refs, 0 cross-module, 0 timestamp gaps, OK`.
- Not verified: no code test run (none expected for docs). Git wrapper reported
  a clean tree while these edits exist on disk; commit state unconfirmed.
- Schema still `NOT NULL` in shipped DB until ERP-0037 lands.

## 2026-11-08 - Docs: receipts moved to Sales; merge-main-sync docs planning (not committed)

Status: in-progress (docs only, branch `fix/docs-consistency`, uncommitted).
`merge/main-sync` was not touched. No code, migration, or seeder changed.

- `finance.receipts` moved to `sales.receipts` (kwitansi is issued against a
  sales invoice). `sales_invoice_id` stays an intra-module reference to
  `sales.invoices`. `payment_id` became a nullable logical reference to
  `finance.payments.id` (contract `resolvePayment`); the former `Ref` is gone.
  `sales.receipts` added to the Sales TableGroup.
- Docs references updated: `data-dictionary.md`, `implementation-phases.md`,
  `integrity-and-consistency.md`, `plans/finance.md` (D6), `m02-crm-sales.md`.
  Historical entries in this file are left as written.
- `module-ownership.md` recounted from `docs.dbml`: Sales 15 tables / 11 FK /
  47 logical refs; Finance 16 / 14 / 46; total 258 / 225 / 523 / 25 schemas
  incl. empty `public`.
- Verified: `bun docs/database/gen-logical-references.ts` → `523 refs across 39
  targets, 225 intra-module refs`. `bun docs/database/validate-dbml.ts` →
  `258 tables, 225 refs, 0 cross-module, 0 timestamp gaps, OK`.
- Merge planning decisions (2026-11-08): base is `fix/docs-consistency`;
  `sales.invoices` is the only invoice table; ERP-0031..0034 stay `proposed`;
  `finance.md` and `tax.md` restored; `docs/user-guide/` comes from merge.
- Kept from fix-only: `accounting.tax_corrections`, `finance.ap_open_items`,
  `finance.ar_open_items` (their plan docs were dropped on the merge side).
- Dropped from merge: `finance.invoices`, `finance.invoice_items`.
- Deferred to a separate docs merge (not in this change): merge-only tables
  `aftersales.warranty_certificates`, `crm.lead_attachments`,
  `inventory.item_categories`, `licensing.application_api_keys`,
  `projects.project_costs`, `projects.project_evidence`,
  `sales.delivery_note_items`. The DBML is therefore not yet a superset of
  `merge/main-sync`.
- Not yet done: git merge of `merge/main-sync` into `fix/docs-consistency`
  (ADR-0011, ADR-0013, `docs/user-guide/`, `architecture/README.md`,
  `modules/*`). Conflicts in `docs/plan/backlog.md`, `features.md`, and
  `progress.md` still need reconciling by hand. Code conflicts (apps/,
  packages/) are out of scope for this change.

- Correction (2026-11-08): the 2026-11-07 M09 entry and `plans/finance.md` F9
  said `features.md` M09 moved to done. Reverted to in-progress. M09 stays
  in-progress until ERP-0010..0013 are decided in `backlog.md`; Stage 2 is open.

## Next executable task

**Owner review of PR #83** (`feat/m08-hr-on-main`, M08 / ERP-0053). `main` was
merged in on 2026-11-15 (see that entry): conflicts resolved, the two orphan M08
migrations replaced by `20261114173050_lush_darkstar`, `hasAppRole` adopted,
gates green (typecheck 4/4, lint 5/5, backend 1021 / web-admin 100 / locales 90
/ react-email 5 tests, `validate-dbml.ts` `OK`). The database gates were then
run too: `drizzle:migrate` from empty, the seeder twice (second run inserted
nothing) and a browser pass with a real attendance write and both NIK-masking
directions — evidence in the 2026-11-15 entry. ERP-0053 stays `implemented`
until the owner signs off; the only gate still unrun is
`drizzle-kit push --explain`, which this merge does not need.

**ERP-0047 is verified** (2026-11-14, see the Phase 8 complete entry above). Nothing open in its plan. The docs changes for this step are uncommitted. The original Phase 8 scope, for reference:
`bunx tsc -b --noEmit` in both apps, `bun run test`, `bun run lint`,
`bun docs/database/validate-dbml.ts`, `bun run drizzle:migrate-reset` then seed
twice, `apps/backend/test/notification/realtime.smoke.test.ts` (session cookie →
producer → `{ type: 'notification.created', status: 'success', sentAt, data }`),
and the manual two-session walkthrough (admin adds a registered user → that user
sees the badge; a second notification arrives live). Phases 0-7 are done (see
the 2026-11-14 entries); the browser pass already exercised the reconnect,
live-delivery and locale paths by hand, so Phase 8 only has to automate the
smoke test and re-run the reset.

**Get reviewer sign-off on PR #82** (`fix/org-hardening`) — the organization
`description` slice, the full-width create card, the create-style edit page,
and the `findById` cache-invalidation fix are all in. Gates green: `bunx tsc
-b --noEmit` clean in `apps/backend` + `apps/web-admin`, `bun run test`
backend 842 / web-admin 62 / locales 82, no new lint warnings, migration
verified on disposable DB `ims_erp41_desc` (dropped), `validate-dbml.ts`
`OK`, live create/edit/detail walk-through done. Main was merged in after
dependabot bumped 20 workspace deps.

**Verify ERP-0046** (from main): the next dependabot run after the config
change must open a PR whose diff contains `bun.lock` with all four lint/test
jobs green; if it does not, fall back to a lockfile-refresh workflow (see the
2026-11-13 entry).

Older, still-open follow-ups: docs merge of `merge/main-sync` into
`fix/docs-consistency`, then the 7 deferred tables.

## Previous next task (still open)

**Finance review of the tax slice (D12/D14/D18)** — column list, rounding
rule, and real rates. Then ERP-0016's other half: P&L, balance sheet, cash
flow (T11).

## Previous next task (still open)

**Customer slice (ERP-0004/0005)** — the last unstarted dependency root:
backend customer CRUD (`ERP-0004`) then the web-admin customer page
(`ERP-0005`). HTTP bring-up + auth core are done (verified 2026-10-29);
apply the `erp` macro + scoping patterns from `security-and-access.md`.
Also open: backend source-build Dockerfile + CI test job polish. Status
rollup across all features: `docs/plan/plans/features.md`.

## Completed - Better Auth secondary storage (Redis), 2026-10-29

- options/secondary-storage.auth.ts: adapter implementing Better Auth's
  full SecondaryStorage contract (get / getAndDelete / increment / set /
  delete) over the shared Bun RedisClient. Keys prefixed etter-auth:;
  TTLs in seconds (setex); GETDEL for atomic getAndDelete; INCR+EXPIRE on
  first increment only (fixed-window rate-limit contract). Fail closed:
  errors logged via betterAuthLogger and re-thrown.
- uth.options.ts: secondaryStorage wired; session.storeSessionInDatabase:
  false (Redis-only sessions); session.cookieCache enabled, 5-min maxAge.
- Live verification (bun dev + real Redis on :6379): sign-in 200; Redis holds
  etter-auth:<token> + etter-auth:active-sessions-<userId> (7d TTL);
  NO new Postgres session rows after sign-in (DB rows pre-switch are legacy);
  cookie cache active (etter-auth.session_data cookie; repeat get-session
  55ms -> 12ms); sign-out 200 then get-session -> null; 7 adapter unit tests
  pass with mocked RedisClient seam; suite 61 pass / 0 fail; typecheck clean.

## 2026-10-30 - Database documentation consolidated into docs/database/

Status: implemented (design docs; no live DB touched).

- DB docs moved out of apps/backend/database and .agents/docs/database into
  docs/database/ (repo root): docs.dbml (canonical persistence contract),
  5 companion MDs, validate-dbml.ts, gen-logical-references.ts. Only
  migrations/, seeders/, migrate-reset.ts remain in apps/backend/database.
- Identity module folded: 6 ERP extension tables now live in the auth schema
  (auth.user_profiles, user_role_assignments, portal_identities,
  user_preferences, identity_verifications, user_devices) alongside the 9
  Better Auth core tables. No identity schema exists.
- org schema renamed to organization (9 tables, 6 refs). Organization master
  remains auth.organizations (Better Auth).
- Deleted docs.generated.sql (throwaway validator export) and
  postgresql-constraints.sql (superseded: constraints are specified for
  direct implementation in the Drizzle schemas; see S7 in
  docs/database/implementation-phases.md for the 85/197/45 inventory).
- Validation (docs/database/validate-dbml.ts, bun + @dbml/core): parsed 251
  tables, 218 refs, 0 cross-module, 0 timestamp gaps, OK. logical-references
  regenerated: 529 logical refs, 36 targets.
- Skills dbml-database-docs (.agents + .claude copies) updated to the new
  docs/database/docs.dbml path.
- Not verified: nothing applied to any database; the DBML remains a design
  reference for hand-written Drizzle schemas.
