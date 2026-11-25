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

## Bank statement import and auto-match (C, ERP-0143, built)

- No `bank_statements` / `bank_statement_lines` tables: a
  `bank_reconciliations` row is one statement and its
  `bank_reconciliation_items` are the lines, now with `statement_date`,
  `description`, `direction` and `match_method` (auto / manual / created).
  Two parallel structures for the same statement would have drifted.
- Each cash/bank account stores its bank's CSV layout in `statement_mapping`
  (`PUT /finance/cash-bank-accounts/:id/statement-mapping`): delimiter, rows
  to skip, date column and format (incl. `DD/MM` taking the statement's year),
  description and reference columns, amount as signed / debit+credit /
  amount+DB/CR, decimal separator.
- `POST /finance/reconciliations/:id/statement` imports a CSV (all or nothing;
  rows without a date are skipped, a dated row with an unreadable amount
  rejects the file; lines already present by date, direction, amount and text
  are skipped). `POST .../auto-match` pairs lines with unmatched posted
  movements of the account: same direction and amount, +-3 days, a book code
  or reference number in the line text wins, then the nearest date; a tie
  without reference stays for manual matching; each movement is used once.
  `POST .../items/:itemId/transaction` books an unmatched line (bank fee,
  interest) as a cash/bank movement against a chosen account and matches it.
- The reconcile check changed: lines are movements, so the statement balance
  must equal the book balance on the statement date (recomputed at reconcile)
  with every line matched. The old rule (matched lines sum to the statement
  balance) treated lines as balances.
- `GET /finance/reconciliations/:id` now returns the lines; the page shows
  them from the server instead of the current session only.

## Employee advances, settlements and employee payments (C, ERP-0144, built)

- `finance.employee_advances`, `expense_settlements`,
  `expense_settlement_items` (previously `status: target`) are built.
  Advance: draft -> submitted -> approved (not by the requester) ->
  disbursed -> settled, or cancelled before disbursement. Settlement of a
  disbursed advance: draft -> submitted -> verified -> approved, each step by
  a different user than the previous one; one open settlement per advance.
  Only `settlement_type = advance` is created; plain reimbursements stay
  expense claims.
- Settlement approval (`finance.advance_settled`): Dr each expense account
  (the advance's project on every expense line) and PPN input / Cr Uang Muka
  Karyawan 1-1340 (new account and role `employee_advance`, party employee)
  up to the advance's open balance / Cr claims payable 2-1200 for the rest
  (`payable_amount`).
- Payments to and from employees go through `payment`
  (`counterparty_type = employee`): disbursement allocations
  `employee_advance` (approved advance, full amount; Dr 1-1340),
  `expense_claim` (approved claim, full amount; Dr 2-1200; claim -> paid) and
  `expense_settlement` (unpaid payable; Dr 2-1200; settlement -> paid);
  a receipt allocated to a disbursed advance takes back cash the employee
  returns (Cr 1-1340; advance settled when fully accounted for). One payment
  settles one kind of counterpart (`payment.allocationMixed`).
- Voiding an executed employee payment is refused
  (`accounting.employeePaymentVoid`): there is no rollback of the advance,
  claim or settlement state yet.
- `GET /payments` gained a `counterpartyType` filter; the web payment tables
  now send real filters (they sent `customer_payment` / `supplier_payment`,
  which the API rejects - a pre-existing bug).

## Fixed assets in the general ledger (C, ERP-0145, built)

- The physical unit stays `inventory.items` (ADR-0024 Q15: cost, salvage,
  useful life, method, book value). Finance adds `finance.fixed_asset_books`,
  one per capitalized item: fiscal group, capitalization and disposal
  journals, status active/disposed. No second asset master.
- Capitalization (`POST /finance/fixed-assets/:itemId/capitalize`): Dr fixed
  asset / Cr the account the cost sits in (GR/IR, inventory, payables, cash or
  opening equity). Fixed-asset and accumulated-depreciation accounts follow
  the item kind (new posting-rule discriminator `item_kind`: vehicle
  1-2120/1-2220, it and furniture 1-2130/1-2230, intangible 1-2310/1-2390,
  others 1-2110/1-2210).
- Monthly run (`POST /finance/fixed-assets/depreciation-runs`): every
  active book from its start month, straight line ((cost - salvage) / life)
  or double declining (2 / life on the book value), never below salvage, the
  last month takes the rest; the valuation moves through
  `ItemService.applyDepreciation`; one journal per run (Dr 6-2500 / Cr
  accumulated by kind), stamped on each `asset_depreciations` row; items
  already depreciated for the month are skipped.
- Disposal: inventory's disposal execution calls `FixedAssetService.postDisposal`
  in its transaction: Dr accumulated, Dr Piutang Lain-lain 1-1330 (proceeds),
  Dr loss 8-2000 / Cr fixed asset, Cr gain 7-2000; the book closes. A
  posting failure rolls the disposal back. Uncapitalized items post nothing.
- Fiscal report (`GET /finance/fixed-assets/fiscal-report?year=`): UU PPh
  Pasal 11 groups (kelompok 1-4, buildings), from the acquisition month,
  declining balance expensing the rest in the last year, buildings straight
  line only; the difference to the commercial depreciation is the fiscal
  correction.
- Not built: capitalization from goods receipts of asset categories, stock
  and asset opening detail, collecting disposal proceeds (a manual cash
  movement against 1-1330).

## Project budgets (C, ERP-0146, built)

- `finance.project_budgets` (versions: draft -> active -> superseded, one
  active per project, `control_mode` warn/block) and
  `finance.project_budget_lines` (account x month x amount).
  `/finance/project-budgets*`: versions, draft lines, activation, mode,
  report; reading `project:read`, maintaining `journal:approve`.
- Actual = posted journal movement of expense accounts tagged with the
  project (debit - credit). Commitment = approved / sent / received purchase
  orders of the project (new nullable `procurement.purchase_orders.project_id`,
  read through the repository-only `ExportedPurchaseOrderService`) less
  finance's non-draft, non-void bills on those orders.
- Checked against the active version's total at purchase-order approval
  (the order itself excluded from commitment), expense-claim submission (new
  nullable `finance.expense_claims.project_id`; approval now tags the expense
  lines with the project) and project-cost entry. `block` refuses
  (`accounting.budgetExceeded`), `warn` lets it through and the report shows
  the overrun.
- Projects are company-wide (no tenant column): a project has at most one
  active budget across organizations, and the owning organization's ledger
  and bills are the ones counted.
- Not built: per-account or per-month blocking (the check is the project
  total), warnings surfaced in the forms (the report and
  `GET /finance/project-budgets/check` show them).

## Cost accounting reports (C, ERP-0147, built)

- `GET /finance/reports/project-costing?from&to` (revenue, cost, margin,
  margin %, active budget per project with ledger movement),
  `/project-costing/:projectId` (per account) and `/cost-center-pl` (revenue,
  cost, result per cost centre, lines without one as "unassigned"), all
  `financial_report:read`, over posted (and reversed) journal lines by their
  `project_id` / `cost_center_id`. Reports page tabs "Project costing" and
  "Cost centres".
- Fixed with it (pre-existing since ERP-0133): the P&L and balance sheet
  signed each account by its own normal balance, so contra accounts were
  added to their section (sales returns raised revenue, accumulated
  depreciation raised assets). They now sign by the account type's natural
  side and contra accounts show negative; the general-ledger detail keeps
  each account's own normal-side running balance. Found because the
  cost-centre totals did not tie to the P&L.

## Statements: direct and indirect cash flow, changes in equity (D, ERP-0148, built)

- `GET /finance/reports/statements?from&to&compare=none|previous_period|previous_year`
  (`financial_report:read`); reports page tab "Cash flow & equity".
- Direct method (primary): the non-cash lines of every posted entry that
  touches a cash account (postable 1-11xx Kas dan Setara Kas, or a GL account
  linked to a cash/bank account), netted per counterpart account; in a
  balanced entry their credit - debit is exactly the cash moved, so
  cash-to-cash transfers vanish. Category: the account's cash-flow category;
  P&L and uncategorised accounts are operating, equity defaults to
  financing. Closing cash is tied to the balance-sheet cash
  (`tieDifference`, zero when tied).
- Indirect view: net income + non-cash adjustments (contra assets, i.e.
  accumulated depreciation) + working-capital changes + investing and
  financing balance movements; equals the direct total by double entry.
- Changes in equity per equity account (opening, increases, decreases,
  closing) plus earlier results not yet closed and the period result; the
  closing ties to the balance-sheet equity.
- Comparatives: whole calendar months step back by the same number of
  months, other ranges by the same number of days; or the same range a year
  earlier.
- Known issue kept: the ERP-0133 `GET /finance/reports/cash-flow` (tab "Cash
  flow") treats every counterpart movement as cash, so non-cash entries such
  as an invoice show as inflow. The new statement is the correct one; the old
  endpoint should be retired or rebuilt on it.

## 13-week cash forecast (D, ERP-0149, built)

- `GET /finance/reports/cash-forecast` (`financial_report:read`), manual
  lines `GET|POST /cash-forecast/lines`, `DELETE /cash-forecast/lines/:id`
  (`cash_bank:create`, `finance.cash_forecast_lines`); reports page tab
  "Cash forecast".
- From today: opening cash = ledger balance of the statement cash accounts;
  13 weekly buckets of open AR and AP on their due dates (overdue or undated
  in week 1), payroll at the latest approved month's run-rate (net pay on the
  payday, month end when none is set; PPh 21 and BPJS on the 10th of the next
  month) through HR's repository-only `ExportedPayrollService`, and manual
  lines. Licence contracts ending in the horizon are listed through
  `ProjectLookupService.renewalsDue`; contracts carry no amount, so finance
  adds the expected receipt as a manual line.
- Not built: collection-pattern or probability adjustments, sales pipeline,
  recurring manual lines.

## Profitability (D, ERP-0150, built)

- `GET /finance/reports/profitability?from&to&dimension=project|customer|product|business_line`
  (`financial_report:read`); reports page tab "Profitability".
- Built on journal-line dimensions: `project_id`, `product_id`, and the
  customer party. Invoice revenue and deferred-revenue lines now carry the
  customer party (they already carried the product) and delivery COGS lines
  carry the customer. Business line = product category (names through
  `ExportedProductService.categoryNames`). Lines without the dimension
  (overheads, entries posted before the dimension existed) form the
  unattributed row, so every view totals the P&L.
- Not built: overhead allocation keys; deferred-revenue recognition entries
  do not carry party/product yet.

## Financial ratios (D, ERP-0151, built)

- `GET /finance/reports/ratios?from&to` (`financial_report:read`); reports
  page tab "Ratios". Current, quick, cash; gross and net margin, ROA, ROE;
  debt to equity; DSO, DPO, DIO (days over the range).
- Balance-sheet figures at the end date (contra accounts against their
  section), P&L over the range. Current = 1-1xxx assets / 2-1xxx
  liabilities; cash = statement cash accounts; receivables, payables and
  inventory = the `'*'` posting-rule accounts of those roles; cost of goods =
  5-xxxx expense accounts. ROA and ROE use closing balances, not averages.
  `null` when a denominator is zero.

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
  asset-flagged product categories. Built in ERP-0145 as a finance book over
  `inventory.items` instead of a second register (see below); creation from
  goods receipts is not built.
- **Budgets (C):** project x account x month, versioned, actual (posted GL
  lines with `project_id`) + commitment (approved, unbilled PO), checked on PO
  approval, expense-claim submit and project-cost entry; default `warn`.
- **Bank reconciliation (C):** CSV statement import per bank mapping
  (`bank_statements`, `bank_statement_lines`), auto-match on amount, +-3 days
  and reference, unmatched lines become cash/bank transactions. Built in
  ERP-0143 on the existing reconciliation tables instead (see below).
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
