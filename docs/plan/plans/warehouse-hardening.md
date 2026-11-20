> Historical plan written before ADR-0024; module and schema names below are the pre-refactor ones (see docs/database/module-ownership.md for the current mapping).

# Warehouse Feature Hardening Plan — Inventory Module

> Status: approved plan (sharpened through a grilling session)
> Scope: robust warehouse CRUD + warehouse detail page in the `inventory`
> module. Builds on shipped inventory slices S1–S3 (see
> `docs/plan/plans/inventory.md`).
> Affected apps: backend (Elysia API) + `apps/web-admin`.

## Implementation Status

Honest record. Nothing shipped yet.

| Phase | State | Commit | Delivered |
|---|---|---|---|
| 1 | ✅ done | — | Backend: `WarehouseInactiveError` guard on storage create/update, `countKinds` batched counts on list/detail, `warehouseId` items filter (EXISTS join), locale keys (en + id), tests |
| 2 | ✅ done | — | Frontend: card-grid list page (search, archived filter, pagination, active toggle, archive), detail page (stats cards, address, 4 tabs with storage create/edit/archive modal), i18n keys (en + id) |
| 2b | ✅ done | — | Follow-ups: location-selector popup fix (`ComboboxContent` portal), `Empty` component adoption, per-item **quantity** on detail tabs — `/items?warehouseId=` now decorates rows with `quantityOnHand` (SUM over `stock_balances`) and the `warehouseId` filter matches units **or** balances so quantity-tracked items appear; `warehouses.quantity` locale key (en + id) |

## Grilling outcome — locked decisions

| # | Decision |
|---|---|
| D1 | Permissions stay as-is: **global admin only** (ADR-0008; no `warehouse:*` catalog grants added). **Superseded for organization access by ADR-0010** (warehouse↔organization links, ERP-0031); CRUD stays global-admin-only. |
| D2 | **No archive/restore lifecycle change.** Backend soft delete already exists (`DELETE /warehouses/:id`, guarded by `WarehouseHasUnitsError`) but is surfaced as an **active toggle** (`isActive`) in the UI. No restore endpoint is added. |
| D3 | `isDefault` stays **fully manual** — no backend default-warehouse rules; user sets/unsets freely. |
| D4 | Business-rule guards to add: **storage code uniqueness per warehouse** and **storage create/update blocked in inactive warehouse**. No other guards. |
| D5 | Detail tabs (products / materials / tools / storage) are **read-only tables**; only storages are manageable (create/edit/archive modal) — wiring the existing but unused backend `PATCH .../storages/:storageId`. |
| D6 | Products/materials/tools come from the **items endpoint filtered by kind**, scoped to the warehouse (requires new backend filter, see B3). |
| D7 | Detail header shows **stats + meta** (counts per tab, address, scope, badges); counts computed **server-side** (B2). |
| D8 | Tab search/filter is **server-side**. |
| D9 | List page layout: **card grid like the organizations page**. |
| D10 | Create/edit UX: **routes** for warehouse create/edit (existing `new` / `$warehouseId.edit` routes), **modal** for storage create/edit. |
| D11 | Guard violations follow the repo's existing **`AppError` / 409 convention** (e.g. `WarehouseCodeTakenError`); frontend maps to toast. |
| D12 | **Full i18n**: all strings in the `inventory` namespace, `en` + `id`, satisfying locale-parity/dead-key tests. Replaces today's hardcoded English strings. |
| D13 | Two-phase delivery: backend first, then frontend; review between phases. |

## Facts established during exploration (do not re-discover)

- Routes already exist: `routes/_authed/inventory/warehouses/{index,new,$warehouseId,$warehouseId.edit}` with `<AdminOnly>` gating and a `warehouse-api.ts` client. The work is **upgrading**, not creating.
- Backend warehouse CRUD + addresses + storages + searchable province→village cascade already shipped (S2). Archive exists backend-side; there is **no restore endpoint** (and we are not adding one).
- `WarehouseCodeTakenError` → 409 already exists for warehouse code.
- The items list endpoint has **no `warehouseId` filter** — units (with `binId`) do. A new join-based filter is needed (B3).
- `@tanstack/react-table` is **not** installed. Server-side paginated tables use plain UI tables + `useQuery` with `placeholderData: (previous) => previous`.
- No employees API exists → responsible-employee is displayed as text only, no picker.
- Locales are **TS objects** in `packages/locales/src/{en,id}/`, with parity and dead-key tests — every key must be used and mirrored in both languages.

## Phase 1 — Backend

1. **Guards** (controller/service, `AppError` convention):
   - `StorageCodeTakenError` (409) — unique storage `code` within a warehouse on create and update.
   - `WarehouseInactiveError` (409) — reject storage create/update when parent warehouse `isActive = false`.
   - Unit tests per repo testing strategy.
2. **Counts**: extend `GET /inventory/warehouses` rows and `GET /inventory/warehouses/:id` with `productsCount`, `materialsCount`, `toolsCount`, `storagesCount` (aggregate via units → bin → storage → warehouse).
3. **Warehouse-scoped items**: add `warehouseId` filter to the items list endpoint — items having ≥1 unit in a bin of that warehouse — alongside existing `itemKind`, `search`, and pagination params.
4. Zod contracts updated; locale error keys `inventory.storageCodeTaken`, `inventory.warehouseInactive` added to both `en` and `id`.

## Phase 2 — Frontend (`apps/web-admin`)

1. **List page** (`_authed/inventory/warehouses/index.tsx` + list component), modeled on `_authed/organizations/index.tsx`:
   - Card grid: code, name, scope badge (global/org), active/archived badge, default badge; stats row with the four counts from B2.
   - Header: title/description, search input, include-archived filter, "New warehouse" button; empty / loading / error states.
   - Server-side pagination controls; `placeholderData: (previous) => previous` pattern.
   - Active toggle (`PATCH isActive`) with toast, mirroring the orgs restore flow.
2. **Detail page** (`$warehouseId.tsx`):
   - Header: warehouse meta + counts (stats + meta), address card, edit action; responsible employee shown as text (no picker).
   - **Tabs — Products / Materials / Tools / Storage** (read-only):
     - Item tabs: server-side paginated tables (code, name, quantity on hand, unit, bin, status), `itemKind` fixed per tab, `warehouseId` filter from B3, search; click-through to item detail.
     - Storage tab: storages table + **create-storage modal** + edit storage (wires existing `PATCH .../storages/:storageId`) + archive storage; guards from Phase 1 surface as toasts.
3. **i18n**: all new strings in the `inventory` namespace (`en` + `id`); replace existing hardcoded English strings on warehouse pages; keep locale parity/dead-key tests green.

## Sequencing

1. Phase 1 (backend) → review.
2. Phase 2 (frontend) → review.
