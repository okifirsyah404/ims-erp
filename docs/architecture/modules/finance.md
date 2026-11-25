# Finance Module (M09) - ERP-grade general ledger

> Rewritten 2026-11-25 (ERP-0126, ADR-0030). Module: `apps/backend/src/app/finance`,
> Postgres schema `finance`, routes `/finance/*`. Tables: `docs/database/docs.dbml`
> `finance.*`. Everything below marked **(A)** is Phase A, **(B)** Phase B;
> ADR-0030 was accepted by the owner on 2026-11-25.

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

## AR postings (B, ERP-0135, built)

- **Invoice issue** posts `sale.invoice_issued` through `postBusinessEvent`
  (`sale/utils/invoice-posting.ts`, pure and unit-tested):
  - DP invoice: Dr receivable / Cr customer advances 2-1300 + Cr VAT output.
  - Installment and plain invoices: revenue per line, discriminated by the
    product's category (rule `product_category` -> account); lines without a
    product use the default revenue rule. The invoice discount is allocated
    pro rata (largest remainder).
  - Settlement: the order's earlier live DP tax base is released (Dr customer
    advances) into revenue together with this invoice's base.
  - Lines with `service_period_start/end` credit deferred revenue 2-1500 and
    open a `finance.deferred_revenue_schedules` row through the
    `DEFERRED_REVENUE_PORT_TOKEN` contract.
- **Deferred revenue:** `POST /finance/deferred-revenue/run {year, month}`
  catches every due schedule up, one journal per schedule and month
  (straight-line per calendar month, last month takes the remainder),
  idempotent on `deferred:<schedule>:<YYYY-MM>`. Voiding the invoice reverses
  posted amortisations and cancels the schedule. Locking a period is refused
  while a schedule is not amortised through it.
- **Credit memo** (`finance.credit_memos`, built from the DBML target):
  drafted against an issued invoice, `apply` posts Dr sales returns 4-1900 +
  Dr VAT output / Cr receivable and lowers the open item; `void` of an applied
  memo reverses it. Deviation from grill Q56: `sale.returns` are replacements
  (their DBML note says "no credit memo"), so a credit memo is a finance
  document issued from the invoice, not created by a return. Allocating a
  credit to another invoice and refunds through `payment` are not built.
- **Write-off:** request (`ar_write_off:request`) and approve
  (`ar_write_off:approve`, not by the requester): Dr allowance 1-1390 / Cr
  receivable for the whole open amount; open item and invoice `written_off`.
- **Open item arithmetic:** adjustments lower `original_amount` and are kept
  in `adjusted_amount`, so `outstanding = original - paid` and the payment
  module's settlement math are unchanged. An issued invoice carrying a credit
  memo cannot be voided until the memo is voided.
- **Not built:** the web-admin has no line-item invoice editor (order
  invoices are single-line terms without a product), so service periods and
  per-category revenue are reachable through the API only for now.

## Inventory and purchasing postings (B, ERP-0136/0137, built)

- **Goods receipt** (procurement): stock-tracked lines post
  `procurement.goods_received` Dr inventory 1-1410 / Cr GR/IR 2-1150 at
  quantity x ex-VAT order price (the receipt cost), in the receipt's
  transaction.
- **Supplier bill** (finance): stock lines clear GR/IR at the receipt value
  stored on the line (`supplier_bill_items.grir_amount`); the difference to
  the billed tax base is purchase price variance 5-1300 (debit or credit);
  service/non-stock lines debit expense. The 3-way match (billed quantity <=
  received minus billed) already existed (ERP-0012).
- **Purchase return** (procurement, `shipped`): Dr GR/IR / Cr inventory at the
  receipt cost; `purchase_returns.journal_entry_id`. Units already billed
  keep a GR/IR debit until a supplier credit note exists (not built).
- **Delivery note** (sale, `shipped`): Dr COGS 5-1100, or project COGS 5-1200
  with `project_id` when the order has a live project / Cr inventory at the
  moving-average cost of the issue movements.
- **Sales return** (sale, `received`): Dr inventory / Cr COGS (project COGS)
  at the delivery cost; the replacement ships on a new delivery note.
- **Stock adjustment** (inventory, `posted`): gains Dr inventory / Cr
  inventory variance 5-1400, losses the reverse, at the movement cost.
- Every flow values a line as `round(quantity x unit cost)`
  (`finance/utils/inventory-value.ts`). GR/IR is posted in the receiving
  user's organization and cleared in the bill's organization; when the two
  differ the balance nets only at company level.
- **Not built:** the GR/IR-older-than-30-days close warning, asset-category
  receipts to fixed assets (ERP-0145), inventory disposals.

## Receipts and gateway settlement (B, ERP-0139, built)

- **Gap found and fixed:** a sale receipt (kuitansi, manual or from the
  payment gateway) only raised the invoice's paid total; no journal was
  written and finance's AR open item did not move, so the receivable in the
  GL was never cleared on this path. Receipts recorded before ERP-0139 stay
  without a journal (their reversal only touches sale).
