# Phase 3 — Core Master Data, Organization Settings, COA, Opening Data

- **Owner:** A (master data + COA foundations) + B (org settings, opening
  facilities, refinements).
- **Depends on:** Phase 2 exit (auth runtime verified, slice landed, user
  module closed).

## Entry criteria
- Phase-2 exit criteria met and evidenced.
- Permission matrix stable enough to gate new domains.

## Work (ERP-0007, ERP-0008, ERP-0009 and onward splits)
1. ERP-0007 user domain completion (status/admin flows, cache invariants
   tested).
2. ERP-0008 master data by owner in `domain-map.md`: company profile, suppliers
   (+restricted bank details), unified product/service catalog with
   categories/units, single warehouse, employees (+restricted salary bank
   details), COA, cash/bank accounts, subscription packages, investors.
   Decisions explicitly logged (not silently made) where a catalog entity gets
   a discriminator.
3. ERP-0009 document numbering/code generation configuration
   (collision-safe, per-document-type).
4. Opening-data facilities (imports, not transactions): opening ledger
   balances, opening stock, outstanding AR/AP, investor capital, active
   subscriptions, ongoing projects — distinguished from reusable master data.
5. Organization settings rebuilt on real data (replacing sample content),
   respecting ADR-0001 internal-organization semantics.

## Exit criteria
- Each master-data entity: model + permissions + tests + idempotent seeder;
  permission-scoped bank-detail reads.
- COA foundation supports the journal invariants (services ready for Phase 4
  posting).
- Opening balances importable and reversible (traceable correction, not
  silent overwrite); opening equity = assets − liabilities verified by test.
- Licenses/portal groundwork: nothing gated by missing master data.

## Outputs
- Master-data endpoints (documented in `api-conventions.md` patterns), seeders,
  doc updates (`data-model.md`), statuses in `backlog.md`/`progress.md`.
