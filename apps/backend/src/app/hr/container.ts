import type { DependencyContainer } from 'tsyringe';
import {
	ATTENDANCE_REPOSITORY_TOKEN,
	ATTENDANCE_SERVICE_TOKEN,
	EMPLOYEE_REPOSITORY_TOKEN,
	EMPLOYEE_SERVICE_TOKEN,
	LEAVE_REPOSITORY_TOKEN,
	LEAVE_SERVICE_TOKEN,
	SALARY_REPOSITORY_TOKEN,
	SALARY_SERVICE_TOKEN,
	TASK_REPOSITORY_TOKEN,
	TASK_SERVICE_TOKEN,
} from './constants/di';
import { AttendanceRepository } from './repositories/attendance.repository';
import { EmployeeRepository } from './repositories/employee.repository';
import { LeaveRepository } from './repositories/leave.repository';
import { SalaryRepository, TaskRepository } from './repositories/task-salary.repository';
import { AttendanceService } from './services/attendance.service';
import { EmployeeService } from './services/employee.service';
import { LeaveService } from './services/leave.service';
import { SalaryService } from './services/salary.service';
import { TaskService } from './services/task.service';

export * from './constants/di';

/**
 * Registers the HR module (M08 stage 1: employees, attendance, leave,
 * overtime, tasks, salary summaries).
 *
 * @param container - The tsyringe container to populate
 */
export function registerHr(container: DependencyContainer): void {
	container.register(EMPLOYEE_REPOSITORY_TOKEN, { useClass: EmployeeRepository });
	container.register(ATTENDANCE_REPOSITORY_TOKEN, { useClass: AttendanceRepository });
	container.register(LEAVE_REPOSITORY_TOKEN, { useClass: LeaveRepository });
	container.register(TASK_REPOSITORY_TOKEN, { useClass: TaskRepository });
	container.register(SALARY_REPOSITORY_TOKEN, { useClass: SalaryRepository });
	container.register(EMPLOYEE_SERVICE_TOKEN, { useClass: EmployeeService });
	container.register(ATTENDANCE_SERVICE_TOKEN, { useClass: AttendanceService });
	container.register(LEAVE_SERVICE_TOKEN, { useClass: LeaveService });
	container.register(TASK_SERVICE_TOKEN, { useClass: TaskService });
	container.register(SALARY_SERVICE_TOKEN, { useClass: SalaryService });
}
