# Phase 4 — Sales/Invoices/Receivables, Purchasing/Payables, Expenses, Posting

- **Owner:** A (sales side + posting engine) + B (purchasing, expenses,
  integration).
- **Depends on:** Phase 3 (COA + master data + numbering; ERP-0010 gates all
  transactional work).

## Entry criteria
- Phase-3 COA foundation reviewed; ADR-0002 money convention enforced
  everywhere; no float money in any planned code path.

## Work (ERP-0011, ERP-0012, ERP-0013, ERP-0010)
1. ERP-0010 posting engine (finalized): journals balance, atomic
   state changes, idempotent postings, traceable corrections (no in-place
   mutation), period checks, subledger → control-account reconciliation
   points.
2. ERP-0011 sales: quotation (SPH) → approval → invoice → DP/partial payment →
   settlement → receipts; receivables lifecycle; revenue-recognition timing
   explicit (deposits are liabilities until delivery event).
3. ERP-0012 purchasing: supplier bills, payables, supplier payments; payment
   terms; restricted bank-detail visibility.
4. ERP-0013 expenses: expense capture with approval and journal posting.
5. Permissions wired per `security-and-access.md` matrix
   (`sales.*`, `purchasing.purchase`, `finance.transaction`, …).

## Exit criteria
- Financial invariant tests green (per `testing-strategy.md`): balance,
  idempotency (duplicate payment posts once), subledger reconciliation,
  no double revenue on settlement.
- End-to-end sales test: SPH → invoice → DP → settlement with audited moves;
  same for purchasing bill→payment; expense→posting.
- Tax-relevant postings identifiable/configurable-effective-dated (for Phase 5).
- All mutation endpoints authorization-tested (staff vs portal identity).

## Outputs
- Domain endpoints, transaction mutation services, tests/e2e, updated docs.
