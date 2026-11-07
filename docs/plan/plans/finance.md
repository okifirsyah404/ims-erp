# Finance Module Plan — M09 Stage 1 (ERP backlog)

> Status: approved plan (sharpened through a grilling session, rounds 1–3).
> Scope: Stage 1 of baseline M09 — the bookkeeping core: COA, posting
> engine, opening balances, cash/bank, AR/AP, reconciliation, financial
> statements, month-end close. Stage 2 (payroll/gateway postings, fee
> reconciliation) is out of scope.
> Baseline: `docs/plan/erp-module-plans/m09-finance.md`.
> Affected apps: backend (Elysia, domains `accounting` + new `finance` +
> `sales` invoice flow) + `apps/web-admin` + `docs/database/docs.dbml`
> + `packages/common` (authorization) + `packages/locales`.

## Implementation Status

Honest record. Nothing shipped yet.

| Phase | State | Commit | Delivered |
|---|---|---|---|
| F1 | done | — | DBML updated (invoices → `sales.*`, sub-ledger open items, `cash_flow_category`, `idempotency_key`/`source_module` on `journal_entries`, deferred tables annotated), validator `OK`; `finance.schema.ts` (11 tables), `accounting.schema.ts` ledger slice (7 tables), `sales.invoices`/`sales.invoice_items`; migration `20261106221731_m09_finance_stage1` generated, applied to a disposable DB, and CHECK invariants spot-tested (balanced-entry, one-side line, payment direction, open-item consistency all enforced) |
| F2 | done | — | Ledger domain: `posting.service` (balanced-entry + one-side + COA resolution + period lock + idempotency + append-only reversal, caller-tx contract per D9), `account.service` (COA CRUD + archive), `period.service` (open → closed with balance snapshot per D7 → locked, audited reopen), `ledger.repository`, `ledger.controller` (`/accounts`, `/periods`, `/journal` with `chart_of_account`/`accounting_period`/`journal` permission guards), 17 new locale keys (en + id), 15 unit tests on the posting rules; 651 tests pass, typecheck + lint clean |
| F3 | done | — | Opening balances (batch draft + one-shot post as ONE JE, `opening-balance.service`) + cash/bank (`cash-bank.service`: account CRUD, GL link upsert, manual movements with auto-journal DR/CR via `post()`, running `balance_after`, insufficient-funds guard, GL link required at posting per F3 Q4); 11 new routes under `/opening-balances` + `/cash-bank/*` (`journal:*` and `cash_bank:*` permission reuse per Q5); 8 locale keys (en + id); 6 unit tests (balanced batch, unbalanced reject, posted-row immutability, cash-in journal shape, link-required, insufficient funds); 657 tests pass, typecheck + lint clean |
| F3 | done | — | (consolidated above) |
| F4 | done | — | Invoices & AR: `invoice.service` (sales module: draft CRUD with server-side totals, `INV-<YYYYMM>-<#5>` codes, issue = one tx stamping issued + JE DR AR / CR revenue / CR tax payable via `post()` + `ar_open_items` row, idempotent `invoice:<id>`); `payment.service` (D5 workflow draft→submitted→approved→executed + pre-execution void, allocations Σ=amount, execute updates `ar_open_items` + `sales.invoices` mirrors then routes money through tx-aware `postMovement` (decision 2a) with `sourceType: 'payment'`); `ArAccountResolverService` (decision 1c provisional codes `1-1300`/`4-1000`/`2-1000`, settings-seam ready); AR aging on-demand (`/ar/aging`, buckets current/1-30/31-60/61-90/90+ from the sub-ledger per D7); 14 routes (`/invoices*` with `invoice:read/create/update/issue`, `/payments*` with `payment:read/create/submit/approve/execute`); 12 error keys (en+id); 11 unit tests (issue journal shape incl. 3-line tax case, idempotency, AR-row creation, no-items/non-draft/AR-not-configured rejects, full & partial settlement across both mirrors, Σ-mismatch, over-allocation, non-issued target, invalid transitions, void semantics, inactive-cash refusal); 668 tests pass, typecheck + lint clean. Void-executed deferred to F7 (decision 4a) |
| F5 | done | — | AP: `supplier-bill.service` (draft `SB-<YYYYMM>-<#5>` → record = one tx stamping approved + JE DR expense / DR input tax / CR AP via `post()` + `ap_open_items` row, idempotent `supplier-bill:<id>`); `payment.service` generalized to `supplier_payment` (direction `out`, `supplier_bill` allocations validated against approved/partially_paid bills with outstanding room; execute updates `ap_open_items` + `finance.supplier_bills` mirrors and posts cash-out DR AP / CR cash through tx-aware `postMovement`); AP resolver roles `2-1100`/`5-1000`/`1-1800` (decision 1c); AP aging on-demand (`/ap/aging` per D7); 6 routes (`/bills*` with `bill:read/create/record`, `/ap/aging`); 2 error keys (en+id); 7 unit tests (bill journal shape incl. 3-line tax case, double-record/cancel-recorded rejects, supplier payment full & partial settlement across both mirrors with cash-out journal, unrecorded-target & over-allocation rejects, inactive-cash refusal); 675 tests pass, typecheck + lint clean |
| F6 | planned | — | — |
| F7 | planned | — | — |
| F8 | planned | — | — |
| F9 | planned | — | — |

