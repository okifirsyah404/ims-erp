> Historical plan written before ADR-0024; module and schema names below are the pre-refactor ones (see docs/database/module-ownership.md for the current mapping).

# M10 — Tax

## Purpose

Tax working papers for finance review: configure the tax types and rates
finance uses, summarize tax per period from posted transactions, record
corrections and evidence, and track what is paid and what is still payable.
The output supports filing. It does not file with DJP.

## Stage 1 scope (baseline)

- Basic configuration and rates.
- Period summaries.
- Corrections.
- Evidence.
- Paid/payable status.
- Reviewed by finance.

_Interpretation, needs owner confirmation:_

| Entity | Minimum fields | Status flow |
|---|---|---|
| Tax type | code (e.g. `PPN`, `PPh23`, `PPh21`, `PPh4(2)`), name, base (`DPP`), rate, GL payable/receivable account, effective from/to | `active` / `inactive` |
| Tax line | source document (invoice, supplier bill, payroll run), tax type, base amount, tax amount | — (derived from source) |
| Period summary | tax type, month, total base, total tax, corrections, net payable | `draft → reviewed → paid` |
| Correction | period summary, amount, reason, evidence | — |
| Evidence | period summary, file (payment proof / e-Bupot / e-Faktur number), date | — |

- Types, bases, rates and effective periods are **set by finance at kickoff**
  (v5.1 p.9). That is a business gate, so T12 is `blocked` without them.
- Rate changes create a new effective-dated row. Old periods keep their old
  rate.
- Paid status: finance records the payment and attaches evidence. The
  payment journal (debit tax payable, credit bank) posts through M09.

## Stage 2 scope (baseline)

- Tax working papers still require finance review.
- Added automation (gateway, payroll) **does not expand the tax scope**.
- _Interpretation:_ payroll PPh 21 amounts from M08 and invoice PPN from
  gateway orders appear as tax lines automatically. No new tax logic is
  added.

## Explicit limits (out of scope)
> **ADR-0030 (accepted by the owner 2026-11-25):** the finance ERP-grade extension lifts some of the limits below (see the ADR's "Limits lifted" table); where they conflict, the ADR wins.


- No official DJP filing (no e-Faktur, e-Bupot or Coretax integration).
- No tax engine covering every tax type or every scenario.
- No tax advice. Rules come from finance.

## Tasks

| ID | Task | PIC | Days | Price (IDR) |
|---|---|---|---|---:|
| T12 | Tax working papers | B | S1 12 | 168,750 |

## SOPs

- **S11 Finance:** reports and tax before the period lock.

## Controls

- Tax amounts on documents use the rate effective on the **document date**.
- Period summaries are recomputed from tax lines and are not typed in. A
  correction is a separate line with a reason and evidence.
- When a profit-sharing basis uses after-tax profit (M11), tax is **not
  deducted twice** (v5.1 p.9).
- A summary for a closed period (M09) is read-only.
- Money is integer IDR minor units, with the rounding rule fixed by finance.

## Acceptance

- UAT: tax scenarios in U01–U20, per Excel. Scenario text is not in the repo.
- _Interpretation:_ a sample month's PPN output/input and PPh 23 totals match
  finance's manual working paper, and a rate change mid-year applies only to
  documents after the effective date.

## Definition of Done

Common DoD in [README.md](README.md), plus:

- Effective-date rate lookup has unit tests at the boundaries.
- Period summary totals are asserted against fixture documents.
- The working paper exports (XLSX/CSV) carry the columns finance needs for
  manual filing. _Interpretation:_ the column list is agreed at kickoff.
- No code calls DJP endpoints.

## Dependencies

- Needs: M02 invoices (output tax), M05/M09 supplier bills (input
  tax/withholding), M08 payroll (PPh 21), M09 accounts and period lock.
- Provides: tax payable to M09 reports and the after-tax basis to M11.

## Current state vs plan (checked 2026-11-04)

| Plan item | `docs.dbml` | Code |
|---|---|---|
| Tax types/rates | `accounting.tax_types` | none |
| Tax lines / summaries | `accounting.tax_records` | none |
| Withholding | `accounting.withholding_tax_records` | none |
| Fiscal settings | `organization.fiscal_settings` | none |

- Tax has no schema of its own. It lives inside `accounting` (M09's schema),
  which fits a working-paper scope.
- Status: **planned**.
- `beyond-baseline`: none found. Evidence attachments have no explicit
  table, so they may use `documents`. Small gap.
