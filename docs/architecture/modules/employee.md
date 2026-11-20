> **Deprecated (ADR-0024, 2026-11-20).** This page describes the pre-refactor module "employee / hr". It is kept for history. Current owner: human_resource (schema `human_resource`, page `human-resource.md`) - see docs/database/module-ownership.md.
> Mapping: hr -> human_resource; module dir apps/backend/src/app/human-resource.

# HR Module — Employees & Attendance (M08)

Code: `apps/backend/src/app/hr/` (schema `hr`), web
`apps/web-admin/src/routes/_authed/hr/`. Employees are ERP-0034 (invite-first
creation, organization or company level, warehouse PIC). The M08 stage 1
records (T10) were rebuilt on top of them on 2026-11-12 — **implemented, not
yet accepted by the owner**. Stage 2 payroll automation (T19/T20, ERP-0018)
is **blocked** until finance supplies the salary component rules. Evidence:
`docs/plan/progress.md`.

> The 2026-10-25 audit text that stood here described the deleted NestJS
> backend; it is replaced by this file.

## Purpose and boundary

Employees (ERP-0034) plus attendance, leave, overtime, simple employee tasks
and the monthly salary summary (M08). Owner decisions (2026-11-07):
attendance entered by HR/admin or imported from an Excel/CSV template (all
rows or none); HR records leave and overtime on the employee's behalf and
someone else approves; annual leave quota 12 days (pending requests count);
salary summaries entered or imported by HR/finance and approved by the
owner, then locked. No employee self-service, no attendance machine, no
payroll engine, no journal (M09).

## Data (`docs/database/docs.dbml`, MODULE HR)

| Table | Role |
|---|---|
| `employees` | ERP-0034: code `EMP-#####`, identity, contact, employment, `organization_id` (NULL = company level), invite-linked login |
| `bank_accounts` | one salary account per employee |
| `attendance_records` | one status per employee per day (`manual`, `import`, `leave`) |
| `leave_types` | seeded in every environment: annual (12, quota), special, sick, permit |
| `leave_requests` | days = dates in the range except Sundays; approval writes attendance |
| `overtime_requests` | hours per date; approved hours shown on the salary summary |
| `employee_tasks` | simple tasks outside projects |
| `salary_summaries` | per month and employee; net = base + allowances + overtime + bonus − deductions |

The M08 tables have no `organization_id`: a record belongs to an employee.
The other `hr.*` tables in the DBML are target-only.

## Rules

- **Scope** (same rule as the ERP-0034 employee list): a caller sees and
  writes records of company-level employees and of the active
  organization's employees; an application admin sees all. Lists, reads,
  decisions, imports and salary approval are all limited to that scope
  (`repositories/people.repository.ts` `visibleEmployees`).
- **Private data**: the NIK (on the ERP-0034 employee read) and the bank
  account number are masked (last 4) without `employee:read_private` (HR,
  finance, owner); a masked NIK is never written back.
- Only active employees get new attendance, leave, overtime and tasks; an
  employee works from the hire date until the termination date.
- Days of an approved leave belong to it: the day sheet and the import do
  not overwrite them; cancelling the leave removes them.
- Whoever recorded a leave or overtime request cannot approve or reject it.
- Salary: **Fill from last month** drafts every working employee without a
  row, copying last month's base and allowances (employees carry no salary;
  `employment_contracts` / `employee_salary_components` are not built).
  Approving a month (`payroll:approve`, owner) locks every row.
- Imports (`.xlsx` / `.csv`, ≤ 2 MB, ≤ 2000 rows) validate every row first;
  any error imports nothing and the errors come back by spreadsheet row. An
  employee code used in two visible organizations is reported as ambiguous.

## Endpoints and permissions

`/hr/employees*` (ERP-0034), `/hr/active-employees`,
`/hr/employees/:id/bank-account`, `/hr/attendance/*`, `/hr/leave*`,
`/hr/overtime*`, `/hr/tasks*`, `/hr/salary*`, all mounted by `hrModule()`.
Permissions: `employee:read | create | update | archive | read_private`,
`attendance:read | record`, `leave:read | create | approve | reject |
cancel`, `overtime:read | create | approve | reject | cancel`, `task:read |
create | update`, `payroll:read | create | update | approve`. HR: all except
`payroll:approve`; finance: `employee:read, read_private`, `payroll:read,
create, update, export`; admin: `employee:read`, `attendance:read, record`;
owner: everything.

## Boundaries

`ExportedHrService` (ERP-0034) is the contract other modules use (warehouse
PIC). The M08 records reach employees only through `HrPeopleService`.

## Tests

`apps/backend/test/unit/hr-records.service.test.ts` (rules, scope, masking,
quota, overlap, no self-decision, leave → attendance, imports all-or-nothing
and ambiguous codes, salary generation, lock and import);
`test/authorization/permission-matrix.test.ts` (finance and HR grants).
E2E 2026-11-12 in `progress.md`.
