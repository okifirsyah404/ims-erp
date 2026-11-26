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
import { AgreementRenderController, EmployeeDocumentController } from './controllers/employee-document.controller';
import { MyPayslipController, PayslipController, PayslipRenderController } from './controllers/payslip.controller';
import { EmployeePortalController, MyPortalAccessController } from './controllers/employee-portal.controller';

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
export { startAgreementPdfWorker } from './queues/agreement-pdf.worker';
export { startPayslipPdfWorker } from './queues/payslip-pdf.worker';
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
		.use(PayrollSettingsController.plugin())
		.use(EmployeeDocumentController.plugin())
		// Public: the render token is the only credential (ERP-0121).
		.use(AgreementRenderController.plugin())
		// Static `/payslips.zip` before the salary routes' `/:id` siblings resolve (ERP-0122).
		.use(PayslipController.plugin())
		// Self-service, session only: the employee comes from the session (ERP-0122).
		.use(MyPayslipController.plugin())
		// Employee portal (Phase A): access probe, then the `/me` self-service routes.
		.use(MyPortalAccessController.plugin())
		.use(EmployeePortalController.plugin())
		.use(PayslipRenderController.plugin());
}
