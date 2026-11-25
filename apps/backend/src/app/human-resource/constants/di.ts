/**
 * Injection tokens for the HR module.
 */
import type { InjectionToken } from 'tsyringe';
import type { HumanResourceCodeNumberingRepository } from '../repositories/code-numbering.repository';
import type { HumanResourceNumberingService } from '../services/human-resource-numbering.service';
import type { IEmployeeRepository } from '../contracts/employee.repository.interface';
import type {
	IAttendanceRepository,
	IHrPeopleRepository,
	ILeaveRepository,
	ISalaryRepository,
	ITaskRepository,
} from '../contracts/hr-records.repository.interface';
import type { AttendanceService } from '../services/attendance.service';
import type { LeaveService } from '../services/leave.service';
import type { HrPeopleService } from '../services/people.service';
import type { SalaryService } from '../services/salary.service';
import type { TaskService } from '../services/task.service';
import type { ScheduleService } from '../services/schedule.service';
import type { SalaryPeriodService } from '../services/salary-period.service';
import type { PayrollScheduleService } from '../services/payroll-schedule.service';
import type { PayrollStatutoryService } from '../services/payroll-statutory.service';
import type { IAgreementPdfQueue, IEmployeeAddressRepository } from '../contracts/employee-document.contract';
import type { EmployeeDocumentService } from '../services/employee-document.service';
import type { AgreementPdfService } from '../services/agreement-pdf.service';
import type { IPayslipQueue } from '../contracts/payslip.contract';
import type { PayslipService } from '../services/payslip.service';
import type { IHrSettingsRepository } from '../contracts/payroll-settings.contract';
import type { ISalaryPeriodRepository } from '../contracts/salary-period.contract';
import type { IScheduleRepository } from '../contracts/schedule.repository.interface';
import type { EmployeeService } from '../services/employee.service';
import type { EmployeeInviteService } from '../services/employee-invite.service';
import type { ExportedEmployeeService } from '../services/exported-employee.service';

export const EMPLOYEE_REPOSITORY_TOKEN: InjectionToken<IEmployeeRepository> =
	Symbol('EMPLOYEE_REPOSITORY');

export const EMPLOYEE_SERVICE_TOKEN: InjectionToken<EmployeeService> =
	Symbol('EMPLOYEE_SERVICE');

/** Invite-creates-employee orchestration (ERP-0034). */
export const EMPLOYEE_INVITE_SERVICE_TOKEN: InjectionToken<EmployeeInviteService> =
	Symbol('EMPLOYEE_INVITE_SERVICE');

/** Cross-module facade consumed by inventory (warehouse PIC validation). */
export const EXPORTED_HUMAN_RESOURCE_SERVICE_TOKEN: InjectionToken<ExportedEmployeeService> =
	Symbol('EXPORTED_HR_SERVICE');

// M08 stage 1 employee records ------------------------------------------------

export const HR_PEOPLE_REPOSITORY_TOKEN: InjectionToken<IHrPeopleRepository> = Symbol('HR_PEOPLE_REPOSITORY');
export const ATTENDANCE_REPOSITORY_TOKEN: InjectionToken<IAttendanceRepository> = Symbol('ATTENDANCE_REPOSITORY');
export const LEAVE_REPOSITORY_TOKEN: InjectionToken<ILeaveRepository> = Symbol('LEAVE_REPOSITORY');
export const TASK_REPOSITORY_TOKEN: InjectionToken<ITaskRepository> = Symbol('TASK_REPOSITORY');
export const SALARY_REPOSITORY_TOKEN: InjectionToken<ISalaryRepository> = Symbol('SALARY_REPOSITORY');

/** The M08 view of ERP-0034 employees (scope, bank account). */
export const HR_PEOPLE_SERVICE_TOKEN: InjectionToken<HrPeopleService> = Symbol('HR_PEOPLE_SERVICE');
export const ATTENDANCE_SERVICE_TOKEN: InjectionToken<AttendanceService> = Symbol('ATTENDANCE_SERVICE');
export const LEAVE_SERVICE_TOKEN: InjectionToken<LeaveService> = Symbol('LEAVE_SERVICE');
export const TASK_SERVICE_TOKEN: InjectionToken<TaskService> = Symbol('TASK_SERVICE');
export const SALARY_SERVICE_TOKEN: InjectionToken<SalaryService> = Symbol('SALARY_SERVICE');

/** Employee work schedule (ERP-0118). */
export const SCHEDULE_REPOSITORY_TOKEN: InjectionToken<IScheduleRepository> = Symbol('SCHEDULE_REPOSITORY');
export const SCHEDULE_SERVICE_TOKEN: InjectionToken<ScheduleService> = Symbol('SCHEDULE_SERVICE');

/** Effective-dated salary periods of an employee (ERP-0119). */
export const SALARY_PERIOD_REPOSITORY_TOKEN: InjectionToken<ISalaryPeriodRepository> = Symbol('SALARY_PERIOD_REPOSITORY');
export const SALARY_PERIOD_SERVICE_TOKEN: InjectionToken<SalaryPeriodService> = Symbol('SALARY_PERIOD_SERVICE');

/** Payroll payday setting and its daily draft run (ERP-0120). */
export const HR_SETTINGS_REPOSITORY_TOKEN: InjectionToken<IHrSettingsRepository> = Symbol('HR_SETTINGS_REPOSITORY');
export const PAYROLL_SCHEDULE_SERVICE_TOKEN: InjectionToken<PayrollScheduleService> = Symbol('PAYROLL_SCHEDULE_SERVICE');

/** PPh 21 and BPJS toggles and parameters (ERP-0138). */
export const PAYROLL_STATUTORY_SERVICE_TOKEN: InjectionToken<PayrollStatutoryService> = Symbol('PAYROLL_STATUTORY_SERVICE');

/** Employee documents, addresses and the employment agreement PDF (ERP-0121). */
export const EMPLOYEE_ADDRESS_REPOSITORY_TOKEN: InjectionToken<IEmployeeAddressRepository> = Symbol('EMPLOYEE_ADDRESS_REPOSITORY');
export const AGREEMENT_PDF_QUEUE_TOKEN: InjectionToken<IAgreementPdfQueue> = Symbol('AGREEMENT_PDF_QUEUE');
export const EMPLOYEE_DOCUMENT_SERVICE_TOKEN: InjectionToken<EmployeeDocumentService> = Symbol('EMPLOYEE_DOCUMENT_SERVICE');
export const AGREEMENT_PDF_SERVICE_TOKEN: InjectionToken<AgreementPdfService> = Symbol('AGREEMENT_PDF_SERVICE');

/** Payslips (ERP-0122). */
export const PAYSLIP_QUEUE_TOKEN: InjectionToken<IPayslipQueue> = Symbol('PAYSLIP_QUEUE');
export const PAYSLIP_SERVICE_TOKEN: InjectionToken<PayslipService> = Symbol('PAYSLIP_SERVICE');

/** Token resolving to the repository of `human_resource.code_numberings`. */
export const HUMAN_RESOURCE_CODE_NUMBERING_REPOSITORY_TOKEN: InjectionToken<HumanResourceCodeNumberingRepository> =
	Symbol('HUMAN_RESOURCE_CODE_NUMBERING_REPOSITORY');

/** Token resolving to the {@link HumanResourceNumberingService}. */
export const HUMAN_RESOURCE_NUMBERING_SERVICE_TOKEN: InjectionToken<HumanResourceNumberingService> =
	Symbol('HUMAN_RESOURCE_NUMBERING_SERVICE');
