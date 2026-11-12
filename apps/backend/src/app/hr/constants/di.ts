/**
 * Injection tokens for the HR module.
 */
import type { InjectionToken } from 'tsyringe';
import type { IEmployeeRepository } from '../contracts/employee.repository.interface';
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
