# Expense Module

## Purpose and boundary

Operational expense capture and their posting into the ledger. In the v5.1
package (M09) expense journals are part of the finance workflow (S11);
**automation of journal entries for every activity is explicitly out of
scope** — expense → journal is a governed posting path owned jointly with the
finance module (T11; posting engine = finance).

## Current state (audit, 2026-10-25)

**Scaffold only:**

- `modules/expense/{module, controllers, services, repositories}` — empty
  classes; registered in `app.module.ts`.
- Pre-written unit specs (controller/service) exist.

## Data ownership (planned, Phase 4)

- `erp.expenses` — date (business date, Asia/Jakarta), category/link to COA
  account, amount (**integer IDR minor units**, ADR-0002), receipt/attachment
  reference, approver + approval state, journal reference (unique posting id,
  reversals via reversing entries — never in-place edits).
- Category/master expense accounts belong to the finance module (COA); this
  module references accounts by exported contract.

## Behavior targets (commercial T11 adjacency; M09 stage-1)

- Expense entry → (approval gate) → journal posting.
- Corrections via reversal entries with audit trail.
- List/detail with finance-appropriate permissions; amounts aggregated by
  finance for P&L — reporting drill-down must trace to the expense row.

## Dependencies and rules

- Depends on finance (posting) — consume via exported service; finance stays
  the transaction owner when both write in one use case (single transaction
  handle).
- No float math on money; period checks (closed period rejects unauthorized
  posting) enforced by finance before accepting expense postings.

## Tests

- Existing stub specs to replace.
- Required: posting idempotency (same expense posts once), reversal
  correctness, period-close rejection, permission tests.
