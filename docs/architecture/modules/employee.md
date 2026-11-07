# HR Module — Employees & Attendance (M08)

Code: `apps/backend/src/app/hr/` (schema `hr`, company-wide, ADR-0012), web
`apps/web-admin/src/routes/_authed/hr/`. Status: stage 1 (T10) **implemented
2026-11-07, not yet accepted by the owner**; stage 2 payroll automation
(T19/T20, ERP-0018) **blocked** until finance supplies the salary component
rules. Evidence: `docs/plan/progress.md`.

> The 2026-10-25 audit text that stood here described the deleted NestJS
> backend; it is replaced by this file.

## Purpose and boundary

Employees, attendance, leave, overtime, simple employee tasks and the
monthly salary summary. Owner decisions (2026-11-07): attendance entered by
HR/admin or imported from an Excel/CSV template (all rows or none); HR
records leave and overtime on the employee's behalf and someone else
approves; annual leave quota 12 days tracked (pending requests count);
salary summaries entered or imported by HR/finance and approved by the
owner, then locked. No employee self-service, no attendance machine, no
payroll engine, no journal (M09).

## Data (`docs/database/docs.dbml`, MODULE HR)

| Table | Role |
|---|---|
| `employees` | `EMP-####`, NIK, position, contact, hire date, status, base salary, optional login |
| `bank_accounts` | one salary account per employee |
| `attendance_records` | one status per employee per day (`manual`, `import`, `leave`) |
| `leave_types` | seeded: annual (12, quota), special, sick, permit |
| `leave_requests` | days = dates in the range except Sundays; approval writes attendance |
| `overtime_requests` | hours per date; approved hours shown on the salary summary |
| `employee_tasks` | simple tasks outside projects |
| `salary_summaries` | per month and employee; net = base + allowances + overtime + bonus − deductions |

The other `hr.*` tables in the DBML are target-only.

## Rules

- Private data: NIK and the bank account are masked (last 4) and the base
  salary hidden for callers without `employee:read_private` (HR, finance,
  owner); masked values are never written back.
- Inactive employees keep their history; new attendance, leave, overtime
  and tasks need an active employee working on that date.
- Days of an approved leave belong to it: the day sheet and the import do
  not overwrite them; cancelling the leave removes them.
- Whoever recorded a leave or overtime request cannot approve or reject it.
- Approving a salary month (`payroll:approve`, owner) locks every row.
- Imports (`.xlsx` / `.csv`, ≤ 2 MB, ≤ 2000 rows) validate every row first;
  any error imports nothing and the errors come back by spreadsheet row.

## Permissions

`employee:read | create | update | archive | read_private`, `attendance:read
| record`, `leave:read | create | approve | reject | cancel`, `overtime:read
| create | approve | reject | cancel`, `task:read | create | update`,
`payroll:read | create | update | approve`. HR: all except
`payroll:approve`; finance: `employee:read, read_private`, `payroll:read,
create, update`; admin: `employee:read`, `attendance:read, record`; owner:
everything.

## Boundaries

Organization: `NumberingService.next('employee')`. User: `UserService.getUser`
for the optional login link. `EmployeeService` is the HR contract other
modules use (assets' custodian, projects' staff — not wired yet, ERP-0034).

## Tests

`apps/backend/test/unit/hr.service.test.ts` (rules, masking, quota,
overlap, no self-decision, leave → attendance, imports all-or-nothing,
salary lock and import); `test/authorization/permission-matrix.test.ts`
(finance and HR grants). Browser e2e 2026-11-07 in `progress.md`.