- **Receipt** (`ReceiptLedgerService`, in the receipt's transaction):
  `sale.receipt_posted` Dr `cash_receipt` (posting-rule discriminator
  `payment_method`: seeded `cash` -> petty cash 1-1110, everything else ->
  1-1120) or Dr gateway clearing 1-1250 for an online payment / Cr
  receivable; the AR open item takes the payment (`applyReceipt` on the AR
  ledger port). A reversal reverses the journal and gives the amount back.
- **Outstanding math:** receipts and their reversals now move
  `outstanding_total` by the amount instead of recomputing `grand - paid`,
  which would have undone a credit memo (ERP-0135). Status comes from paid
  and outstanding (`receiptStatus`).
- **Gateway settlement** (`POST /finance/gateway-settlements`,
  `cash_bank:create`, dialog on `/finance/cash-bank`): a cash/bank movement
  for the net payout against gateway clearing (visible to bank
  reconciliation) plus `payment.gateway_settled` Dr gateway fees 6-3200 / Cr
  gateway clearing. The clearing balance (general ledger of 1-1250) is what
  still awaits settlement.
- **Not built:** importing the provider's settlement report and matching it
  line by line (reconciliation of clearing is manual through the GL report);
  refunds.

## Project postings (B, ERP-0141, built)

- `sale.invoices.project_id` (logical reference) is stamped at issue from
  the order's live project (`PROJECT_LOOKUP_SERVICE_TOKEN`); the revenue,
  deferred-revenue and customer-advance lines carry `project_id`, so project
  profitability reads the GL without joining sale.
- **Manual project costs** (`project.costs`) post `project.cost_recorded` in
  the cost's transaction: Dr project COGS 5-1200 (posting-rule discriminator
  `cost_category` = the cost category) / Cr claims payable 2-1200 when an
  employee paid (`payment_source = employee_claim`) or Cr `cash_payment`
  (discriminator `payment_method`: petty cash -> 1-1110, bank -> 1-1120).
  The journal id is kept on `project.costs.journal_entry_id`; voiding the
  cost reverses it. `reference` lets the UI warn about a duplicate entry.
  `project` joined the journal `source_module` vocabulary.
- Costs recorded before ERP-0141 have no journal; their void touches only the
  project.

## Tax postings (B, ERP-0140, built)

- **PPh withheld at supplier payment.** A disbursement may carry
  `withholding {taxId, amount, taxObjectCode}` (PPh tax types only, amount
  below the payment). Execution settles the AP open item in full and posts
  `payment.withholding_recorded`: Dr AP / Cr `wht_payable` (posting-rule
  discriminator `tax` = tax code: PPH23 -> 2-1430, PPH4_2 -> 2-1440); the
  bank moves only the net. The tax module records the withholding
  (`source_module = payment`, `source_id`) in the same transaction through
  `EXPORTED_TAX_SERVICE_TOKEN`. Voiding the payment returns the net cash,
  reverses the withholding entry and reverses the withholding record.
- **PPN period close** (`POST /finance/tax/ppn-settlements`): that month's GL
  activity on `vat_output` / `vat_input` moves out: Dr PPN output / Cr PPN
  input / Cr Utang PPN 2-1460 (or Dr PPN Lebih Bayar 1-1830), dated the
  period's last day, idempotency key `ppn_settlement:YYYY-MM`. A repeat call
  returns the posted journal. PPN booked after settlement needs a reversal and
  a fresh settlement.
- **Tax payment** (`POST /finance/tax/payments`): a cash/bank movement out
  against the liability its role resolves (`vat_payable`, `wht_payable` by tax
  code, `pph21_payable`, `pph25_payable`); reference = billing code / NTPN.
- **Coretax XML** (`GET /taxes/coretax/faktur.xml`, `bupot.xml`): built from
  issued VAT invoices (TrxCode 04, DPP nilai lain 11/12, 12%) and the
  period's withholdings. The layout follows the DJP import template as
  understood and is **unverified until a test import into Coretax
  succeeds**. Withholdings carry `tax_object_code`, `withholding_slip_number`,
  `counterparty_tax_id`, `coretax_status` (not_exported / exported /
  uploaded). BP21 export moves to ERP-0138 with payroll.
- No disbursement creation form exists in web-admin yet, so withholding at
  payment is API-only.

## Payroll statutory tables (B, ERP-0138 part 1, built)

- `tax.pph21_ptkp`, `tax.pph21_ter_rates`, `tax.pph21_brackets`: global
  statutory reference data (no `organization_id`), effective-dated by row
  set; the set in force on a date has the latest `effective_from` on or before
  it. A rate applies from its `lower_bound` up to the next row's.
- Seeded: PTKP per status (PMK 101/2016) with the PP 58/2023 TER category
  (from 2024-01-01) and Pasal 17 UU HPP brackets (from 2022-01-01). **TER rates
  are never seeded or invented**: finance imports the official table as CSV
  (`POST /taxes/pph21/ter-rates/import`, all or nothing, each category must
  start at 0, an import replaces the rows of each effective date it carries).
