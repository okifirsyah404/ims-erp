import type { DependencyContainer } from 'tsyringe';
import { EmployeeRepository } from './repositories/employee.repository';
import { EmployeeService } from './services/employee.service';
import { EmployeeInviteService } from './services/employee-invite.service';
import { InvitationEmployeeAdapter } from './adapters/invitation-employee';
import { INVITATION_EMPLOYEE_PORT_TOKEN } from '@app/user/constants/di';
import { ExportedHrService } from './services/exported-hr.service';
import {
	EMPLOYEE_REPOSITORY_TOKEN,
	EMPLOYEE_INVITE_SERVICE_TOKEN,
	EMPLOYEE_SERVICE_TOKEN,
	EXPORTED_HR_SERVICE_TOKEN,
} from './constants/di';

export * from './constants/di';

/**
 * Registers the HR module's repository and services.
 *
 * @remarks
 * Employee creation flows through the user module's invitation pipeline
 * (service-to-service via `INVITATION_SERVICE_TOKEN`) and numbering flows
 * through the organization module's `CodeNumberService` — HR owns no auth
 * tables of its own (elysia-module rule 3.3).
 */
export function registerHr(container: DependencyContainer): void {
	container.register(EMPLOYEE_REPOSITORY_TOKEN, {
		useClass: EmployeeRepository,
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
	container.register(EXPORTED_HR_SERVICE_TOKEN, {
		useClass: ExportedHrService,
	});
}