## Grilling outcome — locked decisions

| # | Decision |
|---|---|
| D1 | Scope = Stage 1 full. The posting service contract is designed from day one so Stage 2 (payroll, gateway) and other modules only ever call it — no payroll/gateway implementation now. |
| D2 | **Invoices belong to Sales.** Tables move from `finance.invoices`/`finance.invoice_items` (DBML lines 3727–3802) to `sales.invoices`/`sales.invoice_items` (DBML + `sales.schema.ts`). Finance owns no invoice table. |
| D3 | AR/AP tracked via a **sub-ledger mirror** in finance (`finance.ar_open_items`, `finance.ap_open_items` — new tables, to be added to docs.dbml), updated through the posting flow. Not computed from journal lines alone. |
| D4 | Bottom-up, ledger-first order. Backend-first per sub-domain; all frontend collected in a single final phase. |
| D5 | `finance.payments` = single payment ledger with workflow `draft → submitted → approved → executed`, one approver role (no multi-level approval matrix). |
| D6 | Beyond-baseline **deferred** (not built): `expense_settlements(_items)`, `expense_claims(_items)`, `employee_advances`, `credit_memos`, `journal_templates`, `accounting_settings`. Built anyway: `finance.payment_terms` (reference table, needed for invoice due dates) and `finance.receipts` as a minimal stub. |
| D7 | Reports computed **on-demand from `journal_lines`** (+ Redis cache per period). `accounting.account_balances` is populated only as a snapshot at period close — incremental maintenance and drift are avoided entirely. |
| D8 | All document codes generated via `organization.document_sequences` (JE / PAY / INV / SB prefixes, yearly reset). |
| D9 | Posting direction: `post(tx, lines, reference)` **receives the caller's transaction handle** (e.g. the Sales service opens the tx). Finance validates (balanced, period open) then writes journal rows inside that tx. No inverted-callback control flow. |
| D10 | One file per pg-schema: extend existing `accounting.schema.ts`, create new `finance.schema.ts`, extend `sales.schema.ts`. |
| D11 | Cash-flow mapping: new nullable column `cash_flow_category` (`operating`/`investing`/`financing`) on `accounting.chart_of_accounts`, used by the direct-method cash-flow statement. |
| D12 | Migration/drop of `sales.payments` (transitional scaffold, planned step S7) is **outside this plan's scope**. It stays untouched here; its `amount integer` overflow defect is not fixed by this plan. |

## Deviations from docs.dbml (edit DBML first)

1. `finance.invoices` + `finance.invoice_items` → relocated to `sales.*` (D2).
2. New tables `finance.ar_open_items`, `finance.ap_open_items` (D3).
3. `accounting.chart_of_accounts` gains `cash_flow_category` (D11).
4. `accounting.journal_entries` gains explicit `reversed_by_entry_id`, `source_module`, unique `idempotency_key` columns per DBML intent (reversal = mirrored entry, append-only).
5. Tables under D6 stay unbuilt; DBML annotates them as deferred.

## Artifact map

**Drizzle schemas (`apps/backend/drizzle/schemas/`)**
- `accounting.schema.ts` (extends existing tax-only file): `chart_of_accounts` (+`cash_flow_category`), `accounting_periods`, `journal_entries`, `journal_lines` (CHECK: sum of debits = sum of credits per entry; one signed side per line), `opening_balances`, `account_balances`.
- `finance.schema.ts` (new): `payments`, `payment_allocations`, `cash_bank_accounts`, `cash_bank_transactions`, `bank_reconciliations`, `bank_reconciliation_items`, `supplier_bills`, `payment_terms`, `receipts` (stub), `ar_open_items`, `ap_open_items`.
- `sales.schema.ts`: adds `invoices`, `invoice_items`.

