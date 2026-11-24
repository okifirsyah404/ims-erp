# Finance Module (M09) - ERP-grade general ledger

> Rewritten 2026-11-25 (ERP-0126, ADR-0030). Module: `apps/backend/src/app/finance`,
> Postgres schema `finance`, routes `/finance/*`. Tables: `docs/database/docs.dbml`
> `finance.*`. Everything below marked **(A)** is Phase A; B-D are planned and
> outside the v5.1 baseline until the owner records ADR-0030.

## Purpose and boundary

The general ledger is the **single source of truth** for money. Every
financial event of the ERP ends as a balanced journal written by this module's
posting service. Other modules never write finance tables: they call the
posting contract inside their own transaction (D9), so a business document and
its journal commit or roll back together.

Ownership (unchanged by ADR-0030, see `docs/database/module-ownership.md`):

| Area | Owner | Finance role |
|---|---|---|
| Invoices, receipts, returns, delivery notes | `sale` | AR open items + GL |
| Supplier bills, AP open items | `finance` | owner |
| All third-party money movement (customer, supplier, employee) | `payment` | GL through `LedgerSettlementPort` |
| Non-payment cash/bank movement (transfers, fees, interest, capital) | `finance` | `cash_bank_transactions` |
| Tax rates, recaps, withholding, Coretax XML, PPh 21 reference tables | `tax` | GL through posting events |
| Payroll runs, PPh 21 and BPJS calculation | `human_resource` | GL through posting events |
| Fixed-asset register, depreciation, budgets, cost centres | `finance` | owner |
| Physical items, stock, moving-average cost | `inventory` | GL through posting events |

## Architecture principles

1. Every journal balances (service guard + `total_debit = total_credit` check).
2. Operational modules never write ledger tables.
3. Posting is a synchronous application-service call in the caller's
   transaction; idempotency key `(source_module, source_type, source_id, event)`.
4. Posted journals are immutable: corrections are reversals or adjustments.
5. Audit trail on every finance state change; maker-checker on manual journals.

## Posting contract (A)

- `PostingService.post(tx, input)` - explicit accounts (manual journals,
  reversals, legacy callers).
- `PostingService.postBusinessEvent(tx, input)` - **the** contract for source
  modules. Input: `eventType` (e.g. `sale.invoice_issued`), entry date,
  source, idempotency key, and lines that carry a **role** (`receivable`,
  `revenue`, `vat_output`, ...) plus an optional discriminator
  (`product_category`, `tax`, `cash_bank_account`, `expense_category`,
  `asset_category`, `cost_category`). Finance resolves the account through
  `finance.posting_rules`:
  1. `(event_type, role, discriminator)`
  2. `(event_type, role)`
  3. `('*', role, discriminator)`
  4. `('*', role)`
  A missing rule throws `PostingRuleNotFoundError` (422) and the source
  document fails. The journal stores `event_type` for traceability.
- `ArAccountResolverService` (legacy seam used by sale invoices, supplier
  bills, expense claims and payment settlement) now resolves through the same
  rules; the hard-coded `AR_POSTING_DEFAULT_CODES` became seeded rules.

Seeded roles (A): `receivable` 1-1310, `revenue` 4-1100, `vat_output` 2-1410,
`payable` 2-1100, `expense` 6-2900, `vat_input` 1-1810, `inventory` 1-1410,
`claim_payable` 2-1200. Codes are `X-XXXX`, hierarchical; see
`apps/backend/database/seeders/seed/chart-of-accounts.seeder.ts`.

## Posting map (all phases)

