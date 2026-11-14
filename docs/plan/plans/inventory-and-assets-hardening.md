# Inventory & Assets Hardening Plan

> Status: approved plan (converged through a grilling session).
> Scope: (1) hardening of the shipped `inventory` module (stock/ledger
> integrity, numbering, audit, transactionality, verification) and residual
> warehouse gaps, and (2) full implementation of the M06 **Assets and
> Equipment** module — all 11 dbml tables, backend (Elysia API) and UI
> (`apps/web-admin`).
> Builds on: `docs/plan/plans/inventory.md` (S1–S3) and
> `docs/plan/plans/warehouse-hardening.md` (warehouse CRUD/UI — shipped; this
> plan covers stock/ledger integrity and master-data audit, not CRUD/UI).
> Target doc home once implementation starts: `docs/plan/plans/inventory-and-assets-hardening.md`.
>
> **dbml deviation (shipped):** `assets.status` uses
> `('in_stock','in_use','maintenance','inactive','disposed','lost')` — the
> dbml vocabulary plus `'inactive'`, per D18 (deactivation-with-reason SOP).
> Enforced by `assets_deactivation_reason_check`:
> `inactive ⇔ deactivation_reason IS NOT NULL`.

## Implementation Status

All phases shipped. Commits on `fix/inventory-module-hardening`.

| Phase | State | Commit | Delivered |
|---|---|---|---|
| I-1 Ledger integrity | ✅ done | `8238323` | `applyDelta` row-lock sole mutation path; CHECKs `quantity_on_hand >= 0`, `quantity_reserved >= 0`; default-warehouse partial unique index; seeder routed through `applyDelta` |
| I-2 ERP-0009 numbering | ✅ done | `6670e56` | `organization.document_sequences` + atomic allocate-in-tx service; `Math.random()` codes removed (MV/ADJ/BRW) |
| I-3 Audit | ✅ done | `ccf8b47` | Audit rows for adjustment/borrowing workflows + master-data CRUD with before/after snapshots; per-operation ledger events |
| I-4 Adjustment posting | ✅ done | `182480b` | Atomic `claimForPost` inside ONE posting transaction; rollback releases the claim; no partial posting |
| I-5 Verifier | ✅ done | `e6677d1` | `verify-inventory-constraints.ts`: CHECKs, ledger-vs-balance, ERP-0009 20-way concurrency, atomic claim, D17 negative-stock smoke - all PASS on real PG 18. **Script deleted 2026-11-14** after rotting to 14 failing checks; no live-DB constraint proof remains |
| A-1 Schema & migrations | ✅ done | `1c5fef1` | 11 asset tables per docs.dbml; `assets.status` adds `'inactive'` (D18 deviation); verified clean on fresh PG 18 |
| A-2 Numbering & permissions | ✅ done | `2f768fd` | Register/category CRUD over ERP-0009 codes (`AST-REG`, `AST-CAT`); `asset:*` matrix wired; audit vocabulary |
| A-3 Services & API | ✅ done | `ead5c9e` | Custody (D12), depreciation (D14), disposal workflow (D21), maintenance, condition checks, documents, tool sets; atomic claims for return/execution; 18 unit tests |
| A-4 UI | ✅ done | `1dcfe0c` | Register (list/detail/new), loans, disposals, depreciation, service records, tool sets, categories; en+id `assets` namespace; parity + dead-key tests green |
| Final pass | ✅ done | (this commit) | Verifier extended with asset checks (D18 CHECK, disposal vocabulary, financial-proof persistence) — ALL CHECKS PASSED on real PG 18; docs.dbml deviation noted |

Deferred (see Explicit follow-ups below): provisional-serial guard,
valuation/UI sync (OPEN-3), DB role GRANT/REVOKE script, partial-unique
org+code indexes for asset tables.

## Grilling outcome — locked decisions

