# human-resource - ERP-0084

Schema `human_resource` (was `hr`) · folder `src/app/human-resource` (was
`hr`) · URL `/human-resources` (was `/hr`) · phase P6

## Current

Tables employees, bank_accounts, leave_types, leave_requests,
attendance_records, overtime_requests, employee_tasks, salary_summaries.
Repositories attendance, employee, leave, people, task-salary. Controllers
`/hr`, `/hr/employees`, `/hr/attendance`, `/hr/tasks`, `/hr/salary`, leave,
people, hr-context. `ExportedHrService` exists. Consumers: web-admin
`hr-api.ts`, `hr-records-api.ts`.

## Target tables (Q20, Q39)

| Table | Notes |
|---|---|
| employees | department/position/branch/cost-centre columns removed (Q4) if present |
| attendances | was attendance_records |
| leave_types, leave_requests, overtime_requests, employee_tasks | unchanged |
| employee_addresses | target (Q10 shape) |
| schedules | target: employee_id, work_date, shift_start, shift_end, shift_label, is_day_off; attendance compares against it |
| employee_salaries | new (Q39): employee_id FK, base_salary, fixed allowances, effective_from/to, salary bank account (bank_name, account_number masked without `employee:read_private`, account_holder) - absorbs `hr.bank_accounts` |
| employee_salary_records | was `salary_summaries` (Q39): monthly record per employee, draft -> approved (locked), `net_pay` CHECK unchanged |
| settings, code_numberings | new (employee code) |

Salary stays in this module (Q39). Finance reads approved records for the
payroll journal and payment allocates against `employee_salary_record`, both
through `ExportedEmployeeService`.

## Steps

1. **dbml** - rename section and tables; drop target-only hr tables not in the
   owner's list.
2. **Drizzle** - `human-resource.schema.ts` (`pgSchema('human_resource')`);
   delete `hr.schema.ts`.
3. **Repositories** - employee, attendance, leave-type, leave-request,
   overtime-request, employee-task, employee-salary, employee-salary-record,
   setting, code-numbering (split today's
   `leave`, `people`, `task-salary`).
4. **Services** - existing use cases including salary (`SalaryService`).
   `ExportedEmployeeService` (renamed from `ExportedHrService`,
   repository-only): employee assertions, `getApprovedSalaryRecords(period)`,
   `resolveSalaryRecordPayable(id)`, masked salary bank account.
5. **Controllers** - `/human-resources/employees`, `/attendances`,
   `/leave-types`, `/leave-requests`, `/overtime-requests`, `/employee-tasks`,
   `/employee-salaries`, `/salary-records` (was `/hr/salary`), `/people`.
6. **Consumers** - `hr-api.ts`, `hr-records-api.ts` paths; salary screens stay
   in the HR menu.

## Exit

Leave approval -> attendance rows, overtime approval, salary record approval
lock and bank-account masking tests green.
