/**
 * Injection tokens for the HR module.
 */
import type { InjectionToken } from 'tsyringe';
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
import type { EmployeeService } from '../services/employee.service';
import type { EmployeeInviteService } from '../services/employee-invite.service';
import type { ExportedHrService } from '../services/exported-hr.service';

export const EMPLOYEE_REPOSITORY_TOKEN: InjectionToken<IEmployeeRepository> =
	Symbol('EMPLOYEE_REPOSITORY');

export const EMPLOYEE_SERVICE_TOKEN: InjectionToken<EmployeeService> =
	Symbol('EMPLOYEE_SERVICE');

/** Invite-creates-employee orchestration (ERP-0034). */
export const EMPLOYEE_INVITE_SERVICE_TOKEN: InjectionToken<EmployeeInviteService> =
	Symbol('EMPLOYEE_INVITE_SERVICE');

/** Cross-module facade consumed by inventory (warehouse PIC validation). */
export const EXPORTED_HR_SERVICE_TOKEN: InjectionToken<ExportedHrService> =
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
