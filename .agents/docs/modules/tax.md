# Tax Module (owner to be created)

## Purpose and boundary

Tax configuration and workpapers: types/bases/rates with **effective-dated**
parameters set by finance at kickoff, period summaries, corrections,
evidence, and paid/payable status. Output is **working papers for finance
review** — never automatic DJP filing, and no tax engine covering every tax
type (v5.1 M10; task T12).

## Current state (audit, 2026-10-25)

**Absent — no module directory, no tables.** Permissions exist in the matrix
(`tax.configuration.view|update`, `tax.report.view`).

## Planned ownership (Phase 5)

- `erp.tax_parameters` — type, base rule, rate, effective-from/to
  (effective-dated; finance-approved changes audited).
- `erp.tax_workpapers` (or derived queries) — per-period recap with
  drill-down to source postings; correction entries traceable.
- Paid/payable status derived from finance postings, not duplicated.

## Behavior targets

- Configurable recap/workpapers per period; finance review gate before any
  status is considered final.
- Tax must not be deducted twice when the profit base is after-tax (v5.1
  control; relevant to profit-sharing interplay).
- Stage 2: automation does **not** expand the tax scope (contractual).

## Dependencies and rules

- Reads postings via finance contracts; consumed by reporting (recap
  surfaces) and investor/profit-sharing (after-tax base). Rate changes are
  effective-dated — never retroactive edits of history.

## Tests

- None exist. Required: effective-dating (correct rate by period), recap
  tie-out to postings, after-tax/no-double-deduction invariant with profit
  sharing, permission gates.
