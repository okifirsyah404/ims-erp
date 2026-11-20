> **Deprecated (ADR-0024, 2026-11-20).** This page describes the pre-refactor module "reporting". It is kept for history. Current owner: finance (report_archives) and the web-admin dashboard (no schema of its own) - see docs/database/module-ownership.md.
> Mapping: reporting -> finance.report_archives; no reporting module was ever built.

> 2026-10-28: content below describes the deleted NestJS backend (apps/backend-nest). Domains listed as modules/ stubs do not exist in apps/backend-elysia (which has only user, organization, location). Treat as historical audit; re-verify against backend-elysia before acting.

# Reporting Module

## Purpose and boundary

Read-model reporting over posted/derived data: operational dashboards (v5.1
M01 — sales, cash, profit, inventory, projects, subscriptions nearing due
dates; stage 2 adds gateway/payroll/subscription summaries on verified data)
and financial report assembly (with finance module owning the posting engine
and account math). Exports and the monthly report archive (M12 stage 1)
land here.

## Current state (audit, 2026-10-25)

**Scaffold only:**

- `modules/reporting/**` — empty stubs; registered in `app.module.ts`.
- Pre-written unit specs (controller/service) exist.

## Data ownership

- **Owns no transactional tables.** Reads via contracts from sales, payment,
  inventory, projects, licensing, finance. May own cache-friendly read
  projections (`erp.report_snapshots` if needed) — snapshots must record
  their source cutoff.
- Monthly report archive (M12): immutable snapshot rows per period.

## Behavior targets (commercial T11, T14)

- Financial reports (P&L, balance sheet, cash flow) are **computed by
  finance** and served/drilled-down here; every line traceable to posted
  entries and source documents.
- Dashboard aggregates with permission-appropriate scoping
  (`reports.view|export`, `finance.report`); exports go through the same
  authorization checks.
- No advanced BI / per-role custom dashboards (v5.1 limit).
- One basic webhook (T14) — outbound, logged, after-commit only.

## Dependencies and rules

- Consumer-only module; depends on finance for report correctness. Long
  queries: consider read replicas only if a concrete need appears (YAGNI);
  cache only suitable aggregates with scope-correct keys.

## Tests

- Existing stub specs to replace.
- Required: drill-down traceability test (line → posted entry → source doc),
  archive immutability, export permission-denial tests.
