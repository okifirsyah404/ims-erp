import type { DependencyContainer } from 'tsyringe';
import { HumanResourceCodeNumberingRepository } from './repositories/code-numbering.repository';
import { HumanResourceNumberingService } from './services/human-resource-numbering.service';
import { EmployeeRepository } from './repositories/employee.repository';
import { EmployeeService } from './services/employee.service';
import { EmployeeInviteService } from './services/employee-invite.service';
import { InvitationEmployeeAdapter } from './adapters/invitation-employee';
import { INVITATION_EMPLOYEE_PORT_TOKEN } from '@app/user/constants/di';
import { ExportedEmployeeService } from './services/exported-employee.service';
import { AttendanceRepository } from './repositories/attendance.repository';
import { LeaveRepository } from './repositories/leave.repository';
import { HrPeopleRepository } from './repositories/people.repository';
import { SalaryRepository, TaskRepository } from './repositories/task-salary.repository';
import { AttendanceService } from './services/attendance.service';
import { LeaveService } from './services/leave.service';
import { HrPeopleService } from './services/people.service';
import { SalaryService } from './services/salary.service';
import { TaskService } from './services/task.service';
import { ScheduleRepository } from './repositories/schedule.repository';
import { ScheduleService } from './services/schedule.service';
import {
	ATTENDANCE_REPOSITORY_TOKEN,
	ATTENDANCE_SERVICE_TOKEN,
	EMPLOYEE_REPOSITORY_TOKEN,
	EMPLOYEE_INVITE_SERVICE_TOKEN,
	EMPLOYEE_SERVICE_TOKEN,
	EXPORTED_HUMAN_RESOURCE_SERVICE_TOKEN,
	HUMAN_RESOURCE_CODE_NUMBERING_REPOSITORY_TOKEN,
	HUMAN_RESOURCE_NUMBERING_SERVICE_TOKEN,
	HR_PEOPLE_REPOSITORY_TOKEN,
	HR_PEOPLE_SERVICE_TOKEN,
	LEAVE_REPOSITORY_TOKEN,
	LEAVE_SERVICE_TOKEN,
	SALARY_REPOSITORY_TOKEN,
	SALARY_SERVICE_TOKEN,
	SCHEDULE_REPOSITORY_TOKEN,
	SCHEDULE_SERVICE_TOKEN,
	TASK_REPOSITORY_TOKEN,
	TASK_SERVICE_TOKEN,
} from './constants/di';

export * from './constants/di';

/**
 * Registers the HR module's repository and services.
 *
 * @remarks
 * Employee creation flows through the user module's invitation pipeline
 * (service-to-service via `INVITATION_SERVICE_TOKEN`) and numbering flows
 * through the organization module's `HumanResourceNumberingService` — HR owns no auth
 * tables of its own (elysia-module rule 3.3).
 */
export function registerHumanResource(container: DependencyContainer): void {
	container.register(EMPLOYEE_REPOSITORY_TOKEN, {
		useClass: EmployeeRepository,
	});
	container.register(HUMAN_RESOURCE_CODE_NUMBERING_REPOSITORY_TOKEN, {
		useClass: HumanResourceCodeNumberingRepository,
	});
	container.register(HUMAN_RESOURCE_NUMBERING_SERVICE_TOKEN, {
		useClass: HumanResourceNumberingService,
	});
	container.register(EMPLOYEE_SERVICE_TOKEN, {
		useClass: EmployeeService,
	});
	container.register(EMPLOYEE_INVITE_SERVICE_TOKEN, {
		useClass: EmployeeInviteService,
	});
	container.register(INVITATION_EMPLOYEE_PORT_TOKEN, {
		useClass: InvitationEmployeeAdapter,
	});
	container.register(EXPORTED_HUMAN_RESOURCE_SERVICE_TOKEN, {
		useClass: ExportedEmployeeService,
	});

	// M08 stage 1 employee records.
	container.register(HR_PEOPLE_REPOSITORY_TOKEN, { useClass: HrPeopleRepository });
	container.register(ATTENDANCE_REPOSITORY_TOKEN, { useClass: AttendanceRepository });
	container.register(LEAVE_REPOSITORY_TOKEN, { useClass: LeaveRepository });
	container.register(TASK_REPOSITORY_TOKEN, { useClass: TaskRepository });
	container.register(SALARY_REPOSITORY_TOKEN, { useClass: SalaryRepository });
	container.register(HR_PEOPLE_SERVICE_TOKEN, { useClass: HrPeopleService });
	container.register(ATTENDANCE_SERVICE_TOKEN, { useClass: AttendanceService });
	container.register(LEAVE_SERVICE_TOKEN, { useClass: LeaveService });
	container.register(TASK_SERVICE_TOKEN, { useClass: TaskService });
	container.register(SALARY_SERVICE_TOKEN, { useClass: SalaryService });

	// Employee work schedule (ERP-0118).
	container.register(SCHEDULE_REPOSITORY_TOKEN, { useClass: ScheduleRepository });
	container.register(SCHEDULE_SERVICE_TOKEN, { useClass: ScheduleService });
}
