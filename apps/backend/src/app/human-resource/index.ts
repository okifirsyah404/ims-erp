/**
 * Public entry point of the human-resource module: ERP-0034 employees and the M08 stage
 * 1 employee records (attendance, leave, overtime, tasks, salary summary).
 * `src/app/app.ts` mounts `.use(hrModule())`.
 */
import Elysia from 'elysia';

import { HumanResourceCodeNumberingController } from './controllers/code-numbering.controller';
import { AttendanceController } from './controllers/attendance.controller';
import { EmployeeController } from './controllers/employee.controller';
import { LeaveController } from './controllers/leave.controller';
import { HrPeopleController } from './controllers/people.controller';
import { SalaryController } from './controllers/salary.controller';
import { TaskController } from './controllers/task.controller';
import { ScheduleController } from './controllers/schedule.controller';
import { SalaryPeriodController } from './controllers/salary-period.controller';
import { PayrollSettingsController } from './controllers/payroll-settings.controller';

/**
 * Public entry point of the human-resource module.
 *
 * @remarks
 * Re-exports the composition-root registration and the HTTP controller so
 * consumers only import from `@app/hr`.
 */
export * from './container';
export * from './controllers/employee.controller';
export { registerPayrollPayDaySchedule } from './queues/payroll-pay-day.queue';
export { startPayrollPayDayWorker } from './queues/payroll-pay-day.worker';
export type { ExportedEmployeeService } from './services/exported-employee.service';

/**
 * Elysia instance mounting every HR controller. The employee routes were not
 * mounted before (ERP-0034 shipped the controller without a mount), so
 * `/hr/employees` answered 404.
 */
export function humanResourceModule() {
	return new Elysia({ name: 'human-resource' })
		// Static `/code-numberings` routes: settings of this module's series.
		.use(HumanResourceCodeNumberingController.plugin())
		.use(EmployeeController.plugin())
		.use(HrPeopleController.plugin())
		.use(AttendanceController.plugin())
		.use(LeaveController.plugin())
		.use(TaskController.plugin())
		.use(ScheduleController.plugin())
		.use(SalaryController.plugin())
		.use(SalaryPeriodController.plugin())
		.use(PayrollSettingsController.plugin());
}
