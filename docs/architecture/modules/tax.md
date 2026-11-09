# Tax Module (accounting schema, ERP-0016 Phase 1)

> Rewritten 2026-11-07. The previous version described the deleted NestJS
> backend. This describes the current Elysia slice in
> `apps/backend/src/app/accounting/`.

## Purpose and boundary

Tax rate master and period working papers for finance review. Output is
**working papers**, never automatic DJP filing, and not a tax engine for every
tax type (v5.1 M10, ERP-0016). The tax slice lives in the `accounting` schema
(one schema per module, see `docs/plan/plans/tax.md`, D1 to D18).

## Implemented (backend, Phase 1)

- `accounting.tax_types`: effective-dated rates. Rate change = new row. Overlap
  per code refused by `TaxService` (D7). Unique `(org, code, effective_from)`
  on live rows.
- `accounting.tax_records`: one draft recap per tax type per period (D13).
  Lifecycle `draft → verified → filed`. Amounts editable only in `draft`.
- `accounting.tax_corrections`: signed corrections against a recap. Record
  moves to `corrected`; `tax_amount` is never rewritten. Net payable = recap +
  active corrections, computed at read (D15).
- `accounting.withholding_tax_records`: PPh withheld on a payment. Lifecycle
  `recorded → verified → paid | reversed`. Counterparty is plain text (D11).
- Rounding: half-up to whole rupiah, `ROUNDING_UNIT_MINOR = 100` minor units
  (D14, finance gate open).
- Seeded rates are placeholders (PPN 11%, PPh 23 2%, PPh 4(2) 10%, D18).
  Not confirmed by finance.

## Routes (`/tax/*`)

| Area | Routes | Permission |
| --- | --- | --- |
| Rate rows | `GET /tax/types`, `GET /tax/types/:id`, `GET /tax/types/preview`, `POST /tax/types`, `PATCH /tax/types/:id`, `DELETE /tax/types/:id` | read / update |
| Records | `GET /tax/records`, `GET /tax/records/recap`, `GET /tax/records/:id`, `GET /tax/records/:id/corrections`, `POST /tax/records`, `PATCH /tax/records/:id`, `POST /tax/records/:id/verify`, `POST /tax/records/:id/file`, `POST /tax/records/:id/corrections` | read / update / verify |
| Withholding | `GET /tax/withholding`, `GET /tax/withholding/:id`, `POST /tax/withholding`, `POST /tax/withholding/:id/transition` | read / update / verify |

## Permissions

Uses the existing `tax` resource in `packages/common/src/authorization/erp-permissions.ts`
(`tax:read|create|update|verify|export`). Mapping: `tax:read` view,
`tax:update` create/edit and corrections, `tax:verify` status transitions,
`tax:export` reserved for CSV/XLSX (phases 2 and 3, not built). The older
`tax.configuration.*` names are retired.

## Not built yet

- Web UI in `apps/web-admin` (en + id).
- CSV export (Phase 2) and XLSX via `exceljs` (Phase 3).
- Drill-down to source postings and finance-posting tie-out. The `finance`
  module is not built (ERP-0011..0013).
- Automated tests for service state machine and `tax:*` authorization
  (only `tax-math` is covered).

## Rules

- Rate changes are effective-dated. Never edit history in place.
- Tax is not deducted twice when a profit base is after-tax (v5.1 control,
  relevant to profit sharing). Enforced when profit sharing lands, not here.
- Automation does **not** expand the tax scope (contractual, Stage 2).
