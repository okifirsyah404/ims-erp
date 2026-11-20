> Historical plan written before ADR-0024; module and schema names below are the pre-refactor ones (see docs/database/module-ownership.md for the current mapping).

# ERP Module Plans — v5.1 Baseline

Detailed per-module breakdown of `docs/plan/erp-plan-en.md` (v5.1, 2026-10-21,
IDR 15,000,000). One file per plan module M01–M12. The six Stage 2 add-on
features live inside the module they extend.

## Reading rules

- **Baseline text** = restated from the v5.1 plan. Binding.
- **_Interpretation, needs owner confirmation_** = detail inferred to make the
  plan implementable. Not baseline until the owner records it (plan, "Change
  control baseline").
- **`beyond-baseline`** = exists in `docs/database/docs.dbml` or code but is
  not in v5.1 scope. Recorded only; no cut/rebaseline decided here.
- UAT scenarios U01–U32 and their per-module mapping live in the Excel
  workbook (sheets `UjiTerima`, `Scope`), which is **not in the repo**. Files
  cite ranges only; no scenario text is invented.

## Package basis (applies to every module)

One business entity, **one warehouse**, responsive web app, IDR only. Two
programmers (A, B), 50 working days / 100 person-days. Stage 1: 18 tasks,
IDR 6,750,000, 20 working days inside a 30-calendar-day target. Stage 2: 14
tasks, IDR 7,750,000, 30 working days. Contingency IDR 500,000 (owner approval
only). External costs (hosting, gateway fees, WA templates, AI tokens, n8n
paid tiers) excluded.

## Glossary (Indonesian business terms)

| Term | Meaning |
|---|---|
| SPH | _Surat Penawaran Harga_ — sales quotation |
| BAST | _Berita Acara Serah Terima_ — signed handover/acceptance certificate |
| DP | _Uang muka_ — down payment; recorded as customer advance until delivery |
| HPP | _Harga Pokok Penjualan_ — cost of goods sold (COGS) |
| DJP | _Direktorat Jenderal Pajak_ — Indonesian tax authority |
| SN | Serial number |
| PIC | Person in charge |
| Kuitansi | Payment receipt |

## Module index

| ID | Module | File | Stage 1 tasks | Stage 2 tasks | Add-on carried |
|---|---|---|---|---|---|
| M01 | Dashboard | [m01-dashboard.md](m01-dashboard.md) | T14 | T31 | — |
| M02 | CRM and Sales | [m02-crm-sales.md](m02-crm-sales.md) | T05 | T21, T22 | Checkout / payment gateway |
| M03 | Subscription and Licensing | [m03-subscription-licensing.md](m03-subscription-licensing.md) | T09 | T23, T24 | Automatic licensing API |
| M04 | n8n, WhatsApp, Website | [m04-n8n-whatsapp-website.md](m04-n8n-whatsapp-website.md) | T14, T15 | T27, T28 | WhatsApp AI |
| M05 | Inventory and Purchasing | [m05-inventory-purchasing.md](m05-inventory-purchasing.md) | T07 | — | — |
| M06 | Assets and Equipment | [m06-assets-equipment.md](m06-assets-equipment.md) | T07 | — | — |
| M07 | Projects and After-Sales | [m07-projects-aftersales.md](m07-projects-aftersales.md) | T08 | T26 | Customer portal (part) |
| M08 | Employees and Attendance | [m08-employees-attendance.md](m08-employees-attendance.md) | T10 | T19, T20 | Automated payroll |
| M09 | Finance | [m09-finance.md](m09-finance.md) | T04, T06, T11 | (T20, T22 postings) | — |
| M10 | Tax | [m10-tax.md](m10-tax.md) | T12 | — | — |
| M11 | Bonuses and Investors | [m11-bonuses-investors.md](m11-bonuses-investors.md) | T13 | T29, T30 | Investor portal |
| M12 | Reports and Access Rights | [m12-reports-access.md](m12-reports-access.md) | T02 | T25, T30 | Customer portal (accounts) |

Cross-cutting tasks (no single module): T01 kickoff/scope freeze, T03 master
data and basic forms, T16 limited import/UAT/fixes, T17 deployment and
backup/restore test, T18 pilot/training/handover, T31 integration/UAT/final
fixes, T32 integrated release/handover.

## Common Definition of Done (every module file adds its own items)

A module, or a task within it, is done only when all of these hold:

1. **Plan acceptance (v5.1 p.9):** Tracker status "Completed", progress 100%,
   valid actual start/finish dates, result "Accepted", reviewer name and
   evidence filled in. A "Pass" label without evidence and reviewer is invalid.
2. **Vertical slice:** backend endpoint, web-admin UI, append-only migration
   (generated, inspected, applied to a disposable DB), idempotent seed (run
   twice), and tests reflect the same reality.
3. **Server-side access:** role permission and record ownership enforced on
   every endpoint, export, and download; tests cover denial paths.
4. **Boundaries:** module owns its schema; cross-module access only via the
   owning module's contract/service token; no `DRIZZLE_TOKEN` in services or
   controllers.
5. **Data conventions:** money = integer IDR minor units; datetimes = unix ms;
   soft delete via `deleted_at`.
6. **i18n:** every UI string in both `en` and `id`; locale parity and dead-key
   tests green.
7. **Gates:** `bun run lint`, `bun run typecheck`, `bun run test` green;
   `bun docs/database/validate-dbml.ts` prints `OK`; `docs.dbml` updated or
   `progress.md` records "reviewed, unchanged".
8. **Status honesty:** `progress.md` and `backlog.md` updated with commands
   and outcomes. Release still needs UAT pass, finance reconciliation, and
   owner approval.

## Main sequence (plan p.7)

lead/catalog → SPH/order → invoice → verified payment → goods/project/license →
journal entries → reconciliation → financial and tax reports → profit-sharing
approval → investor publication → period close. Approved payroll becomes a
source of expenses / payroll liabilities.

## Not in v5.1 baseline (`beyond-baseline`)

Found in `docs/database/docs.dbml` (24 modules, ~253 tables, checked
2026-11-04) or in code, with no matching v5.1 scope line.

| Item | Where | Why it is outside v5.1 |
|---|---|---|
| Inventory as built (multi-warehouse, storages, addresses, borrowing, adjustments) | `inventory` schema; ADR-0010 | **Rebaseline proposed (ADR-0010, 2026-11-04)** — keep as built; organizations access warehouses via `warehouse_organizations` links; no further inventory extras until procurement lands. Owner sign-off pending. |

Reclassified 2026-11-04 (ADR-0010): the `organization` module is **consistent
with v5.1** — organizations are internal departments of one company (one
ledger, one tax identity), per ADR-0001/0007.
| `location` module — Indonesian province→village tree (4 tables, shipped) | `location` schema | Not in any module. Supporting master data at most. |
| `budgeting` module (8 tables) | `budgeting` schema | No budgeting in any module. |
| `approval` as a generic engine (7 tables) | `approval` schema | Plan: "simple approvals", "no multi-level approvals". |
| `documents` as a standalone module (8 tables) | `documents` schema | Plan: one template per document inside M02; protected docs in M12. |
| `ticket` schema separate from `aftersales` (5 + 15 tables) | `ticket`, `aftersales` | Plan: "basic tickets" with manual closure. Size exceeds scope. |
| Inventory borrowings with lifecycle events, serial statuses, adjustments with approval (shipped) | `inventory` code | Plan M05: purchasing/receiving, transfers, optional SN reference. Borrowing belongs to M06 at register level. |
| Sales payment approve/execute workflow (shipped) | `apps/backend/src/app/sales` | Plan: simple approval on SPH; payment flow is M09/T06 territory. Needs mapping. |

Decision on each row (cut, freeze, or rebaseline with owner sign-off) is
**open** and belongs to the owner. Nothing in this directory changes
`docs.dbml`, `backlog.md`, or code.
