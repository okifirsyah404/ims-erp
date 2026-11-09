# Finance Module (M09 — in-progress: Stage 1 built, Stage 2 open)

## Purpose and boundary

The accounting core: chart of accounts (COA), accounting periods, journal
entries, posting engine, opening balances, cash & bank, AR/AP sub-ledgers
with payments and supplier bills, financial reports, bank reconciliation,
and period close. Owns the **posting engine** and all financial invariants.
Other modules (sales, expense, purchasing, payroll) request postings through
this module's exported service — they never write ledger rows themselves.
Invoices stay owned by Sales (`sales.invoices`); finance mirrors only the
open-item sub-ledger.

## Current state (implemented, 2026-11-07)

Backend: `apps/backend/src/app/accounting/` (Bun + Elysia + Drizzle),
Postgres schemas `accounting` (ledger) and `finance` (cash/bank, payments,
supplier bills, reconciliations). Web-admin: `/finance/*` routes with a typed
`finance-api.ts` client. Stage 1 phases F1–F9 of `docs/plan/plans/finance.md`
are complete; decisions D1–D12 are pinned in the same plan.

### Layout

- `schemas/` — Drizzle `accounting` + `finance` pg-schemas (one file per
  pg-schema).
- `repositories/ledger.repository.ts` — the only writer of ledger tables.
- `services/` — posting engine, accounts, periods, opening balances,
  cash bank, payments, supplier bills, reports, bank reconciliation,
  month-end close.
- `controllers/ledger.controller.ts` + `payment.controller.ts` — Elysia
  routes under `/accounts`, `/periods`, `/journal`, `/opening-balances`,
  `/cash-bank/*`, `/payments*`, `/bills*`, `/ar|ap/aging`, `/reports/*`,
  `/close/*`, `/bank-reconciliations*`, guarded by `erp` permissions
  (`chart_of_account:*`, `accounting_period:*`, `journal:*`, `cash_bank:*`,
  `payment:*`, `bill:*`, `financial_report:*`).
- `contracts/` — zod request/response shapes (money = integer minor units).

### Key invariants (tested)

- Posting contract: callers open the transaction and pass it —
  `post(tx, input)` / `postMovement(ctx, input, outerTx?)`. Entries balance
  in exact integer minor units; `sourceType`/`sourceId` provenance on the JE.
- Corrections are append-only reversals, never edits (reversal links both
  ways); posting requires an open period for the entry date; document codes
  come from `organization.document_sequences`.
- Cash/bank accounts need a GL link before the first movement; the
  informational `opening_balance` never overrides the JE truth.
- AR/AP: sub-ledger mirror tables (`ar_open_items` / `ap_open_items`)
  reconcile to the GL control accounts; executed payments post mirrored JE +
  cash movement atomically; void-executed reads the counterpart and cash GL
  from the ORIGINAL posted JE lines.
- Reports (P&L, balance sheet, cash flow via `cash_flow_category`) are
  computed on demand from posted journal lines — never stored snapshots.
- Bank reconciliation gate: matched items Σ must equal the statement balance
  exactly (integer minor units); statuses draft → in_progress → reconciled →
  closed.
- Closed periods reject posting; reopening a locked period is owner-only and
  audited.
- Month-end close checklist is advisory, not a hard close gate.

## Deferred (Stage 2)

Expense entry + journal posting (ERP-0013), payroll postings (T20), gateway
payment reconciliation (T22). The final COA seed list awaits finance/owner
sign-off (provisional codes in use: `1-1300`, `1-1100`, `4-1000`, `2-1000`,
`2-1100`, `5-1000`, `1-1800`).

## Tests

Integration tests on disposable PG cover the balance invariant, idempotent
posting, reversal math, period-close rejection, reconciliation tie-outs,
opening-balance balancing, payment workflow transitions, and the
reconciliation exact-match gate (backend suite: 686 tests).
