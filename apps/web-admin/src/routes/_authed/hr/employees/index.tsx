import { createFileRoute } from '@tanstack/react-router';

import { EmployeeList } from '@/components/hr/employee-list';

/** Search params for the employee list (URL-backed filters). */
type TEmployeesSearch = {
	page?: number;
	search?: string;
	status?: string;
};

/** `/hr/employees` — the employee list (ERP-0034). */
export const Route = createFileRoute('/_authed/hr/employees/')({
	validateSearch: (search: Record<string, unknown>): TEmployeesSearch => ({
		page: search.page ? Number(search.page) || 1 : undefined,
		search:
			typeof search.search === 'string' && search.search
				? search.search
				: undefined,
		status: typeof search.status === 'string' ? search.status : undefined,
	}),
	component: EmployeeList,
});