| # | Decision |
|---|---|
| D1 | Hardening scope = core six: stock TOCTOU race, DB negative-stock guards, ERP-0009 numbering, audit coverage, adjustment posting transactionality, verifier-script test coverage. Deferred: provisional-serial one-time mutation guard; valuation/UI sync (OPEN-3 phase-gate); DB role GRANT/REVOKE script (ops follow-up). |
| D2 | Negative stock closed by **both**: (a) pessimistic `SELECT … FOR UPDATE` row lock in `applyDelta`, and (b) CHECK constraints `quantity_on_hand >= 0`, `quantity_reserved >= 0` on `stock_balances` (defense-in-depth; symmetric with existing `quantity_after >= 0` on `stock_movements`). |
| D3 | Audit scope: financial-control events (adjustment submit/approve/reject/post, borrowing issue/return) **+ master-data CRUD** (item, warehouse, storage create/update/delete with before/after snapshots) **+ per-operation ledger events** (postMovement invocation, reversals — not per ledger row). |
| D4 | Document numbering via ERP-0009: create `organization.document_sequences` (per-org, per-doc-type rows: prefix, `next_number`); allocation by `UPDATE … SET next_number = next_number + 1 … RETURNING next_number - 1` inside the document's transaction; **gaps from rollbacks are acceptable** (documented). Replaces all `Math.random()` code generation (movement, borrowing, adjustment). Formats preserved: `MV-…`, `ADJ-…`, `BRW-YYYYMM-####` with serial part sequence-allocated. |
| D5 | Verification = extend `apps/backend/database/verify-inventory-constraints.ts` only (no testcontainers/persistent test DB). CI shape unchanged. **Superseded 2026-11-14:** that script was deleted; the backend suite still needs no DB (it mocks via `test/helpers/mock-db.ts`), so CI shape is unchanged but the live-DB constraint checks are gone |
| D6 | Plan doc follows house style of `warehouse-hardening.md` (phased, D-decisions, acceptance criteria). |
| D7 | Seeder must route through `applyDelta` (it currently hand-rolls balance updates, violating the "applyDelta is the ONLY way" contract). |
| D8 | DB role permissions (no DELETE/TRUNCATE on ledger tables) **deferred** — ops/environment-specific follow-up, noted in plan. |
| D9 | Warehouse residual: add partial unique index enforcing single default warehouse (`WHERE is_default`). |
| D10 | Serial-unit `assetTag`: non-empty + max-length validation, **unique index** (nulls distinct), hide the assets sidebar entry until the asset module ships (this plan ships it — the hide step is therefore transient; see D21). |
| D11 | Asset module: **all 11 dbml tables built** (`assets`, `asset_categories`, `asset_assignments`, `asset_movements`, `asset_condition_checks`, `asset_maintenances`, `asset_depreciations`, `asset_disposals`, `tool_sets`, `tool_set_items`, `asset_documents`). |
| D12 | Asset loans: **full loan flow inside the assets module** — borrower, purpose, out date, due date, return date, condition out/in; state `borrowed → returned`. Overdue = flag + list filter + UI badge only (no scheduler, no notifications, no auto-blocking). |
| D13 | Missing dependencies (M05 PO, M09 finance, HR): `supplier_id` / `purchase_order_id` / employee refs stay **nullable logical refs**; acquisition value entered manually; holders/borrowers picked from existing **users**. |
| D14 | Depreciation: `asset_depreciations` built as a **manual finance-entry log** (no calculation engine — explicit M06 limit); book value/accumulated depreciation derived from entries. |
| D15 | Asset codes (`assets.code`, maintenance, disposal codes) allocated via the new ERP-0009 `document_sequences` service (one numbering service shared with inventory). |
| D16 | Permissions: keep the existing role matrix in `packages/common/src/authorization/erp-permissions.ts` (admin read-only, ops-manager full minus dispose, field assign-only, owner read/export). UI replaces ComingSoon stubs, gated by `asset:*` permissions, i18n en + id. |
| D17 | Guard tests: double-assign of an asset already `borrowed`/`inactive`/`in_use`; return of an unassigned asset; negative-stock concurrency smoke — asserted in the verifier script per D5. |
| D18 | Asset status vocabulary: adopt dbml `status IN ('in_stock','in_use','maintenance','disposed','lost')` **plus `'inactive'`** (single documented deviation; S07 deactivation-with-reason is an explicit SOP). Deviation noted in plan and `docs.dbml`. |
| D19 | `asset_documents`: table built; UI records **logical references only** (type + external reference/number). Real file upload deferred to the future documents module. |
| D20 | Plan filename: `inventory-and-assets-hardening.md`. |
| D21 | Disposal workflow UI included (D11 builds `asset_disposals`); disposal soft-deletes the asset (financial master-data rule). |

