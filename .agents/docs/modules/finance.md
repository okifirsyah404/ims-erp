# Finance Module (owner to be created)

## Purpose and boundary

The accounting core: chart of accounts (COA), opening balances, journals,
ledger, trial balance, reconciliation, and period close (v5.1 M09; tasks
T04, T06, T11). Owns the **posting engine** and all financial invariants.
Other modules (expense, sales, payment, purchasing, payroll) request postings
through this module's exported service — they never write ledger rows
themselves.

## Current state (audit, 2026-10-25)

**Absent — no module directory.** The `erp` schema currently has only
`audit_logs`, `customers`, `investors`. Commercial scope is fully specified
(M09, S11) and the financial invariants are pinned in `../data-model.md`
(ADR-0002 money, period rules) and `../security-and-access.md`.

## Planned ownership (Phase 3–4)

- `erp.accounts` (COA) — code, name, classification, normal balance, report
  mapping, posting restrictions.
- `erp.journal_entries` + `erp.journal_lines` — balanced entries, unique
  posting references, business date vs period, reversal links (corrections
  are reversing entries; no silent overwrites), idempotency keys.
- `erp.cash_bank_accounts` — code, bank, account number, holder, linked
  ledger account.
- `erp.periods` — open/closed state; closing/reopening permissions + audit.
- Opening balances (imports, distinct from master data): must balance;
  opening equity = assets − liabilities.

## Behavior targets (invariants, all tested)

- Posted journals balance; posting + source-state changes atomic and
  idempotent.
- Subledger balances reconcile to GL control accounts; balance sheet
  satisfies assets = liabilities + equity; reports drill down to source
  documents and posted entries.
- DP before delivery is a liability until the revenue event; settlement
  never creates revenue twice.
- Closed periods reject unauthorized posting; reopening requires permission
  + audit trail.
- Cash-flow statement ending cash agrees with balance sheet (v5.1 control).
- Stage 2: payroll postings (after approval) and gateway payments feed
  reports; gateway gross/fees/pending/net reconciliation.

## Dependencies and rules

- Exported service: `post(transaction, lines, reference)` — the single
  posting gateway; transaction owner when composing with source modules.
- Money strictly integer minor units (ADR-0002). Unique references for
  postings (v5.1 reconciliation requirement).
- COGS/valuation summaries remain **manual by finance** (v5.1 M05 limit);
  no automatic COGS automation is promised.

## Tests

- None exist. Required: balance invariant, idempotent posting, reversal
  math, period-close rejection, reconciliation tie-outs, opening-balance
  balancing — integration level on disposable PG.
