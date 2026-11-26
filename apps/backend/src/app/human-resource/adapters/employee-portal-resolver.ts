import { inject, injectable } from 'tsyringe';
import type {
	IEmployeePortalResolver,
	TPortalEmployee,
	TPortalOrganization,
} from '@authorization/employee-portal-resolver';
import { EMPLOYEE_REPOSITORY_TOKEN } from '../constants/di';
import type { IEmployeeRepository } from '../contracts/employee.repository.interface';

/**
 * HR implementation of the employee-portal guard's lookup port.
 *
 * @remarks
 * Reads `hr.employees` only (its own schema). Organization names stay with the
 * organization module; the portal joins the ids it gets here with
 * `GET /organizations/mine`.
 */
@injectable()
export class EmployeePortalResolver implements IEmployeePortalResolver {
	constructor(
		@inject(EMPLOYEE_REPOSITORY_TOKEN)
		private readonly repository: IEmployeeRepository,
	) {}

	async findByUserAndOrganization(
		userId: string,
		organizationId: string,
	): Promise<TPortalEmployee | null> {
		const employee = await this.repository.findByUserAndOrganization(
			userId,
			organizationId,
		);
		if (!employee || !employee.organizationId) return null;
		return {
			id: employee.id,
			employeeCode: employee.employeeCode,
			fullName: employee.fullName,
			organizationId: employee.organizationId,
		};
	}

	async listOrganizationsForUser(userId: string): Promise<TPortalOrganization[]> {
		const rows = await this.repository.listByUserId(userId);
		return rows.flatMap((row) =>
			row.organizationId
				? [
						{
							organizationId: row.organizationId,
							employeeId: row.id,
							employeeCode: row.employeeCode,
							fullName: row.fullName,
						},
					]
				: [],
		);
	}
}