## Part I — Inventory hardening

### Phase I-1: Ledger integrity (backend)
1. `applyDelta` (balance repository) becomes the sole serialized mutation path:
   `INSERT … ON CONFLICT DO NOTHING` (upsert already exists) → `SELECT … FOR
   UPDATE` on the `stock_balances` row → apply delta under lock, inside the
   caller's transaction.
2. Refactor `stock.service.postMovement` to accept a caller-supplied
   transaction (needed for Phase I-4 and asset none — but also adjustment
   posting).
3. Route every balance-mutation site through `applyDelta`: stock post/reversal,
   borrowing issue/return, transfers, scheduler, and the **seeder** (D7).
4. Migration: add CHECKs `quantity_on_hand >= 0` and `quantity_reserved >= 0`
   on `stock_balances`, ordered after a data-scrub assertion so existing rows
   cannot fail the constraint.
5. Migration: partial unique index on `warehouses` enforcing one default per
   scope (D9).

### Phase I-2: ERP-0009 numbering (backend)
1. Create `organization.document_sequences` (table + Drizzle schema +
   migration): per-org, per-doc-type row with `prefix` and `next_number`;
   lazily seeded on first use.
2. Numbering service: allocate with
   `UPDATE document_sequences SET next_number = next_number + 1 … RETURNING
   next_number - 1` inside the caller's transaction. Gaps from rollbacks
   accepted (D4).
3. Replace `Math.random()` + retry code generation in movement, borrowing, and
   adjustment flows; keep existing human formats.

### Phase I-3: Audit (backend)
1. Extend `AuditService` action catalog (`AUDIT_ACTIONS`).
2. Audit rows for: adjustment submit/approve/reject/post; borrowing issue/
   return; item / warehouse / storage create-update-delete with before/after
   snapshots; per-operation ledger events (`postMovement` invocation,
   reversal) — D3.
3. No audit row per ledger row — the ledger itself is the row-level trail.

### Phase I-4: Adjustment posting correctness (backend)
1. Atomic claim: `UPDATE adjustments SET posted_at = now() WHERE id = ? AND
   status = 'approved' AND posted_at IS NULL RETURNING` (mirrors
   `claimForReversal`).
2. Wrap the whole post (claim + all per-line movements) in **one transaction**
   so a failed line rolls back prior lines (partial posting impossible).

### Phase I-5: Verification (backend)
Extend `apps/backend/database/verify-inventory-constraints.ts` to assert (D5):
- both new CHECK constraints (and that seeder output satisfies them);
- ledger-vs-balance consistency after all mutation paths;
- `document_sequences` integrity (no duplicate allocations, monotonic per row);
- adjustment atomic-claim behavior (concurrent double-post rejected);
- concurrency smoke: parallel posts cannot produce negative stock (D17).

> **Shipped 2026-11-06, then the script was deleted 2026-11-14.** All five
> assertion groups passed on real PostgreSQL 18 when the phase closed. The
> verifier later rotted (missing `items.code`, `organization.document_sequences`
> relocated to `code_number`, a hardcoded six-schema `DROP` that made a second
> run fail) and was removed rather than repaired. Nothing currently asserts
> these invariants against a live database - the backend suite runs entirely on
> `test/helpers/mock-db.ts`. See `docs/plan/progress.md` 2026-11-14 "removed the
> two stale one-shot database scripts".

## Part II — Asset module (M06, full build)

