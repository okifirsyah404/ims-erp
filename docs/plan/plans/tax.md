# Tax Module Plan — M10 (ERP-0016)

> Status: approved plan (sharpened through a grilling session, rounds 1–2 + Q12–Q13)
> Scope: tax parameter master (Stage 1) + period working papers, corrections,
> withholding records, CSV/XLSX export (Stage 2 of baseline M10).
> Baseline: `docs/plan/erp-module-plans/m10-tax.md`. Phase 5, backlog `ERP-0016`.
> Affected apps: backend (Elysia API, new `accounting` domain) + `apps/web-admin`
> + `docs/database/docs.dbml` + `packages/locales`.

## Implementation Status

Honest record. Nothing shipped yet.

| Phase | State | Commit | Delivered |
|---|---|---|---|
| 1 | planned | — | DBML update, migration, backend domain (tax types, tax records, corrections, withholding), guards, tests |
| 2 | planned | — | Frontend: tax types, period recap, tax records, corrections, withholding pages; i18n en + id; CSV export |
| 3 | planned | — | XLSX export via `exceljs`, separate dependency review |

## Grilling outcome — locked decisions

| # | Decision |
|---|---|
| D1 | Scope = Stage 1 (tax parameter master) + Stage 2 (period working papers, corrections, withholding records). |
| D2 | New backend domain `apps/backend/src/app/accounting/` owning Postgres schema `accounting`. Only tax tables for now; tax has no schema of its own. |
| D3 | Pure configuration + recap. No tax is applied to sales/inventory documents. A small "resolve applicable rate" service is exposed for later consumers via the owning module's contract (no sales changes). |
| D4 | `accounting.withholding_tax_records` is in scope (CRUD + recap). |
| D5 | Rate lookup: exact `code`, `is_active`, `effective_from <= date <= effective_to` (or open-ended), latest `effective_from` wins. Build with placeholder rates; finance review is a Definition-of-Done gate, not a build blocker. |
| D6 | Frontend in scope: tax types list + create/edit, period recap (read-only with drill-down), tax records, corrections, withholding; full en + id i18n. |
| D7 | **Deviation from DBML:** `tax_types` unique changes from `(organization_id, code)` to `(organization_id, code, effective_from)`, plus a no-overlap guard per `(organization_id, code)` over effective ranges. Rate change = new effective-dated row. Requires `docs.dbml` edit before Drizzle. |
| D8 | Corrections are a new table `accounting.tax_corrections`. Evidence uses the existing `documents` module via logical reference. |
| D9 | Uses the existing `tax` permission resource (`tax:read|create|update|verify|export`) from `erp-permissions.ts`. Mapping: `tax:read` view, `tax:update` create/edit and corrections, `tax:verify` status transitions, `tax:export` CSV/XLSX. No new catalog entries. |
| D10 | `tax_records` input is manual, with a helper: entering base computes tax amount from the effective rate on the period/document date, still overridable. Derived/posted lines come later with M09. |
| D11 | Withholding `counterparty_type` / `counterparty_id` are plain text, no cross-module validation. |
| D12 | Export: CSV in phase 2; XLSX in phase 3 via `exceljs` (new dependency, version and advisory check at install time). |
| D13 | Unique `(organization_id, tax_type_id, period_year, period_month)` on `tax_records`, in addition to the existing `(organization_id, code)`. Corrections never duplicate recap rows. |
| D14 | Rounding: half-up to the nearest rupiah as a documented default. Marked as a finance gate in Definition of Done (finance may change it before UAT). |
| D15 | Corrections do not change the original `tax_amount`. Net payable = recap + sum of corrections, computed at read time. Correction amount is signed bigint, `reason` required, `evidence_document_id` optional logical reference. |
| D16 | Route prefix `/tax/*` (backend and frontend), not `/admin/*`. Access is controlled by `tax.*` permissions, not global admin. |
| D17 | Delivery: phase 1 backend, review; phase 2 frontend + CSV, review; phase 3 XLSX, review. |
| D18 | Seed placeholder rates (PPN 11%, PPh 23 2%, PPh 4(2) 10%). PPh 21 is not seeded (progressive, belongs to M08 logic). Seed comments mark every value as placeholder until finance confirms. |

