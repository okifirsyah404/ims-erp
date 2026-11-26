# Human Resource Module

> Created 2026-11-20 (ADR-0024). Replaces `employee.md` (deprecated, the
> pre-refactor `hr` schema).

Code: `apps/backend/src/app/human-resource` (directory with a hyphen, schema
`human_resource`). Profile: `docs/database/module-ownership.md` (#14).
Tables: `docs/database/docs.dbml`.

## Purpose and boundary

Employees, attendance, leave, overtime, employee tasks and salary records.
Payroll automation (T19/T20, ERP-0018) is still blocked on finance rules;
salary stays here and journals are posted by `finance` (ADR-0024 Q39).

## Owned tables (12)

`employees`, `employee_addresses`, `attendances`, `leave_types`,
`leave_requests`, `overtime_requests`, `employee_tasks`, `employee_salaries`,
`employee_salary_records`, `schedules`, `settings`, `code_numberings`
(`HumanResourceNumberingService`).

## HTTP

Prefix `/human-resources` (`erp` guard): `/employees` (list, `picker`, CRUD,
invite-first creation), `/attendances` (`day`, `month`, `template`,
`import`), `/leave-types`, `/leave` (`approve|reject|cancel`, `balances`),
`/overtime`, `/employee-tasks`, `/salary-records` (`generate`, `template`,
`import`, `approve`), `/active-employees`, `/employees/:id/bank-account`.

## Contract

`ExportedEmployeeService` (`EXPORTED_HUMAN_RESOURCE_SERVICE_TOKEN`):
`findEmployeeById`, `findEmployeeByUserId`. Other modules never read
`human_resource.*` directly.

## Permissions

Resources `employee` (`read_private` for sensitive fields), `attendance`
(`record`), `leave`, `overtime`; salary and bank data need the matching
`employee` read rights.

## Key rules

- Employee creation is invite-first: the invitation pipeline (`auth`) runs and
  the employee row is inserted; the user link is a logical reference.
- Employees live at organization or company level; reads see the own
  organization's employees plus company-level ones.
- Approving leave writes the attendance days; cancelling removes them.
- Attendance and salary imports are all-or-nothing, with errors per row.
- Salary records carry PPh 21 and BPJS when switched on (ERP-0138);
  approval posts the payroll journal through finance's `PayrollLedgerService`
  and the BP21 Coretax file is exported from an approved month.
- Employees carry optional NPWP (masked like the NIK), PTKP status (NULL counts
  as TK/0) and BPJS numbers (ERP-0138). PPh 21 and BPJS are switched on
  company-wide in `/human-resources/payroll-settings/statutory` (application
  admins).
