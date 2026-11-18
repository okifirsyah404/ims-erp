# finance - ERP-0079

Schema `finance` · folder `src/app/finance` (new; replaces `accounting`) ·
URL `/finance` · phase P5

## Current

- No `finance` module folder. `accounting` (15 repositories, controllers
  ledger, payment, tax) owns `accounting.*` and, in violation, the `finance.*`
  tables through `ap-open-item`, `ar-open-item`, `bank-reconciliation`,
  `cash-bank`, `close-checklist`, `supplier-bill-item`, `supplier-bill`.
- `company.bank_accounts`, `assets.asset_depreciations`. Salary data stays
  in HR (Q39) and is not part of this module.
- Consumers: web-admin `finance-api.ts` (~20 accounting/finance routes),
  company settings bank tab.

## Target tables (Q19)

| Table | From |
|---|---|
| chart_of_accounts, accounting_periods, journal_entries, journal_lines, opening_balances, account_balances, bank_account_links, report_archives | `accounting.*` |
| supplier_bills, supplier_bill_items, ap_open_items, ar_open_items, payment_terms, cash_bank_transactions, bank_reconciliations, bank_reconciliation_items | `finance.*` (re-pointed: supplier -> supplier.companies, item -> inventory.products, invoice -> sale.invoices, customer -> customer.customers/companies) |
| cash_bank_accounts | `finance.cash_bank_accounts` + `company.bank_accounts` (adds `bank_code`, `branch_name`, `invoice_usage`, `is_primary`) |
| asset_depreciations | `assets.asset_depreciations` (`asset_id` -> `item_id`, logical -> inventory.items) |
| settings | accounting settings, close-checklist state if persisted |
| code_numberings | journal, bill, cash-bank, reconciliation codes |
| journal_templates, credit_memos, expense_claims(+items), employee_advances, expense_settlements(+items) | target only |

`journal_entries.source_module` vocabulary: `finance`, `sale`, `procurement`,
`inventory`, `payment`, `tax`, `human_resource`.

## Steps

1. **dbml** - merge accounting into finance; remove `accounting` and
   `payroll`; move tax tables to `tax` (ERP-0080).
2. **Drizzle** - `finance.schema.ts` gains the accounting tables; delete
   `accounting.schema.ts`.
3. **Repositories** - one per table (move the 15 accounting repositories,
   split those that serve two tables, e.g. `cash-bank` -> cash-bank-account +
   cash-bank-transaction, `journal` -> journal-entry + journal-line).
4. **Services** - `FinancePostingService` (single journal writer, idempotency
   key), ledger, supplier bill, cash/bank, reconciliation, period close,
   reports, `DepreciationService` (calls
   `ItemService.applyDepreciation` in inventory). Reads from other modules via
   `ExportedInvoiceService`, `ExportedPurchaseOrderService`,
   `ExportedPaymentService`, `ExportedInventoryService`,
   `ExportedEmployeeService` (approved salary records for the payroll
   journal, Q39). Publish `ExportedFinanceService`
   (repository-only: payment terms, cash/bank account assertion, bill and
   advance payables for payment allocations) and `ExportedJournalService`
   (for tax).
5. **Controllers** - `/finance/ledger/*`, `/finance/supplier-bills`,
   `/finance/cash-bank-accounts`, `/finance/reconciliations`,
   `/finance/periods`, `/finance/reports`, `/finance/depreciations`.
6. **Consumers** - `finance-api.ts` paths; company bank tab -> cash/bank accounts with invoice usage.

## Exit

Trial balance, P&L, balance sheet, cash flow and period-close tests green;
no repository outside finance imports `finance.schema.ts`.
