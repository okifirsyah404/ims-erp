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

## Target tables (Q20)

| Table | Notes |
|---|---|
| employees | department/position/branch/cost-centre columns removed (Q4) if present |
| attendances | was attendance_records |
| leave_types, leave_requests, overtime_requests, employee_tasks | unchanged |
| employee_addresses | target (Q10 shape) |
| schedules | target: employee_id, work_date, shift_start, shift_end, shift_label, is_day_off; attendance compares against it |
| settings, code_numberings | new (employee code) |

Moved out: `bank_accounts` -> `finance.employee_salaries`; `salary_summaries`
-> `finance.employee_salary_records` (ERP-0079).

## Steps

1. **dbml** - rename section and tables; drop target-only hr tables not in the
   owner's list.
2. **Drizzle** - `human-resource.schema.ts` (`pgSchema('human_resource')`);
   delete `hr.schema.ts`.
3. **Repositories** - employee, attendance, leave-type, leave-request,
   overtime-request, employee-task, setting, code-numbering (split today's
   `leave`, `people`, `task-salary`).
4. **Services** - existing use cases; salary logic leaves for finance.
   `ExportedEmployeeService` (renamed from `ExportedHrService`).
5. **Controllers** - `/human-resources/employees`, `/attendances`,
   `/leave-types`, `/leave-requests`, `/overtime-requests`, `/employee-tasks`,
   `/people`.
6. **Consumers** - `hr-api.ts`, `hr-records-api.ts` paths; salary screens call
   finance URLs.

## Exit

Leave approval -> attendance rows, overtime approval tests green.