**Backend domains (`apps/backend/src/app/`)**
- `accounting/` (exists, tax-only): adds COA CRUD + seed, periods (open/close/reopen owner-only + audit trail), journal entries/reversals, the **posting service** (exported from the module's barrel — the single ledger entry point for every other module), opening balances, report builders (P&L, balance sheet, direct-method cash flow), month-end close.
- `finance/` (new, standard layout `constants/contracts/controllers/errors/repositories/services`): payments + allocations, cash/bank, reconciliation, supplier bills, AR/AP aging from sub-ledgers.
- `sales/`: invoice feature; on `issue` it opens the tx and calls `post(tx, …)` (DR AR / CR revenue / CR output VAT).

**Automatic postings** (all via `post()`; no other module ever writes `journal_lines`): invoice issued, payment executed (customer & supplier), supplier bill recorded, cash/bank transaction.

**Authorization**: reuse existing grants in `packages/common/src/authorization/erp-permissions.ts` — `finance` role (invoice, receipt, payment, cash_bank, financial_report) and `accountant` role (chart_of_account, journal, accounting_period close/reopen, financial_report). No new role shapes; only wire guards in the new controllers.

## Phases

| Phase | Content | Done when |
|---|---|---|
| **F1 Schema & migration** | The three schema files + Drizzle migration + docs.dbml updated (deviations above) | migration applies cleanly; schema-invariant tests pass |
| **F2 Posting engine & COA** | COA CRUD + default seed, periods (open/close/reopen audited), `post()` with balanced/period-lock/idempotency validation, reversals | posting rejected when unbalanced or period closed; reversal produces a mirrored entry; unique reference enforced |
| **F3 Opening balances & cash/bank** | Opening balances (must balance, posted once), cash/bank accounts + transactions + auto-journal | trial balance nets to zero after opening; cash/bank moves hit the linked GL accounts |
| **F4 Invoices & AR** | `sales.invoices` + issue flow, `finance.payments` workflow + allocations, AR sub-ledger, AR aging | issuing an invoice and settling it produce correct journals and outstanding status |
| **F5 AP** | Supplier bills, supplier payments, AP sub-ledger, AP aging | same, on the purchasing side |
| **F6 Reconciliation & reports** | Bank reconciliation, P&L, balance sheet, direct-method cash flow (on-demand + per-period cache) | reports reconcile to the GL; reconciliation runs draft → completed |
| **F7 Month-end close** | Adjustment entries, close checklist, final locking, audited reopen | posting with a date in a locked period is rejected server-side; reopen is owner-only and audited |
| **F8 Frontend web-admin** | UI: COA, journals, periods/close, opening balances, cash/bank, payments, bills, AR/AP aging, reconciliation, financial reports; full en + id i18n | every Stage-1 flow operable from the UI |
| **F9 Docs sync** | Mark DBML-deferred tables, remove the stale NestJS-era warning in `docs/architecture/modules/finance.md`, update `progress.md` + backlog + `features.md` | docs reflect the code |

**Business gate**: final COA list supplied by finance at kickoff — F2's seed depends on it.

## Definition of Done (per phase)

`AGENTS.md` gates (lint, typecheck, tests, migration inspected and applied to a disposable DB, `docs.dbml` validated) plus:

- Posting service is the only writer of `journal_entries`/`journal_lines` (grep check across domains).
- Cross-module access only via exported service contracts; no cross-module FKs or joins.
- Idempotency: replayed posting payloads produce no duplicate journals.
- Report numbers asserted against fixture journals (F6).
- Period-lock rejection asserted at the service layer, not only at HTTP level.
- Historical migrations untouched.

## Explicit limits (out of scope)

- Stage 2: payroll postings (M08/T20), gateway postings + fee reconciliation (M02/T22).
- Migration and removal of `sales.payments` (S7, D12).
- Budgeting module (incl. `cash_flow_plans`).
- Deferred entities (D6): expense settlements/claims, employee advances, credit memos, journal templates, accounting settings.
- Multi-currency: IDR only (ADR-0002, bigint minor units).
- Multi-level payment approval matrix.