## Facts established during exploration (do not re-discover)

- `docs/database/docs.dbml` already defines `accounting.tax_types` (line ~4408), `accounting.tax_records` (~4436), `accounting.withholding_tax_records` (~4530). No code exists for any of them.
- `docs.dbml` `tax_types` unique is `(organization_id, code)`. Conflicts with effective-dated rows → D7.
- `tax_records` has `filing_status` (`draft|verified|filed|corrected`), `filed_on`, `verified_by` (logical ref to `auth.users.id`), `notes`, `deleted_at`.
- `withholding_tax_records.status`: `recorded|verified|paid|reversed`. `period_year/month` nullable.
- Money: bigint minor units + `currency_code`. Datetimes: bigint unix ms (`effective_from` / `effective_to` / `filed_on` are `date` per DBML — keep as DBML says).
- Permissions in matrix: `tax:read`, `tax:update`, `tax:verify`, `tax:export` (D9).
- `exceljs` is not installed. No XLSX/CSV library in `package.json`.
- Module shape reference: `apps/backend/src/app/sales/` (thinnest scaffold with state machines); ports pattern at `inventory/contracts/warehouse-borrowing-guard.port.ts`.
- Warehouse hardening (`docs/plan/plans/warehouse-hardening.md`) is the format template.
- Mandatory gates: `docs/database/` read before coding; `grill-me` pass done (this document); `docs.dbml` updated before Drizzle; `bun docs/database/gen-logical-references.ts` then `bun docs/database/validate-dbml.ts` must print `OK`.

## Current state

- No `accounting` schema, module, routes, or tests exist.
- No tax-related code outside docs and permission matrix.
- Business gate (finance rates, rounding, CSV/XLSX column list) is open; implementation proceeds with placeholders.

## Phase 1 — Backend

1. **DBML first** (`docs/database/docs.dbml`):
   - `tax_types`: unique → `(organization_id, code, effective_from)`; partial unique on `deleted_at IS NULL` per soft-delete convention.
   - `tax_records`: add unique `(organization_id, tax_type_id, period_year, period_month)`.
   - Add `accounting.tax_corrections`: `id`, `organization_id`, `tax_record_id`, `amount bigint` (signed), `reason text not null`, `evidence_document_id uuid` (logical ref to `documents`), `created_by` (logical ref to `auth.users.id`), `created_at`, `updated_at`, `deleted_at`. Check: `reason` non-empty; `amount <> 0`.
   - Run `gen-logical-references.ts` and `validate-dbml.ts` → `OK`.
   - Record `docs/database/` changes in `progress.md`.
2. **Migration**: `bunx --bun drizzle-kit generate` in `apps/backend`, inspect SQL, apply to disposable DB only. Append-only; no historical migration edits.
3. **Drizzle schemas**: `apps/backend/drizzle/schemas/accounting.schema.ts` (`pgSchema('accounting')`), unixTimestamp custom types for datetimes, bigint for money.
4. **Domain** `apps/backend/src/app/accounting/`:
   - `constants/di.ts`, `container.ts` (`registerAccounting`), `contracts/` (interfaces + zod), `repositories/`, `services/*.service.ts`, `controllers/`, `errors/accounting.errors.ts`, `utils/` (rate lookup, rounding helpers).
   - Services: `TaxTypeService`, `TaxRecordService`, `TaxCorrectionService`, `WithholdingTaxService`, `TaxRateResolver` (exported contract for future consumers).
   - Rate lookup: effective-date boundaries unit-tested (start day, end day, day after end, rate change mid-period).
   - Rounding: half-up to rupiah, unit-tested at .5 boundaries.
5. **Guards** (`AppError` convention, 409 where applicable):
   - `TaxTypeCodeEffectiveOverlapError` (409) — overlapping effective ranges for the same code.
   - `TaxRecordPeriodTakenError` (409) — duplicate `(tax_type, year, month)`.
   - `TaxRecordLockedError` (409) — edit when `filed`; corrections only.
   - `TaxInvalidStatusTransitionError` (409) — allowed: `draft→verified`, `verified→filed`, `corrected` set automatically when a correction exists, `verified→draft` not allowed.
   - `TaxCorrectionReasonRequiredError` (422/400 per validation convention).
   - `WithholdingTaxStatusTransitionError` (409) — `recorded→verified→paid`, `reversed` reachable from `verified`/`paid`.
