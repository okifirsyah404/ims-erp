/**
 * Injection tokens for the HR module (M08 stage 1).
 */
import type { InjectionToken } from 'tsyringe';
import type {
	IAttendanceRepository,
	IEmployeeRepository,
	ILeaveRepository,
	ISalaryRepository,
	ITaskRepository,
} from '../contracts/hr.repository.interface';
import type { AttendanceService } from '../services/attendance.service';
import type { EmployeeService } from '../services/employee.service';
import type { LeaveService } from '../services/leave.service';
import type { SalaryService } from '../services/salary.service';
import type { TaskService } from '../services/task.service';

export const EMPLOYEE_REPOSITORY_TOKEN: InjectionToken<IEmployeeRepository> = Symbol('EMPLOYEE_REPOSITORY_TOKEN');
export const ATTENDANCE_REPOSITORY_TOKEN: InjectionToken<IAttendanceRepository> = Symbol('ATTENDANCE_REPOSITORY_TOKEN');
export const LEAVE_REPOSITORY_TOKEN: InjectionToken<ILeaveRepository> = Symbol('LEAVE_REPOSITORY_TOKEN');
export const TASK_REPOSITORY_TOKEN: InjectionToken<ITaskRepository> = Symbol('TASK_REPOSITORY_TOKEN');
export const SALARY_REPOSITORY_TOKEN: InjectionToken<ISalaryRepository> = Symbol('SALARY_REPOSITORY_TOKEN');

/** Token resolving to the {@link EmployeeService} — also the HR contract other modules use. */
export const EMPLOYEE_SERVICE_TOKEN: InjectionToken<EmployeeService> = Symbol('EMPLOYEE_SERVICE_TOKEN');
export const ATTENDANCE_SERVICE_TOKEN: InjectionToken<AttendanceService> = Symbol('ATTENDANCE_SERVICE_TOKEN');
export const LEAVE_SERVICE_TOKEN: InjectionToken<LeaveService> = Symbol('LEAVE_SERVICE_TOKEN');
export const TASK_SERVICE_TOKEN: InjectionToken<TaskService> = Symbol('TASK_SERVICE_TOKEN');
export const SALARY_SERVICE_TOKEN: InjectionToken<SalaryService> = Symbol('SALARY_SERVICE_TOKEN');