| Source | Event | Journal | Phase |
|---|---|---|---|
| Sale | DP invoice issued | Dr Receivable / Cr Customer advances 2-1300 + Cr VAT output | B |
| Sale | Invoice issued (termin, goods, software, installation) | Dr Receivable / Cr Revenue (per product category) + Cr VAT output; lines with a service period -> Cr Deferred revenue 2-1500 | B |
| Sale | Settlement invoice | Dr Customer advances / Cr Receivable for the DP part | B |
| Sale | Deferred revenue amortisation (monthly) | Dr Deferred revenue / Cr Revenue | B |
| Sale | Return approved -> credit memo | Dr Sales returns + Dr VAT output / Cr Receivable; Dr Inventory / Cr COGS at original cost | B |
| Sale | Write-off (approved) | Dr Allowance 1-1390 / Cr Receivable; open item `written_off` | B |
| Payment | Customer payment executed | Dr Cash/Bank / Cr Receivable | built |
| Payment | Gateway callback | Dr Gateway clearing 1-1250 / Cr Receivable | B |
| Payment | Gateway settlement | Dr Bank (net) + Dr Gateway fees / Cr Gateway clearing | B |
| Procurement | Goods receipt (stock line) | Dr Inventory / Cr GR/IR 2-1150 (qty x PO price) | B |
| Procurement | Goods receipt (fixed-asset category) | Dr Fixed asset / Cr GR/IR; draft `fixed_assets` row | B/C |
| Finance | Supplier bill recorded | Dr GR/IR (stock) or Dr Expense/Asset (service, non-stock) + Dr VAT input / Cr Payable; price variance -> Purchase price variance | B |
| Procurement | Purchase return | Dr GR/IR (unbilled) or Dr Payable (debit note) / Cr Inventory | B |
| Inventory | Delivery note shipped | Dr COGS (or Project COGS with `project_id`) / Cr Inventory at moving average | B |
| Inventory | Stock adjustment posted | Dr/Cr Inventory vs Inventory variance | B |
| HR | Payroll run approved | Dr Salary + Dr BPJS expense / Cr Salaries payable + PPh 21 payable + BPJS payable | B |
| Payment | Salary paid | Dr Salaries payable / Cr Bank | B |
| Finance | Expense claim approved | Dr Expense (per category) + Dr VAT input / Cr Claims payable | built |
| Finance | Employee advance / settlement | Dr Employee receivable / Cr Cash; settlement clears it | C |
| Project | Manual project cost | Dr Project COGS (per category) / Cr Claims payable or Cash | B |
| Finance | Depreciation run (monthly) | Dr Depreciation expense / Cr Accumulated depreciation | C |
| Finance | Asset disposal | Remove cost + accumulated depreciation, gain/loss | C |
| Tax | Tax payment | Dr Tax payable / Cr Bank | B |
| Finance | Year-end close | Revenue/expense to Retained earnings | A+ (ERP-0131) |

## Journals, periods and reversals (A)

- **Manual journal lifecycle:** `draft -> submitted -> approved` where approve
  also posts (number assigned at posting, `JE` series). `reject` returns a
  submitted entry to `draft`; `void` discards a draft. Approver must differ
  from the preparer (maker-checker); `journal:approve` (accountant, owner).
  Drafts and submitted entries carry no number and never reach reports.
- **System journals** from source modules post directly (`posted`): their
  documents were approved in the source module.
- **Ledger statuses:** reports sum `posted` **and** `reversed` entries (a
  reversed original plus its mirror nets to zero). Before 2026-11-25 the
  queries summed `posted` only, so a reversal *negated* the original instead
  of cancelling it - fixed in Phase A.
- **Reversal date:** original period open -> the original date or a later
  date chosen by the user inside an open period; original period closed or
  locked -> the first day of the next open period. A reason is mandatory and
  is stored as the reversal's description and in the audit log.
  `reverses_entry_id` links the mirror back to the original.
- **Periods:** `open` accepts everything; `closed` (soft close, balance
  snapshot taken) accepts only manual journals flagged `is_adjusting`;
  `locked` accepts nothing. Locking requires a clean gate: no draft/submitted
  journals in the period (A); depreciation, deferred-revenue amortisation,
  reconciliations and tax recap `verified` join the gate in B/C. GR/IR older
  than 30 days only warns. Reopen is audited.

## Chart of accounts (A)