6. **Routes** under `/tax/*` (mounted in `src/app/app.ts` via `createApp()`); guards by permission: `tax:read`, `tax:update`, `tax:verify`, `tax:export`. Ownership and permission enforced server-side for every endpoint, including CSV export.
7. **Endpoints (minimum)**:
   - `GET/POST /tax/types`, `GET/PATCH/DELETE /tax/types/:id` (soft delete).
   - `GET /tax/recap?year=&month=` — recomputed per tax type from `tax_records` + corrections (net payable).
   - `GET/POST /tax/records`, `GET/PATCH /tax/records/:id`, `POST /tax/records/:id/transition`, `POST /tax/records/:id/corrections`.
   - `POST /tax/records/preview` — helper: base + tax type + date → computed tax amount (no persistence).
   - `GET/POST /tax/withholding`, `GET/PATCH /tax/withholding/:id`, `POST /tax/withholding/:id/transition`.
   - `GET /tax/export.csv?year=&month=` — phase 2.
8. Zod contracts for all bodies and queries. Locale error keys added in `packages/locales` (en + id).
9. **Seed** (`apps/backend/database/seeders`): placeholder tax types (PPN 11%, PPh 23 2%, PPh 4(2) 10%), idempotent (run twice), comments mark placeholders.
10. **Tests** (bun:test, mocked Drizzle/Redis per project convention): authorization per endpoint, ownership, guards above, rate boundaries, rounding, recap totals against fixture records and corrections.

## Phase 2 — Frontend + CSV (`apps/web-admin`)

1. Routes under `_authed/tax/`:
   - `tax/types/index.tsx` — list, active filter, create/edit route (`tax:update` gated).
   - `tax/recap/index.tsx` — period selector, per-type totals, net payable, drill-down to records.
   - `tax/records/index.tsx` + `$recordId.tsx` — list, detail, transitions, corrections panel (reason required, evidence via `documents`).
   - `tax/withholding/index.tsx` + `$recordId.tsx` — list, create/edit, transitions; counterparty as text + type select.
   - Gates: `tax:*` in UI are UX only; server enforces.
2. Rate helper UI on record create: enter base → preview tax amount (from `/tax/records/preview`), editable.
3. CSV export button on recap page; file columns agreed at kickoff (placeholder: recap columns).
4. i18n: all strings in a `tax` namespace (or existing `admin` if convention requires), en + id, satisfying `locale-parity.test.ts` and `locale-dead-keys.test.ts`.
5. Route tree regeneration (`routeTree.gen.ts`) in the same change.

## Phase 3 — XLSX export

1. Add `exceljs` (verify current version and advisories at install; record in `progress.md`).
2. `GET /tax/export.xlsx?year=&month=` with same columns as CSV.
3. Backend tests for permission and content; frontend button.

## Sequencing

1. Phase 1 (DBML → migration → backend + tests) → review.
2. Phase 2 (frontend + i18n + CSV) → review.
3. Phase 3 (XLSX) → review.

## Definition of Done

Common DoD from `AGENTS.md` (lint, typecheck, tests, migration inspected and applied to disposable DB, idempotent seed, `progress.md` + `backlog.md` (`ERP-0016`) + `features.md` updated, `docs.dbml` validated `OK`). Plus:

- Rate lookup unit tests at boundaries (D5).
- Recap totals asserted against fixture records and corrections (D15).
- Rounding rule has a finance gate; default half-up documented until confirmed (D14).
- Placeholder seed rates have a finance gate; nothing is marked verified without finance review (D18).
- Export columns have a finance gate (D12).
- No code calls DJP endpoints.
- Historical migrations untouched.
- Acceptance: `U01–U20` UAT scenarios from Excel (not in repo) — status `planned` until run.

## Explicit limits (out of scope)

- Official DJP filing (e-Faktur, e-Bupot, Coretax).
- Tax applied to sales/inventory/payroll documents (later, via M09/M02/M08 integration).
- PPh 21 progressive calculation.
- Posting tax journal entries to M09 (later).
- Restore endpoints for soft-deleted tax types (not requested).
