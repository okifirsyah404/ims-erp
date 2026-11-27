# ADR-0024: Database normalization and baseline v2

Status: **proposed** (2026-11-19). Plan: `docs/plan/database-refactor/`
(ERP-0070..ERP-0089).
**Status update 2026-11-28 (T-6, recorded by programmer B, reviewed by Oki):** **accepted** (executed: 20 schemas, per-schema migration baseline).

## Context

The persistence contract grew to 28 schemas / 280 tables, of which 140 have no
code. Several modules break the module rules: `accounting` owns `finance.*`
tables, `organization` queries `inventory`, `user` reads `portal_identities`.
Concepts are split across schemas (customer in `crm` + `auth`, assets vs
inventory, licensing vs projects, after-sales vs ticket), numbering is one
central table every module depends on, and `drizzle:generate` is blocked by a
branching snapshot chain. No production database exists (ADR-0011, 0018, 0019).

## Decision

1. Rebuild the schema set to the owner's target (`01-target-schema.md`):
   18 schemas, one module per schema, `auth` shared by `user` and
   `organization` as the only exception. A module may own **no** schema when it
   holds no data: `webhook` receives provider callbacks and delegates to the
   owning modules' exported services.
2. No cross-schema foreign keys; cross-module links are nullable logical ids
   validated through exported services (ADR-0014 unchanged).
3. Polymorph `<role>_type` + `<role>_id` only for "exactly one of more than
   three targets".
4. One repository per table; repositories join only within their schema.
5. Numbering moves from `code_number.series` to `<schema>.code_numberings`
   per owning schema with a shared helper (supersedes ADR-0013's single
   table, keeps its atomic allocation rule).
6. Migrations are squashed into a new per-schema baseline (extends
   ADR-0019); the append-only rule resumes from the new baseline.
7. HTTP prefixes become the plural module name; external endpoints keep an
   alias during a transition window.

## Consequences

- All backend modules and the three frontends change; work proceeds on one
  long branch, module by module, with green gates per phase.
- Target-only schemas (`payroll`, `approval`, `budgeting`, `investor`,
  `commerce`) leave the contract; they return through new ADRs if built.
- Any database created before this ADR must be recreated; acceptable only
  while no production server exists. Must be re-evaluated if one is deployed
  before cutover.
