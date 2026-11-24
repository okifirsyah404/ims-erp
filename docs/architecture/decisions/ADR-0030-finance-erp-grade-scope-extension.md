# ADR-0030 - Finance becomes an ERP-grade general ledger: scope extension beyond v5.1

- **Status:** proposed (2026-11-25, ERP-0126). Phase A (GL foundation) is
  inside the v5.1 baseline and proceeds; every item listed under "Limits
  lifted" stays `planned` in `docs/plan/backlog.md` until the owner records
  the scope change, as `docs/plan/erp-plan-id.md` requires ("Perubahan
  lingkup, harga, jadwal atau kebutuhan tambahan harus dicatat owner sebelum
  menjadi acuan baru").
- **Amends:** the "Explicit limits" sections of
  `docs/plan/erp-module-plans/m05-inventory-purchasing.md`,
  `m06-assets-equipment.md`, `m08-employees-attendance.md`, `m09-finance.md`
  and `m10-tax.md` (each carries a pointer to this record).
- **Design source:** the grill-me session of 2026-11-25 (questions Q1-Q59,
  answers recorded in `docs/architecture/modules/finance.md`).

## Context

The v5.1 plan scopes finance as a bookkeeping core: manual journals, a
handful of automatic postings (invoice, payment, receipt, payable, payroll,
gateway), and manual HPP, depreciation and tax working papers. The owner now
asks for an ERP-grade finance & accounting module: chart of accounts, general
ledger as the single source of truth, AR/AP, cash & bank, period closing,
budget, expense, tax, cost accounting, fixed assets, bank reconciliation and
the reporting layer (statements, forecast, profitability, ratios, management
reports), with every operational module posting through one standardised
mechanism.

## Decision

1. **The general ledger is the single source of truth.** Every financial
   event produces a balanced journal through the finance posting service.
   No other module writes finance tables (ADR-0024 ownership unchanged).
2. **Posting contract: business facts, not accounts.** Source modules call
   `PostingService.postBusinessEvent(tx, { eventType, lines: [{ role, ... }] })`
   inside their own transaction (the existing D9 rule: the source document
   and its journal commit together). Finance resolves each role to an account
   through `finance.posting_rules` (most specific rule wins:
   event + discriminator, event, any-event + discriminator, any-event). A
   missing rule fails the posting, so the source document fails with it.
   The low-level `post()` with explicit accounts remains for manual journals.
3. **Standard and basis:** SAK EP, accrual basis, IDR only (enforced by a
   `currency_code = 'IDR'` check), perpetual inventory at moving average.
4. **Journals are immutable once posted.** Manual journals follow
   `draft -> submitted -> approved/posted`, maker-checker (the approver must
   not be the preparer). Corrections are reversals; a reversal whose original
   period is no longer open lands on the first day of the next open period.
5. **Periods:** `open`, `closed` (soft close: only adjusting manual journals),
   `locked` (hard close behind a checklist). Reopen is audited.
6. **Dimensions on journal lines:** cost centre (new finance-owned
   `cost_centers`), project, party, product.
7. **Audit:** every status transition of a finance document, every posting
   rule and chart-of-account change and every period transition is written
   to `audit.audit_logs`.

## Limits lifted (owner approval pending)

| Plan limit | Lifted by |
|---|---|
| M05: no automatic HPP/COGS | COGS posted when a delivery note ships (moving average) |
| M05: goods receipt creates the payable | GR/IR clearing: receipt posts Dr Inventory / Cr GR/IR, the bill clears GR/IR |
| M06: no automatic depreciation | Finance-owned fixed-asset register with monthly depreciation runs |
| M08: no PPh 21 TER engine, no annual reconciliation | PPh 21 TER (PP 58/2023) + annual Pasal 17 reconciliation, BPJS, behind organization toggles |
| M09: only defined postings are automatic | Every operational event in the posting map posts automatically |
| M09: no budgeting | Project budgets (finance schema, not a `budgeting` schema) with warn/block control |
| M09: no cash-flow plans | 13-week cash-flow forecast |
| M10: no e-Faktur / e-Bupot / Coretax | Coretax-compatible XML export (no DJP API call) |

## Consequences

- Phases: A (GL foundation, this record's first slice), B (AR/AP, cash &
  bank, all source-module postings incl. payroll and gateway), C (bank
  reconciliation import, expenses, fixed assets, budgets, cost accounting),
  D (reporting and analysis). Backlog ERP-0126..ERP-0153.
- The `investor` schema stays removed. M11 profit sharing is out of this
  scope; finance only exposes a closed-period profit contract later.
- POS is not a module: a cash sale is an invoice plus an immediate payment.
- Out of scope: multi-currency, direct DJP API, percentage-of-completion /
  WIP, activity-based costing, multi-entity consolidation with eliminations.
