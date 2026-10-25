# Employee Module

## Purpose and boundary

Employee master data: code, name, position, contact, joining date, status,
and links from user identity to employee. Salary/bank details are sensitive
and **restricted access** (masked in list responses; permission-gated reads).
Payroll flows are a later-stage user of this data (v5.1 M08; tasks T10,
T19–T20).

## Current state (audit, 2026-10-25)

**Scaffold only:**

- `modules/employee/{module, controllers, services, repositories}` — empty
  classes; module registered in `app.module.ts`.
- Pre-written unit specs (controller/service) exist for the stubs.

## Data ownership (planned table, Phase 3 — commercial T03/T10)

- `erp.employees` — code (unique alive), name, position, contact, joining
  date, status, salary bank details (restricted), user identity link
  (`auth.users.id`, nullable, ON DELETE SET NULL to audit-safe references).
- Attendance/payroll inputs are commercial M08 — attendance is manual
  entry/import in this package; do not promise attendance machines, GPS, or
  complex shifts (contractual limit).

## Behavior targets

- CRUD + deactivate (soft) with permission gates (`hr.employee.*`).
- Bank-detail reads masked by default; full detail requires a dedicated
  permission (finance/owner-class roles) and is audited.
- Link resolution used by payroll (approve payslips per employee) —
  establishes post stage-2 integration surface only as contracts, not repo
  imports.

## Dependencies and rules

- Authorization + session context; identity linking consumes `user`/auth
  contracts. Next user of this data (Stage 2 payroll, tasks T19–T20) will
  read via this module's exported service — keep its API shape narrow.

## Tests

- Existing pre-written stub specs — replace with real coverage on
  implementation: permission-denial (bank details), ownership/linking
  invariant (one employee row per user id where linked), soft-delete
  filtering, cache-free list correctness.
