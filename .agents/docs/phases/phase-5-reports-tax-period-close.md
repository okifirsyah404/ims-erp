# Phase 5 — Inventory Valuation, Assets/Projects, Reports/Tax, Profit Sharing, Period Close

- **Owner:** A (reports/tax/profit sharing/period close) + B (inventory,
  assets, projects).
- **Depends on:** Phase 4 transactional core; business decision gates
  (profit-sharing scheme approval, tax parameters approval) — they block their
  items explicitly rather than being silently assumed.

## Work (ERP-0014, ERP-0015, ERP-0016, ERP-0017)
1. ERP-0014 inventory: stock movements + valuation boundaries; one warehouse;
   reconciliation to GL control account.
2. ERP-0015 assets & projects: assets/tools master incl. depreciation
   adjustments via journal; project progress + handover/BAST records.
3. ERP-0016 reports: P&L, balance sheet (assets = liabilities + equity
   enforced), cash flow, account drill-down to source documents and posted
   entries; configurable tax recap/workpapers (finance-approved, filing
   responsibility stays external).
4. ERP-0017 period close: closed periods reject unauthorized posting; reopen
   requires permission + audit trail.
5. ERP-0016-adjacent profit sharing: approved distributable amount, reserves,
   prior profit/loss policy, recipient shares (single agreed scheme);
   no double tax subtraction on after-tax bases.

## Exit criteria
- Drill-down: every report line traces to posted entries and source docs
  (tested).
- Balance-sheet equation test; subledger↔GL control tests.
- Closed-period enforcement tests; reopen audited.
- Profit-sharing computation tests on the approved scheme parameters (using
  synthetic data only, never real distributions).

## Outputs
- Report endpoints + frontend reports routes, valuation docs, ADRs for
  report-account mapping decisions.