- Format `X-XXXX`, header accounts per group, postable leaves. Groups:
  1 Assets (incl. receivables 1-1310/1-1320/1-1330/1-1390, inventory, VAT
  input, prepaid, fixed assets + accumulated depreciation), 2 Liabilities
  (AP, GR/IR, claims payable, customer advances, VAT output, PPh 21/23/4(2),
  salaries, BPJS, deferred revenue), 3 Equity (capital, retained earnings,
  current-year profit), 4 Revenue (goods, software, installation,
  maintenance/subscription, services, returns), 5 COGS (goods, project,
  purchase price variance, inventory variance), 6 Operating expenses,
  7 Other income, 8 Other expenses.
- **Locking (Q55):** once an account has journal lines its type, normal
  balance and postable flag are frozen (type/normal balance were already
  immutable). An account can be deactivated only with a zero balance and when
  no active posting rule points at it. System accounts are never archived.

## Cost centres (A)

`finance.cost_centers` (code, name, parent, active). `journal_lines.cost_center_id`
became a real intra-schema FK; the posting service rejects unknown or
inactive cost centres. `journal_lines.product_id` is a logical reference to
`product.products.id`, filled only by source modules that validated it (B).

## Reports

- (A) Trial balance (`GET /finance/reports/trial-balance?asOf=`): opening +
  period movement + closing per account, totals must tie.
- (A) General ledger (`GET /finance/reports/general-ledger?accountId=&from=&to=`):
  opening balance, every posted line with running balance.
- Existing: P&L, balance sheet, cash flow (category mapping), AR/AP aging.
- (D) Direct-method cash flow as the primary statement (indirect as a
  reconciliation view), statement of changes in equity, comparatives,
  13-week forecast, profitability by project/customer/product/business line,
  ratios (current, quick, cash, GPM, NPM, ROA, ROE, DER, DSO, DPO, DIO),
  budget vs actual and the monthly management pack (PDF/Excel).

## Phase B-D decisions (recorded, not built)

- **AR:** sale owns invoices; finance owns `ar_open_items`; `sale.invoices`
  gains `project_id`; invoice lines gain `service_period_start/end` (from
  `project.license_contracts`). Installation projects: DP = advance,
  further termin invoices are revenue (milestone), settlement deducts the DP.
- **AP:** GR/IR; bills over received quantity are blocked (3-way match);
  price variance always allowed. `purchase_returns.journal_entry_id`.
- **Payroll:** `human_resource.payroll_runs` (`draft -> calculated ->
  reviewed -> approved -> paid`, adjustment runs after approval), salary
  record components, optional NIK/NPWP, PTKP, BPJS numbers on employees,
  organization toggles `payroll.pph21_enabled`, `payroll.bpjs_*_enabled`.
  Missing PTKP counts as TK/0; missing NIK/NPWP warns and blocks the BP21 export.
- **Tax:** TER, PTKP and Pasal 17 tables (effective-dated) in `tax`;
  withholding records gain tax object code, slip number, counterparty NPWP,
  source and Coretax status; PPN 12% with DPP nilai lain 11/12.
- **Fixed assets (C):** `fixed_assets` + `asset_categories` (commercial
  book in the GL, fiscal group for the fiscal-depreciation report),
  straight-line and declining balance, created from goods receipts of
  asset-flagged product categories.
- **Budgets (C):** project x account x month, versioned, actual (posted GL
  lines with `project_id`) + commitment (approved, unbilled PO), checked on PO
  approval, expense-claim submit and project-cost entry; default `warn`.
- **Bank reconciliation (C):** CSV statement import per bank mapping
  (`bank_statements`, `bank_statement_lines`), auto-match on amount, +-3 days
  and reference, unmatched lines become cash/bank transactions.
- **Opening balances (B):** per sub-ledger import (AR, AP, stock, assets)
  that must tie to the control accounts, posted as one opening journal.

## Permissions

Existing resources plus (A) `posting_rule: read, update` and
`cost_center: read, create, update, archive` - accountant full, finance and
auditor read, owner full (blanket). Owner already holds `journal:approve`,
so a one-accountant organization can still pass maker-checker.

## Tests

Unit tests under `apps/backend/test/finance/` and `test/accounting/`
(posting balance, idempotency, reversal, period rules, posting-rule
resolution, maker-checker, CoA locking, trial balance tie-out). Database
proof: migrate + seed twice on a local database (`progress.md`).
