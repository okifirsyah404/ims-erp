import { createFileRoute } from '@tanstack/react-router';

import { EmployeeList } from '@/components/hr/employee-list';
import {
	EMPLOYEE_SORT_FIELDS,
	EMPLOYMENT_STATUSES,
	EMPLOYMENT_TYPES,
	GENDERS,
	MARITAL_STATUSES,
	type TEmployeeSortField,
	type TEmploymentStatus,
	type TEmploymentType,
	type TGender,
	type TMaritalStatus,
	type TWorkType,
	WORK_TYPES,
} from '@/lib/hr-api';

/** Search params of the employee table (URL-backed filters and sort, like `/admin/users`). */
export type TEmployeesSearch = {
	page?: number;
	search?: string;
	status?: TEmploymentStatus;
	employmentType?: TEmploymentType;
	workType?: TWorkType;
	gender?: TGender;
	maritalStatus?: TMaritalStatus;
	scope?: 'organization' | 'company';
	login?: 'yes' | 'no';
	sortBy?: TEmployeeSortField;
	sortDir?: 'asc' | 'desc';
};

/** The value when it is one of `allowed`, otherwise `undefined` (a hand-edited URL never reaches the API). */
function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
	return allowed.includes(value as T) ? (value as T) : undefined;
}

/** `/hr/employees` — the employee table (ERP-0034, table + filters since the ERP-0117 review). */
export const Route = createFileRoute('/_authed/hr/employees/')({
	validateSearch: (search: Record<string, unknown>): TEmployeesSearch => ({
		page: search.page ? Number(search.page) || 1 : undefined,
		search: typeof search.search === 'string' && search.search ? search.search : undefined,
		status: oneOf(search.status, EMPLOYMENT_STATUSES),
		employmentType: oneOf(search.employmentType, EMPLOYMENT_TYPES),
		workType: oneOf(search.workType, WORK_TYPES),
		gender: oneOf(search.gender, GENDERS),
		maritalStatus: oneOf(search.maritalStatus, MARITAL_STATUSES),
		scope: oneOf(search.scope, ['organization', 'company'] as const),
		login: oneOf(search.login, ['yes', 'no'] as const),
		sortBy: oneOf(search.sortBy, EMPLOYEE_SORT_FIELDS),
		sortDir: oneOf(search.sortDir, ['asc', 'desc'] as const),
	}),
	component: EmployeeList,
});