### Phase A-1: Schema & migrations (backend)
Drizzle schema + migrations for all 11 tables (D11), per `docs.dbml` with
these documented deviations/additions:
- `assets.status` adds `'inactive'` (D18); deactivation reason recorded.
- All FK-ish references to not-yet-existing modules (supplier, PO) are nullable
  logical refs (D13).
- Unique index on `asset_tag`-equivalent serial-unit field per D10 (inventory
  side).
- Single-default-warehouse partial unique index (D9, from Part I).

### Phase A-2: Numbering & permissions (backend)
1. Asset codes via the shared ERP-0009 service (D15).
2. Wire the existing `asset:*` permission matrix (D16); no new grants.

### Phase A-3: Services & API (backend)
- Categories CRUD.
- Assets register CRUD: create (manual acquisition fields), read (detail with
  custody/condition/service/depreciation history), update, **soft delete only**
  (financial master-data rule; hard delete blocked once referenced by
  journal/loan — no journal refs yet, rule enforced defensively), deactivate
  with reason (D18), reactivate.
- Custody/assignments (D12 full loan flow): assign (guards: not
  `borrowed`/`inactive`/`in_use`), return with condition in/out, movement
  trail in `asset_movements`.
- Condition checks CRUD (log).
- Service notes (`asset_maintenances`) CRUD (log) with code via D15.
- Depreciation manual-entry log (D14): finance-style entries, derived book
  value.
- Disposal workflow (D21): disposal record → asset `disposed` (soft status),
  codes via D15.
- Tool sets (D11): kit CRUD + `tool_set_items` composition (references
  serialized units/assets).
- Asset documents (D19): logical references only.
- All writes audited (same AuditService as Part I); all writes transactional;
  loan state transitions use atomic conditional claims (lesson from Phase I-4).

### Phase A-4: UI (apps/web-admin)
- Replace ComingSoon stubs under `routes/_auth/assets/**`:
  - Register: card/table list (search, status/category filters, pagination),
    detail page (stats, meta, custody/condition/service/depreciation/
    documents tabs), create/edit modal, deactivate flow with reason,
    disposal flow.
  - Categories management page.
  - Loans: assign modal, return modal with condition in, overdue badge +
    filter (D12).
  - Service records page; depreciation entries page.
  - Tool sets page.
- Server-side pagination/filtering (`placeholderData: previous` pattern, house
  convention).
- i18n: all strings in `assets` namespace, `en` + `id`, locale parity tests
  green.
- Permission gating per D16.

## Sequencing

1. Part I Phases I-1 → I-2 → I-3 → I-4 → I-5 (review gate after I-2).
2. Part II Phases A-1 → A-2 → A-3 → A-4 (review gate after A-3).
3. Final pass: verifier script covers both parts; docs.dbml deviation note.

## Acceptance criteria

- Concurrent movement posts cannot produce negative stock (DB CHECK + row
  lock); verifier asserts it.
- No `Math.random()` document codes remain in inventory or assets; all codes
  come from `document_sequences`.
- Every write path listed in D3/D16's audit scope produces audit rows; master
  data writes carry before/after snapshots.
- Adjustment double-post concurrently returns one success, one failure; no
  partial line posting.
- Seeder output passes the new CHECK constraints.
- Assets: full lifecycle works end-to-end — register → assign → return →
  condition → service → depreciate (manual) → dispose/deactivate; guards
  reject illegal transitions with clear errors; guard tests in verifier.
- UI: assets pages fully replace ComingSoon stubs; en+id locale parity tests
  green.

## Explicit follow-ups (deferred)

- Provisional-serial one-time mutation guard (app-level, D13 of inventory plan
  territory) — rare path.
- Valuation/UI sync (`average_cost`/`total_value` advance) — OPEN-3 phase-gate.
- DB role GRANT/REVOKE script (no DELETE/TRUNCATE on ledger tables) — ops.
- Real file upload for asset documents (awaits documents module).
- Notifications/scheduler for overdue asset loans.