- `tax/utils/pph21.ts` is the engine: TER lookup, `applyRate` (exact integer
  percentage, rounded down to whole rupiah), Pasal 17 `progressiveTax`, and
  `annualPph21` (biaya jabatan 5% capped at Rp500.000 a month, employee
  pension contribution capped at Rp200.000 a month, PKP rounded down to
  thousands). Payroll reads the tables through `ExportedTaxService.pph21Tables`.
- Employees gain optional `tax_id` (NPWP, masked like the NIK without
  `employee:read_private`), `ptkp_status` (NULL counts as TK/0) and BPJS
  participant numbers. Company-wide toggles in `human_resource.settings`
  (`/human-resources/payroll-settings/statutory`, application admins):
  `pph21_enabled`, `bpjs_health_enabled`, `bpjs_employment_enabled`, the JKK
  rate (default 0.24%), the BPJS Kesehatan wage cap (default Rp12.000.000)
  and the JP wage cap (no default: BPJS announces it yearly).

## Payroll calculation, journal and BP21 (B, ERP-0138 part 2, built)

- The salary period stays the payroll run (no `payroll_runs` table): every
  draft write (save, generate, import) and the explicit
  `POST /human-resources/salary-records/recalculate` (`payroll:calculate`)
  compute PPh 21 and BPJS when switched on; approval recalculates the drafts
  with the tables in force, locks them and posts the journal in one
  transaction.
- BPJS on the wage (base + fixed allowances): Kesehatan 4% / 1% up to its
  cap, JHT 3.7% / 2%, JP 2% / 1% up to the JP cap (refused while the cap is
  empty), JKK at the configured rate and JKM 0.3%. The TER base adds JKK, JKM
  and the company Kesehatan share to the pay.
- PPh 21: TER on the TER base, refused while no TER table is in force; in
  the last tax month (December or the month employment ends) the annual
  Pasal 17 tax less the year's earlier withholding, which may be negative.
  Missing PTKP status counts as TK/0. No 20% surcharge for employees without
  NPWP (the NIK serves as NPWP).
- `employee_salary_records` keeps `pph21_amount`, `bpjs_employee_amount`,
  `bpjs_company_amount`, `pension_employee_amount`, `taxable_gross`,
  `ptkp_status`, `ter_rate`, `tax_method`, `journal_entry_id`; net pay is
  pay - deductions - PPh 21 - employee BPJS (database check).
- Journal (`payroll.approved`, through `PayrollLedgerService`, not the
  repository-only `ExportedFinanceService`): Dr 6-1100 pay, Dr 6-1200 company
  BPJS / Cr 2-1600 net, Cr 2-1420 PPh 21 (Dr on a refund), Cr 2-1700 both
  BPJS shares, Cr 1-1320 Piutang Karyawan for other deductions (new role
  `employee_receivable`). One journal per approval, posted to the approving
  organization's ledger.
- Payment: `POST /finance/payroll/payments` (`payroll_payment:execute`)
  pays `salary_payable` or `bpjs_payable` from cash/bank (`payroll.paid`);
  the cash/bank page has a "Pay salaries / BPJS" dialog. Salary records are
  not marked paid individually.
- BP21: `GET /human-resources/salary-records/bp21.xml` (`payroll:export`),
  `MmPayrollBulk` built by the tax module from approved TER months. Refused
  when an employee has neither NIK nor NPWP, and for the last tax month
  (the annual slip is not built). Format unverified until a test import.

## Sub-ledger opening balances (B, ERP-0142, AR and AP built)

- `finance.opening_subledger_items` holds the open customer invoices (`ar`)
  and supplier bills (`ap`) at cutover, imported per ledger as CSV
  (`/finance/ledger/opening-balances/subledger/import`, all or nothing,
  parties resolved by code through `ExportedCustomerService.findCustomerByCode`
  and `ExportedSupplierService.findCompanyByCode`; an import replaces the
  unposted rows of its ledger and is refused once the ledger has posted
  detail).
- Posting the opening batch (`POST /finance/ledger/opening-balances/post`) is
  refused while a ledger's draft total differs from the draft opening row of
  its control account (rules `receivable` / `payable`, `'*'` event), whenever
  either side is non-zero, and while detail rows carry another as-of date.
- In the opening-journal transaction AR rows become `ar_open_items` without
  an invoice; AP rows become approved supplier bills (no purchase order) with
  `ap_open_items`, payable by the normal supplier payment flow. Neither posts
  a journal: the opening journal carries the control-account amounts.
- Not covered: stock (no inventory valuation contract yet) and fixed assets
  (register is Phase C). An opening AR item has no invoice, so collecting it
  through a receipt is not wired yet.

## Phase B-D decisions (recorded, not built)

- **AR (rest):** `sale.invoices` gains `project_id` (ERP-0141); service
  periods filled from `project.license_contracts` need a line-item invoice UI.
  Installation projects: DP = advance, further termin invoices are revenue
  (milestone), settlement deducts the DP (built in ERP-0135).
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
  AR and AP built in ERP-0142 (see below); stock and assets still open.

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
