# M09 — Finance

## Purpose

The bookkeeping core. Every other module's money event ends here as a
journal. It produces the profit-and-loss statement, balance sheet and
cash-flow statement, all traceable to the general ledger, and runs month-end
closing.

## Stage 1 scope (baseline)

- Opening balances.
- Cash and bank.
- Accounts receivable and payable.
- Journals and reversals.
- Reconciliation.
- Profit-and-loss statement, balance sheet, cash-flow statement.
- Month-end closing.

_Interpretation, needs owner confirmation:_

| Entity | Minimum fields | Status flow |
|---|---|---|
| Chart of accounts | code, name, type (asset/liability/equity/revenue/expense), normal side, parent | `active` / `inactive` |
| Opening balance | account, amount, as-of date | posted once; must balance |
| Journal entry | date, reference (unique), source module, memo, lines (account, debit, credit) | `draft → posted`; posted entries are corrected only by `reversal` |
| Cash/bank account | name, bank, number, linked GL account | — |
| Cash/bank transaction | account, date, in/out, amount, counterparty, reference | — |
| Receivable | from M02 invoices; open amount per invoice | `open → partially_paid → paid` |
| Payable | from M05 receipts/supplier bills; open amount | `open → partially_paid → paid` |
| Bank reconciliation | account, period, statement balance, matched transactions | `draft → completed` |
| Accounting period | month | `open → closed` (locked) |

- Account list: supplied by finance at kickoff (a business gate).
- Reports are generated from posted journal lines only:
  - P&L: revenue − expenses for the period.
  - Balance sheet: assets = liabilities + equity at a date, with current-year
    profit included.
  - Cash flow: _interpretation:_ the **direct method** from cash/bank
    accounts, grouped by category (operating/investing/financing) using an
    account mapping.
- Month-end close (S11): post adjustments (depreciation from M06, HPP from
  M05, accruals), reconcile banks, review reports and tax (M10), then lock
  the period. After the lock, no posting is allowed with a date in that
  period. A reopen is owner-only and audited.

## Stage 2 scope (baseline)

- Payroll postings (from M08/T20) feed into the reports.
- Gateway payments (from M02/T22) feed into the reports.
- Gateway fees are reconciled.

_Interpretation, needs owner confirmation:_

- Gateway accounting split (v5.1 p.9):
  - On a valid callback: debit **gateway clearing** (gross), credit
    receivable.
  - On settlement: debit bank (net), debit **gateway fee expense** (fee),
    credit gateway clearing (gross).
  - The clearing balance is "funds awaiting settlement". It reconciles
    against the gateway's settlement report.
- Payroll: on approval, debit salary expense and credit payroll payable
  (plus tax and BPJS payables). On payment, debit payroll payable and credit
  bank.

## Explicit limits (out of scope)

- No multi-entity consolidation.
- Journal entries are not automated for every activity. Only the defined
  postings (invoice, payment, receipt, payable, payroll, gateway) are
  automatic, and the rest are manual journals.
- No foreign currency. IDR only.
- No budgeting (see README `beyond-baseline`).

## Tasks

| ID | Task | PIC | Days | Price (IDR) |
|---|---|---|---|---:|
| T04 | Opening-balance bookkeeping and journals | A | S1 2–5 | 675,000 |
| T06 | Cash, bank, receivables, and payables | A | S1 6–8 | 506,250 |
| T11 | Financial reports and month-end closing | A | S1 11–13 | 506,250 |
| T20 | (payroll journal posting; task owned by M08) | A | S2 6–8 | — |
| T22 | (gateway reconciliation; task owned by M02) | B | S2 7–10 | — |

## SOPs

- **S03 Invoice and payment** (reconciliation, receipt).
- **S06 Procurement** (payable).
- **S11 Finance:** transaction, journal/adjustment, reconciliation,
  reports/tax, lock period.
- **S13 Monthly reporting:** period close, reports, owner review, archive.

## Controls (v5.1 p.9)

- Opening balances **must balance** (debits = credits) before the first
  posting.
- Every journal balances. A DB constraint or a service guard rejects
  unbalanced entries.
- **Corrections use reversing entries.** Posted journals are never edited or
  deleted.
- DP before delivery is a **customer advance** (liability). The final payment
  must not record revenue twice.
- P&L, balance sheet and cash flow are **traceable to the GL** (drill down to
  journal lines). **Ending cash in the cash-flow statement equals cash on the
  balance sheet.**
- Postings use **unique references**, so a replayed source event cannot post
  twice.
- HPP/inventory value, depreciation and manual adjustments are checked by
  finance.
- A closed period rejects new postings on the server.
- Money is integer IDR minor units (ADR-0002). Business dates are
  Asia/Jakarta.

## Acceptance

- UAT: finance scenarios in U01–U20, gateway/payroll postings in U21–U32 and
  the integrated cycle re-test, per Excel. Scenario text is not in the repo.
- _Interpretation:_ a sample month supplied by finance, posted end to end,
  must produce the expected P&L/BS/CF, with ending cash in the CF equal to
  the BS.

## Definition of Done

Common DoD in [README.md](README.md), plus:

- Tests for: an unbalanced journal (rejected), a reversal (net zero, linked
  to the original), a posting into a closed period (rejected), a duplicate
  reference (rejected), and an opening balance that does not balance
  (rejected).
- Report totals are asserted against a fixture ledger. CF ending cash = BS
  cash is asserted.
- Posting is exposed as a contract/service token that other modules call. No
  other module writes `accounting` tables.
- The period reopen is audited (M12).

## Dependencies

- Needs: T01 (chart of accounts and opening balances from finance), T03
  (company bank accounts).
- Provides: the posting contract to M02, M05, M06, M08 and M11, reports to
  M01, M10 and M11 (distributable profit), and the period lock to every
  posting module.

## Current state vs plan (checked 2026-11-04)

| Plan item | `docs.dbml` | Code |
|---|---|---|
| COA, journals, periods, opening | `accounting.chart_of_accounts`, `journal_entries`, `journal_lines`, `accounting_periods`, `opening_balances`, `account_balances` | none |
| Cash/bank | `finance.cash_bank_accounts`, `cash_bank_transactions`, `organization.company_bank_accounts` | none |
| AR / AP | `finance.invoices`, `payments`, `receipts`, `payment_allocations`, `supplier_bills`, `credit_memos` | none (`sales.payments` exists; see M02) |
| Reconciliation | `finance.bank_reconciliations`, `bank_reconciliation_items` | none |

- Status: **planned**. This is the most important gap: the plan's whole
  sequence ends in M09, and nothing exists yet.
- `beyond-baseline`: `finance.expense_settlements`, `expense_claims`,
  `employee_advances` (employee expense workflows), `accounting.journal_templates`
  and `accounting_settings` are fine if they stay minimal. The `budgeting`
  module (including `cash_flow_plans`) is outside v5.1.
