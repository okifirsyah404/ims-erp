import type { TEmployeeSelect } from '@drizzle/schemas/human-resource.schema';
import { businessDateOf } from '@utils/business-date.util';
import { inject, injectable } from 'tsyringe';
import { HR_PEOPLE_REPOSITORY_TOKEN } from '../constants/di';
import type { THrScope } from '../contracts/hr-records.contract';
import type { IHrPeopleRepository } from '../contracts/hr-records.repository.interface';
import { EmployeeStateError, HrNotFoundError } from '../errors/hr.errors';

export type TPersonRef = { id: string; employeeCode: string; fullName: string };

/** Jakarta business date of an ERP-0034 date column (unix ms at Jakarta midnight). */
const dayOf = (value: Date | null) => (value ? businessDateOf(value) : null);

/**
 * Whether the employee can have records on a business date: hired by then,
 * and active — or not active yet but the date is before the termination
 * date.
 */
export function worksOn(employee: TEmployeeSelect, date: string): boolean {
	const hired = dayOf(employee.hireDate);
	const ended = dayOf(employee.terminationDate);
	if (hired && hired > date) return false;
	if (employee.employmentStatus === 'active') return !ended || date < ended;
	return !!ended && date < ended;
}

export const personOf = (employee: TEmployeeSelect): TPersonRef => ({
	id: employee.id,
	employeeCode: employee.employeeCode,
	fullName: employee.fullName,
});

/**
 * The M08 view of ERP-0034 employees (M08 stage 1, rebuilt on main
 * 2026-11-12).
 *
 * @remarks
 * Employees are created and edited by ERP-0034 (`EmployeeService`). The M08
 * records reach them only through this service, which applies the same
 * visibility rule as the employee list: company-level employees and those of
 * the caller's active organization, or all for an application admin.
 */
@injectable()
export class HrPeopleService {
	constructor(@inject(HR_PEOPLE_REPOSITORY_TOKEN) private readonly repository: IHrPeopleRepository) {}

	async require(scope: THrScope, id: string): Promise<TEmployeeSelect> {
		const employee = await this.repository.findVisible(id, scope);
		if (!employee) throw new HrNotFoundError('employee');
		return employee;
	}

	/** Visible and employed today (new records need an active employee). */
	async requireActive(scope: THrScope, id: string): Promise<TEmployeeSelect> {
		const employee = await this.require(scope, id);
		if (employee.employmentStatus !== 'active') throw new EmployeeStateError('inactive');
		return employee;
	}

	listVisible(scope: THrScope): Promise<TEmployeeSelect[]> {
		return this.repository.listVisible(scope);
	}

	/** Active employees for the record forms' pickers. */
	async listActive(scope: THrScope): Promise<TPersonRef[]> {
		return (await this.repository.listVisible(scope)).filter((employee) => employee.employmentStatus === 'active').map(personOf);
	}

	findByCodes(scope: THrScope, codes: string[]): Promise<TEmployeeSelect[]> {
		return this.repository.findByCodes(codes, scope);
	}
}
